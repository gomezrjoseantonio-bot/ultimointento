// Onboarding día 0 · C6 · parser de la plantilla Excel de inversiones.
// Patrón espejo · NO crea nada.
//
// Columnas (§2.5):
//   1 Tipo (fondo/accion/etf/crypto/plan_pensiones/deposito/otro) · 2 Entidad ·
//   3 Producto · 4 Unidades · 5 Coste adquisición € · 6 Fecha compra · 7 Valor de hoy €
import * as XLSX from 'xlsx';
import { toIsoDate } from './rentilaParserService';

export type TipoInversionTemplate =
  | 'fondo'
  | 'accion'
  | 'etf'
  | 'crypto'
  | 'plan_pensiones'
  | 'deposito'
  | 'otro';

export interface InversionTemplateRow {
  filaOriginal: number;
  tipo: TipoInversionTemplate;
  entidad: string | null;
  producto: string;
  unidades: number;
  costeAdquisicion: number;
  fechaCompra: string | null;
  valorHoy: number;
}

export class InversionesTemplateFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InversionesTemplateFormatError';
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

const COLUMNS: ColumnSpec[] = [
  { accept: ['tipo'], required: true },
  { accept: ['entidad'], required: false },
  { accept: ['producto', 'nombre'], required: true },
  { accept: ['unidades', 'participaciones'], required: false },
  { accept: ['coste adquisicion', 'coste', 'coste de adquisicion'], required: false },
  { accept: ['fecha compra', 'fecha'], required: false },
  { accept: ['valor de hoy', 'valor hoy', 'valor actual', 'valor'], required: false },
];

const headerMatches = (header: string, accept: string[]): boolean =>
  accept.some((token) => header === token || header.includes(token) || token.includes(header));

export const validateInversionesTemplateHeader = (headerRow: unknown[]): void => {
  const headers = headerRow.map(normalizeHeader);
  if (headers.length < COLUMNS.length) {
    throw new InversionesTemplateFormatError(
      `El fichero tiene ${headers.length} columnas; la plantilla de inversiones requiere ${COLUMNS.length}.`,
    );
  }
  const mismatches: string[] = [];
  COLUMNS.forEach((spec, index) => {
    if (!spec.required) return;
    const header = headers[index] ?? '';
    if (!headerMatches(header, spec.accept)) {
      mismatches.push(`columna ${index + 1} ("${header || '(vacía)'}") no coincide con ${spec.accept[0]}`);
    }
  });
  if (mismatches.length) {
    throw new InversionesTemplateFormatError(`El header no corresponde a la plantilla de inversiones: ${mismatches.join('; ')}.`);
  }
};

const toText = (value: unknown): string => String(value ?? '').trim();
const toNullableText = (value: unknown): string | null => {
  const t = toText(value);
  return t ? t : null;
};
const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = toText(value).replace(/€/g, '').trim();
  if (!raw) return 0;
  let normalized = raw;
  if (raw.includes(',')) normalized = raw.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};
const TIPOS: TipoInversionTemplate[] = ['fondo', 'accion', 'etf', 'crypto', 'plan_pensiones', 'deposito', 'otro'];
const toTipo = (value: unknown): TipoInversionTemplate => {
  const t = toText(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');
  return (TIPOS.find((x) => x === t) ?? 'otro');
};

const readSheetAsMatrix = async (file: File): Promise<unknown[][]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
};

export const parseInversionesTemplateXlsx = async (file: File): Promise<InversionTemplateRow[]> => {
  const matrix = await readSheetAsMatrix(file);
  if (!matrix.length) throw new InversionesTemplateFormatError('El fichero está vacío.');

  const [headerRow, ...dataRows] = matrix;
  validateInversionesTemplateHeader(headerRow);

  const rows: InversionTemplateRow[] = [];
  dataRows.forEach((cells, index) => {
    const producto = toText(cells[2]);
    const valorHoy = toNumber(cells[6]);
    if (!producto && !valorHoy) return;
    rows.push({
      filaOriginal: index + 2,
      tipo: toTipo(cells[0]),
      entidad: toNullableText(cells[1]),
      producto,
      unidades: toNumber(cells[3]),
      costeAdquisicion: toNumber(cells[4]),
      fechaCompra: toIsoDate(cells[5]) || null,
      valorHoy,
    });
  });

  return rows;
};
