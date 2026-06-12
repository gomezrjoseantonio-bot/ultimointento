// Onboarding día 0 · C6 / FIX PUNTO 7 · parser de la plantilla Excel de inversiones.
// Patrón espejo · NO crea nada.
//
// Espejo de las 6 familias del modal "Nueva posición" (§2.2). Columnas
// resueltas POR NOMBRE de cabecera (no por índice) → una plantilla vieja de 7
// columnas (Tipo · Entidad · Producto · Unidades · Coste · Fecha · Valor) sigue
// funcionando, y las columnas nuevas (Subtipo · ISIN · % atribución · TAE ·
// Plazo) son opcionales. Obligatorias SOLO: Tipo y Producto.
import * as XLSX from 'xlsx';
import { toIsoDate } from './rentilaParserService';

/** Familia de la posición · espejo del selector de 6 familias del modal. */
export type FamiliaInversionTemplate =
  | 'plan_pensiones'
  | 'fondo'
  | 'accion_etf_reit'
  | 'prestamo_activo'
  | 'deposito_cuenta'
  | 'crypto'
  | 'otro';

export interface InversionTemplateRow {
  filaOriginal: number;
  /** Familia (espejo modal). Retrocompatible: 'fondo' viejo → 'fondo'. */
  tipo: FamiliaInversionTemplate;
  /** Subtipo/clase libre (PPE · ETF · REIT · P2P · cuenta · plazo…). */
  subtipo: string | null;
  entidad: string | null;
  producto: string;
  /** ISIN o ticker (fondos · acciones/ETF). */
  isin: string | null;
  unidades: number;
  costeAdquisicion: number;
  fechaCompra: string | null;
  valorHoy: number;
  /** % de atribución para participaciones (CB · sociedades). */
  porcentajeAtribucion: number | null;
  /** TAE/TIN % (depósito · préstamo-activo). */
  tae: number | null;
  /** Plazo en meses (depósito a plazo · préstamo). */
  plazoMeses: number | null;
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

// ── Resolución de columnas por nombre (espejo · retrocompatible) ─────────────
type FieldKey =
  | 'tipo'
  | 'subtipo'
  | 'entidad'
  | 'producto'
  | 'isin'
  | 'unidades'
  | 'costeAdquisicion'
  | 'fechaCompra'
  | 'valorHoy'
  | 'porcentajeAtribucion'
  | 'tae'
  | 'plazoMeses';

interface FieldSpec {
  accept: string[];
  required: boolean;
}

// Orden de prioridad · cada campo toma la primera cabecera (aún no tomada) que
// contenga alguno de sus tokens. Los tokens más específicos van en familias
// distintas para que "valor de hoy" no lo capture "valor" antes de tiempo.
const FIELDS: Record<FieldKey, FieldSpec> = {
  tipo: { accept: ['tipo', 'familia'], required: true },
  subtipo: { accept: ['subtipo', 'clase'], required: false },
  entidad: { accept: ['entidad', 'broker', 'banco'], required: false },
  producto: { accept: ['producto', 'nombre'], required: true },
  isin: { accept: ['isin', 'ticker'], required: false },
  unidades: { accept: ['unidades', 'participaciones', 'titulos'], required: false },
  costeAdquisicion: { accept: ['coste'], required: false },
  fechaCompra: { accept: ['fecha'], required: false },
  valorHoy: { accept: ['valor de hoy', 'valor hoy', 'valor actual', 'valor'], required: false },
  porcentajeAtribucion: { accept: ['atribucion', '% atribucion', 'porcentaje'], required: false },
  tae: { accept: ['tae', 'tin'], required: false },
  plazoMeses: { accept: ['plazo', 'meses'], required: false },
};

type ColumnMap = Partial<Record<FieldKey, number>>;

const headerMatches = (header: string, accept: string[]): boolean =>
  header.length > 0 && accept.some((token) => header.includes(token));

const resolveColumns = (headerRow: unknown[]): ColumnMap => {
  const headers = headerRow.map(normalizeHeader);
  const map: ColumnMap = {};
  const taken = new Set<number>();
  (Object.keys(FIELDS) as FieldKey[]).forEach((key) => {
    const { accept } = FIELDS[key];
    for (let i = 0; i < headers.length; i++) {
      if (taken.has(i)) continue;
      if (headerMatches(headers[i], accept)) {
        map[key] = i;
        taken.add(i);
        break;
      }
    }
  });
  return map;
};

export const validateInversionesTemplateHeader = (headerRow: unknown[]): ColumnMap => {
  const map = resolveColumns(headerRow);
  const faltan = (Object.keys(FIELDS) as FieldKey[])
    .filter((k) => FIELDS[k].required && map[k] === undefined)
    .map((k) => FIELDS[k].accept[0]);
  if (faltan.length) {
    throw new InversionesTemplateFormatError(
      `El header no corresponde a la plantilla de inversiones · faltan columnas obligatorias: ${faltan.join(', ')}.`,
    );
  }
  return map;
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
const toNullableNumber = (value: unknown): number | null => {
  if (toText(value) === '') return null;
  return toNumber(value);
};

// Familia · normaliza alias y tipos viejos a las 6 familias del modal.
const FAMILIA_ALIASES: Record<string, FamiliaInversionTemplate> = {
  plan_pensiones: 'plan_pensiones',
  plan: 'plan_pensiones',
  plan_empleo: 'plan_pensiones',
  plan_de_pensiones: 'plan_pensiones',
  ppi: 'plan_pensiones',
  ppe: 'plan_pensiones',
  ppes: 'plan_pensiones',
  ppa: 'plan_pensiones',
  fondo: 'fondo',
  fondo_inversion: 'fondo',
  fi: 'fondo',
  accion_etf_reit: 'accion_etf_reit',
  accion: 'accion_etf_reit',
  acciones: 'accion_etf_reit',
  etf: 'accion_etf_reit',
  reit: 'accion_etf_reit',
  prestamo_activo: 'prestamo_activo',
  prestamo: 'prestamo_activo',
  prestamo_p2p: 'prestamo_activo',
  p2p: 'prestamo_activo',
  deposito_cuenta: 'deposito_cuenta',
  deposito: 'deposito_cuenta',
  deposito_plazo: 'deposito_cuenta',
  cuenta: 'deposito_cuenta',
  cuenta_remunerada: 'deposito_cuenta',
  crypto: 'crypto',
  cripto: 'crypto',
  otro: 'otro',
};

const toFamilia = (value: unknown): FamiliaInversionTemplate => {
  const t = toText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[/·.,]/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return FAMILIA_ALIASES[t] ?? 'otro';
};

const readSheetAsMatrix = async (file: File): Promise<unknown[][]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
};

const cell = (cells: unknown[], col: number | undefined): unknown =>
  col === undefined ? '' : cells[col];

export const parseInversionesTemplateXlsx = async (file: File): Promise<InversionTemplateRow[]> => {
  const matrix = await readSheetAsMatrix(file);
  if (!matrix.length) throw new InversionesTemplateFormatError('El fichero está vacío.');

  const [headerRow, ...dataRows] = matrix;
  const cols = validateInversionesTemplateHeader(headerRow);

  const rows: InversionTemplateRow[] = [];
  dataRows.forEach((cells, index) => {
    const producto = toText(cell(cells, cols.producto));
    const valorHoy = toNumber(cell(cells, cols.valorHoy));
    if (!producto && !valorHoy) return;
    rows.push({
      filaOriginal: index + 2,
      tipo: toFamilia(cell(cells, cols.tipo)),
      subtipo: toNullableText(cell(cells, cols.subtipo)),
      entidad: toNullableText(cell(cells, cols.entidad)),
      producto,
      isin: toNullableText(cell(cells, cols.isin)),
      unidades: toNumber(cell(cells, cols.unidades)),
      costeAdquisicion: toNumber(cell(cells, cols.costeAdquisicion)),
      fechaCompra: toIsoDate(cell(cells, cols.fechaCompra)) || null,
      valorHoy,
      porcentajeAtribucion: toNullableNumber(cell(cells, cols.porcentajeAtribucion)),
      tae: toNullableNumber(cell(cells, cols.tae)),
      plazoMeses: toNullableNumber(cell(cells, cols.plazoMeses)),
    });
  });

  return rows;
};
