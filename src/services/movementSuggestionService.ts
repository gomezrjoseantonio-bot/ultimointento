// TAREA 17 sub-task 17.3 · Movement suggestion service.
//
// For each movement that capa 2 (movementMatchingService) couldn't pair with a
// previously forecasted treasuryEvent, this service proposes one or more
// suggested actions for the user to confirm in the UI.
//
// Three vías are evaluated **in order**, with a short-circuit: as soon as a
// vía produces a suggestion with confidence ≥ 60, the remaining vías are not
// evaluated. The exception is vía B with appliedCount=0 (confidence 50): it is
// emitted but does NOT short-circuit, so vía C also runs.
//
// Vía A — `compromisosRecurrentes`. E2.3 · el juicio vive en
// `recurrentes/reconocerRecurrente`: identidad (CUPS / nº contrato / NIF de la
// llave de E2.1) > texto (`conceptoBancario` o proveedor), importe según el
// modo (fijo exacto · variable por rango), calendario del patrón como
// desempate, y `reparto[]` al atribuir. Confianza 75-95; con dos candidatos
// pegados no elige. Solo gasto: el compromiso modela salidas.
//
// Vía B — `movementLearningRules`. Compute learnKey via
// movementLearningService.buildLearnKey, look up by exact key. If a rule
// exists with appliedCount > 0, propose with confidence 70-85 (log10 bonus).
// If appliedCount == 0, propose at confidence 50 — informative but not
// actionable yet, and vía C still runs.
//
// Vía C — heuristics over description tokens. Detects suministros, hipoteca/
// cuota préstamo, IBI/tasas, comunidad, BIZUM/transferencias, AMAZON purchases.
// Falls back to `ignore` at confidence 30 if nothing matches.
//
// EL SIGNO MANDA PRIMERO · por encima de las tres vías. Antes de que ninguna
// palabra del texto del banco cuente, el importe ya ha dicho si el dinero entró
// o salió, y eso no admite interpretación: un negativo no puede ser el cobro de
// una renta y un positivo no puede ser un gasto. Cada regla mira su signo —así
// el motivo que se le enseña al usuario es el bueno— y además todo lo que sale
// de aquí pasa por `contradiceElSigno`, que es lo que impide que la regla que
// alguien escriba dentro de un año se olvide de mirarlo. Ver
// `sugerencias/signoDelMovimiento.ts`.
//
// Pure analysis: never mutates DB. The orchestrator (sub-task 17.5) applies
// approved suggestions and is the only writer.
import {
  initDB,
  Contract,
  Movement,
  MovementLearningRule,
  TreasuryEvent,
} from './db';
import { buildLearnKey, buildLearnKeyV1, nombreDeContraparte } from './movementLearningService';
import { contradiceElSigno } from './sugerencias/signoDelMovimiento';
import { puedeResolverSola } from './reglaResuelveSola';
import { reconocerRecurrente } from './recurrentes/reconocerRecurrente';
import { nivelDeCoincidencia } from './coincidenciaNombre';
import type { CompromisoRecurrente } from '../types/compromisosRecurrentes';
import type { LineaExtractoPersistida } from './db/types-lineasExtracto';
import { movimientosDesdeLineas, sugerenciasPorLinea, type SugerenciaPorLinea } from './lineaComoMovimiento';

export type SuggestionVia = 'compromiso_recurrente' | 'learning_rule' | 'heuristica';

export type SuggestionAction =
  | {
      kind: 'create_treasury_event';
      type: TreasuryEvent['type'];
      ambito: 'PERSONAL' | 'INMUEBLE';
      inmuebleId?: number;
      categoryKey?: string;
      sourceType: TreasuryEvent['sourceType'];
      sourceId?: number | string;
    }
  | { kind: 'assign_to_contract'; contractId?: number }
  | { kind: 'mark_personal_expense'; categoryKey: string }
  /** E2.2 · una regla aprendida de un traspaso · la línea es la salida hacia `cuentaDestinoId`. */
  | { kind: 'transfer'; cuentaDestinoId: number }
  | { kind: 'ignore' };

