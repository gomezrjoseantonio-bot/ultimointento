// FIX § 1.6 bloque 4 · alarmas tempranas ACCIONABLES con cálculos correctos.
// Sustituye a la antigua "23 unidades libres ahora" (dato informativo, mal
// calculado). 4 tipos · máx 8 · orden vencimiento → vacío → sin firma → rotación.

import type { Contract, Property } from '../../../services/db';
import { getEstadoEfectivo, diasHastaFin } from './estadoEfectivoService';
import { esFechaIndefinida } from './formatFechaFin';
import { habitacionNumeroDe } from './timelineColores';
import { unidadesArrendablesInmueble } from './mapaTemporalService';
import { parseIsoDateAsUTC } from '../../../utils/recurrenceDateUtils';

export type AlarmaIcono = 'clock' | 'alert-triangle' | 'file-warning' | 'rotate-ccw';

export interface AlarmaAccionable {
  id: string;
  tipo: 'vencimiento' | 'vacio' | 'sin_firma' | 'rotacion';
  tono: 'warn' | 'neg';
  icono: AlarmaIcono;
  titulo: string;
  detalle: string;
  cta: string;
}

const MS_DIA = 1000 * 60 * 60 * 24;
const MAX_ALARMAS = 8;

const eur = (n: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const aliasDe = (props: Property[], inmuebleId: number): string =>
  props.find((p) => p.id === inmuebleId)?.alias ?? `#${inmuebleId}`;

const modoDe = (props: Property[], inmuebleId: number): Property['modoExplotacion'] =>
  props.find((p) => p.id === inmuebleId)?.modoExplotacion;

/** " · Hab N" cuando el inmueble es por habitaciones y el contrato la trae. */
const sufijoHab = (c: Contract, props: Property[]): string => {
  if (modoDe(props, c.inmuebleId) !== 'por_habitaciones') return '';
  const n = habitacionNumeroDe(c);
  return n != null ? ` · Hab ${n}` : '';
};

const nombreInquilino = (c: Contract): string =>
  `${c.inquilino?.nombre ?? ''} ${c.inquilino?.apellidos ?? ''}`.trim() || 'Inquilino';

const diasDesde = (fechaIso: string, hoy: Date): number | null => {
  if (!fechaIso || esFechaIndefinida(fechaIso)) return null;
  const t = parseIsoDateAsUTC(fechaIso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((hoy.getTime() - t) / MS_DIA);
};

const meses = (dias: number): number => Math.max(1, Math.round(dias / 30));

const claveUnidad = (c: Contract): string => `${c.inmuebleId}#${c.habitacionId ?? '-'}`;

/** Genera las alarmas accionables ordenadas y acotadas a 8. */
export function generarAlarmas(
  contracts: Contract[],
  properties: Property[],
  hoy: Date = new Date(),
): AlarmaAccionable[] {
  const vigentes = contracts.filter((c) => getEstadoEfectivo(c, hoy) === 'vigente');
  const proximos = contracts.filter((c) => getEstadoEfectivo(c, hoy) === 'proximo');

  const vencimientos: AlarmaAccionable[] = [];
  const vacios: AlarmaAccionable[] = [];
  const sinFirma: AlarmaAccionable[] = [];
  const rotacion: AlarmaAccionable[] = [];

  // ── 1 · Vencimientos sin renovación (0-30 días · sin próximo que solape) ──
  for (const c of vigentes) {
    const dias = diasHastaFin(c, hoy);
    if (dias == null || dias < 0 || dias > 30) continue;
    const cubierto = proximos.some(
      (p) => p.inmuebleId === c.inmuebleId && (p.habitacionId ?? '-') === (c.habitacionId ?? '-'),
    );
    if (cubierto) continue;
    vencimientos.push({
      id: `venc-${c.id}`,
      tipo: 'vencimiento',
      tono: 'warn',
      icono: 'clock',
      titulo: `${aliasDe(properties, c.inmuebleId)}${sufijoHab(c, properties)} · vence en ${dias} días`,
      detalle: `${nombreInquilino(c)} · sin renovación firmada · ${eur(c.rentaMensual ?? 0)}/mes en riesgo`,
      cta: 'Contactar inquilino',
    });
  }

  // ── 2 · Inmuebles vacíos > 3 meses (sin vigente · último fin > 90 días) ──
  for (const p of properties) {
    if (p.id == null || (p.state && p.state !== 'activo')) continue;
    const propios = contracts.filter((c) => c.inmuebleId === p.id);
    const vigentesInm = propios.filter((c) => getEstadoEfectivo(c, hoy) === 'vigente');
    if (vigentesInm.length >= unidadesArrendablesInmueble(p)) continue; // totalmente ocupado

    const finalizados = propios
      .filter((c) => getEstadoEfectivo(c, hoy) === 'finalizado')
      .filter((c) => !esFechaIndefinida(c.fechaFin))
      .sort((a, b) => (a.fechaFin < b.fechaFin ? 1 : -1));
    const ultimo = finalizados[0];
    const diasVacio = ultimo ? diasDesde(ultimo.fechaFin, hoy) : null;
    if (diasVacio == null || diasVacio <= 90) continue;

    const rentaRef = ultimo?.rentaMensual ?? 0;
    vacios.push({
      id: `vacio-${p.id}`,
      tipo: 'vacio',
      tono: diasVacio > 180 ? 'neg' : 'warn',
      icono: 'alert-triangle',
      titulo: `${p.alias ?? `#${p.id}`} · vacío hace ${meses(diasVacio)} meses`,
      detalle: `Sin contrato activo desde ${ultimo.fechaFin} · capacidad estimada ${eur(rentaRef)}/mes`,
      cta: 'Publicar anuncio',
    });
  }

  // ── 3 · Vigentes sin firmar > 2 meses (documentoFirmado false · inicio > 60d) ──
  for (const c of vigentes) {
    if (c.documentoFirmado !== false) continue;
    const dias = diasDesde(c.fechaInicio, hoy);
    if (dias == null || dias <= 60) continue;
    sinFirma.push({
      id: `firma-${c.id}`,
      tipo: 'sin_firma',
      tono: 'warn',
      icono: 'file-warning',
      titulo: `${aliasDe(properties, c.inmuebleId)}${sufijoHab(c, properties)} · sin firmar hace ${meses(dias)} meses`,
      detalle: `${nombreInquilino(c)} · ocupando · falta soporte documental`,
      cta: 'Pedir firma',
    });
  }

  // ── 4 · Rotación alta (misma unidad · 3+ contratos en 12 meses) ──
  const porUnidad = new Map<string, Contract[]>();
  for (const c of contracts) {
    const dias = diasDesde(c.fechaInicio, hoy);
    if (dias == null || dias > 365 || dias < 0) continue;
    const lista = porUnidad.get(claveUnidad(c)) ?? [];
    lista.push(c);
    porUnidad.set(claveUnidad(c), lista);
  }
  for (const [, lista] of porUnidad) {
    if (lista.length < 3) continue;
    const c = lista[0];
    rotacion.push({
      id: `rot-${claveUnidad(c)}`,
      tipo: 'rotacion',
      tono: 'warn',
      icono: 'rotate-ccw',
      titulo: `${aliasDe(properties, c.inmuebleId)}${sufijoHab(c, properties)} · rotación alta`,
      detalle: `${lista.length} inquilinos en 12 meses · considera revisar precio o condiciones`,
      cta: 'Ver histórico',
    });
  }

  return [...vencimientos, ...vacios, ...sinFirma, ...rotacion].slice(0, MAX_ALARMAS);
}
