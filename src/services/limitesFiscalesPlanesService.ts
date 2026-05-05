// src/services/limitesFiscalesPlanesService.ts
// TAREA 13 v4 · Commit 5 (G+H)
//
// Cálculo de límites fiscales y reducción de base imponible por aportaciones
// a planes de pensiones, alineado con §3 del spec:
//
//  · Constantes 2026 territorio común (PPI/PPA · PPE · PPES · cónyuge ·
//    discapacidad).
//  · Validación de aportación con doble tope: límite económico Y 30% de
//    rendimientos netos del trabajo + actividades económicas (art. 52.1 LIRPF).
//  · Cálculo de reducción rico con desglose por tipo, exceso arrastrable
//    (5 años · art. 52.2 LIRPF) y alertas.
//  · Validación cónyuge · si la base imponible del cónyuge aportante supera
//    8.000 € no puede usar el régimen del art. 51.7.

import { initDB } from './db';
import type {
  TipoAdministrativo,
  SubtipoPPE,
  SubtipoPPES,
  AportanteRol,
  LimitesFiscalesPlan,
  ResultadoValidacionDetallado,
  ResultadoReduccionBaseImponible,
  PlanPensiones,
  AportacionPlan,
} from '../types/planesPensiones';
import { aportacionesPlanService } from './aportacionesPlanService';

// ── Tabla de límites 2026 territorio común ───────────────────────────────────

const LIMITE_PPI_PPA = 1_500;
const LIMITE_PPE_EMPRESA = 8_500;
const LIMITE_PPE_CONJUNTO = 10_000;
const LIMITE_PPES_AUTONOMOS_ADICIONAL = 4_250;
const LIMITE_PPES_AUTONOMOS_TOTAL = 5_750;
const LIMITE_PPES_OTROS = 10_000;
const LIMITE_CONYUGE = 1_000;
const BASE_IMPONIBLE_MAX_CONYUGE = 8_000;
const LIMITE_DISCAPACIDAD = 24_250;
const PORCENTAJE_RENDIMIENTOS = 0.30;

/**
 * Calcula los rendimientos netos del trabajo + actividades económicas del
 * titular en el ejercicio dado · base sobre la que aplica el tope del 30 %.
 *
 * Aproximación pragmática (sin acceso a la declaración cerrada):
 *   - Nómina (`ingresos.tipo='nomina'`) · `salarioBrutoAnual` (descontaríamos
 *     SS si tuviéramos cálculo cerrado · usamos bruto como cota superior
 *     conservadora).
 *   - Pensión (`ingresos.tipo='pension'`) · `pensionBrutaAnual`.
 *   - Autónomo (`ingresos.tipo='autonomo'`) · suma de `ingresosFacturados`
 *     − suma de `gastosDeducibles` (rendimiento neto de la actividad).
 *
 * Esta cifra es una APROXIMACIÓN · cuando ATLAS tenga la declaración cerrada
 * del ejercicio podemos sustituirla por la casilla 0022 + casilla 0224 reales.
 */
async function getRendimientosNetosAprox(
  personalDataId: number,
  ejercicio: number,
): Promise<number> {
  const db = await initDB();
  const ingresos = (await db.getAll('ingresos')) as Array<Record<string, unknown>>;
  let total = 0;

  for (const ing of ingresos) {
    if (ing.personalDataId !== personalDataId) continue;
    const tipo = ing.tipo as string | undefined;
    if (tipo === 'nomina') {
      // El año de la nómina lo determinamos por `fechaAntiguedad` · si hay
      // cualquier mes de actividad en el ejercicio aplicamos el bruto anual.
      const fechaAntiguedad = ing.fechaAntiguedad as string | undefined;
      const activa = (ing.activa as boolean | undefined) ?? true;
      if (!activa) continue;
      const bruto = (ing.salarioBrutoAnual as number | undefined) ?? 0;
      // Heurística simple · si la nómina está activa o empezó en/antes del
      // ejercicio, suma. Pragmático para no bloquear si falta `fechaBaja`.
      if (!fechaAntiguedad || fechaAntiguedad.slice(0, 4) <= String(ejercicio)) {
        total += bruto;
      }
    } else if (tipo === 'pension') {
      const activa = (ing.activa as boolean | undefined) ?? true;
      if (activa) total += (ing.pensionBrutaAnual as number | undefined) ?? 0;
    } else if (tipo === 'autonomo') {
      const activo = (ing.activo as boolean | undefined) ?? true;
      if (!activo) continue;
      const ingresosFact = (ing.ingresosFacturados as Array<{ fecha?: string; importe?: number }>) ?? [];
      const gastos = (ing.gastosDeducibles as Array<{ fecha?: string; importe?: number; porcentajeDeducible?: number }>) ?? [];
      const ingresosEjercicio = ingresosFact
        .filter((i) => (i.fecha ?? '').slice(0, 4) === String(ejercicio))
        .reduce((s, i) => s + (i.importe ?? 0), 0);
      const gastosEjercicio = gastos
        .filter((g) => (g.fecha ?? '').slice(0, 4) === String(ejercicio))
        .reduce((s, g) => s + (g.importe ?? 0) * ((g.porcentajeDeducible ?? 100) / 100), 0);
      total += Math.max(0, ingresosEjercicio - gastosEjercicio);
    }
  }
  return total;
}

