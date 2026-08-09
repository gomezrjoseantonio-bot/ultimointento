// ============================================================================
// La letra energética del inmueble que financia el préstamo · §6 ter
// ============================================================================
//
// *«El certificado energético, si se tiene o no se tiene, se dice una vez ·
// podemos implementarlo en el alta del piso»* *(Jose · 8 ago 2026)*.
//
// Es la única condición de una hipoteca que no se prueba con dinero. No hay
// movimiento que mirar ni recibo que llegue: o el inmueble tiene su certificado
// o no lo tiene, y eso lo sabe el inmueble. Por eso vive aquí y no en
// `bonificaciones/`: la prueba no sale de la tesorería.
// ============================================================================

import { initDB } from '../db';
import type { Prestamo } from '../../types/prestamos';

/** Lo que dice el certificado · `'NO'` = no lo tiene. */
export type LetraEnergetica = 'NO' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

/**
 * El inmueble que financia el préstamo · `undefined` si es personal.
 *
 * El criterio estaba escrito en una pantalla de conciliación y hacía falta
 * aquí: el destino manda y el `inmuebleId` de raíz es el respaldo de los
 * préstamos anteriores a que existieran los destinos.
 */
export const inmuebleDelPrestamo = (p: Prestamo | undefined): string | undefined =>
  p?.destinos?.find((d) => d.inmuebleId)?.inmuebleId ?? p?.inmuebleId;

/**
 * La letra del inmueble · `null` cuando no consta.
 *
 * `null` y no `'NO'`, que es la distinción entera de esta función: nadie ha
 * dicho todavía si el piso tiene certificado, y eso tiene que llegar a la
 * bonificación como «no se puede comprobar». Convertirlo en un «no lo tiene»
 * haría perder puntos por un campo que el usuario no ha rellenado.
 *
 * Un fallo de lectura devuelve `null` por lo mismo: de no poder mirar no sale
 * un veredicto.
 */
export async function letraEnergeticaDe(
  inmuebleId: string | undefined
): Promise<LetraEnergetica | null> {
  if (!inmuebleId) return null;
  try {
    const db = await initDB();
    const inmuebles = await db.getAll('properties');
    const suyo = inmuebles.find((i) => String(i.id) === String(inmuebleId));
    return suyo?.certificadoEnergetico ?? null;
  } catch {
    return null;
  }
}

/**
 * La escala del certificado, de mejor a peor · **es la oficial**.
 *
 * No es una equivalencia inventada: A→G es el orden que publica el propio
 * certificado, y «letra mínima C» significa A, B o C. Lo que sí sería
 * inventarse algo es traducirlas a números para compararlas con un umbral
 * numérico, y eso no se hace en ninguna parte.
 */
const ESCALA = 'ABCDEFG';

/**
 * Si la letra que tiene alcanza la que pide el anexo.
 *
 * `null` cuando alguna de las dos no es una letra de la escala: un anexo que
 * pida «B+» o un dato guardado a mano que diga cualquier cosa no se resuelven
 * adivinando, se dicen como que no se pueden comprobar.
 */
export function letraAlcanza(tiene: string, pedida: string): boolean | null {
  const a = ESCALA.indexOf(tiene.trim().toUpperCase());
  const b = ESCALA.indexOf(pedida.trim().toUpperCase());
  if (a < 0 || b < 0) return null;
  // Menor índice = mejor letra · una A cumple una condición de «al menos C».
  return a <= b;
}
