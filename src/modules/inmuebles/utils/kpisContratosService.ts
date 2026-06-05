// REORG Contratos · Commit 3 · KPIs de la banda navy GESTIÓN (spec § 1.4 / § 2.2).
//
// Todos los KPIs se calculan en runtime sobre el estado EFECTIVO (por fechas),
// nunca sobre `estadoContrato`. Función pura + hook fino (más abajo en hooks/).

import type { Contract, Property } from '../../../services/db';
import {
  getEstadoEfectivo,
  diasHastaFin,
  calcularUnidadesArrendables,
} from './estadoEfectivoService';
import { esInquilinoIdentificado } from './inquilinoUtils';

export interface ContratosKPIs {
  vigentes: number;
  unidadesArrendables: number;
  ocupacion: number; // % entero
  rentaMensual: number;
  rentaAnual: number;
  venceProx30: {
    count: number;
    /** Nombre del primer inmueble afectado · 'sin vencimientos' si count 0. */
    firstName: string;
  };
}

/** Alias del inmueble por id · para el sub del KPI "Vencen 30 días". */
function aliasInmueble(properties: Property[], inmuebleId: number): string {
  const p = properties.find((x) => x.id === inmuebleId);
  return p?.alias ?? `#${inmuebleId}`;
}

export function calcularKpisContratos(
  contracts: Contract[],
  properties: Property[],
  hoy: Date = new Date(),
): ContratosKPIs {
  // FIX § 1.2 · el KPI "Vigentes" cuenta solo contratos con inquilino real (no
  // los placeholders AEAT sin identificar) · así la banda navy cuadra con el tab.
  const vigentes = contracts.filter(
    (c) => getEstadoEfectivo(c, hoy) === 'vigente' && esInquilinoIdentificado(c),
  );

  const unidadesArrendables = calcularUnidadesArrendables(properties);
  const ocupacion =
    unidadesArrendables > 0
      ? Math.round((vigentes.length / unidadesArrendables) * 100)
      : 0;

  const rentaMensual = vigentes.reduce((sum, c) => sum + (c.rentaMensual ?? 0), 0);
  const rentaAnual = rentaMensual * 12;

  const venceProx30 = vigentes
    .filter((c) => {
      const dias = diasHastaFin(c, hoy);
      return dias !== null && dias >= 0 && dias <= 30;
    })
    .sort((a, b) => (diasHastaFin(a, hoy) ?? 0) - (diasHastaFin(b, hoy) ?? 0));

  return {
    vigentes: vigentes.length,
    unidadesArrendables,
    ocupacion,
    rentaMensual,
    rentaAnual,
    venceProx30: {
      count: venceProx30.length,
      firstName:
        venceProx30.length > 0
          ? aliasInmueble(properties, venceProx30[0].inmuebleId)
          : 'sin vencimientos',
    },
  };
}
