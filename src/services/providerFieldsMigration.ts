// src/services/providerFieldsMigration.ts
//
// PR5-HOTFIX v3 · Migración silenciosa en lectura de `counterparty`
// (campo legado) a `providerName` (nuevo campo estructurado).
//
// Contexto: en el hotfix v3 se introducen 3 campos estructurados
// (`providerName`, `providerNif`, `invoiceNumber`) en los registros de
// TreasuryEvent y Movement. Los registros existentes guardaban el nombre del
// proveedor en `counterparty`. Para no romperlos, los lectores aplican este
// helper: si viene `counterparty` pero no `providerName`, se copia al leer.
//
// El campo `counterparty` NO se elimina aún (retrocompatibilidad con servicios
// de import, learning rules, etc.). Se retirará en un PR posterior cuando
// exista un script de limpieza que normalice todos los registros.

export interface CounterpartyBearingRecord {
  counterparty?: string;
  providerName?: string;
}

/**
 * Completa `providerName` con el valor de `counterparty` cuando el primero
 * no existe. Devuelve un registro nuevo (no muta el original).
 */
export function migrateCounterparty<T extends CounterpartyBearingRecord>(record: T): T {
  if (!record) return record;
  if (record.counterparty && !record.providerName) {
    return { ...record, providerName: record.counterparty };
  }
  return record;
}

/**
 * Aplica `migrateCounterparty` a una lista completa (util para `db.getAll`).
 */
export function migrateCounterpartyAll<T extends CounterpartyBearingRecord>(
  records: readonly T[],
): T[] {
  return records.map((r) => migrateCounterparty(r));
}
