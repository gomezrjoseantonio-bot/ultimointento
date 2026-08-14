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

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Recomputa `remainingAmount` de TODOS los arrastres de un inmueble de forma
 * DETERMINISTA (idempotente): parte del exceso generado en cada año origen y
 * consume, año a año en orden, el importe aplicado (`appliedInYear`) contra los
 * orígenes anteriores por FIFO (más antiguo primero), respetando la caducidad.
 *
 * Al ser un "reset + replay" desde los datos declarados, reimportar un año o
 * cambiar el orden de importación deja SIEMPRE el mismo estado.
 */
export async function recomputarRemainingArrastres(propertyId: number): Promise<void> {
  const db = await initDB();
  const rows: AEATCarryForward[] = await db.getAllFromIndex('aeatCarryForwards', 'propertyId', propertyId);
  if (rows.length === 0) return;

  const byYear = rows.slice().sort((a, b) => a.taxYear - b.taxYear);
  // 1. Reset: cada origen vuelve a su exceso íntegro.
  for (const r of byYear) r.remainingAmount = r.excessAmount;
  // 2. Replay FIFO: el aplicado de cada año consume orígenes anteriores no caducados.
  for (const dest of byYear) {
    let aplicar = round2(dest.appliedInYear ?? 0);
    if (aplicar <= 0) continue;
    for (const src of byYear) {
      if (aplicar <= 0) break;
      if (src.taxYear >= dest.taxYear) break; // solo orígenes anteriores (ordenado asc)
      if (src.expirationYear < dest.taxYear) continue; // caducado para el año que aplica
      if (src.remainingAmount <= 0) continue;
      const toma = Math.min(src.remainingAmount, aplicar);
      src.remainingAmount = round2(src.remainingAmount - toma);
      aplicar = round2(aplicar - toma);
    }
  }

  const now = new Date().toISOString();
  for (const r of byYear) await db.put('aeatCarryForwards', { ...r, updatedAt: now });
}

/**
 * Sincroniza en `aeatCarryForwards` lo que una declaración importada dice de un
 * inmueble para un ejercicio: el pendiente NUEVO generado (`generated` =
 * C_INTGRCEF, casilla 0108) como alta del origen, y el pendiente previo APLICADO
 * (`applied` = IMP4GCPEA, casilla 0103) para el replay FIFO. Idempotente.
 */
export async function sincronizarArrastreImportado(
  propertyId: number,
  taxYear: number,
  d: { generated: number; applied: number; totalIncome?: number; financingAndRepair?: number },
): Promise<void> {
  const generated = Math.max(0, round2(d.generated || 0));
  const applied = Math.max(0, round2(d.applied || 0));

  const db = await initDB();
  const rows: AEATCarryForward[] = await db.getAllFromIndex('aeatCarryForwards', 'propertyId', propertyId);
  const prev = rows.find((cf) => cf.taxYear === taxYear);
  const now = new Date().toISOString();

  if (generated > 0 || applied > 0) {
    const base = {
      propertyId,
      taxYear,
      totalIncome: d.totalIncome ?? prev?.totalIncome ?? 0,
      financingAndRepair: d.financingAndRepair ?? prev?.financingAndRepair ?? 0,
      limitApplied: prev?.limitApplied ?? 0,
      excessAmount: generated,
      appliedInYear: applied,
      expirationYear: taxYear + 4,
      remainingAmount: generated, // se recalcula abajo
    };
    if (prev?.id != null) {
      await db.put('aeatCarryForwards', { ...prev, ...base, updatedAt: now });
    } else {
      await db.add('aeatCarryForwards', { ...base, createdAt: now, updatedAt: now } as AEATCarryForward);
    }
  }

  await recomputarRemainingArrastres(propertyId);
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
