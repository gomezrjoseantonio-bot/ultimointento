import * as XLSX from 'xlsx';
import { inversionesService } from './inversionesService';
import { planesInversionService } from './planesInversionService';
import { Aportacion, PosicionInversion } from '../types/inversiones';
import type { PlanPensionInversion } from '../types/personal';

export interface ImportAportacionesResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface AportacionImportPreviewRow {
  fila: number;
  fecha: string;
  posicionId?: number;
  posicionNombre: string;
  entidad: string;
  importe: number;
  notas: string;
  estado: 'valida' | 'error';
  error?: string;
  importeEmpresa?: number;
  importeIndividuo?: number;
}

export interface BusquedaPosicionResult {
  kind: 'posicion' | 'plan';
  id: number;
  nombre: string;
  entidad: string;
}

export interface FilaCorregida {
  fecha: string;
  importe: number;
  notas: string;
  targetKind: 'posicion' | 'plan';
  targetId: number;
  importeEmpresa?: number;
  importeIndividuo?: number;
}

export interface AportacionesImportPreview {
  totalFilasArchivo: number;
  totalAportacionesDetectadas: number;
  totalValidas: number;
  totalConError: number;
  rows: AportacionImportPreviewRow[];
  errors: string[];
}

type RawRow = Record<string, unknown>;

type ParsedAportacionRow = {
  sourceRow: number;
  posicionId?: number;
  posicionNombre?: string;
  entidad?: string;
  aportacion: Omit<Aportacion, 'id'>;
  importeEmpresa?: number;   // pension plan breakdown
  importeIndividuo?: number; // pension plan breakdown
};

// Result of looking up a position or plan by name/id
type FindResult =
  | { kind: 'posicion'; value: PosicionInversion }
  | { kind: 'plan'; value: PlanPensionInversion }
  | null;

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

  const value = raw.trim().replace(/\s/g, '');
  if (!value) return 0;

  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');

  if (lastComma > -1 || lastDot > -1) {
    const decimalIndex = Math.max(lastComma, lastDot);
    const integerPart = value.slice(0, decimalIndex).replace(/[.,]/g, '');
    const decimalPart = value.slice(decimalIndex + 1).replace(/[.,]/g, '');
    const normalized = `${integerPart}.${decimalPart}`;
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDate = (raw: unknown): string | null => {
  if (!raw && raw !== 0) return null;

  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return formatLocalDate(raw);
  }

  if (typeof raw === 'number') {
    const parsedCode = XLSX.SSF.parse_date_code(raw);
    if (parsedCode) {
      const jsDate = new Date(parsedCode.y, parsedCode.m - 1, parsedCode.d);
      return formatLocalDate(jsDate);
    }
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const isoDate = new Date(trimmed);
    if (!Number.isNaN(isoDate.getTime())) return formatLocalDate(isoDate);

    const match = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      const normalizedYear = year < 100 ? 2000 + year : year;
      const parsed = new Date(normalizedYear, month - 1, day);
      if (!Number.isNaN(parsed.getTime())) return formatLocalDate(parsed);
    }
  }

  return null;
};

const getRowValue = (row: RawRow, aliases: string[]): unknown => {
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') {
      return row[alias];
    }
  }
  return undefined;
};

