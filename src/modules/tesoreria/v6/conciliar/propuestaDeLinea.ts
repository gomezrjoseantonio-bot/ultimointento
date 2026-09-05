// ============================================================================
// Qué le decimos al usuario de una línea que no ha casado sola
// ============================================================================
//
// El orquestador YA calcula esto: `bankStatementOrchestrator.ts:260` llama a
// `suggestForUnmatched` y guarda el resultado en `OrchestratorResult.suggestions`.
// Hasta hoy ese mapa se quedaba ahí: ningún componente lo leía. La pantalla del
// extracto enseñaba el churro del banco y un botón, y la propuesta —que existía,
// con su confianza y su acción— se tiraba a la basura en cada importación.
//
// Este módulo es el traductor que faltaba: de `MovementSuggestion` a la frase que
// el mockup pone en la tarjeta. No decide nada ni escribe en la base: convierte.
//
// ── Dos reglas de lenguaje que vienen del brief (§3.5) ─────────────────────
//
// SIN JERGA · en pantalla no aparece nunca una casilla de la AEAT (0109, 0113…)
// ni un `categoryKey` crudo (`comunidad_inmueble`). El usuario lee "Comunidad de
// propietarios". Por eso `etiquetaDeCategoria` va contra el catálogo de conceptos
// y, si no encuentra la clave, devuelve `null` y la frase se queda sin ella: más
// vale decir menos que enseñar el nombre interno de un campo.
//
// SIN OPINAR · la tarjeta dice QUÉ parece ser, no si entra en el fiscal ni si el
// usuario ya lo decidió otro año. Eso lo decide él al responder.
// ============================================================================

import type { MovementSuggestion, SuggestionAction } from '../../../../services/movementSuggestionService';
import { CONCEPTOS_BASE } from '../../../../services/conceptos/conceptosBase';

/**
 * E1.5 · lo que este traductor necesita de una sugerencia · vale la de un
 * movimiento y la de una línea (`SugerenciaPorLinea`): ni una ni otra llevan
 * aquí su id, solo la vía y la acción.
 */
export type SugerenciaLegible = Omit<MovementSuggestion, 'movementId'>;

/**
 * El tono de la tarjeta · gobierna el color del filo izquierdo en el mockup.
 *
 * `confirma` es el caso del suministro variable: sabemos qué es, pero el importe
 * bailó y por eso se pregunta antes de darlo por bueno. `pregunta` es el "no sé
 * qué es". El resto propone algo concreto.
 */
export type TonoPropuesta = 'propone' | 'confirma' | 'pregunta';

export interface Propuesta {
  tono: TonoPropuesta;
  /** La frase gorda de la tarjeta · "Parece la renta de un inquilino". */
  titular: string;
  /** El porqué, en pequeño · lo que hace que la propuesta no sea un oráculo. */
  ayuda: string;
  /**
   * Si responder a esto deja algo aprendido. Solo se promete cuando es verdad:
   * la vía heurística no escribe regla, así que ahí no se enseña el sello.
   */
  seRecuerda: boolean;
}

/**
 * De la clave interna al nombre que el usuario usa.
 *
 * Se busca por las dos patas del concepto —la de inmueble y la de personal—
 * porque una misma clave puede llegar por cualquiera de las dos. Devuelve `null`
 * cuando no está en el catálogo: la alternativa era enseñar la clave cruda, que
 * es exactamente la jerga que el brief prohíbe.
 */
export function etiquetaDeCategoria(categoryKey: string | null | undefined): string | null {
  if (!categoryKey) return null;
  const clave = categoryKey.trim();
  if (!clave) return null;
  const concepto = CONCEPTOS_BASE.find(
    (c) => c.inmueble?.categoryKey === clave || c.personal?.categoria === clave,
  );
  return concepto?.label ?? null;
}

/** La sugerencia que manda · la de más confianza, y a igualdad la primera. */
function laQueManda(sugerencias: SugerenciaLegible[]): SugerenciaLegible | null {
  let mejor: SugerenciaLegible | null = null;
  for (const s of sugerencias) {
    if (!mejor || s.confidence > mejor.confidence) mejor = s;
  }
  return mejor;
}

/**
 * ¿Esta línea es del montón «personal»?
 *
 * El brief (§3.1) es literal: personal es lo «reconocido como personal por regla
 * aprendida o por marca del recurrente». La heurística NO entra, y no es un
 * matiz: la regla de Amazon marca gasto personal con 50 de confianza por leer
 * una palabra en el texto. Dejarla contar sacaría líneas de «te necesitan» sin
 * que el usuario haya decidido nada — que es la misma clase de bug que esta
 * pantalla viene a matar, solo que en vez de borrar la línea la esconde.
 */
export function esPersonalReconocido(sugerencias: SugerenciaLegible[]): boolean {
  return sugerencias.some(
    (s) =>
      (s.via === 'learning_rule' || s.via === 'compromiso_recurrente') &&
      s.action.kind === 'mark_personal_expense',
  );
}

