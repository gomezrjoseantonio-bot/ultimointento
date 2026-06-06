// Commit 4 · Normalizador a ContractDraft (formato intermedio común) + mapeos
// de tipo + fuzzy match de inmuebles + cotitulares + detección de duplicados +
// clasificación en 3 secciones (listos / revisar / duplicados).
//
// Tanto Rentila como la plantilla ATLAS se normalizan a ContractDraft antes de
// crear Contracts (la creación efectiva es el commit 7). Las funciones núcleo son
// PURAS: reciben los inmuebles y contratos existentes como parámetros para ser
// testeables sin IndexedDB. Hay wrappers async que cargan de la BD para la UI.
import { initDB, Contract, Property } from './db';
import { RentilaRow, parseHabitacionFromRentila } from './rentilaParserService';
import { AtlasTemplateRow } from './atlasTemplateParserService';

export interface ContractDraft {
  filaOriginal: number;
  ficheroOrigen: string;
  origen: 'rentila' | 'plantilla_atlas';

  // Mapeo de inmueble · resuelto o pendiente
  inmuebleRaw: string;
  inmuebleIdSugerido: number | null;
  inmuebleIdConfirmado: number | null;
  /** Paso 3 · el usuario eligió "crear inmueble nuevo" para una fila de la sección revisar. */
  crearInmuebleNuevo?: boolean;

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

  /**
   * FIX § 1.3 · número de habitación parseado del sufijo HX del nombre Rentila
   * (p.ej. "4-ACEVEDO-H2" → 2). `null` si el nombre no trae sufijo. La decisión
   * final (asignar / pedir / ignorar) se toma en creación según el
   * `modoExplotacion` del inmueble resuelto. Solo aplica a origen Rentila.
   */
  habitacionParseada: number | null;

  /**
   * FIX § 1.3 · habitación elegida por el usuario en el wizard cuando el inmueble
   * es `por_habitaciones` y el nombre Rentila NO traía sufijo HX. `null` hasta
   * que se selecciona. En creación, `habitacionParseada ?? habitacionConfirmada`.
   */
  habitacionConfirmada: number | null;

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
  // Planta+mano canónica · "4i"/"4 izq" → "4 izquierda" · "4d"/"4 dcha" → "4 derecha".
  // Así "TENDERINA 64 4I" casa con "Tenderina 64 4 Izq" y se distingue de "4D/Dr"
  // sea cual sea la notación que use el usuario (caso Jose · pisos Iz/Dr).
  t = t.replace(/\b(\d{1,2})\s*(izquierda|izqda|izda|izq|iz|i)\b/g, '$1 izquierda');
  t = t.replace(/\b(\d{1,2})\s*(derecha|dcha|dch|der|dr|d)\b/g, '$1 derecha');
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
 * 2) Tokens identificativos → coeficiente de solapamiento + guarda de ambigüedad
 */

/** Quita el sufijo de habitación (…-H1 / … Hab 4) antes de tokenizar. */
const stripRoomSuffix = (t: string): string => (t || '').replace(/[\s\-_](hab|h)\s?\d+\s*$/i, '');

// Palabras genéricas de dirección que NO identifican el inmueble (ES/CA).
// OJO · "izquierda"/"derecha" NO van aquí: tras la normalización de planta son la
// señal que distingue dos pisos del mismo número (4I vs 4D · caso Jose).
const STOPWORDS_DIR = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'a', 'en', 'un', 'una', 'al', 'con',
  'calle', 'carrer', 'c', 'avenida', 'avinguda', 'avda', 'av', 'passeig', 'paseo', 'pso',
  'plaza', 'plaça', 'pza', 'pl', 'carretera', 'ctra', 'camino', 'cami', 'ronda', 'via',
  'numero', 'num', 'n', 'piso', 'pta', 'puerta', 'escalera', 'esc', 'bajo', 'bis', 'sn',
]);

