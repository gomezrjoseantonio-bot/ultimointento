// REORG Contratos · Commit 7 · cálculos del tab Análisis (bloques 3 y 4).
//
// Todo runtime sobre estado EFECTIVO (fechas). Funciones puras y testables;
// el render vive en TabAnalisis.tsx.

import type { Contract, Property } from '../../../services/db';
import { getEstadoEfectivo, diasHastaFin } from './estadoEfectivoService';
import { calcularLibresAhora } from './calcularLibresAhora';

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

export type AlarmaTono = 'neg' | 'warn' | 'info' | 'ok';

export interface AlarmaContrato {
  id: string;
  tono: AlarmaTono;
  titulo: string;
  detalle: string;
}

/**
 * Bloque 4 · "4 cosas que requieren tu acción". Prioriza unidades libres >
 * vencimientos a 30 d > vencimientos 30-90 d > contratos por empezar. Si no
 * hay nada accionable, devuelve un único item "todo en orden".
 */
export function alarmasContratos(
  contracts: Contract[],
  properties: Property[],
  hoy: Date = new Date(),
): AlarmaContrato[] {
  const alarmas: AlarmaContrato[] = [];

  const libres = calcularLibresAhora(contracts, properties, hoy);
  if (libres.total > 0) {
    const nombres = libres.unidades.slice(0, 2).map((u) => u.inmuebleAlias).join(' · ');
    alarmas.push({
      id: 'libres',
      tono: 'neg',
      titulo: `${libres.total} ${libres.total === 1 ? 'unidad libre' : 'unidades libres'} ahora`,
      detalle: nombres || 'Revisa disponibilidad y publica los anuncios.',
    });
  }

  const vigentes = contracts.filter((c) => getEstadoEfectivo(c, hoy) === 'vigente');
  const vence30 = vigentes.filter((c) => {
    const d = diasHastaFin(c, hoy);
    return d !== null && d >= 0 && d <= 30;
  });
  if (vence30.length > 0) {
    alarmas.push({
      id: 'vence30',
      tono: 'warn',
      titulo: `${vence30.length} ${vence30.length === 1 ? 'contrato vence' : 'contratos vencen'} en 30 días`,
      detalle: 'Decide renovación o salida antes de que termine el plazo.',
    });
  }

  const vence3090 = vigentes.filter((c) => {
    const d = diasHastaFin(c, hoy);
    return d !== null && d > 30 && d <= 90;
  });
  if (vence3090.length > 0) {
    alarmas.push({
      id: 'vence3090',
      tono: 'info',
      titulo: `${vence3090.length} ${vence3090.length === 1 ? 'contrato vence' : 'contratos vencen'} en 30-90 días`,
      detalle: 'A planificar con margen.',
    });
  }

  const proximos = contracts.filter((c) => getEstadoEfectivo(c, hoy) === 'proximo');
  if (proximos.length > 0) {
    alarmas.push({
      id: 'proximos',
      tono: 'info',
      titulo: `${proximos.length} ${proximos.length === 1 ? 'contrato' : 'contratos'} por empezar`,
      detalle: 'Prepara entrada de inquilino y firma pendiente.',
    });
  }

  if (alarmas.length === 0) {
    alarmas.push({
      id: 'ok',
      tono: 'ok',
      titulo: 'Todo en orden',
      detalle: 'Sin unidades libres ni vencimientos próximos. Nada que requiera acción.',
    });
  }

  return alarmas.slice(0, 4);
}
