// FIX § 1.6 bloque 1 · mapa temporal de ocupación · 24 meses (12 atrás · HOY ·
// 11 adelante). Runtime sobre fechas de contrato · puro y testable.

import type { Contract, Property } from '../../../services/db';
import { parseIsoDateAsUTC } from '../../../utils/recurrenceDateUtils';
import { esFechaIndefinida } from './formatFechaFin';

export type NivelOcupacion = 'vacio' | 'parcial' | 'medio' | 'pleno';

export interface MesMapa {
  inicio: Date; // primer día del mes (UTC)
  fin: Date;    // último día del mes (UTC)
  label: string;
  anio: number;
  mes: number;  // 0-11
}

export interface CeldaMapa {
  nivel: NivelOcupacion;
  esHoy: boolean;
  /** Borde rojo discreto · un contrato vence en ese mes o en los 30 días siguientes. */
  warn: boolean;
}

export interface MapaTemporalRow {
  inmueble: Property;
  cells: CeldaMapa[];
}

const NOMBRES_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MS_DIA = 1000 * 60 * 60 * 24;

/** 24 meses: 12 atrás + actual + 11 adelante. */
export function generarMeses24(hoy: Date): MesMapa[] {
  const baseY = hoy.getUTCFullYear();
  const baseM = hoy.getUTCMonth();
  const meses: MesMapa[] = [];
  for (let i = -12; i <= 11; i += 1) {
    const d = new Date(Date.UTC(baseY, baseM + i, 1));
    const anio = d.getUTCFullYear();
    const mes = d.getUTCMonth();
    meses.push({
      inicio: new Date(Date.UTC(anio, mes, 1)),
      fin: new Date(Date.UTC(anio, mes + 1, 0)),
      label: NOMBRES_MES[mes],
      anio,
      mes,
    });
  }
  return meses;
}

/** Unidades arrendables de UN inmueble (piso completo = 1 · por hab = N). */
export function unidadesArrendablesInmueble(p: Property): number {
  const porHab = p.modoExplotacion === 'por_habitaciones' || p.modoExplotacion === 'mixto';
  return porHab ? Math.max(1, p.explotacion?.unidadesArrendables ?? p.bedrooms ?? 1) : 1;
}

function nivelOcupacion(pct: number): NivelOcupacion {
  if (pct <= 0) return 'vacio';
  if (pct >= 1) return 'pleno';
  return pct < 0.4 ? 'parcial' : 'medio';
}

const inicioMs = (c: Contract): number => {
  if (!c.fechaInicio) return NaN;
  return parseIsoDateAsUTC(c.fechaInicio).getTime();
};

const finMs = (c: Contract): number | null => {
  if (esFechaIndefinida(c.fechaFin)) return null; // indefinido · nunca finaliza
  const t = parseIsoDateAsUTC(c.fechaFin).getTime();
  return Number.isNaN(t) ? null : t;
};

/** ¿La `fechaFin` cae en el mes O en los 30 días siguientes a su fin? (§ 1.6). */
function venceEnMes(c: Contract, mes: MesMapa): boolean {
  const fin = finMs(c);
  if (fin == null) return false;
  return fin >= mes.inicio.getTime() && fin <= mes.fin.getTime() + 30 * MS_DIA;
}

export function calcularMapaTemporal(
  inmuebles: Property[],
  contracts: Contract[],
  hoy: Date,
): MapaTemporalRow[] {
  const meses = generarMeses24(hoy);
  const hoyY = hoy.getUTCFullYear();
  const hoyM = hoy.getUTCMonth();

  return inmuebles
    .filter((p) => p.id != null && (!p.state || p.state === 'activo'))
    .map((inmueble) => {
      const unidadesTotal = unidadesArrendablesInmueble(inmueble);
      const propios = contracts.filter((c) => c.inmuebleId === inmueble.id);

      const cells: CeldaMapa[] = meses.map((mes) => {
        const activos = propios.filter((c) => {
          const ini = inicioMs(c);
          if (Number.isNaN(ini) || ini > mes.fin.getTime()) return false;
          const fin = finMs(c);
          return fin == null || fin >= mes.inicio.getTime();
        });

        const ocupadas =
          unidadesTotal === 1
            ? activos.length > 0
              ? 1
              : 0
            : new Set(activos.map((c) => c.habitacionId).filter(Boolean)).size;
        const pct = unidadesTotal > 0 ? ocupadas / unidadesTotal : 0;
        const warn = pct > 0 && activos.some((c) => venceEnMes(c, mes));

        return {
          nivel: nivelOcupacion(pct),
          esHoy: mes.anio === hoyY && mes.mes === hoyM,
          warn,
        };
      });

      return { inmueble, cells };
    });
}
