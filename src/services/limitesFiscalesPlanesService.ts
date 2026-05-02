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
  PlanPensiones,
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
            // empresa puede aportar hasta LIMITE_PPE_EMPRESA; el conjunto título+empresa hasta LIMITE_PPE_CONJUNTO
            limiteEconomico: LIMITE_PPE_EMPRESA,
            limite30Rendimientos: PORCENTAJE_RENDIMIENTOS,
            limiteEfectivo: LIMITE_PPE_CONJUNTO,
            descripcion: `PPE empleador único — empresa: máx. ${LIMITE_PPE_EMPRESA} €; conjunto titular+empresa: máx. ${LIMITE_PPE_CONJUNTO} €`,
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
            descripcion: `PPES autónomos — adicional ${LIMITE_PPES_AUTONOMOS_ADICIONAL} €; total con PPI/PPA: ${LIMITE_PPES_AUTONOMOS_TOTAL} €`,
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
    if (rolAportante === 'empresa') {
      yaAportado = totales.empresa;
    } else if (rolAportante === 'conyuge') {
      yaAportado = totales.conyuge;
    } else {
      yaAportado = totales.titular;
    }
    // empresa: validar contra limiteEconomico (8.500€ en PPE empleador único)
    // conyuge: límite fijo 1.000€
    // titular: limiteEfectivo (conjunto titular+empresa para PPE)
    let limiteAplicable: number;
    if (rolAportante === 'empresa') {
      limiteAplicable = limites.limiteEconomico;
    } else if (rolAportante === 'conyuge') {
      limiteAplicable = LIMITE_CONYUGE;
    } else {
      limiteAplicable = limites.limiteEfectivo;
    }
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
    const planes = (await db.getAll('planesPensiones')) as PlanPensiones[];
    const misPlanes = planes.filter((p) => p.personalDataId === personalDataId);

    let reduccionTotal = 0;
    for (const plan of misPlanes) {
      const totales = await aportacionesPlanService.getTotalesPorAño(plan.id, ejercicio);
      const limites = this.getLimitesPorTipo(
        plan.tipoAdministrativo,
        plan.subtipoPPE,
        plan.subtipoPPES,
        plan.participeConDiscapacidad,
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