const esTokenUtil = (w: string): boolean =>
  !!w && w.length > 1 && !STOPWORDS_DIR.has(w) && !/^\d{5,}$/.test(w); // descarta CP y monosílabos

/** Tokens identificativos (sin prefijo "N-", RC, sufijo de habitación ni ruido). */
export const tokensInmueble = (texto: string): string[] =>
  Array.from(new Set(normalizeName(stripRoomSuffix(texto)).split(' ').filter(esTokenUtil)));

/** Dos tokens "iguales" tolerando un error tipográfico/acento en palabras largas. */
const tokenNear = (a: string, b: string): boolean => {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4 || Math.abs(a.length - b.length) > 2) return false;
  return levenshtein(a, b) <= (Math.max(a.length, b.length) <= 6 ? 1 : 2);
};

/**
 * Coeficiente de solapamiento (Szymkiewicz–Simpson) entre los tokens de la
 * consulta y los del inmueble: `matched / min(|query|, |inmueble|)`. Premia que
 * el conjunto más corto quede contenido en el otro, de modo que un nombre corto
 * ("Acevedo") puntúe alto dentro de una dirección larga ("C/ Fuertes Acevedo 32…")
 * sin que las palabras de relleno de la dirección lo penalicen.
 */
export const puntuarInmueble = (queryTokens: string[], propTexto: string): number => {
  const propTokens = tokensInmueble(propTexto);
  if (!queryTokens.length || !propTokens.length) return 0;
  let matched = 0;
  for (const q of queryTokens) {
    if (propTokens.some((p) => tokenNear(q, p))) matched += 1;
  }
  if (matched === 0) return 0;
  return matched / Math.min(queryTokens.length, propTokens.length);
};

/** Margen mínimo entre el 1.º y el 2.º candidato para considerar el match seguro. */
const MARGEN_AMBIGUO = 0.15;

