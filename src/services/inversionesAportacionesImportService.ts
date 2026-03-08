import * as XLSX from 'xlsx';
import { inversionesService } from './inversionesService';
import { Aportacion, PosicionInversion } from '../types/inversiones';

export interface ImportAportacionesResult {
  imported: number;
  skipped: number;
  errors: string[];
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

  const value = raw.trim().replace(/\s/g, '');
  if (!value) return 0;

  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');

  // Use the last decimal separator if present, and strip the rest as thousand separators.
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

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().split('T')[0];
  }

  if (typeof raw === 'number') {
    const parsedCode = XLSX.SSF.parse_date_code(raw);
    if (parsedCode) {
      const jsDate = new Date(parsedCode.y, parsedCode.m - 1, parsedCode.d);
      return jsDate.toISOString().split('T')[0];
    }
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const isoDate = new Date(trimmed);
    if (!Number.isNaN(isoDate.getTime())) return isoDate.toISOString().split('T')[0];

    const match = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      const normalizedYear = year < 100 ? 2000 + year : year;
      const parsed = new Date(normalizedYear, month - 1, day);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
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

async function buildAportacionesFromFile(file: File, posicion: PosicionInversion): Promise<ImportAportacionesResult & { aportaciones: Omit<Aportacion, 'id'>[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { imported: 0, skipped: 1, errors: ['El archivo no contiene hojas.'], aportaciones: [] };
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

  const aportaciones: Omit<Aportacion, 'id'>[] = [];
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

    const notasRaw = getRowValue(row, ['notas', 'nota', 'comentario', 'descripcion']);
    const notasBase = typeof notasRaw === 'string' && notasRaw.trim()
      ? notasRaw.trim()
      : 'Importación histórica';

    if (posicion.tipo === 'plan_pensiones' || posicion.tipo === 'plan_empleo') {
      const importeEmpresa = parseAmount(getRowValue(row, ['importe_empresa', 'aportacion_empresa', 'empresa']));
      const importeIndividuo = parseAmount(getRowValue(row, ['importe_individuo', 'aportacion_individuo', 'individuo', 'importe']));

      if (importeEmpresa <= 0 && importeIndividuo <= 0) {
        skipped += 1;
        errors.push(`Fila ${rowNumber}: debes informar al menos una aportación (empresa o individuo).`);
        return;
      }

      if (importeEmpresa > 0) {
        aportaciones.push({
          fecha,
          importe: importeEmpresa,
          tipo: 'aportacion',
          notas: `${notasBase} · Empresa`,
        });
      }

      if (importeIndividuo > 0) {
        aportaciones.push({
          fecha,
          importe: importeIndividuo,
          tipo: 'aportacion',
          notas: `${notasBase} · Individuo`,
        });
      }

      return;
    }

    const importe = parseAmount(getRowValue(row, ['importe', 'aportacion', 'monto', 'amount']));
    if (importe <= 0) {
      skipped += 1;
      errors.push(`Fila ${rowNumber}: importe no válido.`);
      return;
    }

    aportaciones.push({
      fecha,
      importe,
      tipo: 'aportacion',
      notas: notasBase,
    });
  });

  return {
    imported: 0,
    skipped,
    errors,
    aportaciones,
  };
}

export async function importarAportacionesHistoricas(file: File, posicion: PosicionInversion): Promise<ImportAportacionesResult> {
  const filename = file.name.toLowerCase();
  if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls')) {
    return {
      imported: 0,
      skipped: 1,
      errors: ['Formato no válido. Usa un archivo Excel (.xlsx o .xls).'],
    };
  }

  const parsingResult = await buildAportacionesFromFile(file, posicion);

  const aportacionesOrdenadas = [...parsingResult.aportaciones].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
  );

  for (const aportacion of aportacionesOrdenadas) {
    await inversionesService.addAportacion(posicion.id, aportacion);
  }

  return {
    imported: aportacionesOrdenadas.length,
    skipped: parsingResult.skipped,
    errors: parsingResult.errors,
  };
}

export function descargarPlantillaImportacionAportaciones(): void {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Fecha', 'Importe', 'Importe Empresa', 'Importe Individuo', 'Notas'],
    ['2024-01-15', '1500', '', '', 'Aportación inicial antes de Atlas'],
    ['2024-02-15', '', '100', '80', 'Plan pensiones febrero'],
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
