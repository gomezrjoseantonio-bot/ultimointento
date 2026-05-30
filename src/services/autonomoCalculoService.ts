// ============================================================================
// autonomoCalculoService · ÚNICA FUENTE DE VERDAD para cifras de autónomo
// ============================================================================
//
// FIX consolidar módulo Personal · función única de cálculo (decisión F7).
//
// Antes de esta tarea convivían TRES motores de cálculo de autónomo con
// definiciones distintas de "neto":
//   1. `autonomoService.getMonthlyDistribution` · ingresos − gastos − cuotaRETA
//      (NO descontaba retención IRPF) · usado por cards/panel/presupuesto.
//   2. `autonomoService.calculateEstimatedAnnualForAutonomos` · facturación −
//      gastos (NI cuota NI IRPF) · usado por el dashboard Horizon.
//   3. preview inline del wizard · ingreso − retenciónIRPF − cuotaRETA (NO
//      descontaba gastos).
//
// Este service define el neto líquido COMPLETO que llega a la cuenta:
//   neto = ingresos − cuotaRETA − gastosDeducibles − retenciónIRPF
//
// REGLA ESTRICTA · toda vista que muestre el importe mensual/anual de un
// autónomo DEBE llamar a estas funciones. NO duplicar lógica en componentes.
//
// Funciones puras · sin side effects · sin acceso a IndexedDB/stores.
// ============================================================================

import type { Autonomo } from '../types/personal';

export interface NetoMesAutonomoDesglose {
  ingresoMes: number;
  cuotaRETA: number;
  gastosDeducibles: number;
  retencionIRPF: number;
}

export interface NetoMesAutonomoResult {
  netoMes: number;
  desglose: NetoMesAutonomoDesglose;
}

export interface NetoAnualAutonomoResult {
  netoAnual: number;
  ingresosAnuales: number;
  totalRETA: number;
  totalGastos: number;
  totalRetencion: number;
  porMes: Array<{ mes: number; neto: number }>;
}

/** Un concepto con `meses` aplica en `mes` si no tiene lista o la incluye. */
function aplicaEnMes(meses: number[] | undefined, mes: number): boolean {
  return !Array.isArray(meses) || meses.length === 0 || meses.includes(mes);
}

/**
 * Ingreso facturado del histórico (`ingresosFacturados`) que cae en el mes.
 * Acepta fecha ISO 'YYYY-MM-DD' o 'YYYY-MM'. Sólo se usa como fallback cuando
 * el autónomo no tiene `fuentesIngreso` (autónomos legacy).
 */
function ingresoFacturadoEnMes(autonomo: Autonomo, mes: number): number {
  return (autonomo.ingresosFacturados ?? []).reduce((sum, i) => {
    if (!i.fecha) return sum;
    const mesFecha = parseInt(i.fecha.slice(5, 7), 10);
    return mesFecha === mes ? sum + (i.importe ?? 0) : sum;
  }, 0);
}

/**
 * Devuelve el neto que llega a la cuenta del titular en un mes concreto.
 *
 * ÚNICA FUENTE DE VERDAD para el importe mensual de autónomo.
 *   neto = ingresos − cuotaRETA − gastosDeducibles − retenciónIRPF
 *
 * La cuota RETA se imputa todos los meses (la SS de autónomos no descansa).
 * La retención IRPF sólo se aplica a las fuentes con `aplIrpf` activo, usando
 * el `irpfRetencionPorcentaje` de la actividad.
 *
 * @param mes 1-12
 */
export function calcularNetoMesAutonomo(
  autonomo: Autonomo,
  mes: number,
  _año: number,
): NetoMesAutonomoResult {
  const zero: NetoMesAutonomoResult = {
    netoMes: 0,
    desglose: { ingresoMes: 0, cuotaRETA: 0, gastosDeducibles: 0, retencionIRPF: 0 },
  };
  if (mes < 1 || mes > 12) return zero;

  const irpfPct = (autonomo.irpfRetencionPorcentaje ?? 0) / 100;
  const fuentes = autonomo.fuentesIngreso ?? [];

  let ingresoMes = 0;
  let retencionIRPF = 0;

  if (fuentes.length > 0) {
    for (const f of fuentes) {
      if (!aplicaEnMes(f.meses, mes)) continue;
      const importe = f.importeEstimado ?? 0;
      ingresoMes += importe;
      // `aplIrpf` indica si el cliente retiene IRPF sobre esta fuente.
      if (f.aplIrpf) retencionIRPF += importe * irpfPct;
    }
  } else {
    // Fallback legacy · histórico de facturas del mes.
    ingresoMes = ingresoFacturadoEnMes(autonomo, mes);
    retencionIRPF = ingresoMes * irpfPct;
  }

  const gastosDeducibles = (autonomo.gastosRecurrentesActividad ?? []).reduce(
    (sum, g) => (aplicaEnMes(g.meses, mes) ? sum + (g.importe ?? 0) : sum),
    0,
  );

  const cuotaRETA = autonomo.cuotaAutonomos ?? 0;

  const netoMes = ingresoMes - cuotaRETA - gastosDeducibles - retencionIRPF;

  return {
    netoMes,
    desglose: { ingresoMes, cuotaRETA, gastosDeducibles, retencionIRPF },
  };
}

/**
 * Devuelve el neto anual sumando los 12 meses reales calculados por
 * `calcularNetoMesAutonomo`. Única fuente de verdad para el "Neto anual".
 */
export function calcularNetoAnualAutonomo(
  autonomo: Autonomo,
  año: number,
): NetoAnualAutonomoResult {
  let netoAnual = 0;
  let ingresosAnuales = 0;
  let totalRETA = 0;
  let totalGastos = 0;
  let totalRetencion = 0;
  const porMes: Array<{ mes: number; neto: number }> = [];

  for (let mes = 1; mes <= 12; mes++) {
    const { netoMes, desglose } = calcularNetoMesAutonomo(autonomo, mes, año);
    netoAnual += netoMes;
    ingresosAnuales += desglose.ingresoMes;
    totalRETA += desglose.cuotaRETA;
    totalGastos += desglose.gastosDeducibles;
    totalRetencion += desglose.retencionIRPF;
    porMes.push({ mes, neto: netoMes });
  }

  return { netoAnual, ingresosAnuales, totalRETA, totalGastos, totalRetencion, porMes };
}