export const sugerirInmueble = (
  textoExcel: string,
  properties: Property[],
  accesorioIds?: Set<number>,
): { inmuebleId: number | null; confianza: number } => {
  // Un inmueble ACCESORIO (parking/trastero vinculado a un piso en la declaración)
  // NUNCA es destino de un contrato de inquilino: se alquila con el piso, no por
  // separado. Se excluye de los candidatos para que no genere falsos empates
  // (caso Jose · "2-MANRESA" empataba piso vs parking y caía a revisar).
  const esAccesorio = (id: number | null | undefined): boolean =>
    id != null && !!accesorioIds && accesorioIds.has(id);

  // 1 · Match exacto por referencia catastral.
  const rcMatch = (textoExcel || '').toUpperCase().match(RC_REGEX);
  if (rcMatch) {
    const rc = normalizeDni(rcMatch[0]);
    const byRc = properties.find(
      (p) => p.cadastralReference && normalizeDni(p.cadastralReference) === rc && !esAccesorio(p.id),
    );
    if (byRc?.id != null) return { inmuebleId: byRc.id, confianza: 1.0 };
  }

  // 2 · Match por tokens identificativos contra alias/globalAlias/dirección.
  const queryTokens = tokensInmueble(textoExcel);
  if (!queryTokens.length) return { inmuebleId: null, confianza: 0 };

  let best: { inmuebleId: number | null; score: number } = { inmuebleId: null, score: 0 };
  let second: { inmuebleId: number | null; score: number } = { inmuebleId: null, score: 0 };
  for (const p of properties) {
    if (p.id == null || esAccesorio(p.id)) continue;
    // `province` se incluye a propósito: el import de la declaración AEAT guarda
    // ahí el MUNICIPIO (splitAddress → province: municipality), que es justo el
    // identificador que usan los nombres Rentila ("1-SANT FRUITOS", "2-MANRESA").
    const campos = [p.alias, p.globalAlias, p.address, p.province].filter(Boolean) as string[];
    let s = 0;
    for (const campo of campos) s = Math.max(s, puntuarInmueble(queryTokens, campo));
    if (s > best.score) {
      second = best;
      best = { inmuebleId: p.id, score: s };
    } else if (s > second.score) {
      second = { inmuebleId: p.id, score: s };
    }
  }

  // 3 · Guarda de ambigüedad · dos inmuebles DISTINTOS casi empatados ⇒ incierto.
  // Caso real: "2-MANRESA" cuando hay un piso Y un parking en Manresa; antes se
  // auto-asignaba al parking. Ahora la confianza baja del umbral y va a "revisar".
  let confianza = best.score;
  if (
    best.inmuebleId != null &&
    second.inmuebleId != null &&
    second.inmuebleId !== best.inmuebleId &&
    best.score - second.score < MARGEN_AMBIGUO
  ) {
    confianza = Math.min(best.score, UMBRAL_CONFIANZA_INMUEBLE - 0.1);
  }

  return { inmuebleId: best.inmuebleId, confianza };
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
  accesorioIds?: Set<number>,
): ContractDraft[] =>
  rows.map((row) => {
    const { inmuebleId, confianza } = sugerirInmueble(row.propiedad, properties, accesorioIds);
    const { principal, cotitulares } = detectarCotitulares(row.inquilino);
    const inmuebleIdSugerido = confianza >= UMBRAL_CONFIANZA_INMUEBLE ? inmuebleId : null;
    const inmuebleMatch = inmuebleIdSugerido != null
      ? properties.find((p) => p.id === inmuebleIdSugerido) ?? null
      : null;

    // FIX § 1.3 problema 3 · Rentila SIEMPRE trae nombre. Si llega vacío es un
    // BUG del fichero/parseo · se reporta en consola (NO se pinta "—" en silencio).
    if (!principal.trim()) {
      console.error(
        `[ImportarContratos] Rentila · contrato sin nombre de inquilino en fila ${row.filaOriginal} (${row.ficheroOrigen}) · propiedad "${row.propiedad}"`,
      );
    }

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
      // Habitación deducida del nombre · sufijo HX explícito o, si el inmueble
      // resuelto se explota por habitaciones, el código de unidad ("…-004" → 4).
      // Si no se puede deducir, el wizard la pide (§ 1.3 · caso Jose).
      habitacionParseada: inferirHabitacion(row.propiedad, inmuebleMatch),
      habitacionConfirmada: null,
    };

    return clasificar(base, confianza, existingContracts);
  });

