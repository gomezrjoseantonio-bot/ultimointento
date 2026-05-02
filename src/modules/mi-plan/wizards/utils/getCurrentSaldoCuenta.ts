// T27.3 · wrapper sobre `accountBalanceService.calculateAccountBalanceAtDate`
// para obtener el saldo "actual" (cutoff = mañana) de una cuenta.
//
// JOSÉ § Etapa A B3 · NO usar `currentBalance` cacheado del Account ni
// `openingBalance` (puede estar obsoleto · es la causa de bugs en el panel
// de Financiación). El servicio existente `fondosService.getSaldoCuenta`
// usa `openingBalance` · está mal · documentado en "Hallazgos laterales"
// del PR · no se arregla aquí.
//
// FIX postdeploy 2026-05 · usamos `cuentasService.list()` para resolver las
// cuentas activas en lugar de filtrar manualmente. `cuentasService.list`
// es el patrón canónico del repo (cubre `status === 'ACTIVE'` nuevo y
// `activa !== false` legacy + descarta `deleted_at` y `DELETED`).
// Garantiza paridad con el resto de la app.

import { initDB } from '../../../../services/db';
import type { Account, Movement, TreasuryEvent } from '../../../../services/db';
import { calculateAccountBalanceAtDate } from '../../../../services/accountBalanceService';
import { cuentasService } from '../../../../services/cuentasService';

export async function loadSaldosActualesCuentas(): Promise<{
  cuentas: Account[];
  saldos: Map<number, number>;
}> {
  const db = await initDB();
  const [cuentasActivasRaw, treasuryEvents, movements] = await Promise.all([
    cuentasService.list(),
    db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
    db.getAll('movements') as Promise<Movement[]>,
  ]);

  // Cutoff = mañana (en formato ISO YYYY-MM-DD). Garantiza incluir todo el
  // día de hoy en el cálculo · `calculateAccountBalanceAtDate` filtra por
  // `< cutoffDate` estrictamente.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const cutoffDate = tomorrow.toISOString().slice(0, 10);

  const saldos = new Map<number, number>();
  const cuentasActivas: Account[] = [];
  for (const acc of cuentasActivasRaw) {
    if (acc.id == null) continue;
    cuentasActivas.push(acc);
    const saldo = calculateAccountBalanceAtDate({
      account: acc,
      cutoffDate,
      treasuryEvents,
      movements,
    });
    saldos.set(acc.id, saldo);
  }

  return { cuentas: cuentasActivas, saldos };
}
