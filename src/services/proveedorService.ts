// D-CRUD-ALTA · sub-tarea 9 · Proveedores · CRUD + UI
//
// El store `proveedores` (keyPath: 'nif') es alimentado por
// declaracionDistributorService al importar declaraciones AEAT, pero hasta hoy
// no había servicio centralizado ni pantalla de gestión. Este servicio expone
// listar / actualizar / borrar (con bloqueo si hay operaciones asociadas).
//
// Cambiar el NIF de un proveedor implica recrear el registro (porque el NIF
// es la clave). Por ahora se permite editar `nombre` y `tipos`; la mutación
// de NIF se cubrirá en spec posterior si se demuestra necesaria.

import { initDB, type Proveedor } from './db';

export interface ProveedorConUso extends Proveedor {
  /** Nº de operaciones encontradas en stores cuyo campo proveedor coincide. */
  operacionesAsociadas: number;
}

const STORE = 'proveedores' as const;

const matchesNif = (campo: unknown, nif: string): boolean => {
  if (typeof campo !== 'string') return false;
  return campo.trim().toUpperCase() === nif.trim().toUpperCase();
};

const STORES_CON_PROVEEDOR: Array<{
  store: string;
  campos: string[];
}> = [
  { store: 'gastosInmueble', campos: ['proveedorNif', 'providerNif', 'counterpartyNif'] },
  { store: 'mejorasInmueble', campos: ['proveedorNif', 'providerNif', 'counterpartyNif'] },
  { store: 'mueblesInmueble', campos: ['proveedorNif', 'providerNif', 'counterpartyNif'] },
  { store: 'movements', campos: ['providerNif', 'counterpartyNif'] },
  { store: 'documents', campos: [] }, // proveedor en metadata.financialData? Skipped
  { store: 'treasuryEvents', campos: ['providerNif', 'counterpartyNif'] },
];

export const proveedorService = {
  async listar(): Promise<Proveedor[]> {
    const db = await initDB();
    return await db.getAll(STORE);
  },

  async listarConUso(): Promise<ProveedorConUso[]> {
    const db = await initDB();
    const proveedores: Proveedor[] = await db.getAll(STORE);
    const result: ProveedorConUso[] = [];
    for (const p of proveedores) {
      const usos = await proveedorService.contarOperaciones(p.nif);
      result.push({ ...p, operacionesAsociadas: usos });
    }
    return result.sort((a, b) =>
      (a.nombre || a.nif).localeCompare(b.nombre || b.nif),
    );
  },

  async contarOperaciones(nif: string): Promise<number> {
    const db = await initDB();
    let total = 0;
    for (const { store, campos } of STORES_CON_PROVEEDOR) {
      if (!db.objectStoreNames.contains(store)) continue;
      if (campos.length === 0) continue;
      const all = (await db.getAll(store as never)) as Record<string, unknown>[];
      for (const row of all) {
        for (const campo of campos) {
          if (matchesNif(row[campo], nif)) {
            total += 1;
            break;
          }
        }
      }
    }
    return total;
  },

  async obtener(nif: string): Promise<Proveedor | undefined> {
    const db = await initDB();
    return await db.get(STORE, nif);
  },

  async actualizar(
    nif: string,
    updates: Partial<Pick<Proveedor, 'nombre' | 'tipos'>>,
  ): Promise<Proveedor> {
    const db = await initDB();
    const existing = await db.get(STORE, nif);
    if (!existing) throw new Error('Proveedor no encontrado');
    const updated: Proveedor = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await db.put(STORE, updated);
    return updated;
  },

  /**
   * Borra un proveedor. Lanza error si tiene operaciones asociadas (mismo NIF
   * en gastos/mejoras/muebles/movements/treasuryEvents). El UI debe mostrar
   * el bloqueo al usuario ANTES de llamar.
   */
  async eliminar(nif: string): Promise<void> {
    const usos = await proveedorService.contarOperaciones(nif);
    if (usos > 0) {
      throw new Error(
        `Proveedor con ${usos} operación(es) asociada(s) · no se puede eliminar`,
      );
    }
    const db = await initDB();
    await db.delete(STORE, nif);
  },
};
