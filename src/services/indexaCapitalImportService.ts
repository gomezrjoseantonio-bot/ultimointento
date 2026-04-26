// src/services/indexaCapitalImportService.ts
// Import Indexa Capital pension plan Excel exports.
//
// Indexa Capital's export has daily rows with columns:
//   Fecha | EN EUROS (€) | EN PORCENTAJE (%) | Evolución de la cartera (base 100) |
//   Rentabilidad (€) | Aportaciones netas del día (€) | Aportaciones netas acumuladas (€) |
//   Retenciones del día (€) | Retenciones acumuladas (€)
//
// This importer aggregates daily rows into:
//   - Monthly valuations (valoraciones_historicas), using the latest day-of-month value.
//   - Monthly net contributions (historialAportaciones), summing "Aportaciones netas del día"
//     (negative values represent redemptions/rescates and are preserved).
// It also updates the target plan's `valorActual` and `aportacionesRealizadas`.
import * as XLSX from 'xlsx';
import { initDB } from './db';
import { planesInversionService } from './planesInversionService';
import { valoracionesService } from './valoracionesService';
import type { PlanPensionInversion } from '../types/personal';
import type { Aportacion, PosicionInversion } from '../types/inversiones';

export interface IndexaDailyRow {
  fecha: string;          // YYYY-MM-DD
  valorEuros: number;     // "EN EUROS (€)" — saldo del plan al cierre del día
  rentabilidadEuros: number;
  aportacionNetaDia: number;
  aportacionNetaAcumulada: number;
  retencionDia: number;
  retencionAcumulada: number;
}

export interface IndexaMonthlyAgg {
  mes: string;               // YYYY-MM
  valorFinMes: number;       // EN EUROS del último día del mes presente en el archivo
  aportacionNetaMes: number; // suma de aportaciones netas del día dentro del mes
}

export interface IndexaImportPreview {
  rows: IndexaDailyRow[];
  monthly: IndexaMonthlyAgg[];
  summary: {
    fechaInicio: string;
    fechaFin: string;
    diasTotales: number;
    mesesDetectados: number;
    saldoFinal: number;
    aportacionNetaAcumulada: number;
    rentabilidadAcumulada: number;
  };
  warnings: string[];
}

type RawRow = Record<string, unknown>;

const normalizeHeader = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const parseAmount = (raw: unknown): number => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (typeof raw !== 'string') return 0;

  // Strip currency symbols, non-breaking spaces, percent, and whitespace.
  let value = raw.replace(/[€%\s\u00a0]/g, '').trim();
  if (!value) return 0;

  // Preserve a leading sign.
  let sign = 1;
  if (value.startsWith('+')) {
    value = value.slice(1);
  } else if (value.startsWith('-')) {
    sign = -1;
    value = value.slice(1);
  }

  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');

  if (lastComma > -1 || lastDot > -1) {
    const decimalIndex = Math.max(lastComma, lastDot);
    const integerPart = value.slice(0, decimalIndex).replace(/[.,]/g, '');
    const decimalPart = value.slice(decimalIndex + 1).replace(/[.,]/g, '');
    const parsed = parseFloat(`${integerPart}.${decimalPart}`);
    return Number.isFinite(parsed) ? sign * parsed : 0;
  }

  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? sign * parsed : 0;
};

const parseDate = (raw: unknown): string | null => {
  if (raw === undefined || raw === null || raw === '') return null;

  const fmt = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return fmt(raw);

  if (typeof raw === 'number') {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) return fmt(new Date(parsed.y, parsed.m - 1, parsed.d));
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // Prefer DD/MM/YYYY (Indexa's format) over ISO to avoid ambiguity.
    const dmy = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (dmy) {
      const day = parseInt(dmy[1], 10);
      const month = parseInt(dmy[2], 10);
      let year = parseInt(dmy[3], 10);
      if (year < 100) year += 2000;
      const d = new Date(year, month - 1, day);
      if (!Number.isNaN(d.getTime())) return fmt(d);
    }

    const iso = new Date(trimmed);
    if (!Number.isNaN(iso.getTime())) return fmt(iso);
  }

  return null;
};

const getValue = (row: RawRow, aliases: string[]): unknown => {
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') {
      return row[alias];
    }
  }
  return undefined;
};

