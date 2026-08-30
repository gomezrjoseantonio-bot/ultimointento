// El punto de entrada · lee los libros del usuario y devuelve lo que reconoce.
//
// Cinco fuentes, una pasada por store. Se lee todo de golpe y se cruza en
// memoria en vez de consultar por línea: un extracto trae ciento y pico
// movimientos y cinco `getAll` cuestan mucho menos que quinientas consultas.
//
// Ninguna fuente escribe nada aquí. Reconocer es una lectura; lo que se guarda
// se guarda al pulsar Guardar, y lo hace `confirmDecisions`.

import { initDB } from '../db';
import type { Movement } from '../db';
import type { Property, PropertySale } from '../db/types';
import type { Prestamo } from '../../types/prestamos';
import type { OrigenDeterminista, AtribucionDeterminista } from './tipos';
import { cuotasQueCuadran } from './cuotasDePrestamo';
import { ventasQueCuadran } from './ventasDeInmueble';
import { rendimientosQueCuadran } from './rendimientosDeInversion';
import { nominasQueSeReconocen } from './nominas';
import { atribucionesDeclaradas } from './gastoDeclaradoPorInmueble';

export interface LoQueSeReconoce {
  /** movementId → el origen que lo explica. Estas líneas se cierran solas. */
  origenes: Map<number, OrigenDeterminista>;
  /** movementId → el piso que probablemente lo paga. NO cierra la línea. */
  atribuciones: Map<number, AtribucionDeterminista>;
}

export function nadaReconocido(): LoQueSeReconoce {
  return { origenes: new Map(), atribuciones: new Map() };
}

/**
 * Qué reconoce ATLAS de este lote, mirando lo que el usuario ya le había dicho.
 *
 * Si una lectura falla, esa fuente aporta cero y las demás siguen: no poder leer
 * los préstamos no es motivo para dejar de reconocer la nómina, y desde luego no
 * lo es para tumbar la importación.
 */
export async function reconocerDeterministas(movimientos: Movement[]): Promise<LoQueSeReconoce> {
  if (movimientos.length === 0) return nadaReconocido();

  const db = await initDB();
  const leer = async <T>(store: string): Promise<T[]> => {
    try {
      return ((await db.getAll(store as never)) ?? []) as T[];
    } catch (err) {
      console.warn(`[deterministas] no se pudo leer '${store}'`, err);
      return [];
    }
  };

  const [prestamos, ventas, inversiones, ingresos, ejercicios, inmuebles] = await Promise.all([
    leer<Prestamo>('prestamos'),
    leer<PropertySale>('property_sales'),
    leer<never>('inversiones'),
    leer<never>('ingresos'),
    leer<never>('ejerciciosFiscalesCoord'),
    leer<Property>('properties'),
  ]);

  const origenes = new Map<number, OrigenDeterminista>();
  // El orden importa poco porque las fuentes no se solapan (una cuota de
  // préstamo no es una nómina), pero se fija igualmente: el primero que
  // reconoce una línea se la queda, y así el resultado no depende del azar.
  for (const o of [
    ...cuotasQueCuadran(movimientos, prestamos),
    ...ventasQueCuadran(movimientos, ventas),
    ...rendimientosQueCuadran(movimientos, inversiones),
    ...nominasQueSeReconocen(movimientos, ingresos),
  ]) {
    if (!origenes.has(o.movementId)) origenes.set(o.movementId, o);
  }

  const atribuciones = new Map<number, AtribucionDeterminista>();
  for (const a of atribucionesDeclaradas(movimientos, ejercicios, inmuebles)) {
    // Lo ya reconocido no necesita que le atribuyan nada: su origen ya sabe de
    // qué piso es, y con más certeza que una declaración del año pasado.
    if (origenes.has(a.movementId)) continue;
    atribuciones.set(a.movementId, a);
  }

  return { origenes, atribuciones };
}