/** El titular por acción · lo que el usuario lee primero. */
function titularDe(action: SuggestionAction): string {
  switch (action.kind) {
    case 'assign_to_contract':
      return 'Parece la renta de un inquilino';
    case 'mark_personal_expense': {
      const etiqueta = etiquetaDeCategoria(action.categoryKey);
      return etiqueta ? `Parece un gasto tuyo · ${etiqueta.toLowerCase()}` : 'Parece un gasto tuyo, no de un piso';
    }
    case 'create_treasury_event': {
      const etiqueta = etiquetaDeCategoria(action.categoryKey);
      if (action.ambito === 'PERSONAL') {
        return etiqueta ? `Parece ${etiqueta.toLowerCase()}, tuyo` : 'Parece un gasto tuyo, no de un piso';
      }
      return etiqueta ? `Parece ${etiqueta.toLowerCase()} de un piso` : 'Parece un gasto de un piso';
    }
    case 'transfer':
      return 'Parece un traspaso a otra cuenta tuya';
    case 'ignore':
    default:
      return 'No sé qué es · dímelo tú una vez';
  }
}

/** El porqué · de dónde sale la propuesta, en el idioma del usuario. */
function ayudaDe(s: SugerenciaLegible): string {
  switch (s.via) {
    case 'compromiso_recurrente':
      return 'te lo cobran cada mes y esta vez cuadra el proveedor, la cuenta y el día';
    case 'learning_rule':
      return 'ya me lo dijiste una vez y desde entonces lo reconozco';
    case 'heuristica':
    default:
      return s.action.kind === 'ignore'
        ? 'si subes la factura, la leo y relleno proveedor e importe solo'
        : 'lo deduzco del texto del banco · confírmalo antes de darlo por bueno';
  }
}

/**
 * Lo que dice la tarjeta de esta línea.
 *
 * Sin sugerencias devuelve la pregunta abierta y no un hueco: la tarjeta existe
 * igual porque la línea existe igual. Que ATLAS no tenga nada que proponer no es
 * motivo para dejar al usuario delante de un churro del banco sin salida.
 */
export function propuestaDeLinea(
  sugerencias: SugerenciaLegible[],
  atribucion?: { alias?: string; concepto: string; ejercicio: number } | null,
): Propuesta {
  const s = laQueManda(sugerencias ?? []);
  // FASE 2 · lo que el usuario declaró el año pasado responde a la pregunta que
  // de verdad atasca el extracto: de qué piso es. Se añade al porqué, no al
  // titular: es una pista fuerte, no una certeza, y la decisión sigue siendo
  // suya.
  const porLaDeclaracion = atribucion
    ? `en tu declaración de ${atribucion.ejercicio}, ${atribucion.concepto.toLowerCase()} es de ${atribucion.alias ?? 'uno de tus pisos'}`
    : null;

  if (!s) {
    return {
      tono: 'pregunta',
      titular: atribucion ? `Parece ${atribucion.concepto.toLowerCase()} de un piso` : 'No sé qué es · dímelo tú una vez',
      ayuda: porLaDeclaracion ?? 'si subes la factura, la leo y relleno proveedor e importe solo',
      seRecuerda: false,
    };
  }

  const tono: TonoPropuesta =
    s.action.kind === 'ignore' ? 'pregunta' : s.via === 'compromiso_recurrente' ? 'confirma' : 'propone';

  return {
    tono,
    titular: titularDe(s.action),
    ayuda: porLaDeclaracion ? `${ayudaDe(s)} · ${porLaDeclaracion}` : ayudaDe(s),
    // La heurística no escribe regla · prometer que se recuerda sería mentir.
    seRecuerda: s.via !== 'heuristica' && s.action.kind !== 'ignore',
  };
}

/**
 * Las propuestas de TODAS las líneas de la sesión · lo que el drawer pinta en
 * cada tarjeta. Sacado del componente para que la regla de qué se dice viva
 * junto a cómo se dice, y para que se pueda probar sin React.
 */
export function propuestasDeLineas(
  lineas: ReadonlyArray<{ lineaId: number }>,
  sugerencias: ReadonlyMap<number, SugerenciaLegible[]> | undefined,
  atribuciones: ReadonlyMap<number, { inmuebleId: number; concepto: string; ejercicio: number }> | undefined,
  inmuebles: ReadonlyArray<{ id: number; alias: string }>,
): Map<number, Propuesta> {
  const m = new Map<number, Propuesta>();
  if (!sugerencias && !atribuciones) return m;
  for (const l of lineas) {
    const a = atribuciones?.get(l.lineaId);
    m.set(
      l.lineaId,
      propuestaDeLinea(
        sugerencias?.get(l.lineaId) ?? [],
        a
          ? { alias: inmuebles.find((i) => i.id === a.inmuebleId)?.alias, concepto: a.concepto, ejercicio: a.ejercicio }
          : null,
      ),
    );
  }
  return m;
}
