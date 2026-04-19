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
 * - Replaces (merges) monthly keys in `plan.historialAportaciones` with the net contributions.
 * - Updates `plan.valorActual` with the last day's EN EUROS and `aportacionesRealizadas` with
 *   the last day's cumulative net contributions.
 */
export async function importarIndexaCapital(
  preview: IndexaImportPreview,
  planId: number
): Promise<IndexaImportResult> {
  const errors: string[] = [];

  if (!preview.rows.length) {
    return { valoracionesImportadas: 0, mesesConAportaciones: 0, saldoActualizado: false, errors: ['No hay filas para importar.'] };
  }

  const db = await initDB();
  const plan = await db.get('planesPensionInversion', planId);
  if (!plan) {
    return { valoracionesImportadas: 0, mesesConAportaciones: 0, saldoActualizado: false, errors: [`Plan con id ${planId} no encontrado.`] };
  }

  // 1. Valoraciones mensuales — use guardarValoracionActivo so we don't overwrite other
  //    assets' monthly snapshots. The plan's valorActual is updated at the end in step 3.
  let valoracionesImportadas = 0;
  for (const m of preview.monthly) {
    try {
      await valoracionesService.guardarValoracionActivo(m.mes, {
        tipo_activo: 'plan_pensiones',
        activo_id: planId,
        activo_nombre: plan.nombre,
        valor: m.valorFinMes,
        notas: 'Importado desde Indexa Capital',
      });
      valoracionesImportadas += 1;
    } catch (e) {
      errors.push(`Error guardando valoración ${m.mes}: ${(e as Error).message}`);
    }
  }

  // 2. Historial de aportaciones — merge month keys (titular receives the net amount;
  //    may be negative if the month had a net redemption).
  const mesesConAportaciones = preview.monthly.filter((m) => m.aportacionNetaMes !== 0).length;
  type HistorialEntry = NonNullable<PlanPensionInversion['historialAportaciones']>[string];
  const historial: Record<string, HistorialEntry> = { ...(plan.historialAportaciones ?? {}) };
  for (const m of preview.monthly) {
    if (m.aportacionNetaMes === 0 && historial[m.mes] === undefined) continue;
    historial[m.mes] = {
      titular: m.aportacionNetaMes,
      empresa: 0,
      total: m.aportacionNetaMes,
      fuente: 'manual',
    };
  }

  // 3. Update plan: valorActual = last day's EN EUROS, aportacionesRealizadas = last day's acumuladas.
  const last = preview.rows[preview.rows.length - 1];
  await planesInversionService.updatePlan(planId, {
    historialAportaciones: historial,
    valorActual: last.valorEuros,
    aportacionesRealizadas: last.aportacionNetaAcumulada,
  });

  return {
    valoracionesImportadas,
    mesesConAportaciones,
    saldoActualizado: true,
    errors,
  };
}

/** List of plans suitable as target for an Indexa import (tipo = plan-pensiones). */
export async function getPlanesObjetivo(): Promise<PlanPensionInversion[]> {
  const planes = await planesInversionService.getAllPlanes();
  return planes.filter((p) => p.tipo === 'plan-pensiones');
}
