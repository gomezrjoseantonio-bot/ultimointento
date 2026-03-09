/**
 * carryForwardService.ts
 * AEAT art. 23.1.a LIRPF: Gestión de arrastres multianuales para gastos 0105+0106
 * que exceden los ingresos íntegros del inmueble.
 */

import { initDB, AEATCarryForward } from './db';

/**
 * Obtiene los arrastres disponibles (no caducados, no consumidos totalmente)
 * para un inmueble. Solo incluye arrastres de ejercicios ANTERIORES cuyo
 * expirationYear >= ejercicio actual.
 */
export async function getCarryForwardsDisponibles(
  propertyId: number,
  ejercicio: number
): Promise<{ total: number; detalle: AEATCarryForward[] }> {
  const db = await initDB();
  const all: AEATCarryForward[] = await db.getAllFromIndex(
    'aeatCarryForwards',
    'propertyId',
    propertyId
  );

  // Only carryforwards from previous years that haven't expired and have remaining amount
  const disponibles = all
    .filter(
      (cf) =>
        cf.taxYear < ejercicio &&
        cf.expirationYear >= ejercicio &&
        cf.remainingAmount > 0
    )
    .sort((a, b) => a.taxYear - b.taxYear); // FIFO: oldest first

  const total = disponibles.reduce((sum, cf) => sum + cf.remainingAmount, 0);
  return { total, detalle: disponibles };
}

/**
 * Registra un nuevo arrastre cuando hay exceso de 0105+0106 sobre ingresos.
 * Si ya existe un registro para ese propertyId/taxYear lo actualiza.
 */
export async function registrarArrastre(
  propertyId: number,
  ejercicio: number,
  totalIncome: number,
  financingAndRepair: number,
  excessAmount: number
): Promise<void> {
  const db = await initDB();

  // Check if a record already exists for this property + year
  const existing: AEATCarryForward[] = await db.getAllFromIndex(
    'aeatCarryForwards',
    'propertyId',
    propertyId
  );
  const prev = existing.find((cf) => cf.taxYear === ejercicio);

  const now = new Date().toISOString();
  const limitApplied = Math.min(financingAndRepair, totalIncome);

  if (prev) {
    await db.put('aeatCarryForwards', {
      ...prev,
      totalIncome,
      financingAndRepair,
      limitApplied,
      excessAmount,
      expirationYear: ejercicio + 4,
      remainingAmount: excessAmount,
      updatedAt: now,
    });
  } else {
    await db.add('aeatCarryForwards', {
      propertyId,
      taxYear: ejercicio,
      totalIncome,
      financingAndRepair,
      limitApplied,
      excessAmount,
      expirationYear: ejercicio + 4,
      remainingAmount: excessAmount,
      createdAt: now,
      updatedAt: now,
    } as AEATCarryForward);
  }
}

/**
 * Consume arrastres anteriores que se han podido aplicar este ejercicio.
 * Aplica FIFO: primero los más antiguos (que caducan antes).
 * @param arrastresDisponibles detalle de carryforwards disponibles (ya ordenados por FIFO)
 * @param importeAplicado importe total de arrastres anteriores que se pudo deducir
 */
export async function consumirArrastresAplicados(
  arrastresDisponibles: AEATCarryForward[],
  importeAplicado: number
): Promise<void> {
  if (importeAplicado <= 0) return;
  const db = await initDB();

  let restante = importeAplicado;
  const now = new Date().toISOString();

  for (const cf of arrastresDisponibles) {
    if (restante <= 0) break;
    const aplicado = Math.min(cf.remainingAmount, restante);
    restante -= aplicado;
    await db.put('aeatCarryForwards', {
      ...cf,
      remainingAmount: cf.remainingAmount - aplicado,
      updatedAt: now,
    });
  }
}
