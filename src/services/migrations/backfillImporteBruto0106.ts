// Migración one-shot: rellena `importeBruto` (C_GRCEA, coste real antes del tope)
// en gastosInmueble de origen xml_aeat y casilla 0106. Los datos escritos antes
// del fix no tenían importeBruto, de modo que el presupuesto mostraba el importe
// aplicado tras el tope (C_INTGRCEA) en lugar del gasto real.
//
// Además marca explícitamente con importeBruto=0 las filas que solo representan
// aplicación de arrastre (reparacionConservacion=0 pero gastosAplicados>0); el
// presupuesto las oculta para no confundirlas con gastos nuevos del ejercicio.

import { initDB, Property } from '../db';

const MIGRATION_KEY = 'migration_backfill_importeBruto_0106_v1';

function normalizeRef(ref: string): string {
  return (ref ?? '').replace(/\s+/g, '').toUpperCase();
}

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Best-effort
  }
}

export async function backfillImporteBruto0106(): Promise<{ actualizados: number }> {
  const db = await initDB();

  const [ejercicios, properties, candidatos] = await Promise.all([
    db.getAll('ejerciciosFiscalesCoord'),
    db.getAll('properties'),
    db.getAllFromIndex('gastosInmueble', 'casillaAEAT', '0106'),
  ]);

  // Index properties by refCatastral for O(1) lookup
  const propByRef = new Map<string, Property>();
  for (const p of properties) {
    const rc = normalizeRef(p.cadastralReference || '');
    if (rc) propByRef.set(rc, p);
  }

  // Build a lookup: inmuebleId+ejercicio -> reparacionConservacion
  const bruto = new Map<string, number>();
  for (const ej of ejercicios) {
    const inmuebles = (ej as any)?.aeat?.declaracionCompleta?.inmuebles ?? [];
    const año = (ej as any)?.año;
    if (!año) continue;
    for (const inm of inmuebles) {
      const rc = normalizeRef(inm?.refCatastral || '');
      const prop = propByRef.get(rc);
      if (!prop?.id) continue;
      const importeBruto = Number(inm?.gastos?.reparacionConservacion ?? 0) || 0;
      bruto.set(`${prop.id}-${año}`, importeBruto);
    }
  }

  let actualizados = 0;
  const tx = db.transaction('gastosInmueble', 'readwrite');
  for (const g of candidatos) {
    if (g.origen !== 'xml_aeat' || g.id == null) continue;
    const key = `${g.inmuebleId}-${g.ejercicio}`;
    const importeBruto = bruto.get(key);
    if (importeBruto === undefined) continue;
    if (g.importeBruto === importeBruto) continue;
    await tx.store.put({
      ...g,
      importeBruto,
      updatedAt: new Date().toISOString(),
    });
    actualizados++;
  }
  await tx.done;

  if (actualizados > 0) {
    console.info(`[Migración] backfillImporteBruto0106: ${actualizados} gastos actualizados`);
  }
  return { actualizados };
}

export async function runMigrationIfNeeded(): Promise<void> {
  try {
    if (safeGetItem(MIGRATION_KEY)) return;
    await backfillImporteBruto0106();
    safeSetItem(MIGRATION_KEY, 'done');
  } catch (e) {
    console.error('[Migración] backfillImporteBruto0106 falló:', e);
  }
}
