// Commit 3 · Parser del formato real de exportación Rentila (12 columnas).
//
// Estructura real validada con 3 ficheros reales de Jose (§ 0.3 del spec):
//   1 ID · 2 Propiedad · 3 Tipo · 4 Inicio de alquiler · 5 Fin del alquiler ·
//   6 Nombre o compañía · 7 Alquiler · 8 Alquiler (DUPLICADO, se ignora) ·
//   9 Gastos · 10 IVA · 11 Fianza · 12 Otros gastos.
//
// Se lee la hoja como matriz (header: 1) en vez de objetos porque Rentila
// repite el header "Alquiler" en las columnas 7 y 8: con sheet_to_json por
// objeto la clave duplicada colapsaría y perderíamos la columna 7.
import * as XLSX from 'xlsx';

export interface RentilaRow {
  filaOriginal: number;       // número de fila en el Excel (1-based, incluye header)
  ficheroOrigen: string;      // nombre del fichero subido
  id: string | null;
  propiedad: string;          // col 2 · texto crudo
  tipo: string;               // col 3 · uno de los 5 valores reales
  inicioAlquiler: string;     // col 4 · normalizado a ISO YYYY-MM-DD
  finAlquiler: string | null; // col 5 · ISO o null si vacío
  inquilino: string;          // col 6 · texto crudo · puede tener cotitulares
  alquiler: number;           // col 7 · se ignora la col 8 (duplicada)
  gastos: number;             // col 9
  iva: string | null;         // col 10 · texto crudo (% o vacío)
  fianza: number;             // col 11
  otrosGastos: number;        // col 12
}

/** Error lanzado cuando el header del fichero no coincide con el formato Rentila. */
export class RentilaFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RentilaFormatError';
  }
}

const normalizeHeader = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Tokens aceptados por columna (ES + EN, Rentila exporta según idioma de la cuenta).
// `required` marca las columnas cuyo header DEBE encajar para aceptar el fichero.
interface ColumnSpec {
  key: keyof RentilaRow | 'alquilerDuplicado';
  accept: string[];
  required: boolean;
}

const RENTILA_COLUMNS: ColumnSpec[] = [
  { key: 'id', accept: ['id', 'identificador', 'reference', 'referencia'], required: false },
  { key: 'propiedad', accept: ['propiedad', 'property'], required: true },
  { key: 'tipo', accept: ['tipo', 'type'], required: true },
  { key: 'inicioAlquiler', accept: ['inicio de alquiler', 'inicio del alquiler', 'inicio', 'start of rental', 'rental start', 'start date'], required: true },
  { key: 'finAlquiler', accept: ['fin del alquiler', 'fin de alquiler', 'fin', 'end of rental', 'rental end', 'end date'], required: true },
  { key: 'inquilino', accept: ['nombre o compania', 'nombre o compañia', 'nombre compania', 'name or company', 'nombre', 'tenant'], required: true },
  { key: 'alquiler', accept: ['alquiler', 'rent'], required: true },
  { key: 'alquilerDuplicado', accept: ['alquiler', 'rent'], required: false },
  { key: 'gastos', accept: ['gastos', 'charges', 'expenses'], required: false },
  { key: 'iva', accept: ['iva', 'vat', 'tax'], required: false },
  { key: 'fianza', accept: ['fianza', 'deposit', 'bond'], required: false },
  { key: 'otrosGastos', accept: ['otros gastos', 'other charges', 'other expenses', 'otros'], required: false },
];

const headerMatches = (header: string, accept: string[]): boolean =>
  accept.some((token) => header === token || header.includes(token) || token.includes(header));

/**
 * Valida que la fila de cabecera corresponde al formato Rentila de 12 columnas.
 * Lanza RentilaFormatError con detalle si no encaja.
 */
export const validateRentilaHeader = (headerRow: unknown[]): void => {
  const headers = headerRow.map(normalizeHeader);

  if (headers.length < RENTILA_COLUMNS.length) {
    throw new RentilaFormatError(
      `El fichero tiene ${headers.length} columnas; el formato Rentila requiere ${RENTILA_COLUMNS.length}.`,
    );
  }

  const mismatches: string[] = [];
  RENTILA_COLUMNS.forEach((spec, index) => {
    if (!spec.required) return;
    const header = headers[index] ?? '';
    if (!headerMatches(header, spec.accept)) {
      mismatches.push(`columna ${index + 1} ("${header || '(vacía)'}") no coincide con ${spec.accept[0]}`);
    }
  });

  if (mismatches.length) {
    throw new RentilaFormatError(`El header no corresponde al formato Rentila: ${mismatches.join('; ')}.`);
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

  // Formato español "1.234,56" → "1234.56". Si sólo hay coma, trátala como decimal.
  let normalized = raw;
  if (raw.includes(',')) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Normaliza fechas a ISO YYYY-MM-DD. Soporta serial Excel y DD/MM/YYYY (./-). */
export const toIsoDate = (value: unknown): string => {
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }

  const raw = toText(value);
  if (!raw) return '';

  // Ya viene en ISO.
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const parts = raw.replace(/\./g, '/').replace(/-/g, '/').split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (y.length === 4) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  return '';
};

const readSheetAsMatrix = async (file: File): Promise<unknown[][]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
};

/**
 * Parsea un fichero Excel de exportación Rentila (12 columnas) a RentilaRow[].
 * NO crea Contracts. Lanza RentilaFormatError si el header no encaja.
 */
export const parseRentilaXlsx = async (file: File): Promise<RentilaRow[]> => {
  const matrix = await readSheetAsMatrix(file);

  if (!matrix.length) {
    throw new RentilaFormatError('El fichero está vacío.');
  }

  const [headerRow, ...dataRows] = matrix;
  validateRentilaHeader(headerRow);

  const rows: RentilaRow[] = [];

  dataRows.forEach((cells, index) => {
    const propiedad = toText(cells[1]);
    const inquilino = toText(cells[5]);

    // Saltar filas totalmente vacías (Rentila a veces deja huecos al final).
    if (!propiedad && !inquilino) return;

    rows.push({
      filaOriginal: index + 2, // +1 por header, +1 porque las filas Excel son 1-based
      ficheroOrigen: file.name,
      id: toNullableText(cells[0]),
      propiedad,
      tipo: toText(cells[2]),
      inicioAlquiler: toIsoDate(cells[3]),
      finAlquiler: toIsoDate(cells[4]) || null,
      inquilino,
      alquiler: toNumber(cells[6]),       // col 7 · se ignora cells[7] (col 8 duplicada)
      gastos: toNumber(cells[8]),
      iva: toNullableText(cells[9]),
      fianza: toNumber(cells[10]),
      otrosGastos: toNumber(cells[11]),
    });
  });

  return rows;
};

/**
 * Parsea varios ficheros Rentila y concatena los resultados.
 * Rentila exporta activos y archivados por separado: cada RentilaRow conserva
 * su `ficheroOrigen`. Si algún fichero no encaja, propaga RentilaFormatError.
 */
export const parseRentilaFiles = async (files: File[]): Promise<RentilaRow[]> => {
  const perFile = await Promise.all(files.map((file) => parseRentilaXlsx(file)));
  return perFile.flat();
};
