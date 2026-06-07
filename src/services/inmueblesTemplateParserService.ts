// Onboarding día 0 · C4 · parser de la plantilla Excel de inmuebles.
//
// Replica EXACTAMENTE el patrón de `atlasTemplateParserService` (contratos):
// lectura como matriz (header:1), validación de cabecera, NO crea nada.
//
// Columnas (§2.3 de la tarea · estructura de compra incluida):
//   1 Alias · 2 Dirección · 3 Referencia catastral · 4 Modo explotación
//   (completo/habitaciones) · 5 Nº habitaciones · 6 Fecha compra · 7 Precio €
//   8 Gastos compra € · 9 Aportación propia € · 10 Importe financiado €
//   11 Valor catastral € · 12 Valor catastral construcción €
import * as XLSX from 'xlsx';
import { toIsoDate } from './rentilaParserService';

export type ModoExplotacionTemplate = 'piso_completo' | 'por_habitaciones';

export interface InmuebleTemplateRow {
  filaOriginal: number;
  alias: string;
  direccion: string | null;
  refCatastral: string | null;
  modoExplotacion: ModoExplotacionTemplate;
  numeroHabitaciones: number | null;
  fechaCompra: string | null;     // ISO o null
  precioCompra: number;
  gastosCompra: number;
  aportacionPropia: number;
  importeFinanciado: number;
  valorCatastral: number;
  valorCatastralConstruccion: number;
}

/** Error lanzado cuando el header no coincide con la plantilla de inmuebles. */
export class InmueblesTemplateFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InmueblesTemplateFormatError';
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
  { accept: ['alias', 'nombre'], required: true },
  { accept: ['direccion', 'dirección'], required: false },
  { accept: ['referencia catastral', 'ref catastral', 'rc', 'referencia'], required: false },
  { accept: ['modo explotacion', 'modo de explotacion', 'explotacion', 'modo'], required: false },
  { accept: ['numero habitaciones', 'n habitaciones', 'nº habitaciones', 'habitaciones'], required: false },
  { accept: ['fecha compra', 'fecha de compra', 'fecha'], required: false },
  { accept: ['precio compra', 'precio', 'precio €', 'precio de compra'], required: true },
  { accept: ['gastos compra', 'gastos', 'gastos de compra'], required: false },
  { accept: ['aportacion propia', 'aportación propia', 'aportacion'], required: false },
  { accept: ['importe financiado', 'financiado'], required: false },
  { accept: ['valor catastral', 'valor catastral total', 'vc'], required: false },
  { accept: ['valor catastral construccion', 'valor catastral construcción', 'vcc', 'construccion'], required: false },
];

const headerMatches = (header: string, accept: string[]): boolean =>
  accept.some((token) => header === token || header.includes(token) || token.includes(header));

export const validateInmueblesTemplateHeader = (headerRow: unknown[]): void => {
  const headers = headerRow.map(normalizeHeader);
  if (headers.length < COLUMNS.length) {
    throw new InmueblesTemplateFormatError(
      `El fichero tiene ${headers.length} columnas; la plantilla de inmuebles requiere ${COLUMNS.length}.`,
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
    throw new InmueblesTemplateFormatError(`El header no corresponde a la plantilla de inmuebles: ${mismatches.join('; ')}.`);
  }
};

const toText = (value: unknown): string => String(value ?? '').trim();
const toNullableText = (value: unknown): string | null => {
  const text = toText(value);
  return text ? text : null;
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

const toModoExplotacion = (value: unknown): ModoExplotacionTemplate => {
  const t = toText(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (t.includes('habitacion')) return 'por_habitaciones';
  return 'piso_completo';
};

const readSheetAsMatrix = async (file: File): Promise<unknown[][]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
};

/**
 * Parsea la plantilla de inmuebles a InmuebleTemplateRow[]. NO crea Properties.
 * Lanza InmueblesTemplateFormatError si el header no encaja.
 */
export const parseInmueblesTemplateXlsx = async (file: File): Promise<InmuebleTemplateRow[]> => {
  const matrix = await readSheetAsMatrix(file);
  if (!matrix.length) throw new InmueblesTemplateFormatError('El fichero está vacío.');

  const [headerRow, ...dataRows] = matrix;
  validateInmueblesTemplateHeader(headerRow);

  const rows: InmuebleTemplateRow[] = [];
  dataRows.forEach((cells, index) => {
    const alias = toText(cells[0]);
    const precioCompra = toNumber(cells[6]);
    // Fila vacía · sin alias ni precio · se ignora.
    if (!alias && !precioCompra) return;

    const numeroHabitacionesRaw = toNumber(cells[4]);
    rows.push({
      filaOriginal: index + 2,
      alias,
      direccion: toNullableText(cells[1]),
      refCatastral: toNullableText(cells[2]),
      modoExplotacion: toModoExplotacion(cells[3]),
      numeroHabitaciones: numeroHabitacionesRaw > 0 ? numeroHabitacionesRaw : null,
      fechaCompra: toIsoDate(cells[5]) || null,
      precioCompra,
      gastosCompra: toNumber(cells[7]),
      aportacionPropia: toNumber(cells[8]),
      importeFinanciado: toNumber(cells[9]),
      valorCatastral: toNumber(cells[10]),
      valorCatastralConstruccion: toNumber(cells[11]),
    });
  });

  return rows;
};
