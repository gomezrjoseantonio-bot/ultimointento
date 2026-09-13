import { initDB, Movement, MovementLearningRule } from './db';
import type { FamiliaId } from './catalogo/catalogoUnico';
import { contraparteDeBizum } from './bizum';
import { claveDeContraparte, claveDeNombre, nivelDeCoincidencia } from './coincidenciaNombre';
import { parteDeLaTransferencia } from './deterministas/traspasosPropios';
import { normalizarTexto } from './deterministas/texto';
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
    // Códigos largos · SOLO lo que mezcla letras y números («a1b2c3d4», un
    // CUPS, una referencia con prefijo). Antes era `[a-z0-9]{8,}` a secas y,
    // como `normalizeText` ya lo ha pasado todo a minúsculas, borraba también
    // las PALABRAS de ocho letras o más: «mercadona», «iberdrola»,
    // «comunidad», «transferencia». Sin ellas casi ningún concepto dejaba dos
    // palabras que juntar, la clave se quedaba en «v1|signo» y cualquier
    // apunte del mismo signo compartía clave — o sea que clasificar una línea
    // clasificaba el resto. Los números largos sueltos ya los quita la
    // regla de arriba, así que aquí solo hace falta lo mixto.
    .replace(/\b(?=[a-z0-9]*\d)[a-z0-9]{8,}\b/g, '')
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

/** El texto del que sale la clave · concepto y contraparte, sin lo volátil. */
function textoParaLaClave(movement: Movement, conIdentificador = false): string {
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

  return `${cleanContraparte} ${cleanDescripcion}`.trim();
}

/**
 * Los n-grams del movimiento · lo que comparten todos los recibos de un mismo
 * texto, una vez quitado lo volátil. Es la parte común de las claves v1 y v2.
 */
function ngramsDelMovimiento(movement: Movement, conIdentificador = false): string[] {
  const combinedText = textoParaLaClave(movement, conIdentificador);

  // Extract top 3 n-grams
  const ngrams = extractNGrams(combinedText, 3);

  // SIN identificador la clave son los n-gram y nada más, como siempre: el
  // principio del concepto dice quién cobra y la cola suele ser texto libre
  // («Bizum a favor de Víctor Concepto Cena» y «… Concepto Regalo» son el
  // mismo Víctor). Meter todas las palabras partiría esos dos en dos reglas y
  // se perdería lo que E2.4.2 vino a hacer.
  if (!conIdentificador) return ngrams;

  // CON identificador sí entran todas las palabras, sin repetir y en orden
  // alfabético. El acreedor ya está fijado por su NIF o su CUPS, así que lo
  // que quede del texto solo puede afinar QUÉ le compras: sin esto, el gas y
  // la luz del mismo acreedor comparten los tres primeros n-gram y se funden
  // en una sola regla. En orden alfabético porque un banco que escriba el
  // mismo concepto en otro orden no debería estrenar regla.
  //
  // Solo palabras de LETRAS: un token con dígitos («ene2024», el nº de
  // factura) es volátil y estrenaría regla cada mes.
  const palabras = Array.from(
    new Set(combinedText.split(/\s+/).filter((w) => w.length > 2 && /^[a-z]+$/.test(w))),
  ).sort();

  // E2.3 · si tras quitar lo volátil queda UNA sola palabra («gas», «luz») no
  // hay n-gram posible y la clave se quedaría solo con el identificador.
  if (ngrams.length === 0) return palabras.slice(0, 3);
  return [...ngrams, ...palabras];
}

/**
 * ¿Hay CON QUÉ agrupar este concepto? · dos palabras, no una.
 *
 * Una sola palabra no identifica a nadie: «BIZUM», «TRANSFERENCIA» o «RECIBO»
 * a secas son cualquiera. Agruparlos era el fallo que hacía que clasificar una
 * línea clasificara todas las pendientes del mismo signo. Con identificador la
 * pregunta no se hace: un CUPS o un NIF agrupa solo.
 */
function hayConQueAgrupar(movement: Movement): boolean {
  return extractNGrams(textoParaLaClave(movement), 1).length > 0;
}

