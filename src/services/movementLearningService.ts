import { initDB, Movement, MovementLearningRule } from './db';
import { contraparteDeBizum } from './bizum';
import { claveDeNombre, nivelDeCoincidencia } from './coincidenciaNombre';
import { claveDeIdentificador, identificadoresDeMovimiento } from './identificadoresDelConcepto';

/**
 * V1.1 Treasury · Movement Learning Service
 *
 * Aprende de las confirmaciones del usuario en `/tesoreria/importar` para
 * auto-categorizar futuras importaciones. El path activo es
 * bankStatementOrchestrator.confirmDecisions → feedLearningRule →
 * createOrUpdateRule.
 *
 * T16-cleanup (este PR):
 * - Eliminado el subsistema `performManualReconciliation` + `createLearningRule`
 *   + `applyRuleToGrays` (sin callers de UI desde 2025).
 * - Eliminado el subsistema de auditoría history[] (`appendHistory`,
 *   `getLearningLogs`, `getLearningRulesStats`) — no había lectores de
 *   producción. El campo `MovementLearningRule.history?` queda marcado como
 *   @deprecated en `db.ts`; los registros existentes lo conservan dormido
 *   hasta el próximo bump DB.
 * - `createOrUpdateRule` ya no escribe entradas a `history[]`. Resto del
 *   contrato (T16-fix-functional · appliedCount, patrones, lastAppliedAt) se
 *   mantiene intacto.
 */

/**
 * Simple hash function for browser compatibility
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Normalize text for pattern matching
 */
function normalizeText(text: string): string {
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Collapse spaces
    .trim();
}

/**
 * Remove volatile tokens from text (dates, numbers, references, IBANs)
 */
function removeVolatileTokens(text: string): string {
  return text
    .replace(/\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}/g, '') // Dates
    .replace(/\d+[,.]\d{2}/g, '') // Amounts with decimals
    .replace(/\b\d{4,}\b/g, '') // Long numbers (references)
    .replace(/\bref\w*\s*\d+/g, '') // Reference numbers
    .replace(/\b[a-z0-9]{8,}\b/g, '') // Long alphanumeric codes
    .replace(/\bES\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}/gi, '') // Spanish IBANs
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]+/g, '') // International IBANs
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract n-grams (2-3 words) from text and return most frequent ones
 */