const parsePosicionId = (raw: unknown): number | undefined => {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }
  if (typeof raw === 'string') {
    const parsed = parseInt(raw.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

async function parseRows(file: File): Promise<{ rows: RawRow[]; errors: string[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return { rows: [], errors: ['El archivo no contiene hojas.'] };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const rows = rawRows.map((row) => {
    const normalized: RawRow = {};
    Object.entries(row).forEach(([key, value]) => {
      normalized[normalizeHeader(key)] = value;
    });
    return normalized;
  });

  return { rows, errors: [] };
}

function mapRowsToAportaciones(
  rows: RawRow[],
  posicionesById: Map<number, PosicionInversion>,
  planes: PlanPensionInversion[],
  posicionPorDefecto?: PosicionInversion
): { aportaciones: ParsedAportacionRow[]; skipped: number; errors: string[] } {
  const aportaciones: ParsedAportacionRow[] = [];
  const errors: string[] = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const fecha = parseDate(getRowValue(row, ['fecha', 'fecha_aportacion', 'date']));

    if (!fecha) {
      skipped += 1;
      errors.push(`Fila ${rowNumber}: fecha no válida o vacía.`);
      return;
    }

    const posicionId = parsePosicionId(getRowValue(row, ['posicion_id', 'id_posicion'])) ?? posicionPorDefecto?.id;
    const posicionNombre = String(getRowValue(row, ['posicion_nombre', 'nombre_posicion', 'posicion']) ?? '').trim() || posicionPorDefecto?.nombre || '';
    const entidad = String(getRowValue(row, ['entidad', 'broker', 'banco']) ?? '').trim() || posicionPorDefecto?.entidad || '';

    if (!posicionId && !posicionNombre) {
      skipped += 1;
      errors.push(`Fila ${rowNumber}: indica posicion_id o posicion_nombre.`);
      return;
    }

    const notasRaw = getRowValue(row, ['notas', 'nota', 'comentario', 'descripcion']);
    const notasBase = typeof notasRaw === 'string' && notasRaw.trim()
      ? notasRaw.trim()
      : 'Importación histórica';

    // Detect if this refers to a pension plan — check both inversiones store type
    // AND planesPensionInversion by name/entidad
    const tipoPosicion = posicionId ? posicionesById.get(posicionId)?.tipo : undefined;
    const nombreNormLower = posicionNombre.toLowerCase();
    const entidadNormLower = entidad.toLowerCase();
    const esPlanPensiones =
      tipoPosicion === 'plan_pensiones' || tipoPosicion === 'plan_empleo' ||
      planes.some(
        (p) =>
          p.tipo === 'plan-pensiones' &&
          p.nombre.toLowerCase() === nombreNormLower &&
          (!entidadNormLower || (p.entidad ?? '').toLowerCase() === entidadNormLower)
      );

    if (esPlanPensiones) {
      const importeEmpresa = parseAmount(getRowValue(row, ['importe_empresa', 'aportacion_empresa', 'empresa']));
      const importeIndividuo = parseAmount(getRowValue(row, ['importe_individuo', 'aportacion_individuo', 'individuo', 'importe']));

      if (importeEmpresa <= 0 && importeIndividuo <= 0) {
        skipped += 1;
        errors.push(`Fila ${rowNumber}: debes informar al menos una aportación (empresa o individuo).`);
        return;
      }

      const importeTotal = importeEmpresa + importeIndividuo;
      const detalleAportacion = [
        importeEmpresa > 0 ? `Empresa: ${importeEmpresa.toFixed(2)}€` : null,
        importeIndividuo > 0 ? `Individuo: ${importeIndividuo.toFixed(2)}€` : null,
      ].filter(Boolean).join(' · ');

      aportaciones.push({
        sourceRow: rowNumber,
        posicionId,
        posicionNombre,
        entidad,
        importeEmpresa,
        importeIndividuo,
        aportacion: {
          fecha,
          importe: importeTotal,
          tipo: 'aportacion',
          fuente: 'excel',
          notas: detalleAportacion ? `${notasBase} · ${detalleAportacion}` : notasBase,
        },
      });

      return;
    }

    const importe = parseAmount(getRowValue(row, ['importe', 'aportacion', 'monto', 'amount']));
    if (importe <= 0) {
      skipped += 1;
      errors.push(`Fila ${rowNumber}: importe no válido.`);
      return;
    }

    aportaciones.push({
      sourceRow: rowNumber,
      posicionId,
      posicionNombre,
      entidad,
      aportacion: { fecha, importe, tipo: 'aportacion', fuente: 'excel', notas: notasBase },
    });
  });

  return { aportaciones, skipped, errors };
}

/**
 * Find a matching posicion (inversiones store) OR plan de pensiones by id/name.
 */
const findPosicionOrPlan = (
  row: ParsedAportacionRow,
  posicionesById: Map<number, PosicionInversion>,
  posiciones: PosicionInversion[],
  planes: PlanPensionInversion[]
): FindResult => {
  // 1. Try inversiones by ID
  if (row.posicionId) {
    const byId = posicionesById.get(row.posicionId);
    if (byId) return { kind: 'posicion', value: byId };
  }

  const nombreNorm = (row.posicionNombre ?? '').toLowerCase().trim();
  const entidadNorm = (row.entidad ?? '').toLowerCase().trim();

  // 2. Try inversiones by name + entidad
  const posMatches = posiciones.filter((p) => {
    if (p.nombre.toLowerCase() !== nombreNorm) return false;
    if (!entidadNorm) return true;
    return p.entidad.toLowerCase() === entidadNorm;
  });
  if (posMatches.length === 1) return { kind: 'posicion', value: posMatches[0] };

  // 3. Try planesPensionInversion by name + entidad
  const planMatches = planes.filter((p) => {
    if (p.tipo !== 'plan-pensiones') return false;
    if (p.nombre.toLowerCase() !== nombreNorm) return false;
    if (!entidadNorm) return true;
    return (p.entidad ?? '').toLowerCase() === entidadNorm;
  });
  if (planMatches.length === 1) return { kind: 'plan', value: planMatches[0] };

  return null;
};

export async function previsualizarImportacionAportaciones(
  file: File,
  posicionPorDefecto?: PosicionInversion
): Promise<AportacionesImportPreview> {
  const posiciones = await inversionesService.getPosiciones();
  const posicionesById = new Map<number, PosicionInversion>(posiciones.map((p) => [p.id, p]));
  const planes = await planesInversionService.getAllPlanes();

  const parsed = await parseRows(file);
  if (parsed.errors.length > 0) {
    return {
      totalFilasArchivo: 0,
      totalAportacionesDetectadas: 0,
      totalValidas: 0,
      totalConError: parsed.errors.length,
      rows: [],
      errors: parsed.errors,
    };
  }

  const mapped = mapRowsToAportaciones(parsed.rows, posicionesById, planes, posicionPorDefecto);
  const previewRows: AportacionImportPreviewRow[] = mapped.aportaciones.map((row) => {
    const result = findPosicionOrPlan(row, posicionesById, posiciones, planes);
    if (!result) {
      const referencia = row.posicionId
        ? `No se encontró una coincidencia única para posicion_id ${row.posicionId}.`
        : `No se encontró una coincidencia única para posición "${row.posicionNombre}"${row.entidad ? ` (${row.entidad})` : ''}.`;

      return {
        fila: row.sourceRow,
        fecha: row.aportacion.fecha,
        posicionId: row.posicionId,
        posicionNombre: row.posicionNombre ?? '',
        entidad: row.entidad ?? '',
        importe: row.aportacion.importe,
        notas: row.aportacion.notas ?? '',
        importeEmpresa: row.importeEmpresa,
        importeIndividuo: row.importeIndividuo,
        estado: 'error',
        error: referencia,
      };
    }

    const matched = result.value;
    return {
      fila: row.sourceRow,
      fecha: row.aportacion.fecha,
      posicionId: matched.id,
      posicionNombre: row.posicionNombre || matched.nombre,
      entidad: row.entidad || matched.entidad || '',
      importe: row.aportacion.importe,
      notas: row.aportacion.notas ?? '',
      importeEmpresa: row.importeEmpresa,
      importeIndividuo: row.importeIndividuo,
      estado: 'valida',
    };
  });

  const totalConError = mapped.skipped + previewRows.filter((r) => r.estado === 'error').length;
  const totalValidas = previewRows.filter((r) => r.estado === 'valida').length;

  return {
    totalFilasArchivo: parsed.rows.length,
    totalAportacionesDetectadas: previewRows.length,
    totalValidas,
    totalConError,
    rows: previewRows,
    errors: [...mapped.errors, ...previewRows.filter((r) => r.error).map((r) => r.error as string)],
  };
}

export async function importarAportacionesHistoricasMasivas(
  file: File,
  posicionPorDefecto?: PosicionInversion
): Promise<ImportAportacionesResult> {
  const filename = file.name.toLowerCase();
  if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls')) {
    return {
      imported: 0,
      skipped: 1,
      errors: ['Formato no válido. Usa un archivo Excel (.xlsx o .xls).'],
    };
  }

  const posiciones = await inversionesService.getPosiciones();
  const posicionesById = new Map<number, PosicionInversion>(posiciones.map((p) => [p.id, p]));
  const planes = await planesInversionService.getAllPlanes();

  const parsed = await parseRows(file);
  if (parsed.errors.length > 0) {
    return { imported: 0, skipped: parsed.errors.length, errors: parsed.errors };
  }

  const mapped = mapRowsToAportaciones(parsed.rows, posicionesById, planes, posicionPorDefecto);
  const ordered = [...mapped.aportaciones].sort(
    (a, b) => new Date(a.aportacion.fecha).getTime() - new Date(b.aportacion.fecha).getTime()
  );

  let imported = 0;
  let skipped = mapped.skipped;
  const errors = [...mapped.errors];

  // Accumulate pension plan contributions in memory, then flush once per plan
  const planAccum = new Map<number, PlanPensionInversion>();

  for (const row of ordered) {
    const result = findPosicionOrPlan(row, posicionesById, posiciones, planes);
    if (!result) {
      skipped += 1;
      const referencia = row.posicionId
        ? `posicion_id ${row.posicionId}`
        : `posición "${row.posicionNombre}"${row.entidad ? ` (${row.entidad})` : ''}`;
      errors.push(`No se encontró una coincidencia única para ${referencia}.`);
      continue;
    }

    if (result.kind === 'plan') {
      const planId = result.value.id!;
      // Use the in-memory accumulator so contributions from the same year add up
      if (!planAccum.has(planId)) {
        planAccum.set(planId, {
          ...result.value,
          historialAportaciones: { ...(result.value.historialAportaciones ?? {}) },
        });
      }
      const plan = planAccum.get(planId)!;
      // Use YYYY-MM key for monthly granularity (falls back to YYYY if no month)
      const mesKey = row.aportacion.fecha.length >= 7
        ? row.aportacion.fecha.slice(0, 7)
        : String(new Date(row.aportacion.fecha).getFullYear());
      const existing = plan.historialAportaciones?.[mesKey] ?? { titular: 0, empresa: 0, total: 0 };
      plan.historialAportaciones = {
        ...plan.historialAportaciones,
        [mesKey]: {
          titular: (existing.titular ?? 0) + (row.importeIndividuo ?? 0),
          empresa: (existing.empresa ?? 0) + (row.importeEmpresa ?? 0),
          total: (existing.total ?? 0) + row.aportacion.importe,
          fuente: 'manual',
        },
      };
      imported += 1;
      continue;
    }

    // Regular posicion in inversiones store
    await inversionesService.addAportacion(result.value.id, row.aportacion);
    imported += 1;
  }

  // Flush pension plan updates — recalculate aportacionesRealizadas from historial
  for (const [planId, plan] of planAccum) {
    plan.aportacionesRealizadas = Object.values(plan.historialAportaciones ?? {}).reduce(
      (sum, entry) => sum + (entry.total ?? 0), 0
    );
    await planesInversionService.updatePlan(planId, plan);
  }

  return { imported, skipped, errors };
}