// Column aliases — normalized (accents stripped, non-alphanumerics → "_").
const COL_FECHA = ['fecha', 'date'];
const COL_EN_EUROS = ['en_euros', 'en_euros_eur', 'en_euros_e', 'saldo', 'valor'];
const COL_RENTAB = ['rentabilidad', 'rentabilidad_eur', 'rentabilidad_e'];
const COL_APORT_DIA = [
  'aportaciones_netas_del_dia',
  'aportaciones_netas_del_dia_eur',
  'aportaciones_netas_del_dia_e',
  'aportacion_neta_del_dia',
  'aportacion_neta_dia',
];
const COL_APORT_ACUM = [
  'aportaciones_netas_acumuladas',
  'aportaciones_netas_acumuladas_eur',
  'aportaciones_netas_acumuladas_e',
  'aportacion_neta_acumulada',
];
const COL_RETEN_DIA = [
  'retenciones_del_dia',
  'retenciones_del_dia_eur',
  'retenciones_del_dia_e',
  'retencion_dia',
];
const COL_RETEN_ACUM = [
  'retenciones_acumuladas',
  'retenciones_acumuladas_eur',
  'retenciones_acumuladas_e',
  'retencion_acumulada',
];

async function parseWorkbook(file: File): Promise<RawRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return rawRows.map((row) => {
    const normalized: RawRow = {};
    Object.entries(row).forEach(([key, value]) => {
      normalized[normalizeHeader(key)] = value;
    });
    return normalized;
  });
}

/** Detects whether a normalized row object looks like an Indexa Capital export. */
export function isIndexaCapitalFormat(rows: RawRow[]): boolean {
  if (!rows.length) return false;
  const sample = rows[0];
  const keys = Object.keys(sample);
  const hasFecha = keys.some((k) => COL_FECHA.includes(k));
  const hasEuros = keys.some((k) => COL_EN_EUROS.includes(k));
  const hasAportDia = keys.some((k) => COL_APORT_DIA.includes(k));
  const hasAportAcum = keys.some((k) => COL_APORT_ACUM.includes(k));
  return hasFecha && hasEuros && (hasAportDia || hasAportAcum);
}

export async function previsualizarImportacionIndexa(file: File): Promise<IndexaImportPreview> {
  const warnings: string[] = [];
  const rows = await parseWorkbook(file);

  if (!rows.length) {
    return emptyPreview(['El archivo está vacío o no tiene hojas legibles.']);
  }

  if (!isIndexaCapitalFormat(rows)) {
    return emptyPreview([
      'El archivo no parece ser un export de Indexa Capital. Verifica que tenga columnas "Fecha", "EN EUROS (€)" y "Aportaciones netas del día".',
    ]);
  }

  const parsed: IndexaDailyRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fecha = parseDate(getValue(row, COL_FECHA));
    if (!fecha) {
      warnings.push(`Fila ${i + 2}: fecha no válida; se omite.`);
      continue;
    }
    parsed.push({
      fecha,
      valorEuros: parseAmount(getValue(row, COL_EN_EUROS)),
      rentabilidadEuros: parseAmount(getValue(row, COL_RENTAB)),
      aportacionNetaDia: parseAmount(getValue(row, COL_APORT_DIA)),
      aportacionNetaAcumulada: parseAmount(getValue(row, COL_APORT_ACUM)),
      retencionDia: parseAmount(getValue(row, COL_RETEN_DIA)),
      retencionAcumulada: parseAmount(getValue(row, COL_RETEN_ACUM)),
    });
  }

  if (!parsed.length) {
    return emptyPreview(['No se pudo extraer ninguna fila válida del archivo.']);
  }

  // Ascending by date — Indexa exports in descending order.
  parsed.sort((a, b) => a.fecha.localeCompare(b.fecha));

  const monthly = aggregateMonthly(parsed);
  const last = parsed[parsed.length - 1];
  const first = parsed[0];

  return {
    rows: parsed,
    monthly,
    summary: {
      fechaInicio: first.fecha,
      fechaFin: last.fecha,
      diasTotales: parsed.length,
      mesesDetectados: monthly.length,
      saldoFinal: last.valorEuros,
      aportacionNetaAcumulada: last.aportacionNetaAcumulada,
      rentabilidadAcumulada: last.rentabilidadEuros,
    },
    warnings,
  };
}

function emptyPreview(errors: string[]): IndexaImportPreview {
  return {
    rows: [],
    monthly: [],
    summary: {
      fechaInicio: '',
      fechaFin: '',
      diasTotales: 0,
      mesesDetectados: 0,
      saldoFinal: 0,
      aportacionNetaAcumulada: 0,
      rentabilidadAcumulada: 0,
    },
    warnings: errors,
  };
}

