// Orden de las tarjetas de cuenta (Tesorería V6 · §4.2).
//
// El usuario reordena arrastrando y el orden se persiste. Vive en `keyval` y no
// en un campo de `Account` porque es preferencia de PRESENTACIÓN, no dato de
// dominio: no cambia nada de la cuenta y no lo lee ningún servicio. Es el mismo
// destino que ya usan `keyval['matchingConfig']` y `keyval['kpiConfig_*']`
// (db.ts:101,108), así que no hace falta bump.

import { initDB } from '../../../services/db';

const CLAVE = 'tesoreria.v6.ordenCuentas';

/** Ids de cuenta en el orden elegido. Vacío = nunca se ha reordenado. */
export async function leerOrdenCuentas(): Promise<number[]> {
  try {
    const db = await initDB();
    const guardado = (await db.get('keyval', CLAVE)) as unknown;
    return Array.isArray(guardado) ? guardado.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    // Una preferencia de UI ilegible no debe tumbar la pantalla.
    return [];
  }
}

export async function guardarOrdenCuentas(ids: number[]): Promise<void> {
  const db = await initDB();
  await db.put('keyval', ids, CLAVE);
}

// ── Orden manual de las TARJETAS (rediseño · 18 ago 2026) ───────────────────
//
// El mismo gesto que las cuentas: arrastrar. Misma naturaleza (preferencia de
// presentación) y mismo destino (keyval).

const CLAVE_TARJETAS = 'tesoreria.v6.ordenTarjetas';

export async function leerOrdenTarjetas(): Promise<number[]> {
  try {
    const db = await initDB();
    const guardado = (await db.get('keyval', CLAVE_TARJETAS)) as unknown;
    return Array.isArray(guardado) ? guardado.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
}

export async function guardarOrdenTarjetas(ids: number[]): Promise<void> {
  const db = await initDB();
  await db.put('keyval', ids, CLAVE_TARJETAS);
}

// ── Orden por columna del ledger (rediseño §4.2) ────────────────────────────
//
// Cada cual ordena sus cuentas como trabaja: por saldo, por lo que queda al
// mes, por estado… o a mano, arrastrando. La elección es preferencia de
// presentación, como el orden manual, así que vive en el mismo sitio.

const CLAVE_LEDGER = 'tesoreria.v6.ordenLedger';

export type CampoLedger = 'nombre' | 'saldo' | 'entra' | 'sale' | 'cierre' | 'estado';

export interface OrdenLedger {
  campo: CampoLedger;
  dir: 'asc' | 'desc';
}

const CAMPOS: CampoLedger[] = ['nombre', 'saldo', 'entra', 'sale', 'cierre', 'estado'];

/** El orden por columna elegido · `null` = orden manual (el de arrastrar). */
export async function leerOrdenLedger(): Promise<OrdenLedger | null> {
  try {
    const db = await initDB();
    const guardado = (await db.get('keyval', CLAVE_LEDGER)) as OrdenLedger | undefined;
    if (
      guardado &&
      CAMPOS.includes(guardado.campo) &&
      (guardado.dir === 'asc' || guardado.dir === 'desc')
    ) {
      return guardado;
    }
    return null;
  } catch {
    return null;
  }
}

export async function guardarOrdenLedger(orden: OrdenLedger | null): Promise<void> {
  try {
    const db = await initDB();
    if (orden == null) await db.delete('keyval', CLAVE_LEDGER);
    else await db.put('keyval', orden, CLAVE_LEDGER);
  } catch (err) {
    // Preferencia de UI · perderla no puede romper la interacción.
    console.warn('[ordenCuentas] no se pudo guardar el orden del ledger', err);
  }
}

/**
 * Aplica el orden guardado.
 *
 * Tolerante a propósito: las cuentas que no estén en el orden (altas nuevas)
 * van al final en su orden natural, y los ids del orden que ya no existen
 * (cuentas borradas) se ignoran. Así una lista desfasada nunca esconde una
 * cuenta ni deja huecos.
 */
export function aplicarOrden<T extends { id?: number }>(cuentas: T[], orden: number[]): T[] {
  if (orden.length === 0) return cuentas;
  const posicion = new Map(orden.map((id, i) => [id, i]));
  const conOrden: T[] = [];
  const sinOrden: T[] = [];
  for (const c of cuentas) {
    if (c.id != null && posicion.has(c.id)) conOrden.push(c);
    else sinOrden.push(c);
  }
  conOrden.sort((a, b) => posicion.get(a.id!)! - posicion.get(b.id!)!);
  return [...conOrden, ...sinOrden];
}