export interface MovementSuggestion {
  movementId: number;
  via: SuggestionVia;
  confidence: number;            // 0-100
  description: string;            // human-readable for UI
  action: SuggestionAction;
  metadata?: Record<string, unknown>;
}

const SHORT_CIRCUIT_CONFIDENCE = 60;

export async function suggestForUnmatched(
  movementIds: number[]
): Promise<Map<number, MovementSuggestion[]>> {
  const result = new Map<number, MovementSuggestion[]>();
  if (movementIds.length === 0) return result;

  const db = await initDB();

  const movements: Movement[] = [];
  for (const id of movementIds) {
    const mov = (await db.get('movements', id)) as Movement | undefined;
    if (mov && mov.id != null) movements.push(mov);
  }
  if (movements.length === 0) return result;

  return sugerirEnMemoria(db, movements);
}

/**
 * E1.4b · la misma entrada, por LÍNEA del extracto.
 *
 * Cada línea se convierte en el `Movement` que `insertMovements` habría
 * creado (en memoria, sin escribir) y se pasa por las MISMAS tres vías. El
 * mapa habla en `lineaId`. Las líneas descartadas no entran, igual que hoy no
 * tienen movimiento. E1.5 · es la puerta que usa el orquestador.
 */
export async function suggestForLineas(
  lineas: LineaExtractoPersistida[]
): Promise<Map<number, SugerenciaPorLinea[]>> {
  const movements = movimientosDesdeLineas(lineas);
  if (movements.length === 0) return new Map();
  const db = await initDB();
  return sugerenciasPorLinea(await sugerirEnMemoria(db, movements));
}

/**
 * Las tres vías sobre movimientos YA en memoria · lo comparten la entrada por
 * id (`suggestForUnmatched`) y la entrada por línea (`suggestForLineas`).
 */
async function sugerirEnMemoria(
  db: Awaited<ReturnType<typeof initDB>>,
  movements: Movement[]
): Promise<Map<number, MovementSuggestion[]>> {
  const result = new Map<number, MovementSuggestion[]>();
  const compromisos = await loadActiveCompromisos(db);
  const learningRulesByKey = await loadLearningRulesIndex(db, movements);
  const contratosActivos = await loadActiveContracts(db);

  for (const movement of movements) {
    const suggestions: MovementSuggestion[] = [];

    const viaA = respetandoElSigno(suggestFromCompromiso(movement, compromisos), movement.amount);
    if (viaA) suggestions.push(viaA);
    if (viaA && viaA.confidence >= SHORT_CIRCUIT_CONFIDENCE) {
      result.set(movement.id!, suggestions);
      continue;
    }

    const viaB = respetandoElSigno(
      suggestFromLearningRule(movement, learningRulesByKey),
      movement.amount,
    );
    if (viaB) suggestions.push(viaB);
    if (viaB && viaB.confidence >= SHORT_CIRCUIT_CONFIDENCE) {
      result.set(movement.id!, suggestions);
      continue;
    }

    const viaC = suggestFromHeuristics(movement, contratosActivos);
    if (viaC) suggestions.push(viaC);

    result.set(movement.id!, suggestions);
  }

  return result;
}

/**
 * El guardián · deja pasar la sugerencia sólo si no contradice el importe.
 *
 * Se descarta entera en vez de "corregirla" (darle la vuelta al `type`, por
 * ejemplo) porque una propuesta que sale al revés del signo no es una propuesta
 * buena mal etiquetada: es que la vía se equivocó de línea. Una regla aprendida
 * que dice "gasto personal" sobre un abono de nómina no acierta cambiándole el
 * tipo, acierta callándose y dejando que decida la vía siguiente — y si ninguna
 * sabe, que lo diga el usuario.
 */
function respetandoElSigno(
  sugerencia: MovementSuggestion | null,
  amount: number,
): MovementSuggestion | null {
  if (!sugerencia) return null;
  return contradiceElSigno(sugerencia.action, amount) ? null : sugerencia;
}

// ─── Vía A · compromisos recurrentes ─────────────────────────────────────────

