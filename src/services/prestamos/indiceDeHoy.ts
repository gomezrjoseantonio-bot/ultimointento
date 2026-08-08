// ============================================================================
// De dónde sale el índice cuando NADIE ha confirmado cuál se aplica
// ============================================================================
//
// `valorIndiceActual` se escribe una vez —al dar de alta el préstamo, al leer
// la FEIN, al importar— y ahí se queda para siempre. La ficha lo enseñaba con
// tres decimales, «euríbor 2,850», con la misma firmeza que un dato de un
// papel; y a dos pantallas de distancia «Actualizar valores» decía 4,000. Dos
// números para la misma pregunta, y el que se veía era el viejo.
//
// La regla de fondo *(Jose · 8 ago 2026)*:
//
//   **No hay euríbor fijado hasta que se confirma en algún sitio cuál aplica.**
//
// Confirmarlo es apuntar la revisión: eso entra en `revisionesDeTipo`, y
// `tramosDeTipo` la trata como hecho (`estimado: false`) y no proyecta nada por
// encima. Todo lo demás —el arranque de una variable, el tramo variable de una
// mixta que todavía no ha llegado— es una PRESUNCIÓN, y una presunción tiene
// que salir del único sitio donde el índice se mantiene al día, que es
// «Actualizar valores». Si sale de un campo congelado hace dos años, no es que
// esté desactualizada: es que es otra fuente de verdad, y hay dos.
//
// Esto NO toca lo confirmado. Sustituir la presunción no mueve un tramo que
// venga de una revisión apuntada, porque ese tramo no lee `valorIndiceActual`.
// ============================================================================

import type { Prestamo } from '../../types/prestamos';

/**
 * El mismo préstamo, con la presunción de índice puesta al día.
 *
 * Se le pasa el índice de «Actualizar valores» y devuelve el préstamo que hay
 * que preguntarle al motor. Un fijo vuelve tal cual —no tiene índice—, y sin
 * índice conocido también: nada de `?? 0`, que escribiría un euríbor al cero
 * por ciento como si alguien lo hubiera dicho.
 *
 * Devuelve **la misma referencia** cuando no hay nada que cambiar, para que los
 * `useMemo` que cuelgan del préstamo no se recalculen por gusto.
 */
export function conIndiceDeHoy(
  prestamo: Prestamo,
  indiceHoy: number | null | undefined
): Prestamo {
  if (prestamo.tipo === 'FIJO') return prestamo;
  if (typeof indiceHoy !== 'number' || !Number.isFinite(indiceHoy)) return prestamo;
  if (prestamo.valorIndiceActual === indiceHoy) return prestamo;
  return { ...prestamo, valorIndiceActual: indiceHoy };
}
