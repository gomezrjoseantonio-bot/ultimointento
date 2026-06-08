// Commit 3 · Parser de la plantilla Excel propia de ATLAS.
//
// Columnas base obligatorias/mínimas (§ 1.6 del spec · 11 columnas):
//   1 Inmueble (nombre o ref. catastral) · 2 Habitación · 3 Tipo de contrato ·
//   4 Fecha inicio · 5 Fecha fin · 6 Inquilino nombre completo · 7 DNI/NIF ·
//   8 Email · 9 Teléfono · 10 Renta mensual € · 11 Fianza €.
//
// FIX P4 (espejo del wizard) · columnas OPCIONALES añadidas, reconocidas por
// NOMBRE de cabecera (no por posición) para ser RETROCOMPATIBLES con la plantilla
// de 11 columnas: Día de pago · Indexación · Reducción IRPF % · Cotitulares (NIFs).
// Si no están, los campos quedan a null/[] y el importador usa sus defaults.
//
// Se lee como matriz (header: 1) por coherencia con el parser Rentila y para
// mapear por posición de columna (las base) o por nombre (las opcionales).
import * as XLSX from 'xlsx';
import { toIsoDate } from './rentilaParserService';

export interface AtlasTemplateRow {
  filaOriginal: number;
  inmuebleNombreOrRC: string;
  habitacion: string | null;
  tipoContrato: string;       // enum ATLAS (validado más adelante en el normalizador)
  fechaInicio: string;        // ISO YYYY-MM-DD
  fechaFin: string | null;    // ISO o null
  inquilinoNombre: string;
  dni: string | null;
  email: string | null;
  telefono: string | null;
  rentaMensual: number;
  fianza: number;
  // ── P4 · columnas opcionales (espejo del wizard) · null/[] si no vienen ──
  diaPago: number | null;            // 1-31
  indexacion: string | null;         // texto crudo (none/ipc/irav/otros · normaliza el draft)
  reduccionPct: number | null;       // 0,50,60,70,90 (Ley 12/2023)
  cotitulares: string[];             // NIFs adicionales declarados en columna propia
}

/** Error lanzado cuando el header no coincide con la plantilla ATLAS. */
export class AtlasTemplateFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AtlasTemplateFormatError';
  }
}

const normalizeHeader = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

interface ColumnSpec {
  accept: string[];
  required: boolean;
}

const ATLAS_COLUMNS: ColumnSpec[] = [
  { accept: ['inmueble', 'inmueble (nombre o ref. catastral)', 'inmueble nombre o ref catastral'], required: true },
  { accept: ['habitacion', 'habitacion/estancia'], required: false },
  { accept: ['tipo de contrato', 'tipo'], required: true },
  { accept: ['fecha inicio', 'inicio'], required: true },
  { accept: ['fecha fin', 'fin'], required: false },
  { accept: ['inquilino nombre completo', 'inquilino', 'nombre completo', 'nombre'], required: true },
  { accept: ['dni/nif inquilino', 'dni', 'nif', 'dni/nif'], required: false },
  { accept: ['email inquilino', 'email', 'correo'], required: false },
  { accept: ['telefono inquilino', 'telefono', 'movil'], required: false },
  { accept: ['renta mensual €', 'renta mensual', 'renta', 'alquiler'], required: true },
  { accept: ['fianza €', 'fianza'], required: false },
];

const headerMatches = (header: string, accept: string[]): boolean =>
  accept.some((token) => header === token || header.includes(token) || token.includes(header));

// P4 · columnas opcionales reconocidas por NOMBRE (cualquier posición tras las
// base). Retrocompatible: si la cabecera no contiene estos tokens, no se leen.
const OPCIONALES_TOKENS = {
  diaPago: ['dia de pago', 'día de pago', 'dia pago', 'dia de cobro', 'día de cobro'],
  indexacion: ['indexacion', 'indexación'],
  reduccionPct: ['reduccion irpf', 'reducción irpf', 'reduccion', 'reducción'],
  cotitulares: ['cotitulares', 'nifs adicionales', 'cotitulares nifs'],
} as const;

const findOpcionalCol = (headers: string[], tokens: readonly string[]): number =>
  headers.findIndex((h) => h.length > 0 && tokens.some((t) => h === t || h.includes(t)));