/** Normaliza filas de la plantilla ATLAS a ContractDraft[] y las clasifica. */
export const normalizarAtlas = (
  rows: AtlasTemplateRow[],
  properties: Property[],
  existingContracts: Contract[],
  accesorioIds?: Set<number>,
): ContractDraft[] =>
  rows.map((row) => {
    const { inmuebleId, confianza } = sugerirInmueble(row.inmuebleNombreOrRC, properties, accesorioIds);
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
      // La plantilla ATLAS no codifica habitación en el nombre · sin sufijo HX.
      habitacionParseada: null,
      habitacionConfirmada: null,
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

const loadContext = async (): Promise<{
  properties: Property[];
  contracts: Contract[];
  accesorioIds: Set<number>;
}> => {
  const db = await initDB();
  const [properties, contracts, vinculos] = await Promise.all([
    db.getAll('properties'),
    db.getAll('contracts'),
    db.getAll('vinculosAccesorio'),
  ]);
  // IDs de inmuebles que son accesorios ACTIVOS (parking/trastero) de un piso:
  // se excluyen del match porque un contrato de inquilino no recae en el accesorio.
  const accesorioIds = new Set<number>(
    vinculos.filter((v) => v.estado === 'activo').map((v) => v.inmuebleAccesorioId),
  );
  return { properties, contracts, accesorioIds };
};

export const construirDraftsRentila = async (rows: RentilaRow[]): Promise<ContractDraft[]> => {
  const { properties, contracts, accesorioIds } = await loadContext();
  return normalizarRentila(rows, properties, contracts, accesorioIds);
};

export const construirDraftsAtlas = async (rows: AtlasTemplateRow[]): Promise<ContractDraft[]> => {
  const { properties, contracts, accesorioIds } = await loadContext();
  return normalizarAtlas(rows, properties, contracts, accesorioIds);
};

export interface InmuebleOpcion {
  id: number;
  label: string;
  /** FIX § 1.3 · decide si el wizard pide habitación cuando no hay sufijo HX. */
  modoExplotacion?: Property['modoExplotacion'];
  /** Nº de habitaciones arrendables · alimenta el selector de habitación. */
  habitaciones: number;
}

/** Nº de habitaciones arrendables de un inmueble (varias fuentes legacy). */
export const contarHabitacionesArrendables = (p: Property): number => {
  const n =
    p.alquilerPorHabitaciones?.numeroHabitaciones ??
    p.explotacion?.unidadesArrendables ??
    p.bedrooms ??
    0;
  // Para inmuebles por habitaciones garantizamos al menos 2 opciones aunque el
  // dato legacy venga incompleto; el resto se queda con su valor (mín. 1).
  const min = p.modoExplotacion === 'por_habitaciones' ? 2 : 1;
  return Math.max(min, n);
};

/**
 * Inteligencia de habitación (caso Jose · "60 contratos por habitaciones").
 * Deduce el nº de habitación de un contrato Rentila SIN depender del formato
 * exacto que use el usuario. Prioridad:
 *   1) sufijo explícito HX / Hab X ("4-ACEVEDO-H2" → 2).
 *   2) si el inmueble se explota POR HABITACIONES: el código de unidad que Rentila
 *      añade tras la identidad del piso ("…64 4I -004" → 4). Se toma el token del
 *      nombre que NO pertenece a la identidad del inmueble, priorizando el código
 *      zero-padded ("004", que no se confunde con la planta "4"), y se valida que
 *      esté en [1..nº de habitaciones].
 * Devuelve `null` si no se puede deducir con seguridad (el wizard lo preguntará).
 */
export const inferirHabitacion = (nombreRentila: string, inmueble?: Property | null): number | null => {
  const hx = parseHabitacionFromRentila(nombreRentila);
  if (hx != null) return hx;

  const porHabitaciones =
    inmueble?.modoExplotacion === 'por_habitaciones' || inmueble?.modoExplotacion === 'mixto';
  if (!inmueble || !porHabitaciones) return null;

  const total = contarHabitacionesArrendables(inmueble);
  const idTokens = tokensInmueble(
    [inmueble.alias, inmueble.globalAlias, inmueble.address, inmueble.province].filter(Boolean).join(' '),
  );
  // Discriminador = lo que queda del nombre tras quitar la identidad del inmueble.
  const propios = tokensInmueble(nombreRentila).filter((t) => !idTokens.some((p) => tokenNear(t, p)));
  const numericos = propios.filter((t) => /^\d{1,3}$/.test(t));

  const enRango = (n: number): boolean => n >= 1 && n <= total;

  // 1) Código zero-padded ("001".."0NN") · el id de unidad/habitación de Rentila.
  const padded = numericos.find((t) => /^0\d{1,2}$/.test(t));
  if (padded) {
    const n = parseInt(padded, 10);
    if (enRango(n)) return n;
  }
  // 2) Un único numérico no ambiguo en rango.
  if (numericos.length === 1) {
    const n = parseInt(numericos[0], 10);
    if (enRango(n)) return n;
  }
  return null;
};

/** Opciones de inmueble para el select de la sección "Requieren revisión" (paso 3). */
export const listarInmueblesOpciones = async (): Promise<InmuebleOpcion[]> => {
  const db = await initDB();
  const properties = await db.getAll('properties');
  return properties
    .filter((p) => p.id != null)
    .map((p) => ({
      id: p.id as number,
      label: p.alias || p.address || `Inmueble ${p.id}`,
      modoExplotacion: p.modoExplotacion,
      habitaciones: contarHabitacionesArrendables(p),
    }));
};
