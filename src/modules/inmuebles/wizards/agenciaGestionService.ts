// Gestión delegada · alta/upsert de la AGENCIA como `Proveedor` (store existente
// `proveedores`, clave `nif`, `tipos` incluye 'gestion'). Reutilizable entre
// pisos: la agencia se da de alta una vez y se referencia por su NIF desde el
// bloque `gestion` de cada contrato de gestión.

import { initDB } from '../../../services/db';
import type { Proveedor } from '../../../services/db';

/**
 * Crea o actualiza la agencia en `proveedores`. No pisa el nombre existente por
 * uno vacío, y garantiza el tipo 'gestion'. Devuelve el NIF (clave).
 */
export async function guardarAgencia(nif: string, nombre: string): Promise<string> {
  const clave = nif.trim();
  const nombreLimpio = nombre.trim();
  const db = await initDB();
  const now = new Date().toISOString();

  const existente = (await db.get('proveedores', clave)) as Proveedor | undefined;
  const tipos = new Set(existente?.tipos ?? []);
  tipos.add('gestion');

  const proveedor: Proveedor = {
    nif: clave,
    nombre: nombreLimpio || existente?.nombre,
    tipos: Array.from(tipos),
    sinNombre: nombreLimpio ? false : existente?.sinNombre,
    createdAt: existente?.createdAt ?? now,
    updatedAt: now,
  };

  await db.put('proveedores', proveedor);
  return clave;
}