async function loadActiveCompromisos(
  db: Awaited<ReturnType<typeof initDB>>
): Promise<CompromisoRecurrente[]> {
  let all: CompromisoRecurrente[] = [];
  try {
    all = ((await db.getAll('compromisosRecurrentes')) ?? []) as CompromisoRecurrente[];
  } catch {
    return [];
  }
  return all.filter(c => c.estado === 'activo');
}

/** Contratos vivos · los únicos a los que tiene sentido asignar un cobro de renta. */
async function loadActiveContracts(
  db: Awaited<ReturnType<typeof initDB>>
): Promise<Contract[]> {
  try {
    const all = ((await db.getAll('contracts')) ?? []) as Contract[];
    return all.filter(c => c.estadoContrato === 'activo');
  } catch {
    return [];
  }
}

function suggestFromCompromiso(
  movement: Movement,
  compromisos: CompromisoRecurrente[]
): MovementSuggestion | null {
  const r = reconocerRecurrente(movement, compromisos);
  if (!r) return null;
  const c = r.compromiso;
  const ambito = c.ambito === 'inmueble' ? 'INMUEBLE' : 'PERSONAL';
  const porQue =
    r.porIdentidad === 'cups'
      ? ' · por CUPS'
      : r.porIdentidad === 'numeroContrato'
      ? ' · por nº de contrato'
      : r.porIdentidad === 'nif'
      ? ' · por NIF'
      : '';
  return {
    movementId: movement.id!,
    via: 'compromiso_recurrente',
    confidence: r.confianza,
    description: `Coincide con compromiso "${c.alias}" (${c.proveedor?.nombre ?? 'proveedor sin nombre'})${porQue}`,
    action: {
      kind: 'create_treasury_event',
      type: 'expense',
      ambito,
      inmuebleId: r.inmuebleId,
      categoryKey: c.categoria,
      sourceType: 'gasto_recurrente',
      sourceId: c.id,
    },
    metadata: {
      compromisoId: c.id,
      razones: r.razones,
      ...(r.porIdentidad ? { porIdentidad: r.porIdentidad } : {}),
      ...(r.reparto ? { reparto: r.reparto } : {}),
    },
  };
}

// ─── Vía B · learning rules ─────────────────────────────────────────────────

