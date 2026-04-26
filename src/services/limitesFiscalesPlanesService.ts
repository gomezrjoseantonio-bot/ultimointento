// src/services/limitesFiscalesPlanesService.ts
// TAREA 13: Límites fiscales para planes de pensiones (territorio común)

import { initDB } from './db';
import type {
  TipoAdministrativo,
  SubtipoPPE,
  SubtipoPPES,
  AportanteRol,
  LimitesFiscalesPlan,
  ResultadoValidacionAportacion,
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
const LIMITE_DISCAPACIDAD = 24_250;
const PORCENTAJE_RENDIMIENTOS = 0.30;

// Suppress unused variable warning for empresa-only limit constant
void LIMITE_PPE_EMPRESA;

export const limitesFiscalesPlanesService = {
  getLimitesPorTipo(tipoAdministrativo: TipoAdministrativo, subtipoPPE?: SubtipoPPE, subtipoPPES?: SubtipoPPES, discapacidad?: boolean): LimitesFiscalesPlan {
    if (discapacidad) {
      return {
        limiteEconomico: LIMITE_DISCAPACIDAD,
        limiteEfectivo: LIMITE_DISCAPACIDAD,
        descripcion: 'Partícipe con discapacidad ≥33% (art. 52.1.c LIRPF)',
      };
    }

    switch (tipoAdministrativo) {
      case 'PPI':
        return {
          limiteEconomico: LIMITE_PPI_PPA,
          limite30Rendimientos: PORCENTAJE_RENDIMIENTOS,
          limiteEfectivo: LIMITE_PPI_PPA,
          descripcion: 'Plan de pensiones individual — máx. 1.500 € / 30% rendimientos trabajo+actividades',
        };
      case 'PPA':
        return {
          limiteEconomico: LIMITE_PPI_PPA,
          limite30Rendimientos: PORCENTAJE_RENDIMIENTOS,
          limiteEfectivo: LIMITE_PPI_PPA,
          descripcion: 'Plan de previsión asegurado — máx. 1.500 € / 30% rendimientos',
        };
      case 'PPE':
        if (subtipoPPE === 'empleador_unico') {
          return {
            limiteEconomico: LIMITE_PPE_CONJUNTO,
            limite30Rendimientos: PORCENTAJE_RENDIMIENTOS,
            limiteEfectivo: LIMITE_PPE_CONJUNTO,
            descripcion: 'PPE empleador único — empresa: máx. 8.500 €; conjunto titular+empresa: máx. 10.000 €',
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
            descripcion: 'PPES autónomos — adicional 4.250 €; total con PPI/PPA: 5.750 €',
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

  async validarAportacionDeducible(
    planId: string,
    importe: number,
    ejercicio: number,
    rolAportante: AportanteRol,
  ): Promise<ResultadoValidacionAportacion> {
    const db = await initDB();
    const plan = (await db.get('planesPensiones' as any, planId as any)) as any;
    if (!plan) throw new Error(`Plan ${planId} no encontrado`);

    const limites = this.getLimitesPorTipo(
      plan.tipoAdministrativo,
      plan.subtipoPPE,
      plan.subtipoPPES,
      plan.partícipeConDiscapacidad,
    );

    const totales = await aportacionesPlanService.getTotalesPorAño(planId, ejercicio);
    const yaAportado = rolAportante === 'empresa' ? totales.empresa : (rolAportante === 'conyuge' ? totales.conyuge : totales.titular);
    const limiteAplicable = rolAportante === 'conyuge' ? LIMITE_CONYUGE : limites.limiteEfectivo;
    const totalConNueva = yaAportado + importe;
    const deducible = Math.min(totalConNueva, limiteAplicable);
    const exceso = Math.max(0, totalConNueva - limiteAplicable);

    return {
      deducible,
      exceso,
      limiteAplicable,
      totalAportado: totalConNueva,
    };
  },

  async calcularReduccionBaseImponible(personalDataId: number, ejercicio: number): Promise<number> {
    const db = await initDB();
    const planes = (await db.getAll('planesPensiones' as any)) as any[];
    const misPlanes = planes.filter((p: any) => p.personalDataId === personalDataId);

    let reduccionTotal = 0;
    for (const plan of misPlanes) {
      const totales = await aportacionesPlanService.getTotalesPorAño(plan.id, ejercicio);
      const limites = this.getLimitesPorTipo(
        plan.tipoAdministrativo,
        plan.subtipoPPE,
        plan.subtipoPPES,
        plan.partícipeConDiscapacidad,
      );
      reduccionTotal += Math.min(totales.total, limites.limiteEfectivo);
    }
    return reduccionTotal;
  },

  getCasillaAEAT(
    tipoAdministrativo: TipoAdministrativo,
    _subtipoPPE?: SubtipoPPE,
    _subtipoPPES?: SubtipoPPES,
    rolAportante?: AportanteRol,
  ): string {
    // TODO: verificar casillas exactas en modelo IRPF vigente
    if (rolAportante === 'conyuge') {
      return '0469'; // TODO casilla ~0469 aportaciones al plan del cónyuge (verificar en modelo IRPF)
    }
    switch (tipoAdministrativo) {
      case 'PPI':
        return '0470'; // TODO casilla ~0470 PPI titular (verificar en modelo IRPF)
      case 'PPA':
        return '0472'; // TODO casilla ~0472 PPA (verificar en modelo IRPF)
      case 'PPE':
        return rolAportante === 'empresa' ? '0471' : '0470'; // TODO casilla ~0471 empresa, ~0470 trabajador (verificar)
      case 'PPES':
        return '0474'; // TODO casilla ~0474 PPES (verificar en modelo IRPF)
      default:
        return '0470';
    }
  },
};
