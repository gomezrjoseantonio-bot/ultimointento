// ============================================================================
// ¿Contradecir al usuario sobre qué banco es este fichero?
// ============================================================================
//
// Hay DOS detectores de banco y tenían criterios opuestos.
//
// El que PREGUNTA (`detectarCuenta`, por IBAN) es estricto a propósito: si no
// encuentra el IBAN en el fichero no adivina, te pide que elijas la cuenta —
// «sin certeza no se adivina (importar en la cuenta equivocada falsea saldos)».
//
// El que CONTRADICE después (`bankProfileMatcher.match`) puntúa el fichero
// contra todos los perfiles y devuelve el que más saque, sea cual sea su
// puntuación. Como todos los extractos españoles llevan cabeceras parecidas
// —fecha, concepto, importe—, cualquier fichero saca algún punto con algún
// perfil.
//
// Resultado: subes un .xls de BBVA, ATLAS no detecta el IBAN y te pide elegir
// cuenta, eliges BBVA, y entonces te dice que el contenido «apunta a Santander»
// y que descartes y empieces de nuevo. Con 8 puntos sobre 100.
//
// Aquí vive el filtro que faltaba, con el MISMO umbral que el fichero ya usa
// para creerse sus propias detecciones. Antes, para decidir por su cuenta pedía
// 60; para desautorizar a una persona le bastaba con 1.
// ============================================================================

/** Lo mínimo para creerse una detección de banco por contenido. */
export const PROFILE_CONFIDENCE_THRESHOLD = 60;

export interface DeteccionDeBanco {
  /** Clave del perfil que más puntuó, o `null` si no hubo ninguno. */
  profile: string | null;
  /** 0-100 · suma de cabeceras, nombre de fichero, contenido e IBAN. */
  confidence: number;
}

/**
 * ¿Hay motivo para decirle al usuario que se ha equivocado de cuenta?
 *
 * Solo cuando la detección es creíble Y señala otro banco. Sin cuenta elegida no
 * hay a quién contradecir, y sin perfil detectado no hay con qué.
 */
export function contradiceLaCuentaElegida(
  cuentaElegida: string | null | undefined,
  deteccion: DeteccionDeBanco,
): boolean {
  if (!cuentaElegida || !deteccion.profile) return false;
  if (deteccion.confidence < PROFILE_CONFIDENCE_THRESHOLD) return false;
  return deteccion.profile.toLowerCase() !== cuentaElegida.toLowerCase();
}
