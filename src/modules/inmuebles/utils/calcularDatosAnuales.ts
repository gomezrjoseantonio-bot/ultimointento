import type { Contract, Property } from '../../../services/db';
import { esFechaIndefinida } from './formatFechaFin';
import { parseIsoDateAsUTC } from '../../../utils/recurrenceDateUtils';
import { getInquilinoNombre } from './inquilinoUtils';

/**
 * T7 · Análisis anual de ocupación. Cálculo de solo lectura (no muta datos)
 * de la ocupación día a día de la cartera durante un año natural completo.
 */

export const OBJETIVO_OCUPACION_DEFAULT = 0.92;

export const NOMBRES_MES_CORTO = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

export type ClaseOcupacion = 'n' | 'o0' | 'o60' | 'o70' | 'o80' | 'o90' | 'o100';

export interface CeldaHeatmap {
  dia: number;
  existe: boolean;
  ocupacion: number; // 0-1 · -1 si el día no existe (ej. 30-feb)
  clase: ClaseOcupacion;
  esHoy: boolean;
  tooltip: string;
}

export interface MesHeatmap {
  numero: number; // 1-12
  diasEnMes: number; // 28-31
  celdas: CeldaHeatmap[]; // 31 celdas · las que excedan diasEnMes son 'n'
}

export interface DatosAnuales {
  ano: number;
  ocupacionMedia: number; // 0-1
  objetivo: number; // 0-1
  diasVaciosProyectados: number; // suma ponderada de (1 - ocupación) por día
  ingresosPerdidosProyectados: number; // €
  meses: MesHeatmap[];
}

/** Una propiedad es alquilable si está operativa (no vendida ni de baja). */
export function esPropiedadAlquilable(p: Property): boolean {
  return p.id != null && p.state === 'activo';
}

/** Unidades arrendables de una propiedad · habitaciones si se alquila por cuartos, 1 si es vivienda completa. */
function unidadesArrendables(p: Property): number {
  if (p.alquilerPorHabitaciones?.activo) {
    return p.alquilerPorHabitaciones.numeroHabitaciones ?? p.bedrooms ?? 1;
  }
  return 1;
}

/** Fin efectivo del contrato en ms UTC · null si es indefinido. */
function finEfectivoMs(c: Contract): number | null {
  if (c.estadoContrato === 'rescindido' && c.rescision?.fecha) {
    return parseIsoDateAsUTC(c.rescision.fecha).getTime();
  }
  if (esFechaIndefinida(c.fechaFin)) return null;
  return parseIsoDateAsUTC(c.fechaFin).getTime();
}

export function cubreElDia(c: Contract, diaMs: number): boolean {
  const iniMs = parseIsoDateAsUTC(c.fechaInicio).getTime();
  if (Number.isNaN(iniMs) || diaMs < iniMs) return false;
  const finMs = finEfectivoMs(c);
  if (finMs === null) return true;
  if (Number.isNaN(finMs)) return false;
  return diaMs <= finMs;
}

export function mapearClaseOcupacion(ocupacion: number): ClaseOcupacion {
  if (ocupacion >= 1.0) return 'o100';
  if (ocupacion >= 0.9) return 'o90';
  if (ocupacion >= 0.8) return 'o80';
  if (ocupacion >= 0.7) return 'o70';
  if (ocupacion >= 0.6) return 'o60';
  return 'o0';
}

function unidadesOcupadas(contratosDia: Contract[], unidades: number): number {
  if (contratosDia.length === 0) return 0;
  if (contratosDia.some((c) => c.unidadTipo === 'vivienda')) return unidades;
  // Habitaciones · contar cuartos distintos para no duplicar por solapamientos (renovaciones)
  const ids = new Set<string>();
  let sinId = 0;
  for (const c of contratosDia) {
    if (c.habitacionId) ids.add(c.habitacionId);
    else sinId += 1;
  }
  return Math.min(ids.size + sinId, unidades);
}

/** Renta diaria media por unidad arrendable de una propiedad (€/día). */
function rentaDiariaUnidad(contratosPropiedad: Contract[]): number {
  const conRenta = contratosPropiedad.filter(
    (c) => typeof c.rentaMensual === 'number' && c.rentaMensual > 0,
  );
  if (conRenta.length === 0) return 0;
  const media =
    conRenta.reduce((s, c) => s + (c.rentaMensual ?? 0), 0) / conRenta.length;
  return (media * 12) / 365;
}

function nombreCorto(c: Contract): string {
  const nombre = getInquilinoNombre(c);
  const palabras = nombre.split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '—';
  return palabras.slice(0, 2).join(' ');
}