// Backward-compatible export name used by previous integrations/builds.
export async function importarAportacionesHistoricas(
  file: File,
  posicionPorDefecto?: PosicionInversion
): Promise<ImportAportacionesResult> {
  return importarAportacionesHistoricasMasivas(file, posicionPorDefecto);
}

/**
 * Look up a position or plan by name + entidad.
 * Used by the inline-edit validation in the import UI.
 */
export async function buscarPosicionPorNombre(
  posicionNombre: string,
  entidad: string
): Promise<BusquedaPosicionResult | null> {
  const posiciones = await inversionesService.getPosiciones();
  const planes = await planesInversionService.getAllPlanes();

  const nombreNorm = posicionNombre.toLowerCase().trim();
  const entidadNorm = entidad.toLowerCase().trim();

  const posMatches = posiciones.filter((p) => {
    if (p.nombre.toLowerCase() !== nombreNorm) return false;
    if (!entidadNorm) return true;
    return p.entidad.toLowerCase() === entidadNorm;
  });
  if (posMatches.length === 1) {
    return { kind: 'posicion', id: posMatches[0].id, nombre: posMatches[0].nombre, entidad: posMatches[0].entidad };
  }

  const planMatches = planes.filter((p) => {
    if (p.tipo !== 'plan-pensiones') return false;
    if (p.nombre.toLowerCase() !== nombreNorm) return false;
    if (!entidadNorm) return true;
    return (p.entidad ?? '').toLowerCase() === entidadNorm;
  });
  if (planMatches.length === 1 && planMatches[0].id != null) {
    return { kind: 'plan', id: planMatches[0].id!, nombre: planMatches[0].nombre, entidad: planMatches[0].entidad || '' };
  }

  return null;
}