async function loadLearningRulesIndex(
  db: Awaited<ReturnType<typeof initDB>>,
  movements: Movement[]
): Promise<Map<string, MovementLearningRule>> {
  const index = new Map<string, MovementLearningRule>();
  const seenKeys = new Set<string>();
  for (const movement of movements) {
    seenKeys.add(buildLearnKey(movement));
    // E2.1 · la v1 es el respaldo de LECTURA de las reglas de antes: se carga
    // también, y `suggestFromLearningRule` la prueba si la v2 no tiene regla.
    seenKeys.add(buildLearnKeyV1(movement));
  }

  for (const key of seenKeys) {
    let rules: MovementLearningRule[];
    try {
      rules = (await db.getAllFromIndex(
        'movementLearningRules',
        'learnKey',
        key
      )) as MovementLearningRule[];
    } catch {
      const all = ((await db.getAll('movementLearningRules')) ?? []) as MovementLearningRule[];
      rules = all.filter(r => r.learnKey === key);
    }
    if (rules.length > 0) {
      // Pick the rule with highest appliedCount; tiebreak by most recent update.
      rules.sort(
        (a, b) =>
          (b.appliedCount ?? 0) - (a.appliedCount ?? 0) ||
          (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
      );
      index.set(key, rules[0]);
    }
  }
  return index;
}

/**
 * La regla que aplica a este movimiento · por la clave v2 y, si no hay, por
 * la v1 (E2.1 · respaldo de lectura). Un recibo con nº de contrato que aún no
 * se ha confirmado desde E2.1 sigue encontrando la regla que aprendió antes;
 * en cuanto se confirme una vez, nace su regla v2 y es la que manda.
 */
function reglaDelMovimiento(
  movement: Movement,
  rulesByKey: Map<string, MovementLearningRule>
): { learnKey: string; rule: MovementLearningRule } | null {
  const v2 = buildLearnKey(movement);
  const porV2 = rulesByKey.get(v2);
  if (porV2) return { learnKey: v2, rule: porV2 };
  const v1 = buildLearnKeyV1(movement);
  if (v1 === v2) return null;
  const porV1 = rulesByKey.get(v1);
  return porV1 ? { learnKey: v1, rule: porV1 } : null;
}

function suggestFromLearningRule(
  movement: Movement,
  rulesByKey: Map<string, MovementLearningRule>
): MovementSuggestion | null {
  const encontrada = reglaDelMovimiento(movement, rulesByKey);
  if (!encontrada) return null;
  const { learnKey, rule } = encontrada;

  const applied = rule.appliedCount ?? 0;
  let confidence: number;
  if (applied === 0) {
    confidence = 50;
  } else {
    const bonus = Math.min(15, Math.round(Math.log10(applied + 1) * 5));
    confidence = 70 + bonus;
  }

  const action: SuggestionAction =
    rule.resolucion === 'traspaso' && rule.cuentaDestinoId != null
      ? { kind: 'transfer', cuentaDestinoId: rule.cuentaDestinoId }
      : rule.ambito === 'PERSONAL'
      ? { kind: 'mark_personal_expense', categoryKey: rule.categoria }
      : {
          kind: 'create_treasury_event',
          type: rule.amountSign === 'positive' ? 'income' : 'expense',
          ambito: 'INMUEBLE',
          inmuebleId: rule.inmuebleId ? Number(rule.inmuebleId) : undefined,
          categoryKey: rule.categoria,
          // Keep sourceType aligned with the event type so downstream flows
          // that branch on income vs gasto stay consistent.
          sourceType: rule.amountSign === 'positive' ? 'ingreso' : 'gasto',
        };

  return {
    movementId: movement.id!,
    via: 'learning_rule',
    confidence,
    description:
      applied > 0
        ? `Regla aprendida (${applied} aplicaciones previas) → ${rule.categoria}`
        : `Regla aprendida sin aplicaciones previas → ${rule.categoria}`,
    action,
    // E2.2 · `resuelveSola` · la regla se ha ganado la confianza y puede
    // ejecutarse sin preguntar. La pantalla lo lee de aquí y no de la regla:
    // el umbral vive en `reglaResuelveSola` y nadie más lo conoce.
    metadata: { learnKey, ruleId: rule.id, appliedCount: applied, resuelveSola: puedeResolverSola(rule) },
  };
}

// ─── Vía C · heuristics ─────────────────────────────────────────────────────

interface HeuristicRule {
  match: (description: string, amount: number) => boolean;
  build: (movement: Movement, contratos: Contract[]) => Omit<MovementSuggestion, 'movementId' | 'via'>;
}

/**
 * A QUÉ contrato apunta este ingreso, si es que apunta a uno solo.
 *
 * Un Bizum llega como "BIZUM DE ADNAN PARWEZ" y en el contrato pone "Adnan
 * Parwez Khan": comparando por palabras (`nivelDeCoincidencia`) eso es una
 * coincidencia `fuerte` — nombre y apellido, no un parecido de pila suelto.
 *
 * Sólo se devuelve el contrato cuando hay UNO y sólo uno así. Con dos hermanos
 * en el mismo piso, o sin ninguna coincidencia, se deja sin resolver: proponer
 * el contrato equivocado es peor que no proponer ninguno, y el evento sigue
 * naciendo como hasta ahora. Esto NO concilia nada por su cuenta · sigue
 * decidiendo el usuario al confirmar la sugerencia.
 */
function contratoDeLaContraparte(
  movement: Movement,
  contratos: Contract[],
): Contract | undefined {
  const nombreBanco = nombreDeContraparte(movement);
  if (!nombreBanco) return undefined;

  const candidatos = contratos.filter((c) => {
    if (c.id == null) return false;
    const inquilino = `${c.inquilino?.nombre ?? ''} ${c.inquilino?.apellidos ?? ''}`.trim();
    if (!inquilino) return false;
    return nivelDeCoincidencia(nombreBanco, inquilino) === 'fuerte';
  });

  return candidatos.length === 1 ? candidatos[0] : undefined;
}

const HEURISTIC_RULES: HeuristicRule[] = [
  // Suministros (always evaluated before generic prestamo / bizum so
  // "RECIBO IBERDROLA CLIENTES SAU" doesn't fall into the BIZUM bucket).
  //
  // El `amount < 0` de ésta y de las tres siguientes no es defensivo: una línea
  // de IBERDROLA en positivo es una devolución, y proponerla como gasto la
  // sumaría al gasto del piso cuando lo que hace es restarlo.
  {
    match: (d, amount) =>
      amount < 0 &&
      /(IBERDROLA|ENDESA|NATURGY|REPSOL|CEPSA|TOTAL\s+ENERGIES|VODAFONE|MOVISTAR|ORANGE|YOIGO|MASMOVIL|JAZZTEL)/i.test(
        d
      ),
    build: () => ({
      confidence: 60,
      description: 'Posible suministro · proponer crear evento de tesorería en INMUEBLE (puedes cambiarlo a PERSONAL)',
      action: {
        kind: 'create_treasury_event',
        type: 'expense',
        ambito: 'INMUEBLE',
        categoryKey: 'inmueble.suministros',
        sourceType: 'gasto',
      },
    }),
  },
  // Hipoteca / préstamo
  {
    match: (d, amount) => amount < 0 && /(CUOTA\s+PRESTAMO|HIPOTECA|RECIBO\s+BANCO)/i.test(d),
    build: () => ({
      confidence: 65,
      description: 'Posible cuota de préstamo / hipoteca · proponer asignar a préstamo activo de la cuenta',
      action: {
        kind: 'create_treasury_event',
        type: 'expense',
        ambito: 'INMUEBLE',
        categoryKey: 'vivienda.hipoteca',
        sourceType: 'prestamo',
      },
    }),
  },
  // IBI / tasas / impuestos inmueble
  {
    match: (d, amount) =>
      amount < 0 && /(\bIBI\b|TASA\s+BASURA|AYUNTAMIENTO|CONTRIBUCION\s+URBANA)/i.test(d),
    build: () => ({
      confidence: 60,
      description: 'Posible impuesto del inmueble (IBI, tasa de basura, etc.)',
      action: {
        kind: 'create_treasury_event',
        type: 'expense',
        ambito: 'INMUEBLE',
        categoryKey: 'inmueble.ibi',
        sourceType: 'gasto',
      },
    }),
  },
  // Comunidad
  {
    match: (d, amount) => amount < 0 && /(COMUNIDAD|ADMIN\s+FINCAS|FINCAS)/i.test(d),
    build: () => ({
      confidence: 60,
      description: 'Posible cuota de comunidad de propietarios',
      action: {
        kind: 'create_treasury_event',
        type: 'expense',
        ambito: 'INMUEBLE',
        categoryKey: 'inmueble.comunidad',
        sourceType: 'gasto',
      },
    }),
  },
  // BIZUM / transferencia RECIBIDA · sólo cuando el dinero entra.
  //
  // Aquí estaba el bug de la captura: el `match` recibía el importe y no lo
  // miraba, así que "Compra Bizum Iryo −70,48 €" salía como "Parece la renta de
  // un inquilino". Peor todavía con "Bizum A Favor De Aroa Gómez −80 €": el
  // texto del banco trae el nombre de una inquilina viva y el buscador de
  // contraparte lo casaba con su contrato, subiendo la confianza a 60. El nombre
  // coincidía porque Aroa es quien COBRA los 80 €.
  {
    match: (d, amount) => amount > 0 && /(BIZUM|TRANSFERENCIA\s+RECIBIDA)/i.test(d),
    build: (movement, contratos) => {
      // A qué contrato · sin esto el evento nacía sin `sourceId` ni
      // `contratoId`, huérfano: ni contaba para el estado de cobro del
      // inquilino ni lo veía el dedupe de previsiones.
      const contrato = contratoDeLaContraparte(movement, contratos);
      if (!contrato) {
        // SIN INQUILINO NO HAY RENTA QUE PROPONER.
        //
        // Antes esto salía igual: `assign_to_contract` con `contractId`
        // undefined y la frase «Parece la renta de un inquilino» encima. Dos
        // cosas mal a la vez. Una, afirma lo que no sabe — sobre «Transferencia
        // recibida · +200 €» no hay absolutamente nada que diga renta, y la
        // misma frase salía sobre un ingreso de 83,37 €. Y dos, es una acción
        // IMPOSIBLE de ejecutar: el evento nacería sin `sourceId` ni
        // `contratoId`, huérfano, sin contar para el estado de cobro del
        // inquilino ni para el dedupe de previsiones. Es exactamente el bug que
        // arregló `asignarCobroAContrato`, servido desde la pantalla con una
        // frase bonita delante.
        //
        // La pregunta abierta es la verdad, y además dice qué la resolvería.
        return {
          confidence: 30,
          description:
            'Un ingreso que no reconozco · si me dices de quién es una vez, el resto de sus cobros los coloco solos',
          action: { kind: 'ignore' },
        };
      }
      const inquilino = `${contrato.inquilino?.nombre ?? ''} ${contrato.inquilino?.apellidos ?? ''}`.trim();
      return {
        confidence: 60,
        description: `Bizum o transferencia recibida · proponer asignarlo a la renta de ${inquilino}`,
        action: { kind: 'assign_to_contract', contractId: contrato.id },
      };
    },
  },
  // BIZUM que SALE · el gemelo de la regla de arriba, para no dejar la línea con
  // la frase genérica de "sin patrón reconocible". Sabemos algo de ella: sabemos
  // que NO es un cobro. Decírselo al usuario le ahorra preguntarse por qué ATLAS
  // no ha reconocido un Bizum que ve clarísimo.
  {
    match: (d, amount) => amount < 0 && /BIZUM/i.test(d),
    build: () => ({
      confidence: 30,
      description: 'Bizum que sale de tu cuenta · lo pagas tú, así que no es el cobro de ninguna renta',
      action: { kind: 'ignore' },
    }),
  },
  // Compras Amazon / AliExpress (only when amount is negative ⇒ gasto personal)
  {
    match: (d, amount) =>
      amount < 0 && /(AMAZON|ALIEXPRESS|ALI\s+EXPRESS)/i.test(d),
    build: () => ({
      confidence: 50,
      description: 'Compra online (Amazon / AliExpress) · proponer marcar como gasto personal',
      action: {
        kind: 'mark_personal_expense',
        categoryKey: 'tecnologia',
      },
    }),
  },
];

/**
 * Lo que se dice cuando no se sabe · la tarjeta existe igual.
 *
 * Que ninguna vía tenga nada que proponer no puede dejar la línea sin sugerencia:
 * la pantalla enseñaría el churro del banco pelado y sin salida, que es
 * exactamente el bug que la pantalla de conciliar vino a matar.
 */
function noSeQueEs(movement: Movement): MovementSuggestion {
  return {
    movementId: movement.id!,
    via: 'heuristica',
    confidence: 30,
    description: 'Sin patrón reconocible · puedes ignorarlo o clasificarlo manualmente',
    action: { kind: 'ignore' },
  };
}

function suggestFromHeuristics(movement: Movement, contratos: Contract[]): MovementSuggestion {
  const description = (movement.description ?? '').trim();

  for (const rule of HEURISTIC_RULES) {
    if (rule.match(description, movement.amount)) {
      const partial = rule.build(movement, contratos);
      const sugerencia: MovementSuggestion = {
        movementId: movement.id!,
        via: 'heuristica',
        ...partial,
      };
      // El guardián · una heurística que contradiga el signo no se emite ni
      // corregida ni a media confianza: se cae y la línea vuelve al "no sé qué
      // es", que es la verdad.
      return respetandoElSigno(sugerencia, movement.amount) ?? noSeQueEs(movement);
    }
  }

  return noSeQueEs(movement);
}