function sinNumerosCortos(text: string): string {
  return text.replace(/\b\d{1,3}\b/g, '').replace(/\s+/g, ' ').trim();
}

function signoDe(movement: Movement): 'positive' | 'negative' {
  return movement.amount >= 0 ? 'positive' : 'negative';
}

/**
 * Las PIEZAS de la clave · lo que se hashea, antes de hashearlo. `reglaEncaja`
 * las compara tal cual: dos textos que dieran el mismo hash por casualidad no
 * darían las mismas piezas.
 */
function piezasV1(movement: Movement): string | null {
  if (!hayConQueAgrupar(movement)) return null;
  return ['v1', signoDe(movement), ...ngramsDelMovimiento(movement)].join('|');
}

/**
 * E3.2 · §7.4 · QUIÉN está al otro lado, reducido a clave · '' si no se sabe.
 */
export function claveDeContraparteDelMovimiento(movement: Movement): string {
  const nombre = nombreDeContraparte(movement);
  return nombre ? claveDeContraparte(nombre) : '';
}

/**
 * Las piezas de la clave v3 · `v3|signo|cp=<nombre ordenado>`.
 *
 * La agrupación es la PERSONA, no el texto. Sin esto, el trigrama que manda en
 * «Transferencia Inmediata A Favor De <quien sea>» es «transferencia inmediata
 * favor» —cabecera del banco, no la persona—, y 198 apuntes de 33 personas
 * distintas caían en la MISMA clave: clasificar uno clasificaba los 198. Es el
 * cajón común de #1866 reapareciendo por otra puerta.
 *
 * Al revés también: los apuntes de una persona se partían en varias reglas
 * porque el banco los encabeza distinto («TRANSFERENCIA A Eloy Gómez Ramírez» y
 * «Bizum A Favor De Eloy Gómez Ramírez»). Con la persona por delante, son una.
 */
function piezasV3(movement: Movement, clave: string): string {
  return ['v3', signoDe(movement), `cp=${clave}`].join('|');
}

function piezasV2(movement: Movement, claves: readonly string[]): string {
  return ['v2', signoDe(movement), ...ngramsDelMovimiento(movement, true), ...claves.map((c) => `id=${c}`)].join('|');
}

/**
 * La clave v1 · `v1|signo|ngramA|ngramB|ngramC`, hasheada.
 *
 * Es la que tienen las reglas aprendidas antes de E2.1. Se conserva SOLO para
 * leerlas (`movementSuggestionService` la prueba cuando la v2 no encuentra
 * regla); no se escribe ninguna regla nueva con ella. No se migran las viejas:
 * son de usar y tirar, y la primera confirmación con identificador ya nace v2.
 *
 * `null` cuando del concepto no queda NADA con lo que agrupar. Antes esos
 * movimientos se iban todos a la misma clave —`v1|signo` y punto— y ese cajón
 * era el más poblado del sistema: una regla aprendida ahí se aplicaba a
 * cualquier otro apunte del mismo signo. «No sé agrupar esto» tiene que
 * significar eso y no «agrúpalo con todo lo demás».
 */
