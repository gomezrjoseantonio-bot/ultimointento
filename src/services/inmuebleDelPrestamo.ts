// ============================================================================
// De qué inmueble es un préstamo
// ============================================================================
//
// El dato vive en `destinos[].inmuebleId`. El campo raíz `Prestamo.inmuebleId`
// está marcado `@deprecated · Usar destinos[].inmuebleId` y en los préstamos
// creados con la ficha actual viene vacío: el piso se elige en "DESTINO DEL
// CAPITAL", no en un campo suelto.
//
// Esto ya estaba resuelto en `treasuryForecastService` —mira `destinos` primero
// y cae al campo raíz—, pero escrito allí dentro. Al copiarlo al generador que
// de verdad se usa miré solo el campo raíz, y la cuota de una hipoteca con su
// piso perfectamente puesto seguía sin decir de cuál era. Es el mismo criterio
// para todos, así que vive en un sitio.
//
// `'standalone'` es el centinela heredado de "sin inmueble", y un
// `Number('standalone')` sería NaN: se descarta antes de convertir.
//
// `idDeInmueble` se exporta porque el mismo criterio hace falta allí donde se
// copia el inmueble de un CONTRATO. Escribirlo dos veces es exactamente cómo
// nació este fallo.
// ============================================================================

/** Lo mínimo que hace falta mirar · sirve igual al préstamo de cualquier módulo. */
export interface PrestamoConDestinos {
  inmuebleId?: string | number | null;
  destinos?: Array<{ inmuebleId?: string | number | null }> | null;
}

const CENTINELA_SIN_INMUEBLE = 'standalone';

/**
 * A id de inmueble, o `undefined` si no lo es.
 *
 * Entero POSITIVO, no cualquier número finito: `properties` es un store
 * `autoIncrement`, así que sus ids empiezan en 1 — y hay flujos que escriben
 * `inmuebleId: 0` como marcador de "aún sin vincular"
 * (`ejercicioResolverService`, `declaracionDistributorService`). Colándose ese
 * 0, el evento acabaría apuntando a un inmueble que no existe y las rentas se
 * agruparían bajo una madre fantasma.
 */
export function idDeInmueble(valor: string | number | null | undefined): number | undefined {
  if (valor == null || valor === '' || valor === CENTINELA_SIN_INMUEBLE) return undefined;
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/**
 * El inmueble que sustenta el préstamo · `undefined` si no hay ninguno.
 *
 * Manda el primer destino que apunte a un inmueble; el campo raíz solo como
 * respaldo para los préstamos antiguos que aún lo traen.
 */
export function inmuebleDelPrestamo(prestamo: PrestamoConDestinos): number | undefined {
  for (const d of prestamo.destinos ?? []) {
    const id = idDeInmueble(d?.inmuebleId);
    if (id != null) return id;
  }
  return idDeInmueble(prestamo.inmuebleId);
}
