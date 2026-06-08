// Onboarding día 0 · parser de la plantilla Excel de inmuebles.
//
// Mapeo por NOMBRE de columna (no por posición): tolera el orden, columnas
// nuevas y la plantilla vieja de 12 columnas (retrocompatibilidad · §2.5).
// Espejo del formulario de inmueble · solo persiste lo que el form persiste.
// NO crea nada.
import * as XLSX from 'xlsx';
import { toIsoDate } from './rentilaParserService';
import type { Property } from './db';
import type { TipoActivo } from '../types/tipoActivo';

export type ModoExplotacionTemplate = 'piso_completo' | 'por_habitaciones';
export type UsoTipoTemplate = NonNullable<Property['usoTipo']>;

export interface InmuebleTemplateRow {
  filaOriginal: number;
  alias: string;
  direccion: string | null;
  tipoActivo: TipoActivo;
  refCatastral: string | null;
  usoTipo: UsoTipoTemplate | null;
  alquilerPorHabitaciones: boolean;
  modoExplotacion: ModoExplotacionTemplate;
  numeroHabitaciones: number | null;
  banos: number | null;
  m2: number | null;
  esUrbana: boolean;
  porcentajePropiedad: number | null;
  tieneParking: boolean;
  tieneTrastero: boolean;
  fechaCompra: string | null;
  precioCompra: number;
  gastosCompra: number;
  aportacionPropia: number;
  importeFinanciado: number;
  valorCatastral: number;
  valorCatastralConstruccion: number;
  valorCatastralRevisado: boolean;
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

type FieldKey =
  | 'alias' | 'direccion' | 'tipo' | 'refCatastral' | 'uso' | 'modo' | 'alquilerHab'
  | 'numHab' | 'banos' | 'm2' | 'urbana' | 'porcentaje' | 'parking' | 'trastero'
  | 'fecha' | 'precio' | 'gastos' | 'aportacion' | 'financiado' | 'vc' | 'vcc' | 'vcRevisado';

// Tokens aceptados por campo. El emparejamiento elige el MÁS específico (token
// más largo) para evitar colisiones (p.ej. "valor catastral construccion" no
// debe caer en "valor catastral").
const FIELDS: Record<FieldKey, string[]> = {
  alias: ['alias', 'nombre'],
  direccion: ['direccion'],
  tipo: ['tipo de inmueble', 'tipo inmueble', 'tipo'],
  refCatastral: ['referencia catastral', 'ref catastral', 'referencia', 'rc'],
  uso: ['uso y alquiler', 'uso alquiler', 'uso'],
  modo: ['modo explotacion', 'modo de explotacion', 'explotacion'],
  alquilerHab: ['alquiler por habitaciones', 'por habitaciones'],
  numHab: ['numero habitaciones', 'n habitaciones', 'nº habitaciones', 'habitaciones'],
  banos: ['banos', 'aseos'],
  m2: ['m2 utiles', 'm2', 'metros utiles', 'superficie', 'metros'],
  urbana: ['urbana/rustica', 'urbana o rustica', 'urbana', 'naturaleza'],
  porcentaje: ['% propiedad', 'porcentaje propiedad', 'porcentaje de propiedad', 'propiedad %'],
  parking: ['anexo parking', 'parking', 'garaje'],
  trastero: ['anexo trastero', 'trastero'],
  fecha: ['fecha compra', 'fecha de compra', 'fecha'],
  precio: ['precio compra', 'precio de compra', 'precio'],
  gastos: ['gastos compra', 'gastos de compra', 'gastos'],
  aportacion: ['aportacion propia', 'aportacion'],
  financiado: ['importe financiado', 'financiado'],
  vc: ['valor catastral total', 'valor catastral'],
  vcc: ['valor catastral construccion', 'vcc'],
  vcRevisado: ['valor catastral revisado', 'catastral revisado', 'revisado'],
};

const matchLen = (header: string, token: string): number => {
  if (header === token || header.includes(token) || token.includes(header)) {
    return Math.min(header.length, token.length);
  }
  return 0;
};

/** Asocia cada cabecera a su campo más específico. Primera columna gana. */
function buildHeaderIndex(headers: string[]): Partial<Record<FieldKey, number>> {
  const idx: Partial<Record<FieldKey, number>> = {};
  headers.forEach((h, col) => {
    let bestKey: FieldKey | null = null;
    let bestLen = 0;
    for (const key of Object.keys(FIELDS) as FieldKey[]) {
      for (const token of FIELDS[key]) {
        const len = matchLen(h, token);
        if (len > bestLen) {
          bestLen = len;
          bestKey = key;
        }
      }
    }
    if (bestKey !== null && idx[bestKey] === undefined) idx[bestKey] = col;
  });
  return idx;
}

export const validateInmueblesTemplateHeader = (headerRow: unknown[]): Partial<Record<FieldKey, number>> => {
  const headers = headerRow.map(normalizeHeader);
  const idx = buildHeaderIndex(headers);
  // Mínimo para reconocer la plantilla: poder ubicar alias o dirección.
  if (idx.alias === undefined && idx.direccion === undefined) {
    throw new InmueblesTemplateFormatError(
      'El fichero no corresponde a la plantilla de inmuebles (no se encuentra la columna Alias ni Dirección).',
    );
  }
  return idx;
};

const toText = (value: unknown): string => String(value ?? '').trim();
const toNullableText = (value: unknown): string | null => {
  const text = toText(value);
  return text ? text : null;
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = toText(value).replace(/[€%]/g, '').trim();
  if (!raw) return 0;
  // Formato es-ES "1.234,56" → 1234.56 · también acepta "1234.56".
  let normalized = raw;
  if (raw.includes(',')) normalized = raw.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toBool = (value: unknown): boolean => {
  const t = toText(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return ['si', 's', 'true', 'x', '1', 'yes', 'verdadero'].includes(t);
};

const TIPOS: TipoActivo[] = ['piso', 'parking', 'trastero', 'local', 'otro'];
const toTipoActivo = (value: unknown): TipoActivo => {
  const t = toText(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!t) return 'piso';
  if (t.includes('garaj')) return 'parking';
  return TIPOS.find((x) => t.includes(x)) ?? 'otro';
};

const toUsoTipo = (value: unknown): UsoTipoTemplate | null => {
  const t = toText(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!t) return null;
  if (t.includes('larga')) return 'larga_estancia';
  if (t.includes('temporada')) return 'temporada';
  if (t.includes('turist')) return 'turistico';
  if (t.includes('mixto')) return 'mixto';
  if (t.includes('habitual')) return 'vivienda_habitual';
  if (t.includes('disponible')) return 'disponible';
  return null;
};

// "rustica"/"rural" → false; por defecto urbana.
const toEsUrbana = (value: unknown): boolean => {
  const t = toText(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (t.includes('rustic') || t.includes('rural')) return false;
  return true;
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
 * Mapeo por nombre · tolera columnas nuevas, orden y la plantilla vieja.
 */
export const parseInmueblesTemplateXlsx = async (file: File): Promise<InmuebleTemplateRow[]> => {
  const matrix = await readSheetAsMatrix(file);
  if (!matrix.length) throw new InmueblesTemplateFormatError('El fichero está vacío.');

  const [headerRow, ...dataRows] = matrix;
  const idx = validateInmueblesTemplateHeader(headerRow);
  const at = (cells: unknown[], key: FieldKey): unknown => (idx[key] === undefined ? '' : cells[idx[key]!]);

  const rows: InmuebleTemplateRow[] = [];
  dataRows.forEach((cells, index) => {
    const alias = toText(at(cells, 'alias'));
    const direccion = toNullableText(at(cells, 'direccion'));
    const precioCompra = toNumber(at(cells, 'precio'));
    // Fila vacía · sin alias, dirección ni precio · se ignora.
    if (!alias && !direccion && !precioCompra) return;

    const numHabRaw = toNumber(at(cells, 'numHab'));
    const banosRaw = toNumber(at(cells, 'banos'));
    const m2Raw = toNumber(at(cells, 'm2'));
    const pctRaw = toNumber(at(cells, 'porcentaje'));
    // El modo se deriva de la columna legacy "modo explotación" o de la nueva
    // "alquiler por habitaciones (sí/no)".
    const modoLegacy = toText(at(cells, 'modo')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const alquilerHab = toBool(at(cells, 'alquilerHab')) || modoLegacy.includes('habitacion');

    rows.push({
      filaOriginal: index + 2,
      alias,
      direccion,
      tipoActivo: toTipoActivo(at(cells, 'tipo')),
      refCatastral: toNullableText(at(cells, 'refCatastral')),
      usoTipo: toUsoTipo(at(cells, 'uso')),
      alquilerPorHabitaciones: alquilerHab,
      modoExplotacion: alquilerHab ? 'por_habitaciones' : 'piso_completo',
      numeroHabitaciones: numHabRaw > 0 ? numHabRaw : null,
      banos: banosRaw > 0 ? banosRaw : null,
      m2: m2Raw > 0 ? m2Raw : null,
      esUrbana: idx.urbana === undefined ? true : toEsUrbana(at(cells, 'urbana')),
      porcentajePropiedad: pctRaw > 0 ? pctRaw : null,
      tieneParking: toBool(at(cells, 'parking')),
      tieneTrastero: toBool(at(cells, 'trastero')),
      fechaCompra: toIsoDate(at(cells, 'fecha')) || null,
      precioCompra,
      gastosCompra: toNumber(at(cells, 'gastos')),
      aportacionPropia: toNumber(at(cells, 'aportacion')),
      importeFinanciado: toNumber(at(cells, 'financiado')),
      valorCatastral: toNumber(at(cells, 'vc')),
      valorCatastralConstruccion: toNumber(at(cells, 'vcc')),
      valorCatastralRevisado: toBool(at(cells, 'vcRevisado')),
    });
  });

  return rows;
};
