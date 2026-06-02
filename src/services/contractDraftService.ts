// Commit 4 · Normalizador a ContractDraft (formato intermedio común) + mapeos
// de tipo + fuzzy match de inmuebles + cotitulares + detección de duplicados +
// clasificación en 3 secciones (listos / revisar / duplicados).
//
// Tanto Rentila como la plantilla ATLAS se normalizan a ContractDraft antes de
// crear Contracts (la creación efectiva es el commit 7). Las funciones núcleo son
// PURAS: reciben los inmuebles y contratos existentes como parámetros para ser
// testeables sin IndexedDB. Hay wrappers async que cargan de la BD para la UI.
import { initDB, Contract, Property } from './db';
import { RentilaRow } from './rentilaParserService';
import { AtlasTemplateRow } from './atlasTemplateParserService';

export interface ContractDraft {
  filaOriginal: number;
  ficheroOrigen: string;
  origen: 'rentila' | 'plantilla_atlas';

  // Mapeo de inmueble · resuelto o pendiente
  inmuebleRaw: string;
  inmuebleIdSugerido: number | null;
  inmuebleIdConfirmado: number | null;

  // Inquilino
  inquilinoNombre: string;
  inquilinoCotitulares: string[];
  inquilinoDni: string | null;
  inquilinoEmail: string | null;
  inquilinoTelefono: string | null;
  inquilinoExistenteId: number | null;

  // Datos del contrato
  modalidadAtlas: 'habitual' | 'vacacional';
  fechaInicio: string;
  fechaFin: string | null;
  rentaMensual: number;
  fianza: number;

  // Clasificación
  seccion: 'listos' | 'revisar' | 'duplicados';
  motivoSeccion: string;

  // Decisión usuario · solo aplica si seccion=duplicados
  decisionDuplicado: 'omitir' | 'fusionar' | 'crear_nuevo' | null;
}

/** Umbral de confianza para considerar un inmueble mapeado automáticamente. */
export const UMBRAL_CONFIANZA_INMUEBLE = 0.7;
/** Umbral de similitud de nombre para considerar un inquilino duplicado. */
export const UMBRAL_DUPLICADO_NOMBRE = 0.85;

// Referencia catastral española de 20 caracteres: 7 dígitos + 2 letras +
// 4 dígitos + 1 letra + 4 dígitos + 2 letras.
const RC_REGEX = /\d{7}[A-Z]{2}\d{4}[A-Z]\d{4}[A-Z]{2}/i;
const RC_REGEX_GLOBAL = /\d{7}[A-Z]{2}\d{4}[A-Z]\d{4}[A-Z]{2}/gi;

// ───────────────────────────── Mapeo de tipos ─────────────────────────────

/** Mapeo de los 5 tipos Rentila a las 2 modalidades que ATLAS distingue hoy. */
export const MAPEO_TIPO_RENTILA_ATLAS: Record<string, 'habitual' | 'vacacional'> = {
  vivienda: 'habitual',
  habitacion: 'habitual',
  'habitacion temporada': 'vacacional',
  temporada: 'vacacional',
  otro: 'habitual',
};

