// Onboarding día 0 · C6 · parser de la plantilla Excel de préstamos.
// Patrón espejo del de contratos/inmuebles · NO crea nada.
//
// Columnas (§2.5):
//   1 Nombre · 2 Inmueble vinculado (alias o RC · opcional) · 3 Cuenta de cargo
//   (IBAN o alias) · 4 Principal inicial € · 5 Principal vivo € · 6 TIN % ·
//   7 Plazo total (meses) · 8 Día de cargo · 9 Fecha primer cargo · 10 Tipo.
import * as XLSX from 'xlsx';
import { toIsoDate } from './rentilaParserService';

export type TipoPrestamoTemplate = 'FIJO' | 'VARIABLE' | 'MIXTO';

export interface PrestamoTemplateRow {
  filaOriginal: number;
  nombre: string;
  inmuebleRef: string | null; // alias o RC · opcional
  cuentaRef: string | null;   // IBAN o alias
  principalInicial: number;
  principalVivo: number;
  tin: number;
  plazoMeses: number;
  diaCargo: number;
  fechaPrimerCargo: string | null;
  tipo: TipoPrestamoTemplate;
}

export class PrestamosTemplateFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrestamosTemplateFormatError';
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
  { accept: ['nombre'], required: true },
  { accept: ['inmueble vinculado', 'inmueble', 'inmueble (alias o rc)'], required: false },
  { accept: ['cuenta de cargo', 'cuenta', 'iban'], required: false },
  { accept: ['principal inicial', 'principal'], required: true },
  { accept: ['principal vivo', 'pendiente'], required: false },
  { accept: ['tin', 'tin %', 'interes'], required: false },
  { accept: ['plazo total', 'plazo', 'plazo meses', 'plazo total (meses)'], required: false },
  { accept: ['dia de cargo', 'dia cargo', 'dia'], required: false },
  { accept: ['fecha primer cargo', 'fecha', 'primer cargo'], required: false },
  { accept: ['tipo', 'tipo (fijo/variable/mixto)'], required: false },
];

const headerMatches = (header: string, accept: string[]): boolean =>
  accept.some((token) => header === token || header.includes(token) || token.includes(header));

export const validatePrestamosTemplateHeader = (headerRow: unknown[]): void => {
  const headers = headerRow.map(normalizeHeader);
  if (headers.length < COLUMNS.length) {
    throw new PrestamosTemplateFormatError(
      `El fichero tiene ${headers.length} columnas; la plantilla de préstamos requiere ${COLUMNS.length}.`,
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
    throw new PrestamosTemplateFormatError(`El header no corresponde a la plantilla de préstamos: ${mismatches.join('; ')}.`);
  }
};

const toText = (value: unknown): string => String(value ?? '').trim();
const toNullableText = (value: unknown): string | null => {
  const t = toText(value);
  return t ? t : null;
};
const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = toText(value).replace(/[€%]/g, '').trim();
  if (!raw) return 0;
  let normalized = raw;
  if (raw.includes(',')) normalized = raw.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};
const toTipo = (value: unknown): TipoPrestamoTemplate => {
  const t = toText(value).toLowerCase();
  if (t.startsWith('var')) return 'VARIABLE';
  if (t.startsWith('mix')) return 'MIXTO';
  return 'FIJO';
};

const readSheetAsMatrix = async (file: File): Promise<unknown[][]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
};

export const parsePrestamosTemplateXlsx = async (file: File): Promise<PrestamoTemplateRow[]> => {
  const matrix = await readSheetAsMatrix(file);
  if (!matrix.length) throw new PrestamosTemplateFormatError('El fichero está vacío.');

  const [headerRow, ...dataRows] = matrix;
  validatePrestamosTemplateHeader(headerRow);

  const rows: PrestamoTemplateRow[] = [];
  dataRows.forEach((cells, index) => {
    const nombre = toText(cells[0]);
    const principalInicial = toNumber(cells[3]);
    if (!nombre && !principalInicial) return;
    const principalVivo = toNumber(cells[4]);
    rows.push({
      filaOriginal: index + 2,
      nombre,
      inmuebleRef: toNullableText(cells[1]),
      cuentaRef: toNullableText(cells[2]),
      principalInicial,
      principalVivo: principalVivo > 0 ? principalVivo : principalInicial,
      tin: toNumber(cells[5]),
      plazoMeses: Math.round(toNumber(cells[6])),
      diaCargo: Math.min(28, Math.max(1, Math.round(toNumber(cells[7])) || 1)),
      fechaPrimerCargo: toIsoDate(cells[8]) || null,
      tipo: toTipo(cells[9]),
    });
  });

  return rows;
};
