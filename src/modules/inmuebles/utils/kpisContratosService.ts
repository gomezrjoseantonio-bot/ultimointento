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
  /** Inmuebles activos de la cartera · para la línea-resumen de la cabecera. */
  inmueblesActivos: number;
  vigentes: number;
  unidadesArrendables: number;
  /** Unidades arrendables sin contrato vigente hoy (`arrendables - vigentes`). */
  unidadesLibres: number;
  ocupacion: number; // % entero
  rentaMensual: number;
  rentaAnual: number;
  venceProx30: {
    count: number;
    /** Nombre del primer inmueble afectado · 'sin vencimientos' si count 0. */
    firstName: string;
  };
}

/** Inmuebles activos de la cartera · misma regla de "activo" que las unidades
 *  arrendables (`state` ausente o `'activo'`). */
function contarInmueblesActivos(properties: Property[]): number {
  return properties.filter(
    (p) => p.id != null && !(p.state && p.state !== 'activo'),
  ).length;
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
  // los placeholders AEAT sin identificar).
  //
  // Además · un borrador (`estadoContrato === 'sin_firmar'`) NO es un
  // arrendamiento en vigor: no ocupa unidad ni genera renta garantizada. Por eso
  // se excluye de TODOS los KPIs operativos (ocupación, renta prevista, unidades
  // libres, vencimientos). Así un borrador a medias deja de inflar la ocupación
  // por encima del 100 %. El borrador sigue visible y accionable en el tab
  // Vigentes (con su chip "sin firmar"), pero no cuadra la banda navy.
  const vigentes = contracts.filter(
    (c) =>
      getEstadoEfectivo(c, hoy) === 'vigente' &&
      esInquilinoIdentificado(c) &&
      c.estadoContrato !== 'sin_firmar',
  );

  const unidadesArrendables = calcularUnidadesArrendables(properties);
  const unidadesLibres = Math.max(0, unidadesArrendables - vigentes.length);
  const inmueblesActivos = contarInmueblesActivos(properties);
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
    inmueblesActivos,
    vigentes: vigentes.length,
    unidadesArrendables,
    unidadesLibres,
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