function extractNGrams(text: string, maxGrams: number = 3): string[] {
  const words = text.split(/\s+/).filter(word => word.length > 2); // Filter short words
  const ngrams: string[] = [];

  // Generate 2-grams and 3-grams
  for (let i = 0; i < words.length; i++) {
    // 2-grams
    if (i < words.length - 1) {
      ngrams.push(`${words[i]} ${words[i + 1]}`);
    }
    // 3-grams
    if (i < words.length - 2) {
      ngrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
  }

  // Count frequency and return most common
  const counts: { [key: string]: number } = {};
  ngrams.forEach(gram => {
    counts[gram] = (counts[gram] || 0) + 1;
  });

  return Object.entries(counts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, maxGrams)
    .map(([gram]) => gram);
}

/**
 * Los n-grams del movimiento · lo que comparten todos los recibos de un mismo
 * texto, una vez quitado lo volátil. Es la parte común de las claves v1 y v2.
 */
function ngramsDelMovimiento(movement: Movement, conIdentificador = false): string[] {
  const contraparte = normalizeText(movement.counterparty || '');
  const descripcion = normalizeText(movement.description || '');

  // Remove volatile tokens
  let cleanContraparte = removeVolatileTokens(contraparte);
  let cleanDescripcion = removeVolatileTokens(descripcion);
  // E2.3 · CON un identificador estable, los números cortos sueltos del texto
  // son ruido: Sabadell escribe el nº de factura en el concepto («IBERDROLA
  // GAS 104», «… 105») y cambiaba la clave cada mes aunque el NIF del acreedor
  // fuese el mismo. SIN identificador no se tocan: «CALLE URIA 5» y «CALLE
  // URIA 7» son dos comunidades distintas y el número es lo único que las
  // separa.
  if (conIdentificador) {
    cleanContraparte = sinNumerosCortos(cleanContraparte);
    cleanDescripcion = sinNumerosCortos(cleanDescripcion);
  }

  // Combine both texts for n-gram extraction
  const combinedText = `${cleanContraparte} ${cleanDescripcion}`.trim();

  // Extract top 3 n-grams
  const ngrams = extractNGrams(combinedText, 3);
  // E2.3 · con identificador, si tras quitar lo volátil queda UNA sola palabra
  // («gas», «luz») no hay n-gram posible y la clave se quedaría solo con el
  // identificador: gas y luz del mismo acreedor (mismo NIF) serían una regla.
  // La palabra suelta entra entonces como token. Solo en la v2 con
  // identificador: la v1 no se toca.
  if (conIdentificador && ngrams.length === 0) {
    return combinedText.split(/\s+/).filter((w) => w.length > 2).slice(0, 3);
  }
  return ngrams;
}

function sinNumerosCortos(text: string): string {
  return text.replace(/\b\d{1,3}\b/g, '').replace(/\s+/g, ' ').trim();
}

function signoDe(movement: Movement): 'positive' | 'negative' {
  return movement.amount >= 0 ? 'positive' : 'negative';
}

/**
 * La clave v1 · `v1|signo|ngramA|ngramB|ngramC`, hasheada.
 *
 * Es la que tienen las reglas aprendidas antes de E2.1. Se conserva SOLO para
 * leerlas (`movementSuggestionService` la prueba cuando la v2 no encuentra
 * regla); no se escribe ninguna regla nueva con ella. No se migran las viejas:
 * son de usar y tirar, y la primera confirmación con identificador ya nace v2.
 */
export function buildLearnKeyV1(movement: Movement): string {
  const keyParts = ['v1', signoDe(movement), ...ngramsDelMovimiento(movement)];
  return simpleHash(keyParts.join('|'));
}

/**
 * La clave de aprendizaje · v2 (E2.1).
 *
 * `v2|signo|ngramA|ngramB|ngramC|id=tipo:valor|…` cuando el concepto trae un
 * identificador estable (CUPS, nº de contrato, NIF, IBAN, tarjeta · ver
 * `identificadoresDelConcepto`). Así dos recibos de Iberdrola de dos pisos
 * distintos —mismo texto, distinto nº de contrato— son DOS reglas, cada una
 * con su piso, en vez de una que la segunda confirmación pisaba.
 *
 * Sin identificador la clave es EXACTAMENTE la v1: el hash no cambia para
 * nada que no lleve identificador, y las reglas viejas de esos textos siguen
 * aplicándose sin fallback. Lo volátil (nº de recibo, referencia de compra,
 * fecha embebida) sigue fuera, como siempre.
 *
 * Exported for movementSuggestionService: the suggestion engine looks up rules
 * by computing the same learnKey from a just-imported movement.
 */
export function buildLearnKey(movement: Movement): string {
  const ids = identificadoresDeMovimiento(movement);
  if (ids.length === 0) return buildLearnKeyV1(movement);
  const keyParts = [
    'v2',
    signoDe(movement),
    ...ngramsDelMovimiento(movement, true),
    ...ids.map((id) => `id=${claveDeIdentificador(id)}`),
  ];
  return simpleHash(keyParts.join('|'));
}

/** Los identificadores del movimiento, como se guardan en la regla · «tipo:valor». */
export function identificadoresDeRegla(movement: Movement): string[] {
  return identificadoresDeMovimiento(movement).map(claveDeIdentificador);
}

/**
 * Generate a learn key for a movement (alias kept for internal use).
 */
function generateLearnKey(movement: Movement): string {
  return buildLearnKey(movement);
}

// ─── Alias de contraparte · quién es, no de qué categoría es ────────────────

/**
 * El nombre de la persona que hay detrás de una línea del banco.
 *
 * Manda la columna de contraparte del fichero si viene; si no, se intenta leer
 * del texto (los Bizum lo traen dentro). `undefined` si no se puede saber — de
 * un nombre inventado no se aprende nada bueno.
 */
export function nombreDeContraparte(movement: Movement): string | undefined {
  const propia = movement.counterparty?.trim();
  if (propia) return propia;
  return contraparteDeBizum(movement.description ?? '');
}

/**
 * Qué alias merece guardarse de esta confirmación · `undefined` si ninguno.
 *
 * Sólo se aprende lo que NO se deducía solo. Si el nombre del banco y el del
 * contrato ya comparten nombre y apellido, `nivelDeCoincidencia` los une sin
 * ayuda y guardar el alias sería ruido. Lo valioso es justo lo contrario:
 * "MPARWEZ" contra "Adnan Parwez Khan", que sin que el usuario lo enseñe no
 * hay forma de adivinar.
 */
function aliasAprendible(
  movement: Movement,
  contraparteConfirmada?: string
): { banco: string; canonica: string } | undefined {
  const nombreBanco = nombreDeContraparte(movement);
  if (!nombreBanco || !contraparteConfirmada) return undefined;
  if (nivelDeCoincidencia(nombreBanco, contraparteConfirmada) === 'fuerte') return undefined;

  // Se comparan normalizados —"PARWEZ, ADNAN" y "Adnan Parwez" son lo mismo—
  // pero se guardan como vienen: esto se enseña en la pantalla de reglas.
  const claveBanco = claveDeNombre(nombreBanco);
  const claveCanonica = claveDeNombre(contraparteConfirmada);
  // Una clave vacía no es un nombre, y un alias hacia uno mismo no enseña nada.
  if (!claveBanco || !claveCanonica || claveBanco === claveCanonica) return undefined;
  return { banco: nombreBanco, canonica: contraparteConfirmada };
}

/**
 * Los alias aprendidos, listos para preguntar: clave del banco → claves a las
 * que el usuario los ha confirmado alguna vez.
 *
 * Es un `Set` y no un valor porque el mapa se construye sobre TODAS las reglas,
 * y reglas distintas —descripciones de banco distintas, `learnKey` distintos—
 * pueden traer el mismo nombre apuntando a personas distintas. Ahí lo honesto
 * es que salgan las dos como candidatas y decida el usuario.
 *
 * Dentro de UNA regla el alias es 1→1 a propósito: el mismo texto del banco
 * confirmado después contra otra persona no son dos verdades a la vez, es una
 * corrección, y pisa a la anterior.
 */
export async function cargarAliasContraparte(): Promise<Map<string, Set<string>>> {
  const mapa = new Map<string, Set<string>>();
  let reglas: MovementLearningRule[] = [];
  try {
    const db = await initDB();
    reglas = ((await db.getAll('movementLearningRules')) ?? []) as MovementLearningRule[];
  } catch {
    // El alias es una ayuda, no un requisito: sin reglas se empareja igual.
    return mapa;
  }

  for (const regla of reglas) {
    if (!regla.aliasContraparte || !regla.contraparteCanonica) continue;
    const clave = claveDeNombre(regla.aliasContraparte);
    const canonica = claveDeNombre(regla.contraparteCanonica);
    // Una clave vacía no es un nombre: metida en el Set haría match con
    // cualquier previsión que tampoco tenga contraparte.
    if (!clave || !canonica) continue;
    const canonicas = mapa.get(clave) ?? new Set<string>();
    canonicas.add(canonica);
    mapa.set(clave, canonicas);
  }
  return mapa;
}

/**
 * Create or update a learning rule by learn key.
 *
 * T16-fix-functional preserved:
 * - Each call counts as one application (`appliedCount` arranca en 1 al crear
 *   y se incrementa al actualizar). Esto alimenta el boost de confianza en
 *   `movementSuggestionService.suggestFromLearningRule`.
 * - Cuando el caller dispone del `Movement` (orchestrator), lo pasa en
 *   `params.movement` para rellenar `counterpartyPattern`, `descriptionPattern`
 *   y `amountSign` en la creación, y para no dejar patrones vacíos en upserts
 *   sobre reglas previamente creadas sin contexto.
 *
 * T16-cleanup: ya no escribe entradas a `history[]`. El campo permanece en el
 * tipo como @deprecated y los registros viejos lo mantienen dormido.
 */
export async function createOrUpdateRule(params: {
  learnKey: string;
  categoria: string;
  ambito: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: string;
  movement?: Movement;
  /**
   * A quién resultó pertenecer el movimiento · el nombre del contrato o del
   * proveedor de la previsión contra la que el usuario lo confirmó. De aquí
   * sale el alias, si es que hay algo que aprender.
   */
  contraparteConfirmada?: string;
  /** E2.2 · qué hace la regla · ausente = clasificar. */
  resolucion?: 'clasificar' | 'traspaso';
  cuentaDestinoId?: number;
}): Promise<MovementLearningRule> {
  try {
    const db = await initDB();
    const { learnKey, categoria, ambito, inmuebleId, movement, contraparteConfirmada } = params;
    const resolucion = params.resolucion ?? 'clasificar';
    const cuentaDestinoId = resolucion === 'traspaso' ? params.cuentaDestinoId : undefined;
    const now = new Date().toISOString();

    const alias = movement ? aliasAprendible(movement, contraparteConfirmada) : undefined;

    const derivedCounterparty = movement
      ? normalizeText(movement.counterparty || '')
      : undefined;
    const derivedDescription = movement
      ? removeVolatileTokens(normalizeText(movement.description || ''))
      : undefined;
    const derivedAmountSign: 'positive' | 'negative' | undefined = movement
      ? (movement.amount >= 0 ? 'positive' : 'negative')
      : undefined;
    // E2.1 · lo que identifica el contrato dentro del texto del banco. Se
    // guarda legible («contrato:8078716546») para la pantalla de reglas.
    const derivedIdentificadores = movement ? identificadoresDeRegla(movement) : [];

    // Check if rule already exists
    const existingRules = await db.getAllFromIndex('movementLearningRules', 'learnKey', learnKey);

    if (existingRules.length > 0) {
      // Update existing rule
      const rule = existingRules[0];
      // Snapshot before any mutation so the amountSign override condition
      // checks the rule's PRE-existing state, not what we are about to write.
      const wasOrchestratorPlaceholder =
        !rule.counterpartyPattern && !rule.descriptionPattern;
      // E2.2 · ¿el usuario cambia de opinión? Otra categoría, otro ámbito, otro
      // piso u otra resolución que la que la regla tenía es una CORRECCIÓN: la
      // regla no acumula confianza con lo nuevo, vuelve a empezar. Un cambio
      // así es exactamente el bug de las dos Iberdrola pisándose: ahora, con
      // la llave de E2.1, dos contratos son dos reglas y esto solo salta cuando
      // de verdad se reclasifica el mismo concepto.
      const cambiaDeOpinion = esCambioDeOpinion(rule, {
        categoria,
        ambito,
        inmuebleId,
        resolucion,
        cuentaDestinoId,
      });
      rule.categoria = categoria;
      rule.ambito = ambito;
      rule.inmuebleId = inmuebleId;
      rule.resolucion = resolucion;
      rule.cuentaDestinoId = cuentaDestinoId;
      // B2 · backfill empty patterns when caller now provides a Movement
      if (derivedCounterparty !== undefined && !rule.counterpartyPattern) {
        rule.counterpartyPattern = derivedCounterparty;
      }
      if (derivedDescription !== undefined && !rule.descriptionPattern) {
        rule.descriptionPattern = derivedDescription;
      }
      if (derivedAmountSign !== undefined && wasOrchestratorPlaceholder) {
        rule.amountSign = derivedAmountSign;
      }
      if (derivedIdentificadores.length > 0) {
        rule.identificadores = derivedIdentificadores;
      }
      // B1 · this call counts as one application · E2.2: salvo que sea una
      // corrección, que la devuelve al principio (esta es su primera aplicación
      // con la opinión nueva).
      if (cambiaDeOpinion) {
        rule.appliedCount = 1;
        rule.correcciones = (rule.correcciones ?? 0) + 1;
        rule.ultimaCorreccionAt = now;
      } else {
        rule.appliedCount = (rule.appliedCount ?? 0) + 1;
      }
      rule.lastAppliedAt = now;
      rule.updatedAt = now;
      // El alias se refresca si esta vez SÍ hay algo que enseñar · una
      // confirmación que no aporta nombre no borra lo aprendido antes.
      if (alias) {
        rule.aliasContraparte = alias.banco;
        rule.contraparteCanonica = alias.canonica;
      }

      await db.put('movementLearningRules', rule);
      console.log(`📚 Updated learning rule: ${learnKey}`);
      return rule;
    } else {
      // Create new rule (sin history writes — T16-cleanup)
      const newRule: MovementLearningRule = {
        learnKey,
        counterpartyPattern: derivedCounterparty ?? '',
        descriptionPattern: derivedDescription ?? '',
        amountSign: derivedAmountSign ?? 'positive',
        categoria,
        ambito,
        inmuebleId,
        source: 'IMPLICIT',
        createdAt: now,
        updatedAt: now,
        appliedCount: 1, // B1 · creation already counts as the first application
        lastAppliedAt: now,
        aliasContraparte: alias?.banco,
        contraparteCanonica: alias?.canonica,
        ...(derivedIdentificadores.length > 0 ? { identificadores: derivedIdentificadores } : {}),
        resolucion,
        ...(cuentaDestinoId != null ? { cuentaDestinoId } : {}),
      };

      const ruleId = await db.add('movementLearningRules', newRule);
      newRule.id = ruleId as number;

      console.log(`📚 Created learning rule: ${learnKey}`);
      return newRule;
    }
  } catch (error) {
    console.error('❌ Error creating/updating learning rule:', error);
    throw error;
  }
}

/** E2.2 · ¿lo que se va a escribir contradice lo que la regla ya decía? */
function esCambioDeOpinion(
  rule: MovementLearningRule,
  nuevo: {
    categoria: string;
    ambito: 'PERSONAL' | 'INMUEBLE';
    inmuebleId?: string;
    resolucion: 'clasificar' | 'traspaso';
    cuentaDestinoId?: number;
  }
): boolean {
  const mismoPiso = (rule.inmuebleId ?? '') === (nuevo.inmuebleId ?? '');
  const mismaResolucion = (rule.resolucion ?? 'clasificar') === nuevo.resolucion;
  const mismaCuenta = (rule.cuentaDestinoId ?? null) === (nuevo.cuentaDestinoId ?? null);
  return !(
    rule.categoria === nuevo.categoria &&
    rule.ambito === nuevo.ambito &&
    mismoPiso &&
    mismaResolucion &&
    mismaCuenta
  );
}

/**
 * E2.2 · el usuario ha deshecho lo que esta regla hizo sola («No es esto» sobre
 * una línea resuelta por ella). La regla pierde la confianza entera: vuelve a
 * proponer desde cero y se anota la corrección. No se borra: lo que aprendió
 * sigue siendo una propuesta razonable, solo que ya no se aplica a ciegas.
 */
export async function penalizarRegla(ruleId: number): Promise<MovementLearningRule | undefined> {
  const db = await initDB();
  const rule = (await db.get('movementLearningRules', ruleId)) as MovementLearningRule | undefined;
  if (!rule) return undefined;
  const now = new Date().toISOString();
  const corregida: MovementLearningRule = {
    ...rule,
    appliedCount: 0,
    correcciones: (rule.correcciones ?? 0) + 1,
    ultimaCorreccionAt: now,
    updatedAt: now,
  };
  await db.put('movementLearningRules', corregida);
  return corregida;
}

/**
 * Apply all learning rules to movements during import.
 *
 * Sin lectores activos tras T16-cleanup (el legacy `bankStatementImportService`
 * fue eliminado en este PR). Se mantiene como API pública para futuros
 * consumidores. El path UI activo (orchestrator) usa
 * `movementSuggestionService.suggestForUnmatched`, que muestra sugerencias al
 * usuario antes de aplicarlas — distinto contrato.
 */
export async function applyAllRulesOnImport(movements: Movement[]): Promise<Movement[]> {
  try {
    const db = await initDB();

    // Get all learning rules
    const allRules = await db.getAll('movementLearningRules');
    const rulesMap = new Map<string, MovementLearningRule>();

    allRules.forEach(rule => {
      rulesMap.set(rule.learnKey, rule);
    });

    const processedMovements = movements.map(movement => {
      // E2.1 · primero la clave v2; si no hay regla, la v1 (reglas de antes).
      let learnKey = generateLearnKey(movement);
      let rule = rulesMap.get(learnKey);
      if (!rule) {
        const v1 = buildLearnKeyV1(movement);
        rule = rulesMap.get(v1);
        if (rule) learnKey = v1;
      }

      if (rule) {
        // Apply learned classification
        return {
          ...movement,
          categoria: rule.categoria,
          ambito: rule.ambito,
          inmuebleId: rule.inmuebleId,
          statusConciliacion: 'match_automatico' as const,
          learnKey,
          updatedAt: new Date().toISOString()
        };
      }

      // No rule found, keep as sin_match with default ambito
      return {
        ...movement,
        ambito: 'PERSONAL' as const,
        statusConciliacion: 'sin_match' as const,
        updatedAt: new Date().toISOString()
      };
    });

    // Update rule application counts for used rules
    const appliedRules = new Set<string>();
    processedMovements.forEach(movement => {
      if (movement.learnKey && movement.statusConciliacion === 'match_automatico') {
        appliedRules.add(movement.learnKey);
      }
    });

    // Update applied counts asynchronously (sin history writes — T16-cleanup)
    for (const learnKey of Array.from(appliedRules)) {
      const rule = rulesMap.get(learnKey);
      if (rule && rule.id) {
        rule.appliedCount += 1;
        rule.lastAppliedAt = new Date().toISOString();
        rule.updatedAt = new Date().toISOString();
        await db.put('movementLearningRules', rule);
      }
    }

    if (appliedRules.size > 0) {
      console.log(`🤖 Applied ${appliedRules.size} learning rules to new movements`);
    }

    return processedMovements;

  } catch (error) {
    console.error('❌ Error applying learning rules to new movements:', error);
    return movements.map(movement => ({
      ...movement,
      ambito: 'PERSONAL' as const,
      statusConciliacion: 'sin_match' as const,
      updatedAt: new Date().toISOString()
    }));
  }
}

/**
 * Apply existing learning rules to new movements during import (alias for applyAllRulesOnImport)
 */
export async function applyLearningRulesToNewMovements(movements: Movement[]): Promise<Movement[]> {
  return applyAllRulesOnImport(movements);
}

/**
 * Service surface kept for compat with consumers that destructure the bundle.
 */
export const learningService = {
  createOrUpdateRule,
  applyAllRulesOnImport,
};

// ── D-CRUD-MEDIA sub-tarea 16 · listar / borrar reglas individualmente ───────

/**
 * Lista todas las reglas de aprendizaje persistidas, ordenadas por
 * fecha de actualización descendente (más recientemente aplicadas primero).
 */
export async function listRules(): Promise<MovementLearningRule[]> {
  const db = await initDB();
  const all = ((await db.getAll('movementLearningRules')) ?? []) as MovementLearningRule[];
  return all.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

/**
 * Borra una regla de aprendizaje. La regla deja de aplicarse a futuras
 * importaciones · los movimientos ya clasificados conservan su categoría.
 */
export async function deleteRule(id: number): Promise<void> {
  const db = await initDB();
  await db.delete('movementLearningRules', id);
}