function aggregateMonthly(rows: IndexaDailyRow[]): IndexaMonthlyAgg[] {
  // Rows are expected in ascending order. For each month: sum day contributions,
  // and keep the valor from the last day present in the file for that month.
  const byMonth = new Map<string, { valorFinMes: number; aportacionNetaMes: number; ultimaFecha: string }>();
  for (const row of rows) {
    const mes = row.fecha.slice(0, 7);
    const existing = byMonth.get(mes);
    if (!existing) {
      byMonth.set(mes, {
        valorFinMes: row.valorEuros,
        aportacionNetaMes: row.aportacionNetaDia,
        ultimaFecha: row.fecha,
      });
    } else {
      existing.aportacionNetaMes += row.aportacionNetaDia;
      if (row.fecha > existing.ultimaFecha) {
        existing.ultimaFecha = row.fecha;
        existing.valorFinMes = row.valorEuros;
      }
    }
  }
  return [...byMonth.entries()]
    .map(([mes, v]) => ({ mes, valorFinMes: v.valorFinMes, aportacionNetaMes: v.aportacionNetaMes }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

export interface IndexaImportResult {
  valoracionesImportadas: number;
  mesesConAportaciones: number;
  saldoActualizado: boolean;
  errors: string[];
}

/**
 * Persists the Indexa Capital preview into the target plan.
 * - Writes one monthly valuation per month in `valoraciones_historicas`.
 * - Replaces (merges) monthly keys in `plan.historialAportaciones` with the net contributions
 *   (only when the plan lives in `planesPensiones`; the legacy `inversiones` store does
 *   not have that field, so we record the aggregate contributions as Aportacion rows instead).
 * - Updates the plan's current value (`valorActual` / `valor_actual`) with the last day's
 *   EN EUROS and the total contributions with the last day's cumulative net value.
 */
export async function importarIndexaCapital(
  preview: IndexaImportPreview,
  target: PlanObjetivo | number
): Promise<IndexaImportResult> {
  const errors: string[] = [];

  if (!preview.rows.length) {
    return { valoracionesImportadas: 0, mesesConAportaciones: 0, saldoActualizado: false, errors: ['No hay filas para importar.'] };
  }

  // Back-compat: legacy callers pass a bare id assuming the dedicated store.
  const planTarget: PlanObjetivo = typeof target === 'number'
    ? { id: target, store: 'planesPensiones', nombre: '', entidad: '', valorActual: 0, aportacionesRealizadas: 0 }
    : target;

  const db = await initDB();
  const rawPlan = await (db as any).get(planTarget.store, planTarget.store === 'planesPensiones' ? String(planTarget.id) : planTarget.id);
  if (!rawPlan) {
    return { valoracionesImportadas: 0, mesesConAportaciones: 0, saldoActualizado: false, errors: [`Plan con id ${planTarget.id} no encontrado en ${planTarget.store}.`] };
  }

  const planNombre: string = (rawPlan as { nombre?: string }).nombre ?? planTarget.nombre;

  // 1. Valoraciones mensuales — use guardarValoracionActivo so we don't overwrite other
  //    assets' monthly snapshots. The plan's valorActual is updated at the end in step 3.
  let valoracionesImportadas = 0;
  for (const m of preview.monthly) {
    try {
      await valoracionesService.guardarValoracionActivo(m.mes, {
        tipo_activo: 'plan_pensiones',
        activo_id: planTarget.id,
        activo_nombre: planNombre,
        valor: m.valorFinMes,
        notas: 'Importado desde Indexa Capital',
      });
      valoracionesImportadas += 1;
    } catch (e) {
      errors.push(`Error guardando valoración ${m.mes}: ${(e as Error).message}`);
    }
  }

  const mesesConAportaciones = preview.monthly.filter((m) => m.aportacionNetaMes !== 0).length;
  const last = preview.rows[preview.rows.length - 1];

  if (planTarget.store === 'planesPensiones') {
    // 2a. Write monthly contributions to aportacionesPlan store.
    //     Replace existing Indexa contributions for this plan (by notas marker).
    const genUUID = (): string =>
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);

    const existingAportaciones = (await (db as any).getAll('aportacionesPlan')) as Array<{
      id: string;
      planId: string;
      notas?: string;
    }>;
    // Remove previous Indexa-sourced aportaciones for this plan
    for (const a of existingAportaciones) {
      if (a.planId === String(planTarget.id) && a.notas?.includes('Indexa Capital')) {
        await (db as any).delete('aportacionesPlan', a.id);
      }
    }
    // Add new monthly aportaciones
    const ahora = new Date().toISOString();
    for (const m of preview.monthly) {
      if (m.aportacionNetaMes === 0) continue;
      await (db as any).add('aportacionesPlan', {
        id: genUUID(),
        planId: String(planTarget.id),
        fecha: `${m.mes}-01`,
        ejercicioFiscal: parseInt(m.mes.slice(0, 4)),
        importeTitular: m.aportacionNetaMes > 0 ? m.aportacionNetaMes : 0,
        importeEmpresa: 0,
        origen: 'manual' as const,
        granularidad: 'mensual' as const,
        notas: 'Importado desde Indexa Capital',
        fechaCreacion: ahora,
        fechaActualizacion: ahora,
      });
    }

    await planesInversionService.updatePlan(String(planTarget.id), {
      valorActual: last.valorEuros,
    });
  } else {
    // 2b. Plan almacenado en `inversiones` (legacy). Replace any previous Indexa
    //     contribution rows ('fuente = indexa') with one row per month with net movement,
    //     preserving manually-added contributions.
    const inv = rawPlan as PosicionInversion;
    const aportacionesBase = (inv.aportaciones ?? []).filter((a) => a.fuente !== 'indexa');
    let nextId = aportacionesBase.reduce((max, a) => Math.max(max, a.id ?? 0), 0);

    const nuevasAportaciones = preview.monthly
      .filter((m) => m.aportacionNetaMes !== 0)
      .map<Aportacion>((m) => {
        nextId += 1;
        const esRescate = m.aportacionNetaMes < 0;
        return {
          id: nextId,
          fecha: `${m.mes}-01`,
          importe: Math.abs(m.aportacionNetaMes),
          tipo: esRescate ? 'reembolso' : 'aportacion',
          fuente: 'indexa',
          notas: esRescate ? 'Rescate neto (Indexa Capital)' : 'Aportación neta (Indexa Capital)',
        };
      });

    const aportacionesActualizadas = [...aportacionesBase, ...nuevasAportaciones].sort(
      (a, b) => a.fecha.localeCompare(b.fecha)
    );

    const totalAportado = last.aportacionNetaAcumulada;
    const rentabilidadEuros = last.valorEuros - totalAportado;
    const rentabilidadPct = totalAportado > 0 ? (rentabilidadEuros / totalAportado) * 100 : 0;

    const updated: PosicionInversion = {
      ...inv,
      valor_actual: last.valorEuros,
      fecha_valoracion: last.fecha,
      aportaciones: aportacionesActualizadas,
      total_aportado: totalAportado,
      rentabilidad_euros: rentabilidadEuros,
      rentabilidad_porcentaje: rentabilidadPct,
      updated_at: new Date().toISOString(),
    };
    await db.put('inversiones', updated);
  }

  return {
    valoracionesImportadas,
    mesesConAportaciones,
    saldoActualizado: true,
    errors,
  };
}

export interface PlanObjetivo {
  id: number;
  store: 'planesPensiones' | 'inversiones';
  nombre: string;
  entidad?: string;
  valorActual: number;
  aportacionesRealizadas: number;
}

/** List of plans suitable as target for an Indexa import (tipo = plan-pensiones).
 *  Combines the dedicated `planesPensiones` store (V65) with legacy entries in
 *  `inversiones` whose `tipo` is `plan_pensiones` / `plan-pensiones`. */
export async function getPlanesObjetivo(): Promise<PlanObjetivo[]> {
  const db = await initDB();
  const [planes, inversiones] = await Promise.all([
    planesInversionService.getAllPlanes(),
    db.getAll('inversiones') as Promise<PosicionInversion[]>,
  ]);

  const targets: PlanObjetivo[] = [];
  for (const p of planes as any[]) {
    if (p.id === undefined) continue;
    targets.push({
      id: p.id,
      store: 'planesPensiones',
      nombre: p.nombre,
      entidad: p.gestoraActual,
      valorActual: p.valorActual ?? 0,
      aportacionesRealizadas: 0, // tracked in aportacionesPlan
    });
  }

  const PLAN_TIPOS_INV = new Set(['plan_pensiones', 'plan-pensiones']);
  for (const inv of inversiones) {
    if (!PLAN_TIPOS_INV.has(inv.tipo)) continue;
    targets.push({
      id: inv.id,
      store: 'inversiones',
      nombre: inv.nombre,
      entidad: inv.entidad,
      valorActual: inv.valor_actual ?? 0,
      aportacionesRealizadas: inv.total_aportado ?? 0,
    });
  }

  return targets;
}
