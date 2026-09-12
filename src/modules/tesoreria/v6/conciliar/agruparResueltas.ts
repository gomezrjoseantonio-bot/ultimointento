// ============================================================================
// El nombre de una línea resuelta y la clave de texto sin lo que cambia
// ============================================================================
//
// Esto era «el montón de la derecha»: agrupaba por el texto del banco
// normalizado. Desde el rediseño de Conciliar se agrupa por ENTIDAD
// (`agruparPorEntidad.ts`): un CUPS, un contrato, una persona, un traspaso.
// Lo que queda aquí es lo que sigue haciendo falta: la clave de texto que quita
// números y referencias (la usa la entidad cuando el banco no da identificador)
// y cómo se llama una línea ya resuelta.
// ============================================================================

import { estaClasificada, etiquetaDeClasificacion } from '../../../../services/clasificacion/clasificada';
import type { LineaExtracto } from '../extractoSesion';

/**
 * La clave de agrupación · el nombre sin lo que cambia en cada recibo.
 *
 * Se quitan los números (importes, cuotas «3/240», números de recibo, años) y la
 * puntuación, y se colapsa el espacio. Lo que queda es el nombre de la cosa.
 * Deliberadamente tosco: agrupar de más junta dos gastos parecidos en una fila
 * que el usuario puede abrir; agrupar de menos le devuelve el extracto entero.
 */
export function claveDeGrupo(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[0-9]+([.,/-][0-9]+)*/g, ' ')
    .replace(/[^a-záéíóúüñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cómo se llama esta línea resuelta · lo que casó manda sobre el churro; y si
 * no casó con nada pero el motor le puso sus ejes, la ETIQUETA manda sobre el
 * texto del banco (E2.4.2-fix2): «AHORRO» y «AHORROS» son una sola fila,
 * «Traspaso · A ahorro», no dos montones partidos por una ese.
 */
export function nombreDeLineaResuelta(l: LineaExtracto): string {
  if (l.previsto?.descripcion) return l.previsto.descripcion;
  if (l.confirmado?.descripcion) return l.confirmado.descripcion;
  if (l.clasificacion && estaClasificada(l.clasificacion)) return etiquetaDeClasificacion(l.clasificacion);
  return l.textoBanco;
}
