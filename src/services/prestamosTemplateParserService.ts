// Onboarding día 0 · C6 · parser de la plantilla Excel de préstamos.
// Patrón espejo del de contratos/inmuebles · NO crea nada.
//
// Columnas base (§2.5 · obligatorias = nombre + principal inicial):
//   1 Nombre · 2 Inmueble vinculado (alias o RC · opcional) · 3 Cuenta de cargo
//   (IBAN o alias) · 4 Principal inicial € · 5 Principal vivo € · 6 TIN % ·
//   7 Plazo total (meses) · 8 Día de cargo · 9 Fecha primer cargo · 10 Tipo.
//
// FIX PUNTO 5 (P1) · ESPEJO del modal · columnas OPCIONALES añadidas a partir de
// la 11 (retrocompatible: la plantilla de 10 columnas sigue funcionando · las
// nuevas se leen por posición y, si faltan, quedan undefined):
//   11 Tipo de préstamo (hipotecario/personal/linea_credito/otro)
//   12 Interés de demora % · 13-17 Comisiones (apertura · mantenimiento ·
//   amort. anticipada · modif. condiciones · cancelación total) · 18 Carencia
//   (ninguna/solo_capital/total) · 19 Carencia meses · 20 Destino del capital
//   (adquisicion/reforma/cancelar_deuda/inversion/personal/otra) · 21 Destino
//   importe € · 22 Destino % · 23 Garantía (hipotecaria/personal/pignoraticia) ·
//   24 Garantía sobre (inmueble alias/RC · informativa).
// Multi-destino: 1 fila = 1 destino · el resto se edita en la ficha del préstamo
// (documentado en la pestaña "Léeme" de la plantilla).
import * as XLSX from 'xlsx';
import { toIsoDate } from './rentilaParserService';

export type TipoPrestamoTemplate = 'FIJO' | 'VARIABLE' | 'MIXTO';
export type TipoPrestamoV2Template = 'hipotecario' | 'personal' | 'linea_credito' | 'otro';
export type CarenciaTemplate = 'NINGUNA' | 'CAPITAL' | 'TOTAL';
export type DestinoTipoTemplate =
  | 'ADQUISICION' | 'REFORMA' | 'CANCELACION_DEUDA' | 'INVERSION' | 'PERSONAL' | 'OTRA';
export type GarantiaTipoTemplate = 'HIPOTECARIA' | 'PERSONAL' | 'PIGNORATICIA';

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
  // ── Opcionales (espejo del modal · P1) ────────────────────────────────────
  tipoPrestamoV2?: TipoPrestamoV2Template;
  interesDemoraPct?: number;
  comisionApertura?: number;
  comisionMantenimiento?: number;
  comisionAmortizacionAnticipada?: number;
  comisionModificacionCondiciones?: number;
  comisionCancelacionTotal?: number;
  carenciaTipo?: CarenciaTemplate;
  carenciaMeses?: number;
  destinoTipo?: DestinoTipoTemplate;
  destinoImporte?: number;
  destinoPorcentaje?: number;
  garantiaTipo?: GarantiaTipoTemplate;
  garantiaInmuebleRef?: string | null;
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

// Índice de la última columna OBLIGATORIA (principal inicial = col 4 · idx 3).
// FIX PUNTO 5 · solo exigimos llegar hasta las obligatorias · una plantilla de
// 10 columnas (legacy) o de 24 (espejo) valen igual · las que falten se
// interpretan como vacías al leer por posición.
const MIN_COLUMNAS = COLUMNS.reduce((max, spec, idx) => (spec.required ? idx + 1 : max), 0);

export const validatePrestamosTemplateHeader = (headerRow: unknown[]): void => {
  const headers = headerRow.map(normalizeHeader);
  if (headers.length < MIN_COLUMNAS) {
    throw new PrestamosTemplateFormatError(
      `El fichero tiene ${headers.length} columnas; la plantilla de préstamos requiere al menos ${MIN_COLUMNAS} (nombre … principal inicial).`,
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
// Número OPCIONAL · celda vacía → undefined (distinto de 0 · no pisa defaults).
const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === '' || value == null) return undefined;
  const t = typeof value === 'string' ? value.trim() : value;
  if (t === '') return undefined;
  return toNumber(value);
};
const toTipo = (value: unknown): TipoPrestamoTemplate => {
  const t = toText(value).toLowerCase();
  if (t.startsWith('var')) return 'VARIABLE';
  if (t.startsWith('mix')) return 'MIXTO';
  return 'FIJO';
};

const toTipoPrestamoV2 = (value: unknown): TipoPrestamoV2Template | undefined => {
  const t = toText(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!t) return undefined;
  if (t.startsWith('hipotec')) return 'hipotecario';
  if (t.includes('linea') || t.includes('credito')) return 'linea_credito';
  if (t.startsWith('personal')) return 'personal';
  return 'otro';
};

const toCarencia = (value: unknown): CarenciaTemplate | undefined => {
  const t = toText(value).toLowerCase();
  if (!t) return undefined;
  if (t.startsWith('total')) return 'TOTAL';
  if (t.includes('capital') || t.includes('solo')) return 'CAPITAL';
  return 'NINGUNA';
};

const toDestinoTipo = (value: unknown): DestinoTipoTemplate | undefined => {
  const t = toText(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!t) return undefined;
  if (t.startsWith('adquis')) return 'ADQUISICION';
  if (t.startsWith('reforma')) return 'REFORMA';
  if (t.includes('cancel') || t.includes('deuda')) return 'CANCELACION_DEUDA';
  if (t.startsWith('invers')) return 'INVERSION';
  if (t.startsWith('personal')) return 'PERSONAL';
  return 'OTRA';
};

const toGarantiaTipo = (value: unknown): GarantiaTipoTemplate | undefined => {
  const t = toText(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!t) return undefined;
  if (t.startsWith('hipotec')) return 'HIPOTECARIA';
  if (t.startsWith('pignor')) return 'PIGNORATICIA';
  if (t.startsWith('personal')) return 'PERSONAL';
  return undefined;
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
      // Opcionales · espejo del modal (P1) · ausentes en la plantilla legacy.
      tipoPrestamoV2: toTipoPrestamoV2(cells[10]),
      interesDemoraPct: toOptionalNumber(cells[11]),
      comisionApertura: toOptionalNumber(cells[12]),
      comisionMantenimiento: toOptionalNumber(cells[13]),
      comisionAmortizacionAnticipada: toOptionalNumber(cells[14]),
      comisionModificacionCondiciones: toOptionalNumber(cells[15]),
      comisionCancelacionTotal: toOptionalNumber(cells[16]),
      carenciaTipo: toCarencia(cells[17]),
      carenciaMeses: toOptionalNumber(cells[18]),
      destinoTipo: toDestinoTipo(cells[19]),
      destinoImporte: toOptionalNumber(cells[20]),
      destinoPorcentaje: toOptionalNumber(cells[21]),
      garantiaTipo: toGarantiaTipo(cells[22]),
      garantiaInmuebleRef: toNullableText(cells[23]),
    });
  });

  return rows;
};
