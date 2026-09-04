// ============================================================================
// E1.5-previo · las fichas que apuntan a los movimientos de un lote
// ============================================================================
//
// A mitad de sesión el usuario puede clasificar una línea desde la ficha, y
// eso escribe una fila en `gastosInmueble` (`gastoDesdeMovimiento`) o en
// `mejorasInmueble` (`mejoraDesdeMovimiento`) con `movimientoId` = el
// movimiento del import. Si después sale SIN guardar, `cancelImportBatch`
// borraba el movimiento y dejaba la fila fiscal apuntando al vacío: basura
// silenciosa que ni se ve ni se puede cruzar (E1-preflight §1.4 · E1.5-preflight
// §4.4).
//
// Aquí se limpian esas fichas junto con el lote:
//   · lo que NACIÓ en la sesión (`gastosInmueble` con `origen: 'tesoreria'`, y
//     toda `mejorasInmueble`) se BORRA · sin el movimiento no significa nada;
//   · una fila de gasto que ya existía y la sesión solo CERRÓ (la del
//     recurrente, `origen: 'recurrente'`, que `gastoDesdeMovimiento` encuentra
//     por `origenIdRecurrente`) NO se borra: es la declaración del gasto. Se
//     le quita el enlace y vuelve a `previsto`, que es lo que era.
// ============================================================================

import type { GastoInmueble, MejoraInmueble } from './db/types-inmuebles';

/** Lo mínimo de la base que hace falta · el handle real y los mocks lo cumplen. */
export interface DbParaFichas {
  getAll(store: string): Promise<unknown[]>;
  put(store: string, row: unknown): Promise<unknown>;
  delete(store: string, key: number): Promise<void>;
}

export interface FichasLimpiadas {
  gastosBorrados: number;
  gastosDesenlazados: number;
  mejorasBorradas: number;
}

/**
 * Limpia las fichas de gasto y mejora que apuntan a estos movimientos.
 * `movimientoId` es `string` en las dos tablas (y número en filas viejas), así
 * que se compara por `Number`.
 */
export async function limpiarFichasDeMovimientos(
  db: DbParaFichas,
  movementIds: number[],
  ahora: string = new Date().toISOString()
): Promise<FichasLimpiadas> {
  const out: FichasLimpiadas = { gastosBorrados: 0, gastosDesenlazados: 0, mejorasBorradas: 0 };
  if (movementIds.length === 0) return out;
  const ids = new Set(movementIds);
  const apuntaAlLote = (f: { movimientoId?: string | number }): boolean =>
    f.movimientoId != null && f.movimientoId !== '' && ids.has(Number(f.movimientoId));

  // Copia · se borra mientras se recorre, y un handle que devuelva la lista
  // viva (mocks) se saltaría el siguiente elemento tras cada borrado.
  const gastos = [...(((await db.getAll('gastosInmueble')) ?? []) as GastoInmueble[])];
  for (const g of gastos) {
    if (g.id == null || !apuntaAlLote(g)) continue;
    if (g.origen === 'tesoreria') {
      await db.delete('gastosInmueble', g.id);
      out.gastosBorrados += 1;
      continue;
    }
    const { movimientoId, fechaValor, cuentaBancaria, ...resto } = g;
    void movimientoId;
    void fechaValor;
    void cuentaBancaria;
    await db.put('gastosInmueble', {
      ...resto,
      estado: 'previsto',
      estadoTesoreria: 'predicted',
      updatedAt: ahora,
    } as GastoInmueble);
    out.gastosDesenlazados += 1;
  }

  const mejoras = [...(((await db.getAll('mejorasInmueble')) ?? []) as MejoraInmueble[])];
  for (const m of mejoras) {
    if (m.id == null || !apuntaAlLote(m)) continue;
    await db.delete('mejorasInmueble', m.id);
    out.mejorasBorradas += 1;
  }

  return out;
}