export function buildLearnKeyV1(movement: Movement): string | null {
  const piezas = piezasV1(movement);
  return piezas === null ? null : simpleHash(piezas);
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
export function buildLearnKey(movement: Movement): string | null {
  const ids = clavesEstables(movement);
  // Con identificador SÍ hay con qué: un CUPS o un NIF agrupa por sí solo,
  // aunque del texto no quede un n-gram. Manda sobre todo lo demás.
  if (ids.length > 0) return simpleHash(piezasV2(movement, ids.map(claveDeIdentificador)));
  // E3.2 · §7.4 · sin identificador, QUIÉN está al otro lado manda sobre el
  // texto: es lo único que no cambia de un banco a otro ni de un mes a otro.
  const contraparte = claveDeContraparteDelMovimiento(movement);
  if (contraparte) return simpleHash(piezasV3(movement, contraparte));
  // Y sin nombre, la v1 de siempre · que puede decir que no hay con qué agrupar.
  return buildLearnKeyV1(movement);
}

/**
 * E3.1 · las CLAVES del movimiento · los identificadores menos el `acreedor`.
 *
 * El acreedor es el NOMBRE de quien cobra («BIP   DRIVE, S.A.»), no una clave:
 * lo escribe el banco y cambia de un extracto a otro. Sirve para cruzar el
 * catálogo nacional (§7.3), no para identificar una regla aprendida: si
 * entrara en `learnKey`, el mismo recibo escrito de dos maneras daría dos
 * reglas, que es justo lo contrario de lo que hace falta.
 */
function clavesEstables(movement: Movement) {
  return identificadoresDeMovimiento(movement).filter((id) => id.tipo !== 'acreedor');
}

/** Los identificadores del movimiento, como se guardan en la regla · «tipo:valor». */
export function identificadoresDeRegla(movement: Movement): string[] {
  return clavesEstables(movement).map(claveDeIdentificador);
}

/**
 * El texto del que nace una regla · lo que se guarda para poder comprobar, al
 * aplicarla, que sigue encajando (`reglaEncaja`). Es la ÚNICA derivación: la
 * usa `createOrUpdateRule` y la usan los tests que siembran reglas.
 */
export function patronesDeRegla(
  movement: Movement,
): Pick<
  MovementLearningRule,
  'counterpartyPattern' | 'descriptionPattern' | 'amountSign' | 'identificadores' | 'contraparteClave'
> {
  const identificadores = identificadoresDeRegla(movement);
  // E3.2 · de quién es la regla · solo cuando es ELLO lo que la agrupa, o sea
  // cuando no hay identificador: con un CUPS delante, quien paga es lo de menos.
  const contraparteClave = identificadores.length === 0 ? claveDeContraparteDelMovimiento(movement) : '';
  return {
    counterpartyPattern: normalizeText(movement.counterparty || ''),
    descriptionPattern: removeVolatileTokens(normalizeText(movement.description || '')),
    amountSign: signoDe(movement),
    ...(identificadores.length > 0 ? { identificadores } : {}),
    ...(contraparteClave ? { contraparteClave } : {}),
  };
}

/**
 * ¿Sigue encajando la regla con ESTE movimiento? · el tercer candado (Jose ·
 * 11 sep 2026).
 *
 * La regla se encuentra por clave, y la clave es un hash. Aquí se comprueba
 * lo que el hash resume: las piezas que salen del texto del movimiento y las
 * que salen del texto GUARDADO en la regla tienen que ser las mismas (v2 con
 * v2 si los dos traen identificador; si no, v1 con v1). Rechaza tres cosas
 * que por clave pasaban: una regla sin texto guardado (no hay nada que
 * comprobar · no se aplica), una regla del cajón común anterior a #1866 (su
 * texto ya no da clave) y una colisión del hash entre dos textos distintos.
 */
export function reglaEncaja(movement: Movement, rule: MovementLearningRule): boolean {
  const deLaRegla = {
    description: rule.descriptionPattern ?? '',
    counterparty: rule.counterpartyPattern ?? '',
    amount: rule.amountSign === 'negative' ? -1 : 1,
  } as Movement;
  const clavesMov = identificadoresDeRegla(movement);
  const clavesRegla = rule.identificadores ?? [];
  if (clavesMov.length > 0 && clavesRegla.length > 0) {
    return piezasV2(movement, clavesMov) === piezasV2(deLaRegla, clavesRegla);
  }
  // E3.2 · v3 · la regla agrupa por PERSONA, así que la persona es lo que se
  // confirma. No se vuelve a leer el nombre del texto guardado en la regla: ese
  // texto está normalizado y sin lo volátil, no es el del banco, y el lector de
  // nombres espera el del banco. Por eso la clave se guardó con la regla.
  const cpMov = claveDeContraparteDelMovimiento(movement);
  const cpRegla = rule.contraparteClave ?? '';
  // D3 sigue en pie: una regla SIN texto guardado no se aplica a nada. Es el
  // hueco por el que se colaba la regla que el orquestador creaba sin
  // movimiento delante, y el nombre no lo tapa — una regla de verdad guarda
  // siempre las dos cosas a la vez (`patronesDeRegla`).
  if (cpMov && cpRegla && rule.descriptionPattern) {
    return piezasV3(movement, cpMov) === piezasV3(deLaRegla, cpRegla);
  }
  // Si solo una de las dos trae nombre, se comprueba por el texto como siempre:
  // una regla de ANTES de E3.2 no lo lleva y se encontró por su clave v1, que es
  // la que hay que confirmar. Exigirle un nombre que nunca guardó la apagaría.
  const piezas = piezasV1(movement);
  return piezas !== null && piezas === piezasV1(deLaRegla);
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
  const texto = movement.description ?? '';
  // E3.2 · la columna de contraparte existe en el modelo pero NINGÚN banco la
  // rellena: de los 4.166 movimientos de los diez extractos reales de Jose,
  // cero. El nombre hay que leerlo del concepto, y de eso ya sabían dos sitios
  // —los Bizum aquí al lado y la parte de una transferencia en el cruce de
  // traspasos—, cada uno para lo suyo. Se preguntan los dos.
  return contraparteDeBizum(texto) ?? parteDeLaTransferencia(normalizarTexto(texto)) ?? undefined;
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
  /** Lo que la regla aprende · eje 2 del catálogo único. */
  familia?: FamiliaId;
  subtipo?: string;
  ambito: 'personal' | 'inmueble';
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
    const { learnKey, familia, subtipo, ambito, inmuebleId, movement, contraparteConfirmada } = params;
    const resolucion = params.resolucion ?? 'clasificar';
    const cuentaDestinoId = resolucion === 'traspaso' ? params.cuentaDestinoId : undefined;
    const now = new Date().toISOString();

    const alias = movement ? aliasAprendible(movement, contraparteConfirmada) : undefined;

    // El texto del que nace la regla · una sola derivación (`patronesDeRegla`),
    // la misma que comprueba `reglaEncaja` al aplicarla. Los identificadores
    // se guardan legibles («contrato:8078716546») para la pantalla de reglas.
    const patrones = movement ? patronesDeRegla(movement) : undefined;
    const derivedCounterparty = patrones?.counterpartyPattern;
    const derivedDescription = patrones?.descriptionPattern;
    const derivedAmountSign = patrones?.amountSign;
    const derivedIdentificadores = patrones?.identificadores ?? [];

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
        familia,
        subtipo,
        ambito,
        inmuebleId,
        resolucion,
        cuentaDestinoId,
      });
      // E3.2 · enseñar SOLO el piso no borra la familia que la regla ya sabía.
      // Este upsert escribía todos los campos siempre, así que una confirmación
      // sin familia —ahora posible— dejaría la regla peor de lo que estaba. Es
      // el mismo fallo que E3.1b encontró en el alta de agencias.
      if (familia !== undefined) {
        rule.familia = familia;
        rule.subtipo = subtipo;
      }
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
      // E3.2 · de quién es · igual que los patrones, se rellena si faltaba.
      if (patrones?.contraparteClave && !rule.contraparteClave) {
        rule.contraparteClave = patrones.contraparteClave;
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
        familia,
        subtipo,
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
    familia?: FamiliaId;
    subtipo?: string;
    ambito: 'personal' | 'inmueble';
    inmuebleId?: string;
    resolucion: 'clasificar' | 'traspaso';
    cuentaDestinoId?: number;
  }
): boolean {
  const mismoPiso = (rule.inmuebleId ?? '') === (nuevo.inmuebleId ?? '');
  const mismaResolucion = (rule.resolucion ?? 'clasificar') === nuevo.resolucion;
  const mismaCuenta = (rule.cuentaDestinoId ?? null) === (nuevo.cuentaDestinoId ?? null);
  // E3.2 · una confirmación que no dice familia no CONTRADICE la que hubiera:
  // no enseña nada sobre eso, así que no es cambiar de opinión.
  const mismaFamilia = nuevo.familia === undefined || rule.familia === nuevo.familia;
  const mismoSubtipo = nuevo.familia === undefined || (rule.subtipo ?? '') === (nuevo.subtipo ?? '');
  return !(
    mismaFamilia &&
    mismoSubtipo &&
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
 * Service surface kept for compat with consumers that destructure the bundle.
 */
export const learningService = {
  createOrUpdateRule,
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