export const limitesFiscalesPlanesService = {
  getLimitesPorTipo(
    tipoAdministrativo: TipoAdministrativo,
    subtipoPPE?: SubtipoPPE,
    subtipoPPES?: SubtipoPPES,
    discapacidad?: boolean,
  ): LimitesFiscalesPlan {
    if (discapacidad) {
      return {
        limiteEconomico: LIMITE_DISCAPACIDAD,
        limiteEfectivo: LIMITE_DISCAPACIDAD,
        descripcion: 'Partícipe con discapacidad ≥33% (art. 52.1.c LIRPF) — límite 24.250 €',
      };
    }

    switch (tipoAdministrativo) {
      case 'PPI':
        return {
          limiteEconomico: LIMITE_PPI_PPA,
          limite30Rendimientos: PORCENTAJE_RENDIMIENTOS,
          limiteEfectivo: LIMITE_PPI_PPA,
          descripcion: 'Plan de pensiones individual — máx. 1.500 € · tope 30 % rendimientos del trabajo+actividades',
        };
      case 'PPA':
        return {
          limiteEconomico: LIMITE_PPI_PPA,
          limite30Rendimientos: PORCENTAJE_RENDIMIENTOS,
          limiteEfectivo: LIMITE_PPI_PPA,
          descripcion: 'Plan de previsión asegurado — máx. 1.500 € · tope 30 % rendimientos',
        };
      case 'PPE':
        if (subtipoPPE === 'empleador_unico') {
          return {
            limiteEconomico: LIMITE_PPE_EMPRESA,
            limite30Rendimientos: PORCENTAJE_RENDIMIENTOS,
            limiteEfectivo: LIMITE_PPE_CONJUNTO,
            descripcion: `PPE empleador único — empresa hasta ${LIMITE_PPE_EMPRESA} €; conjunto titular+empresa hasta ${LIMITE_PPE_CONJUNTO} €`,
          };
        }
        return {
          limiteEconomico: LIMITE_PPE_CONJUNTO,
          limite30Rendimientos: PORCENTAJE_RENDIMIENTOS,
          limiteEfectivo: LIMITE_PPE_CONJUNTO,
          descripcion: 'PPE promoción conjunta — máx. 10.000 € conjunto',
        };
      case 'PPES':
        if (subtipoPPES === 'autonomos') {
          return {
            limiteEconomico: LIMITE_PPES_AUTONOMOS_ADICIONAL,
            limite30Rendimientos: PORCENTAJE_RENDIMIENTOS,
            limiteEfectivo: LIMITE_PPES_AUTONOMOS_TOTAL,
            descripcion: `PPES autónomos — adicional ${LIMITE_PPES_AUTONOMOS_ADICIONAL} €; total con PPI/PPA hasta ${LIMITE_PPES_AUTONOMOS_TOTAL} €`,
          };
        }
        return {
          limiteEconomico: LIMITE_PPES_OTROS,
          limite30Rendimientos: PORCENTAJE_RENDIMIENTOS,
          limiteEfectivo: LIMITE_PPES_OTROS,
          descripcion: 'PPES sectorial/sector público/cooperativas — máx. 10.000 € conjunto',
        };
    }
  },

  /**
   * Validación detallada (TAREA 13 v4 · §3.2 spec).
   *
   * Aplica el doble tope: límite económico Y 30 % de rendimientos netos del
   * trabajo + actividades del titular. El menor de los dos es el efectivo.
   */
  async validarAportacionDeducible(
    planId: string,
    importe: number,
    ejercicio: number,
    rolAportante: AportanteRol,
  ): Promise<ResultadoValidacionDetallado> {
    const db = await initDB();
    const plan = (await db.get('planesPensiones', planId)) as PlanPensiones | undefined;
    if (!plan) throw new Error(`Plan ${planId} no encontrado`);

    const limites = this.getLimitesPorTipo(
      plan.tipoAdministrativo,
      plan.subtipoPPE,
      plan.subtipoPPES,
      plan.participeConDiscapacidad,
    );

    const totales = await aportacionesPlanService.getTotalesPorAño(planId, ejercicio);

    let yaAportado: number;
    let topeEconomico: number;

    if (rolAportante === 'empresa') {
      yaAportado = totales.empresa;
      topeEconomico = limites.limiteEconomico;
    } else if (rolAportante === 'conyuge') {
      yaAportado = totales.conyuge;
      topeEconomico = LIMITE_CONYUGE;
    } else {
      yaAportado = totales.titular;
      topeEconomico = limites.limiteEfectivo;
    }

    const totalConNueva = yaAportado + importe;

    // Tope 30% rendimientos · solo aplica al titular y al cónyuge (no a la
    // empresa promotora).
    let tope30: number | undefined;
    let limiteAplicable = topeEconomico;
    let motivo: string | undefined;

    if (rolAportante !== 'empresa' && plan.participeConDiscapacidad !== true) {
      const rendimientosNetos = await getRendimientosNetosAprox(
        plan.personalDataId,
        ejercicio,
      );
      tope30 = rendimientosNetos * PORCENTAJE_RENDIMIENTOS;
      if (tope30 < topeEconomico) {
        limiteAplicable = tope30;
        motivo = `Tope del 30 % de rendimientos netos (${rendimientosNetos.toFixed(0)} €) · ${tope30.toFixed(0)} € · más restrictivo que el tope económico ${topeEconomico} €`;
      } else {
        motivo = `Tope económico ${topeEconomico} € (30 % de rendimientos = ${tope30.toFixed(0)} €)`;
      }
    } else if (rolAportante === 'empresa') {
      motivo = `Tope económico empresa ${topeEconomico} €`;
    }

    const importeDeducible = Math.min(totalConNueva, limiteAplicable);
    const excesoNoDeducible = Math.max(0, totalConNueva - limiteAplicable);
    const esDeducible = excesoNoDeducible === 0 && importe > 0;

    return {
      esDeducible,
      importeDeducible,
      excesoNoDeducible,
      motivo,
      limiteAplicable,
      totalAportadoEjercicio: totalConNueva,
      tope30Rendimientos: tope30,
      topeEconomico,
    };
  },

  /**
   * Cálculo de reducción de base imponible (TAREA 13 v4 · §3.3 spec).
   *
   * Devuelve desglose por tipo, exceso arrastrable a 5 años (art. 52.2 LIRPF)
   * y alertas para el usuario.
   */
  async calcularReduccionBaseImponible(
    personalDataId: number,
    ejercicio: number,
  ): Promise<ResultadoReduccionBaseImponible> {
    const db = await initDB();
    const planes = (await db.getAll('planesPensiones')) as PlanPensiones[];
    const misPlanes = planes.filter((p) => p.personalDataId === personalDataId);

    const desglose = {
      PPI: 0,
      PPA: 0,
      PPE: 0,
      PPES_autonomos: 0,
      PPES_sectorial: 0,
      PPES_publico: 0,
      PPES_cooperativas: 0,
    };
    let totalAportadoTitular = 0;
    let totalAportadoEmpresa = 0;
    let totalAportadoConyuge = 0;
    const alertas: string[] = [];

    // Tope 30 % rendimientos · común a todos los planes del titular.
    const rendimientosNetos = await getRendimientosNetosAprox(personalDataId, ejercicio);
    const tope30 = rendimientosNetos * PORCENTAJE_RENDIMIENTOS;

    // Bucket de "aportado deducible bruto por tipo" antes de aplicar el tope
    // global · luego se prorratea si excede.
    let totalDeducibleBruto = 0;

    for (const plan of misPlanes) {
      const totales = await aportacionesPlanService.getTotalesPorAño(plan.id, ejercicio);
      const limites = this.getLimitesPorTipo(
        plan.tipoAdministrativo,
        plan.subtipoPPE,
        plan.subtipoPPES,
        plan.participeConDiscapacidad,
      );

      totalAportadoTitular += totales.titular;
      totalAportadoEmpresa += totales.empresa;
      totalAportadoConyuge += totales.conyuge;

      // Para empresa: tope independiente (8.500 € en PPE empleador único)
      const aplicableEmpresa = Math.min(totales.empresa, limites.limiteEconomico);
      const aplicableTitular = Math.min(totales.titular, limites.limiteEfectivo);
      const aplicableTotalPlan = aplicableTitular + aplicableEmpresa;

      // Atribución al desglose por tipo
      switch (plan.tipoAdministrativo) {
        case 'PPI':
          desglose.PPI += aplicableTotalPlan;
          break;
        case 'PPA':
          desglose.PPA += aplicableTotalPlan;
          break;
        case 'PPE':
          desglose.PPE += aplicableTotalPlan;
          break;
        case 'PPES':
          if (plan.subtipoPPES === 'autonomos') desglose.PPES_autonomos += aplicableTotalPlan;
          else if (plan.subtipoPPES === 'sectorial') desglose.PPES_sectorial += aplicableTotalPlan;
          else if (plan.subtipoPPES === 'sector_publico') desglose.PPES_publico += aplicableTotalPlan;
          else if (plan.subtipoPPES === 'cooperativas') desglose.PPES_cooperativas += aplicableTotalPlan;
          else desglose.PPES_sectorial += aplicableTotalPlan;
          break;
      }
      totalDeducibleBruto += aplicableTotalPlan;

      if (totales.titular > limites.limiteEfectivo) {
        alertas.push(
          `Plan ${plan.nombre} · titular aportó ${totales.titular.toFixed(0)} € · supera el tope ${limites.limiteEfectivo} € · exceso ${(totales.titular - limites.limiteEfectivo).toFixed(0)} €.`,
        );
      }
      if (totales.empresa > limites.limiteEconomico) {
        alertas.push(
          `Plan ${plan.nombre} · empresa aportó ${totales.empresa.toFixed(0)} € · supera el tope ${limites.limiteEconomico} € · exceso ${(totales.empresa - limites.limiteEconomico).toFixed(0)} €.`,
        );
      }
    }

    // Aplicar tope 30 % rendimientos sobre la suma deducible (afecta solo a
    // las aportaciones que reducen la base · no a las que ya están filtradas
    // por límite económico individual).
    let totalDeducibleAplicado = totalDeducibleBruto;
    if (rendimientosNetos > 0 && totalDeducibleBruto > tope30) {
      totalDeducibleAplicado = tope30;
      alertas.push(
        `Tope del 30 % de rendimientos netos · ${tope30.toFixed(0)} € · limita la reducción agregada de los planes del titular (rendimientos = ${rendimientosNetos.toFixed(0)} €).`,
      );
    }

    const totalAportado =
      totalAportadoTitular + totalAportadoEmpresa + totalAportadoConyuge;
    const excesoArrastrable = Math.max(0, totalAportado - totalDeducibleAplicado);
    if (excesoArrastrable > 0) {
      alertas.push(
        `Quedan ${excesoArrastrable.toFixed(0)} € pendientes de deducción · arrastrables 5 ejercicios siguientes (art. 52.2 LIRPF).`,
      );
    }

    return {
      totalAportadoTitular,
      totalAportadoEmpresa,
      totalAportadoConyuge,
      desgloseDeduciblesPorTipo: desglose,
      totalDeducibleAplicado,
      excesoArrastrable,
      alertas,
    };
  },

  /**
   * Validación específica del régimen "aportación a favor del cónyuge" (art.
   * 51.7 LIRPF · §3.1 spec). Si el cónyuge aportante (= el receptor del
   * traslado de tributación) tiene base imponible ≥ 8.000 €, no aplica.
   *
   * `baseImponibleConyugeAportante` debe venir del último cierre fiscal o
   * estimación del ejercicio en curso.
   */
  validarAportacionConyuge(
    importe: number,
    baseImponibleConyugeAportante: number,
  ): { esValido: boolean; motivo?: string; limite: number } {
    if (baseImponibleConyugeAportante > BASE_IMPONIBLE_MAX_CONYUGE) {
      return {
        esValido: false,
        limite: LIMITE_CONYUGE,
        motivo: `Base imponible del cónyuge ${baseImponibleConyugeAportante.toFixed(0)} € · supera 8.000 € · no procede aportación deducible a su favor (art. 51.7 LIRPF).`,
      };
    }
    if (importe > LIMITE_CONYUGE) {
      return {
        esValido: false,
        limite: LIMITE_CONYUGE,
        motivo: `Aportación ${importe.toFixed(0)} € · supera el tope cónyuge 1.000 €/año.`,
      };
    }
    return { esValido: true, limite: LIMITE_CONYUGE };
  },

  getCasillaAEAT(
    tipoAdministrativo: TipoAdministrativo,
    _subtipoPPE?: SubtipoPPE,
    _subtipoPPES?: SubtipoPPES,
    rolAportante?: AportanteRol,
  ): string {
    // TODO · verificar casillas exactas en modelo IRPF 2026 vigente. Mapping
    // basado en modelo 2025 · si AEAT publica cambios, actualizar.
    if (rolAportante === 'conyuge') {
      return '0469';
    }
    switch (tipoAdministrativo) {
      case 'PPI':
        return '0470';
      case 'PPA':
        return '0472';
      case 'PPE':
        return rolAportante === 'empresa' ? '0471' : '0470';
      case 'PPES':
        return '0474';
      default:
        return '0470';
    }
  },
};

// Exportamos el helper para poder testearlo aislado.
export const _internalHelpers = {
  getRendimientosNetosAprox,
};

// Anti-warning · evitar que TS marque AportacionPlan como import no usado en
// algunos modos estrictos (lo necesitamos por tipo encadenado).
type _Unused = AportacionPlan;
const _unused: _Unused | undefined = undefined;
void _unused;
