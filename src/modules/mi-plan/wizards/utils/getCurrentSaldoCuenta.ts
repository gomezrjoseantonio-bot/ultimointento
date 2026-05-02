// T27.3 · wrapper sobre `accountBalanceService.calculateAccountBalanceAtDate`
// para obtener el saldo "actual" (cutoff = mañana) de una cuenta.
//
// JOSÉ § Etapa A B3 · NO usar `currentBalance` cacheado del Account ni
// `openingBalance` (puede estar obsoleto · es la causa de bugs en el panel
// de Financiación). El servicio existente `fondosService.getSaldoCuenta`
// usa `openingBalance` · está mal · documentado en "Hallazgos laterales"
// del PR · no se arregla aquí.

import { initDB } from '../../../../services/db';
import type { Account, Movement, TreasuryEvent } from '../../../../services/db';
import { calculateAccountBalanceAtDate } from '../../../../services/accountBalanceService';

/**
 * Calcula el saldo actual de TODAS las cuentas activas vía
 * `accountBalanceService` con cutoff = mañana (incluye eventos confirmados
 * de hoy). Devuelve un Map<cuentaId, saldo>.
 *
 * Pensado para llamarse UNA vez al abrir el wizard · no por-cuenta. Reduce
 * los reads de DB de O(N) a O(1) (cargamos todos los eventos+movimientos).
 */
export async function loadSaldosActualesCuentas(): Promise<{
  cuentas: Account[];
  saldos: Map<number, number>;
}> {
  const db = await initDB();
  const [accounts, treasuryEvents, movements] = await Promise.all([
    db.getAll('accounts') as Promise<Account[]>,
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
  for (const acc of accounts) {
    // Patrón canon del repo · acepta tanto el campo nuevo `status: 'ACTIVE'`
    // como el legacy `activa: true` · solo descarta DELETED. Compatible con
    // registros previos a la introducción del enum AccountStatus.
    // (Ver `cuentasService.list` y `accountBalanceService` para el patrón.)
    if (acc.status === 'DELETED') continue;
    const isActive = acc.status === 'ACTIVE' || acc.activa !== false;
    if (!isActive) continue;
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
