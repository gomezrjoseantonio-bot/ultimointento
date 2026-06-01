// V78.1 · pulido flujo matching · helper de presentación de Contracts.
//
// Resuelve el nombre legible de un Contract a partir de su id, con una cadena de
// fallbacks estable. Lo consumen tanto el drawer de conciliación ("Contratos
// vinculados", B2) como la sección "Histórico fiscal declarado" del detalle del
// inmueble, que solo guardan `contractId` y no el objeto Contract completo.

import { initDB } from '../services/db';
import type { Contract } from '../services/db';

/** Subconjunto de Contract necesario para derivar el nombre mostrado. */
type ContractNameSource = Pick<Contract, 'inquilino'> | undefined | null;

/**
 * Nombre mostrado de un Contract (función pura · sin acceso a BD).
 * Fallbacks: `nombre + apellidos` → `DNI <dni>` → `Contrato #<id>`.
 */
export function contractDisplayName(contract: ContractNameSource, contractId: number): string {
  if (!contract) return `Contrato #${contractId}`;
  const inquilino = contract.inquilino;
  const nombre = `${inquilino?.nombre ?? ''} ${inquilino?.apellidos ?? ''}`.trim();
  if (nombre) return nombre;
  const dni = inquilino?.dni?.trim();
  if (dni) return `DNI ${dni}`;
  return `Contrato #${contractId}`;
}

/** Resuelve el nombre mostrado de un Contract por id (lookup en BD). */
export async function resolveContractName(contractId: number): Promise<string> {
  const db = await initDB();
  const c = (await db.get('contracts', contractId)) as Contract | undefined;
  return contractDisplayName(c, contractId);
}

/**
 * Carga en bloque los Contracts indicados en un mapa `id → Contract`.
 * Los ids inexistentes se omiten del mapa (los consumidores usan el fallback).
 */
export async function getContractsMap(ids: number[]): Promise<Map<number, Contract>> {
  const db = await initDB();
  const out = new Map<number, Contract>();
  await Promise.all(
    Array.from(new Set(ids)).map(async (id) => {
      const c = (await db.get('contracts', id)) as Contract | undefined;
      if (c) out.set(id, c);
    }),
  );
  return out;
}
