// ATLAS HORIZON: Simulador fiscal
// Nivel 3: Simulaciones what-if para optimización fiscal

import { calcularDeclaracionIRPF, DeclaracionIRPF, calcularCuotaPorTramos } from './irpfCalculationService';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export type TipoSimulacion =
  | 'venta_inversion'
  | 'aportacion_plan_pensiones'
  | 'cambio_renta_alquiler'
  | 'vaciar_inmueble'
  | 'alquilar_inmueble'
  | 'nuevo_ingreso_autonomo'
  | 'cambio_nomina'
  | 'compensar_minusvalias';

export interface TipFiscal {
  tipo: 'ahorro' | 'alerta' | 'oportunidad';
  mensaje: string;
}

export interface Simulacion {
  tipo: TipoSimulacion;
  parametros: Record<string, any>;
  resultadoBase: DeclaracionIRPF;
  resultadoSimulado: DeclaracionIRPF;
  diferencia: {
    cuotaLiquida: number;
    tipoEfectivoAntes: number;
    tipoEfectivoDespues: number;
    impactoNetoBolsillo: number;
  };
  tips: TipFiscal[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cloneDeclaracion(d: DeclaracionIRPF): DeclaracionIRPF {
  return JSON.parse(JSON.stringify(d));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const TRAMOS_BASE_GENERAL = [
  { hasta: 12450, tipo: 0.19 },
  { hasta: 20200, tipo: 0.24 },
  { hasta: 35200, tipo: 0.30 },
  { hasta: 60000, tipo: 0.37 },
  { hasta: 300000, tipo: 0.45 },
  { hasta: Infinity, tipo: 0.47 },
];

const TRAMOS_BASE_AHORRO = [
  { hasta: 6000, tipo: 0.19 },
  { hasta: 50000, tipo: 0.21 },
  { hasta: 200000, tipo: 0.23 },
  { hasta: 300000, tipo: 0.27 },
  { hasta: Infinity, tipo: 0.28 },
];

const MAX_APORTACION_PP = 1500;
const REDUCCION_HABITUAL = 0.60;

/**
 * Recalculate the liquidación of a cloned declaración after modifying base values.
 */
function recalcularLiquidacion(sim: DeclaracionIRPF): DeclaracionIRPF {
  const { baseGeneral, baseAhorro, reducciones, minimoPersonal } = sim;

  const baseImponibleGeneral = round2(Math.max(0, baseGeneral.total - reducciones.total));
  const baseImponibleAhorro = round2(Math.max(0, baseAhorro.total));

  const cuotaBaseGeneral = calcularCuotaPorTramos(baseImponibleGeneral, TRAMOS_BASE_GENERAL);
  const cuotaBaseAhorro = calcularCuotaPorTramos(baseImponibleAhorro, TRAMOS_BASE_AHORRO);
  const cuotaMinimosBaseGeneral = calcularCuotaPorTramos(
    Math.min(minimoPersonal.total, baseImponibleGeneral),
    TRAMOS_BASE_GENERAL
  );
  const cuotaIntegra = round2((cuotaBaseGeneral - cuotaMinimosBaseGeneral) + cuotaBaseAhorro);
  const deduccionesDobleImposicion = baseAhorro.capitalMobiliario.retenciones;
  const cuotaLiquida = round2(Math.max(0, cuotaIntegra - deduccionesDobleImposicion));

  sim.liquidacion = {
    baseImponibleGeneral,
    baseImponibleAhorro,
    cuotaBaseGeneral,
    cuotaBaseAhorro,
    cuotaMinimosBaseGeneral,
    cuotaIntegra,
    deduccionesDobleImposicion,
    cuotaLiquida,
  };

  sim.resultado = round2(cuotaLiquida - sim.retenciones.total);
  const totalBase = round2(baseImponibleGeneral + baseImponibleAhorro);
  sim.tipoEfectivo = totalBase > 0 ? round2((cuotaLiquida / totalBase) * 100) : 0;

  return sim;
}

/**
 * Determine which tax bracket a given income falls in.
 */
function tramoActual(base: number): number {
  const tramos = TRAMOS_BASE_GENERAL;
  let anterior = 0;
  for (const t of tramos) {
    if (base <= t.hasta) return t.tipo * 100;
    anterior = t.hasta;
  }
  return tramos[tramos.length - 1].tipo * 100;
}

// ─── Generador de tips ────────────────────────────────────────────────────────

function generarTips(base: DeclaracionIRPF, simulado: DeclaracionIRPF, tipo: TipoSimulacion): TipFiscal[] {
  const tips: TipFiscal[] = [];
  const ahorro = round2(base.liquidacion.cuotaLiquida - simulado.liquidacion.cuotaLiquida);

  if (ahorro > 0) {
    tips.push({ tipo: 'ahorro', mensaje: `Este cambio te ahorra ${ahorro.toFixed(2)} € en la declaración` });
  } else if (ahorro < 0) {
    tips.push({ tipo: 'alerta', mensaje: `Este cambio aumenta tu cuota en ${Math.abs(ahorro).toFixed(2)} €` });
  }

  // Plan pensiones margin
  const aportacionActual = base.reducciones.planPensiones;
  const margenPP = round2(MAX_APORTACION_PP - aportacionActual);
  if (margenPP > 0) {
    const ahorroEstimado = round2(margenPP * 0.30); // rough 30% estimate
    tips.push({
      tipo: 'oportunidad',
      mensaje: `Aún puedes aportar ${margenPP.toFixed(2)} € al plan de pensiones y ahorrarte hasta ${ahorroEstimado.toFixed(2)} €`,
    });
  }

  // Pending losses
  const minusvaliasPendientes = base.baseAhorro.gananciasYPerdidas.minusvaliasPendientes;
  if (minusvaliasPendientes > 0) {
    tips.push({
      tipo: 'alerta',
      mensaje: `Tienes ${minusvaliasPendientes.toFixed(2)} € en minusvalías pendientes de compensar`,
    });
  }

  // Tax bracket change
  const tramoAntes = tramoActual(base.liquidacion.baseImponibleGeneral);
  const tramoDespues = tramoActual(simulado.liquidacion.baseImponibleGeneral);
  if (tramoDespues > tramoAntes) {
    tips.push({ tipo: 'alerta', mensaje: `Este cambio te mueve al tramo del ${tramoDespues}%` });
  } else if (tramoDespues < tramoAntes) {
    tips.push({ tipo: 'ahorro', mensaje: `Este cambio te baja al tramo del ${tramoDespues}%` });
  }

  return tips;
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function ejecutarSimulacion(
  ejercicio: number,
  tipo: TipoSimulacion,
  parametros: Record<string, any>
): Promise<Simulacion> {
  const resultadoBase = await calcularDeclaracionIRPF(ejercicio);
  const sim = cloneDeclaracion(resultadoBase);

  switch (tipo) {
    case 'venta_inversion': {
      // Add plusvalía to base ahorro
      const ganancia = round2((parametros.importeVenta ?? 0) - (parametros.costeAdquisicion ?? 0));
      if (ganancia > 0) {
        sim.baseAhorro.gananciasYPerdidas.plusvalias = round2(
          sim.baseAhorro.gananciasYPerdidas.plusvalias + ganancia
        );
        sim.baseAhorro.gananciasYPerdidas.compensado = round2(
          Math.max(0, sim.baseAhorro.gananciasYPerdidas.plusvalias - sim.baseAhorro.gananciasYPerdidas.minusvalias)
        );
      } else {
        sim.baseAhorro.gananciasYPerdidas.minusvalias = round2(
          sim.baseAhorro.gananciasYPerdidas.minusvalias + Math.abs(ganancia)
        );
        sim.baseAhorro.gananciasYPerdidas.compensado = round2(
          Math.max(0, sim.baseAhorro.gananciasYPerdidas.plusvalias - sim.baseAhorro.gananciasYPerdidas.minusvalias)
        );
      }
      sim.baseAhorro.total = round2(
        sim.baseAhorro.capitalMobiliario.total + sim.baseAhorro.gananciasYPerdidas.compensado
      );
      break;
    }

    case 'aportacion_plan_pensiones': {
      const extra = round2(Math.min(
        parametros.aportacion ?? 0,
        MAX_APORTACION_PP - sim.reducciones.planPensiones
      ));
      sim.reducciones.planPensiones = round2(sim.reducciones.planPensiones + extra);
      sim.reducciones.total = sim.reducciones.planPensiones;
      break;
    }

    case 'cambio_renta_alquiler': {
      const idx = sim.baseGeneral.rendimientosInmuebles.findIndex(
        i => i.inmuebleId === parametros.inmuebleId
      );
      if (idx >= 0) {
        const inmueble = sim.baseGeneral.rendimientosInmuebles[idx];
        const ingresosPrevios = inmueble.ingresosIntegros;
        const meses = parametros.mesesRestantes ?? 12;
        const nuevosIngresos = round2((parametros.rentaNueva ?? 0) * meses);
        const delta = nuevosIngresos - ingresosPrevios;
        const rendBruto = round2(inmueble.ingresosIntegros + delta - inmueble.gastosDeducibles - inmueble.amortizacion);
        const reduccion = inmueble.esHabitual ? round2(rendBruto * REDUCCION_HABITUAL) : 0;
        inmueble.ingresosIntegros = round2(inmueble.ingresosIntegros + delta);
        inmueble.reduccionHabitual = reduccion;
        inmueble.rendimientoNeto = round2(rendBruto - reduccion);
        sim.baseGeneral.rendimientosInmuebles[idx] = inmueble;
        sim.baseGeneral.total = round2(
          (sim.baseGeneral.rendimientosTrabajo?.rendimientoNeto ?? 0) +
          (sim.baseGeneral.rendimientosAutonomo?.rendimientoNeto ?? 0) +
          sim.baseGeneral.rendimientosInmuebles.reduce((s, i) => s + i.rendimientoNeto, 0) +
          sim.baseGeneral.imputacionRentas.reduce((s, i) => s + i.imputacion, 0)
        );
      }
      break;
    }

    case 'vaciar_inmueble': {
      const idx = sim.baseGeneral.rendimientosInmuebles.findIndex(
        i => i.inmuebleId === parametros.inmuebleId
      );
      if (idx >= 0) {
        const inmueble = sim.baseGeneral.rendimientosInmuebles[idx];
        // Remove from rented
        sim.baseGeneral.rendimientosInmuebles.splice(idx, 1);
        // Add imputación
        const mesesVacio = parametros.mesesVacio ?? 12;
        const imputacion = round2(100000 * 0.02 * (mesesVacio * 30 / 365));
        sim.baseGeneral.imputacionRentas.push({
          inmuebleId: inmueble.inmuebleId,
          alias: inmueble.alias,
          valorCatastral: 100000, // Placeholder
          porcentajeImputacion: 0.02,
          diasVacio: mesesVacio * 30,
          imputacion,
        });
        sim.baseGeneral.total = round2(
          (sim.baseGeneral.rendimientosTrabajo?.rendimientoNeto ?? 0) +
          (sim.baseGeneral.rendimientosAutonomo?.rendimientoNeto ?? 0) +
          sim.baseGeneral.rendimientosInmuebles.reduce((s, i) => s + i.rendimientoNeto, 0) +
          sim.baseGeneral.imputacionRentas.reduce((s, i) => s + i.imputacion, 0)
        );
      }
      break;
    }

    case 'alquilar_inmueble': {
      // Remove imputación for the inmueble, add rental income
      const idxImp = sim.baseGeneral.imputacionRentas.findIndex(
        i => i.inmuebleId === parametros.inmuebleId
      );
      const imputacion = idxImp >= 0 ? sim.baseGeneral.imputacionRentas[idxImp] : null;
      if (idxImp >= 0) sim.baseGeneral.imputacionRentas.splice(idxImp, 1);

      const meses = parametros.mesesAlquiler ?? 12;
      const ingresos = round2((parametros.rentaEstimada ?? 0) * meses);
      const rendBruto = ingresos; // No expenses known for simulation
      const reduccion = 0; // Unknown modality
      sim.baseGeneral.rendimientosInmuebles.push({
        inmuebleId: parametros.inmuebleId,
        alias: imputacion?.alias ?? `Inmueble ${parametros.inmuebleId}`,
        ingresosIntegros: ingresos,
        gastosDeducibles: 0,
        amortizacion: 0,
        reduccionHabitual: reduccion,
        rendimientoNeto: round2(rendBruto - reduccion),
        esHabitual: false,
      });
      sim.baseGeneral.total = round2(
        (sim.baseGeneral.rendimientosTrabajo?.rendimientoNeto ?? 0) +
        (sim.baseGeneral.rendimientosAutonomo?.rendimientoNeto ?? 0) +
        sim.baseGeneral.rendimientosInmuebles.reduce((s, i) => s + i.rendimientoNeto, 0) +
        sim.baseGeneral.imputacionRentas.reduce((s, i) => s + i.imputacion, 0)
      );
      break;
    }

    case 'nuevo_ingreso_autonomo': {
      const extra = round2(parametros.importeExtra ?? 0);
      if (sim.baseGeneral.rendimientosAutonomo) {
        sim.baseGeneral.rendimientosAutonomo.ingresos = round2(
          sim.baseGeneral.rendimientosAutonomo.ingresos + extra
        );
        sim.baseGeneral.rendimientosAutonomo.rendimientoNeto = round2(
          sim.baseGeneral.rendimientosAutonomo.rendimientoNeto + extra
        );
      } else {
        sim.baseGeneral.rendimientosAutonomo = {
          ingresos: extra,
          gastos: 0,
          cuotaSS: 0,
          rendimientoNeto: extra,
          pagosFraccionadosM130: round2(extra * 0.20),
        };
      }
      sim.baseGeneral.total = round2(sim.baseGeneral.total + extra);
      break;
    }

    case 'cambio_nomina': {
      const nuevoSalario = round2(parametros.nuevoSalarioBruto ?? 0);
      if (sim.baseGeneral.rendimientosTrabajo) {
        const antiguo = sim.baseGeneral.rendimientosTrabajo;
        const cotizacionSS = round2(nuevoSalario * 0.0635);
        const gastos = 2000;
        const nuevoNeto = round2(nuevoSalario - cotizacionSS - gastos);
        const delta = nuevoNeto - antiguo.rendimientoNeto;
        sim.baseGeneral.rendimientosTrabajo = {
          salarioBrutoAnual: nuevoSalario,
          cotizacionSS,
          irpfRetenido: antiguo.irpfRetenido, // keep original retention (simplification)
          rendimientoNeto: nuevoNeto,
        };
        sim.baseGeneral.total = round2(sim.baseGeneral.total + delta);
      }
      break;
    }

    case 'compensar_minusvalias': {
      const ganancia = round2(parametros.importeGanancia ?? 0);
      const minusvaliasPend = round2(sim.baseAhorro.gananciasYPerdidas.minusvaliasPendientes);
      const compensacion = round2(Math.min(ganancia, minusvaliasPend));
      sim.baseAhorro.gananciasYPerdidas.plusvalias = round2(
        sim.baseAhorro.gananciasYPerdidas.plusvalias + ganancia
      );
      sim.baseAhorro.gananciasYPerdidas.minusvalias = round2(
        sim.baseAhorro.gananciasYPerdidas.minusvalias + compensacion
      );
      sim.baseAhorro.gananciasYPerdidas.minusvaliasPendientes = round2(minusvaliasPend - compensacion);
      sim.baseAhorro.gananciasYPerdidas.compensado = round2(
        Math.max(0, sim.baseAhorro.gananciasYPerdidas.plusvalias - sim.baseAhorro.gananciasYPerdidas.minusvalias)
      );
      sim.baseAhorro.total = round2(
        sim.baseAhorro.capitalMobiliario.total + sim.baseAhorro.gananciasYPerdidas.compensado
      );
      break;
    }
  }

  const resultadoSimulado = recalcularLiquidacion(sim);
  const tips = generarTips(resultadoBase, resultadoSimulado, tipo);

  return {
    tipo,
    parametros,
    resultadoBase,
    resultadoSimulado,
    diferencia: {
      cuotaLiquida: round2(resultadoSimulado.liquidacion.cuotaLiquida - resultadoBase.liquidacion.cuotaLiquida),
      tipoEfectivoAntes: resultadoBase.tipoEfectivo,
      tipoEfectivoDespues: resultadoSimulado.tipoEfectivo,
      impactoNetoBolsillo: round2(resultadoBase.resultado - resultadoSimulado.resultado),
    },
    tips,
  };
}