/**
 * Import a set of rows that were corrected inline in the UI.
 * For posiciones: adds individual aportaciones.
 * For planes: aggregates by year into historialAportaciones.
 */
export async function importarFilasCorregidas(
  rows: FilaCorregida[]
): Promise<ImportAportacionesResult> {
  let imported = 0;
  const errors: string[] = [];
  const planAccum = new Map<number, PlanPensionInversion>();

  for (const row of rows) {
    if (row.targetKind === 'posicion') {
      await inversionesService.addAportacion(row.targetId, {
        fecha: row.fecha,
        importe: row.importe,
        tipo: 'aportacion',
        fuente: 'excel',
        notas: row.notas,
      });
      imported += 1;
    } else {
      // Pension plan — aggregate by year
      if (!planAccum.has(row.targetId)) {
        const planes = await planesInversionService.getAllPlanes();
        const plan = planes.find((p) => p.id === row.targetId);
        if (!plan) {
          errors.push(`Plan con id ${row.targetId} no encontrado.`);
          continue;
        }
        planAccum.set(row.targetId, {
          ...plan,
          historialAportaciones: { ...(plan.historialAportaciones ?? {}) },
        });
      }
      const plan = planAccum.get(row.targetId)!;
      const mesKey = row.fecha.length >= 7
        ? row.fecha.slice(0, 7)
        : String(new Date(row.fecha).getFullYear());
      const existing = plan.historialAportaciones?.[mesKey] ?? { titular: 0, empresa: 0, total: 0 };
      plan.historialAportaciones = {
        ...plan.historialAportaciones,
        [mesKey]: {
          titular: (existing.titular ?? 0) + (row.importeIndividuo ?? 0),
          empresa: (existing.empresa ?? 0) + (row.importeEmpresa ?? 0),
          total: (existing.total ?? 0) + row.importe,
          fuente: 'manual',
        },
      };
      imported += 1;
    }
  }

  for (const [planId, plan] of planAccum) {
    plan.aportacionesRealizadas = Object.values(plan.historialAportaciones ?? {}).reduce(
      (sum, entry) => sum + (entry.total ?? 0), 0
    );
    await planesInversionService.updatePlan(planId, plan);
  }

  return { imported, skipped: 0, errors };
}

export function descargarPlantillaImportacionAportaciones(): void {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['posicion_id', 'posicion_nombre', 'entidad', 'fecha', 'importe', 'importe_empresa', 'importe_individuo', 'notas'],
    ['1', 'Plan pensiones indexado', 'MyInvestor', '2024-01-15', '', '100', '80', 'Aportación previa app'],
    ['2', 'Fondo renta variable', 'BBVA', '2024-02-15', '1500', '', '', 'Aportación puntual'],
  ]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Aportaciones');

  const wbArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbArray], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'plantilla_aportaciones_historicas.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