function construirTooltipDia(
  ano: number,
  mes: number,
  dia: number,
  diaMs: number,
  ocupadas: number,
  arrendables: number,
  contratos: Contract[],
  esHoy: boolean,
): string {
  const mesCorto = NOMBRES_MES_CORTO[mes - 1];
  const pct = arrendables > 0 ? Math.round((ocupadas / arrendables) * 100) : 0;
  const base = `${dia} ${mesCorto} · ${ocupadas}/${arrendables} · ${pct} %`;

  if (esHoy) return `HOY · ${base}`;

  const eventos: string[] = [];
  for (const c of contratos) {
    const fin = finEfectivoMs(c);
    if (fin !== null && fin === diaMs) {
      eventos.push(`vence ${nombreCorto(c)}`);
    }
    const ini = parseIsoDateAsUTC(c.fechaInicio).getTime();
    if (!Number.isNaN(ini) && ini === diaMs && ini > Date.now()) {
      eventos.push(`entra ${nombreCorto(c)}`);
    }
  }

  if (eventos.length > 0) {
    return `${dia} ${mesCorto} · ${eventos.join(' · ')} · ${pct} %`;
  }
  return base;
}

interface OcupacionDia {
  ocupadas: number;
  arrendables: number;
  perdida: number;
}

function calcularOcupacionDia(
  diaMs: number,
  alquilables: Property[],
  contratosPorInmueble: Map<number, Contract[]>,
  rentaPorInmueble: Map<number, number>,
): OcupacionDia {
  let ocupadas = 0;
  let arrendables = 0;
  let perdida = 0;
  for (const p of alquilables) {
    const unidades = unidadesArrendables(p);
    arrendables += unidades;
    const delInmueble = contratosPorInmueble.get(p.id as number) ?? [];
    const contratosDia = delInmueble.filter((c) => cubreElDia(c, diaMs));
    const ocupadasP = unidadesOcupadas(contratosDia, unidades);
    ocupadas += ocupadasP;
    const libres = unidades - ocupadasP;
    if (libres > 0) {
      perdida += libres * (rentaPorInmueble.get(p.id as number) ?? 0);
    }
  }
  return { ocupadas, arrendables, perdida };
}

export function calcularDatosAnuales(
  contratos: Contract[],
  propiedades: Property[],
  ano: number = new Date().getFullYear(),
): DatosAnuales {
  const alquilables = propiedades.filter(esPropiedadAlquilable);

  const contratosPorInmueble = new Map<number, Contract[]>();
  for (const c of contratos) {
    const arr = contratosPorInmueble.get(c.inmuebleId);
    if (arr) arr.push(c);
    else contratosPorInmueble.set(c.inmuebleId, [c]);
  }
  const rentaPorInmueble = new Map<number, number>();
  for (const p of alquilables) {
    rentaPorInmueble.set(
      p.id as number,
      rentaDiariaUnidad(contratosPorInmueble.get(p.id as number) ?? []),
    );
  }

  const ahora = new Date();
  const esAnoActual = ahora.getFullYear() === ano;
  const hoyMs = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

  const meses: MesHeatmap[] = [];
  let sumOcupacion = 0;
  let totalDiasReales = 0;
  let diasVaciosPonderados = 0;
  let ingresosPerdidos = 0;

  for (let mes = 1; mes <= 12; mes++) {
    const diasEnMes = new Date(ano, mes, 0).getDate();
    const celdas: CeldaHeatmap[] = [];
    for (let dia = 1; dia <= 31; dia++) {
      if (dia > diasEnMes) {
        celdas.push({ dia, existe: false, ocupacion: -1, clase: 'n', esHoy: false, tooltip: '' });
        continue;
      }
      const diaMs = Date.UTC(ano, mes - 1, dia);
      const { ocupadas, arrendables, perdida } = calcularOcupacionDia(
        diaMs,
        alquilables,
        contratosPorInmueble,
        rentaPorInmueble,
      );
      const ocupacion = arrendables > 0 ? ocupadas / arrendables : 0;
      const esHoy = esAnoActual && diaMs === hoyMs;
      const tooltip = construirTooltipDia(
        ano, mes, dia, diaMs, ocupadas, arrendables, contratos, esHoy,
      );
      celdas.push({
        dia,
        existe: true,
        ocupacion,
        clase: mapearClaseOcupacion(ocupacion),
        esHoy,
        tooltip,
      });
      // Solo días con unidades arrendables cuentan en medias y agregados;
      // sin cartera operativa no hay "días vacíos" que proyectar.
      if (arrendables > 0) {
        sumOcupacion += ocupacion;
        totalDiasReales += 1;
        diasVaciosPonderados += 1 - ocupacion;
        ingresosPerdidos += perdida;
      }
    }
    meses.push({ numero: mes, diasEnMes, celdas });
  }

  return {
    ano,
    ocupacionMedia: totalDiasReales > 0 ? sumOcupacion / totalDiasReales : 0,
    objetivo: OBJETIVO_OCUPACION_DEFAULT,
    diasVaciosProyectados: Math.round(diasVaciosPonderados),
    ingresosPerdidosProyectados: Math.round(ingresosPerdidos),
    meses,
  };
}