const normalizeBasic = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Mapea el tipo Rentila (col 3) a modalidad ATLAS. Tolerante a los valores
 * cortos ("habitación temporada") y a las frases largas ("Contrato de
 * arrendamiento de temporada"): cualquier mención a temporada/vacacional →
 * vacacional; el resto (vivienda, habitación, otro) → habitual.
 */
export const mapTipoRentilaToAtlas = (tipo: string | undefined | null): 'habitual' | 'vacacional' => {
  const normalized = normalizeBasic(tipo || '');
  if (normalized in MAPEO_TIPO_RENTILA_ATLAS) return MAPEO_TIPO_RENTILA_ATLAS[normalized];
  if (normalized.includes('vacacional') || normalized.includes('temporada')) return 'vacacional';
  return 'habitual';
};

/** Mapea el tipo de contrato de la plantilla ATLAS a modalidad. */
export const mapTipoAtlasToModalidad = (tipoContrato: string | undefined | null): 'habitual' | 'vacacional' => {
  const normalized = normalizeBasic(tipoContrato || '');
  if (normalized.includes('vacacional') || normalized.includes('temporada')) return 'vacacional';
  return 'habitual';
};

// ───────────────────────────── Cotitulares ─────────────────────────────

/**
 * Separa cotitulares del nombre del inquilino. El primero es el principal,
 * el resto cotitulares. Sin comas → 0 cotitulares.
 */
export const detectarCotitulares = (nombre: string): { principal: string; cotitulares: string[] } => {
  const parts = (nombre || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length <= 1) return { principal: (nombre || '').trim(), cotitulares: [] };
  return { principal: parts[0], cotitulares: parts.slice(1) };
};

// ───────────────────────────── Fuzzy match ─────────────────────────────

const normalizeName = (text: string): string => {
  let t = (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  t = t.replace(RC_REGEX_GLOBAL, ' ');         // quitar referencias catastrales
  t = t.replace(/^\s*\d+\s*[-_.]\s*/, ' ');    // quitar prefijo "5-" / "01-"
  t = t.replace(/[^a-z0-9ñ]+/g, ' ');          // separadores → espacio
  return t.replace(/\s+/g, ' ').trim();
};

const normalizeDni = (dni: string | null | undefined): string =>
  (dni || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const levenshtein = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
};

/**
 * Similitud normalizada [0..1] entre dos textos ya normalizados.
 * Combina: igualdad exacta, contención por palabras completas y ratio Levenshtein.
 */
export const similarity = (a: string, b: string): number => {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const wordsA = a.split(' ').filter(Boolean);
  const wordsB = b.split(' ').filter(Boolean);

  // Todas las palabras del más corto aparecen en el más largo (p.ej. "manresa"
  // dentro de la dirección de "Sant Joan d'En Coll, Manresa").
  const [shorter, longer] = wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
  const longerSet = new Set(longer);
  if (shorter.length > 0 && shorter.every((w) => longerSet.has(w))) {
    return 0.7 + 0.3 * (shorter.length / longer.length);
  }

  // Solapamiento parcial de palabras.
  const common = wordsA.filter((w) => wordsB.includes(w)).length;
  const tokenScore = common / Math.max(wordsA.length, wordsB.length);

  // Ratio Levenshtein sobre la cadena completa.
  const levScore = 1 - levenshtein(a, b) / Math.max(a.length, b.length);

  return Math.max(tokenScore, levScore);
};

/**
 * Sugiere un inmueble para un texto crudo del Excel.
 * 1) RC exacta → confianza 1.0
 * 2) Nombre/alias/dirección normalizados → mejor similitud encontrada
 */
export const sugerirInmueble = (
  textoExcel: string,
  properties: Property[],
): { inmuebleId: number | null; confianza: number } => {
  // 1 · Match exacto por referencia catastral.
  const rcMatch = (textoExcel || '').toUpperCase().match(RC_REGEX);
  if (rcMatch) {
    const rc = normalizeDni(rcMatch[0]);
    const byRc = properties.find((p) => p.cadastralReference && normalizeDni(p.cadastralReference) === rc);
    if (byRc?.id != null) return { inmuebleId: byRc.id, confianza: 1.0 };
  }

  // 2 · Match por nombre/alias/dirección normalizados.
  const target = normalizeName(textoExcel);
  if (!target) return { inmuebleId: null, confianza: 0 };

  let best: { inmuebleId: number | null; confianza: number } = { inmuebleId: null, confianza: 0 };
  for (const p of properties) {
    if (p.id == null) continue;
    const candidates = [p.alias, p.globalAlias, p.address].filter(Boolean) as string[];
    for (const candidate of candidates) {
      const score = similarity(target, normalizeName(candidate));
      if (score > best.confianza) best = { inmuebleId: p.id, confianza: score };
    }
  }

  return best;
};

// ───────────────────────────── Duplicados ─────────────────────────────

/**
 * Detecta si un draft es posible duplicado de un Contract existente en el MISMO
 * inmueble: por DNI (si el draft trae DNI) o por nombre fuzzy ≥ umbral.
 */
export const detectarDuplicado = (
  draft: Pick<ContractDraft, 'inmuebleIdSugerido' | 'inquilinoDni' | 'inquilinoNombre'>,
  existingContracts: Contract[],
): { existenteId: number; motivo: string } | null => {
  if (draft.inmuebleIdSugerido == null) return null;

  const sameProperty = existingContracts.filter(
    (c) => c.inmuebleId === draft.inmuebleIdSugerido && c.id != null,
  );
  if (!sameProperty.length) return null;

  // Por DNI.
  const draftDni = normalizeDni(draft.inquilinoDni);
  if (draftDni) {
    const byDni = sameProperty.find((c) => normalizeDni(c.inquilino?.dni) === draftDni);
    if (byDni?.id != null) {
      return { existenteId: byDni.id, motivo: `inquilino ya existe DNI ${draft.inquilinoDni}` };
    }
  }

  // Por nombre fuzzy.
  const targetName = normalizeName(draft.inquilinoNombre);
  for (const c of sameProperty) {
    const existingName = normalizeName(`${c.inquilino?.nombre ?? ''} ${c.inquilino?.apellidos ?? ''}`);
    if (similarity(targetName, existingName) >= UMBRAL_DUPLICADO_NOMBRE) {
      return { existenteId: c.id as number, motivo: 'nombre coincide con un contrato existente en el inmueble' };
    }
  }

  return null;
};

// ───────────────────────────── Clasificación ─────────────────────────────

const clasificar = (
  base: Omit<ContractDraft, 'seccion' | 'motivoSeccion' | 'decisionDuplicado' | 'inquilinoExistenteId'>,
  confianza: number,
  existingContracts: Contract[],
): ContractDraft => {
  const duplicado = detectarDuplicado(
    { inmuebleIdSugerido: base.inmuebleIdSugerido, inquilinoDni: base.inquilinoDni, inquilinoNombre: base.inquilinoNombre },
    existingContracts,
  );

  if (duplicado) {
    return {
      ...base,
      inquilinoExistenteId: duplicado.existenteId,
      seccion: 'duplicados',
      motivoSeccion: duplicado.motivo,
      decisionDuplicado: 'omitir',
    };
  }

  if (base.inmuebleIdSugerido != null && confianza >= UMBRAL_CONFIANZA_INMUEBLE) {
    return {
      ...base,
      inquilinoExistenteId: null,
      seccion: 'listos',
      motivoSeccion: `inmueble mapeado (confianza ${Math.round(confianza * 100)}%)`,
      decisionDuplicado: null,
    };
  }

  return {
    ...base,
    inquilinoExistenteId: null,
    seccion: 'revisar',
    motivoSeccion: confianza > 0 ? `inmueble incierto (confianza ${Math.round(confianza * 100)}%)` : 'inmueble no reconocido',
    decisionDuplicado: null,
  };
};

// ───────────────────────────── Normalizadores ─────────────────────────────

/** Normaliza filas Rentila a ContractDraft[] y las clasifica en 3 secciones. */
export const normalizarRentila = (
  rows: RentilaRow[],
  properties: Property[],
  existingContracts: Contract[],
): ContractDraft[] =>
  rows.map((row) => {
    const { inmuebleId, confianza } = sugerirInmueble(row.propiedad, properties);
    const { principal, cotitulares } = detectarCotitulares(row.inquilino);
    const inmuebleIdSugerido = confianza >= UMBRAL_CONFIANZA_INMUEBLE ? inmuebleId : null;

    const base = {
      filaOriginal: row.filaOriginal,
      ficheroOrigen: row.ficheroOrigen,
      origen: 'rentila' as const,
      inmuebleRaw: row.propiedad,
      inmuebleIdSugerido,
      inmuebleIdConfirmado: inmuebleIdSugerido,
      inquilinoNombre: principal,
      inquilinoCotitulares: cotitulares,
      inquilinoDni: null,                 // Rentila no trae DNI
      inquilinoEmail: null,
      inquilinoTelefono: null,
      modalidadAtlas: mapTipoRentilaToAtlas(row.tipo),
      fechaInicio: row.inicioAlquiler,
      fechaFin: row.finAlquiler,
      rentaMensual: row.alquiler,
      fianza: row.fianza,
    };

    return clasificar(base, confianza, existingContracts);
  });

/** Normaliza filas de la plantilla ATLAS a ContractDraft[] y las clasifica. */
export const normalizarAtlas = (
  rows: AtlasTemplateRow[],
  properties: Property[],
  existingContracts: Contract[],
): ContractDraft[] =>
  rows.map((row) => {
    const { inmuebleId, confianza } = sugerirInmueble(row.inmuebleNombreOrRC, properties);
    const { principal, cotitulares } = detectarCotitulares(row.inquilinoNombre);
    const inmuebleIdSugerido = confianza >= UMBRAL_CONFIANZA_INMUEBLE ? inmuebleId : null;

    const base = {
      filaOriginal: row.filaOriginal,
      ficheroOrigen: 'plantilla-atlas',
      origen: 'plantilla_atlas' as const,
      inmuebleRaw: row.inmuebleNombreOrRC,
      inmuebleIdSugerido,
      inmuebleIdConfirmado: inmuebleIdSugerido,
      inquilinoNombre: principal,
      inquilinoCotitulares: cotitulares,
      inquilinoDni: row.dni,
      inquilinoEmail: row.email,
      inquilinoTelefono: row.telefono,
      modalidadAtlas: mapTipoAtlasToModalidad(row.tipoContrato),
      fechaInicio: row.fechaInicio,
      fechaFin: row.fechaFin,
      rentaMensual: row.rentaMensual,
      fianza: row.fianza,
    };

    return clasificar(base, confianza, existingContracts);
  });

/** Agrupa drafts por sección para el render del paso 3. */
export const agruparPorSeccion = (
  drafts: ContractDraft[],
): { listos: ContractDraft[]; revisar: ContractDraft[]; duplicados: ContractDraft[] } => ({
  listos: drafts.filter((d) => d.seccion === 'listos'),
  revisar: drafts.filter((d) => d.seccion === 'revisar'),
  duplicados: drafts.filter((d) => d.seccion === 'duplicados'),
});

// ───────────────────────── Wrappers con BD (para la UI) ─────────────────────────

const loadContext = async (): Promise<{ properties: Property[]; contracts: Contract[] }> => {
  const db = await initDB();
  const [properties, contracts] = await Promise.all([db.getAll('properties'), db.getAll('contracts')]);
  return { properties, contracts };
};

export const construirDraftsRentila = async (rows: RentilaRow[]): Promise<ContractDraft[]> => {
  const { properties, contracts } = await loadContext();
  return normalizarRentila(rows, properties, contracts);
};

export const construirDraftsAtlas = async (rows: AtlasTemplateRow[]): Promise<ContractDraft[]> => {
  const { properties, contracts } = await loadContext();
  return normalizarAtlas(rows, properties, contracts);
};