export const validateAtlasTemplateHeader = (headerRow: unknown[]): void => {
  const headers = headerRow.map(normalizeHeader);

  if (headers.length < ATLAS_COLUMNS.length) {
    throw new AtlasTemplateFormatError(
      `El fichero tiene ${headers.length} columnas; la plantilla ATLAS requiere ${ATLAS_COLUMNS.length}.`,
    );
  }

  const mismatches: string[] = [];
  ATLAS_COLUMNS.forEach((spec, index) => {
    if (!spec.required) return;
    const header = headers[index] ?? '';
    if (!headerMatches(header, spec.accept)) {
      mismatches.push(`columna ${index + 1} ("${header || '(vacía)'}") no coincide con ${spec.accept[0]}`);
    }
  });

  if (mismatches.length) {
    throw new AtlasTemplateFormatError(`El header no corresponde a la plantilla ATLAS: ${mismatches.join('; ')}.`);
  }
};

const toText = (value: unknown): string => String(value ?? '').trim();
const toNullableText = (value: unknown): string | null => {
  const text = toText(value);
  return text ? text : null;
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = toText(value).replace(/€/g, '').replace(/%/g, '').trim();
  if (!raw) return 0;
  let normalized = raw;
  if (raw.includes(',')) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

// P4 · número opcional · null si la celda viene vacía (distinto de 0).
const toNullableNumber = (value: unknown): number | null => {
  if (!toText(value)) return null;
  const n = toNumber(value);
  return Number.isFinite(n) ? n : null;
};

// P4 · cotitulares declarados en columna propia · separa por , ; / y limpia.
const splitCotitulares = (value: unknown): string[] =>
  toText(value)
    .split(/[,;/]+/)
    .map((s) => s.trim())
    .filter(Boolean);

const readSheetAsMatrix = async (file: File): Promise<unknown[][]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
};

/**
 * Parsea la plantilla ATLAS (11 columnas) a AtlasTemplateRow[].
 * NO crea Contracts. Lanza AtlasTemplateFormatError si el header no encaja.
 */
export const parseAtlasTemplateXlsx = async (file: File): Promise<AtlasTemplateRow[]> => {
  const matrix = await readSheetAsMatrix(file);

  if (!matrix.length) {
    throw new AtlasTemplateFormatError('El fichero está vacío.');
  }

  const [headerRow, ...dataRows] = matrix;
  validateAtlasTemplateHeader(headerRow);

  // P4 · localizar columnas opcionales por nombre (retrocompatible · -1 = ausente).
  const headers = headerRow.map(normalizeHeader);
  const colDiaPago = findOpcionalCol(headers, OPCIONALES_TOKENS.diaPago);
  const colIndexacion = findOpcionalCol(headers, OPCIONALES_TOKENS.indexacion);
  const colReduccion = findOpcionalCol(headers, OPCIONALES_TOKENS.reduccionPct);
  const colCotitulares = findOpcionalCol(headers, OPCIONALES_TOKENS.cotitulares);

  const rows: AtlasTemplateRow[] = [];

  dataRows.forEach((cells, index) => {
    const inmuebleNombreOrRC = toText(cells[0]);
    const inquilinoNombre = toText(cells[5]);

    if (!inmuebleNombreOrRC && !inquilinoNombre) return;

    rows.push({
      filaOriginal: index + 2,
      inmuebleNombreOrRC,
      habitacion: toNullableText(cells[1]),
      tipoContrato: toText(cells[2]),
      fechaInicio: toIsoDate(cells[3]),
      fechaFin: toIsoDate(cells[4]) || null,
      inquilinoNombre,
      dni: toNullableText(cells[6]),
      email: toNullableText(cells[7]),
      telefono: toNullableText(cells[8]),
      rentaMensual: toNumber(cells[9]),
      fianza: toNumber(cells[10]),
      diaPago: colDiaPago >= 0 ? toNullableNumber(cells[colDiaPago]) : null,
      indexacion: colIndexacion >= 0 ? toNullableText(cells[colIndexacion]) : null,
      reduccionPct: colReduccion >= 0 ? toNullableNumber(cells[colReduccion]) : null,
      cotitulares: colCotitulares >= 0 ? splitCotitulares(cells[colCotitulares]) : [],
    });
  });

  return rows;
};
