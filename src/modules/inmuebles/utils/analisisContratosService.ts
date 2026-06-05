// REORG Contratos · Commit 7 · cálculos del tab Análisis (bloques 3 y 4).
//
// Todo runtime sobre estado EFECTIVO (fechas). Funciones puras y testables;
// el render vive en TabAnalisis.tsx.

import type { Contract, Property } from '../../../services/db';
import { getEstadoEfectivo } from './estadoEfectivoService';

export interface RankingInmueble {
  inmuebleId: number;
  alias: string;
  rentaAnual: number;
  /** % de unidades del inmueble ocupadas por contratos vigentes (0-100). */
  ocupacionPct: number;
}

/** Unidades arrendables de UN inmueble (piso completo = 1 · por hab = N). */
function unidadesDe(p: Property): number {
  const porHab = p.modoExplotacion === 'por_habitaciones' || p.modoExplotacion === 'mixto';
  return porHab ? Math.max(1, p.explotacion?.unidadesArrendables ?? p.bedrooms ?? 1) : 1;
}

/**
 * Bloque 3 · ranking de inmuebles por renta anual de sus contratos vigentes.
 * Ordena descendente por rentaAnual. Excluye inmuebles no activos.
 */
export function rankingPorInmueble(
  contracts: Contract[],
  properties: Property[],
  hoy?: Date,
): RankingInmueble[] {
  const vigentesPorInmueble = new Map<number, Contract[]>();
  for (const c of contracts) {
    if (getEstadoEfectivo(c, hoy) !== 'vigente') continue;
    const lista = vigentesPorInmueble.get(c.inmuebleId) ?? [];
    lista.push(c);
    vigentesPorInmueble.set(c.inmuebleId, lista);
  }

  const ranking: RankingInmueble[] = [];
  for (const p of properties) {
    if (p.id == null) continue;
    if (p.state && p.state !== 'activo') continue;
    const vigentes = vigentesPorInmueble.get(p.id) ?? [];
    const rentaAnual = vigentes.reduce((s, c) => s + (c.rentaMensual ?? 0) * 12, 0);
    const unidades = unidadesDe(p);
    const ocupacionPct = unidades > 0 ? Math.round((vigentes.length / unidades) * 100) : 0;
    ranking.push({
      inmuebleId: p.id,
      alias: p.alias ?? `#${p.id}`,
      rentaAnual,
      ocupacionPct: Math.min(100, ocupacionPct),
    });
  }

  return ranking.sort((a, b) => b.rentaAnual - a.rentaAnual);
}
