/**
 * arrastresVivosService.ts · helper para tab Arrastres del F1 dashboard.
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 2 §4.3 cita
 * `carryForwardService.getArrastresVivos()` y
 * `compensacionAhorroService.getDisponibles()`. Ninguno de los dos métodos
 * existe como API pública en sub-tarea 1 (se inlinea la agregación en
 * `getResumenGlobal`). Aquí extendemos esa misma lógica devolviendo el
 * detalle por fila para la tabla del tab.
 *
 * Mantenemos la lectura directa de los stores (`aeatCarryForwards` ·
 * `perdidasPatrimonialesAhorro`) para no introducir nuevas funciones
 * públicas en services existentes que el spec congela.
 */

import { initDB } from '../../../../services/db';

export type TipoArrastreVivo = 'gasto' | 'perdida_ahorro';

export interface ArrastreVivoRow {
  id: string;
  tipo: TipoArrastreVivo;
  origen: number;
  concepto: string;
  importeOriginal: number;
  importeAplicado: number;
  importePendiente: number;
  caduca: string;
  caducaEsteAño: boolean;
}

export interface ArrastresVivosData {
  rows: ArrastreVivoRow[];
  totalPendiente: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getArrastresVivos(añoActual: number): Promise<ArrastresVivosData> {
  const db = await initDB();
  const rows: ArrastreVivoRow[] = [];

  try {
    const carryforwards = (await db.getAll('aeatCarryForwards')) as Array<{
      id?: number;
      taxYear: number;
      excessAmount: number;
      remainingAmount: number;
      expirationYear: number;
      carryForwardType?: string;
    }>;
    for (const cf of carryforwards) {
      if (cf.remainingAmount <= 0) continue;
      if (cf.expirationYear < añoActual) continue;
      const aplicado = round2((cf.excessAmount ?? 0) - (cf.remainingAmount ?? 0));
      rows.push({
        id: `gasto-${cf.id ?? cf.taxYear}`,
        tipo: 'gasto',
        origen: cf.taxYear,
        concepto: 'Exceso intereses + reparación (art. 23 LIRPF)',
        importeOriginal: round2(cf.excessAmount ?? 0),
        importeAplicado: aplicado < 0 ? 0 : aplicado,
        importePendiente: round2(cf.remainingAmount),
        caduca: `31/12/${cf.expirationYear}`,
        caducaEsteAño: cf.expirationYear === añoActual,
      });
    }
  } catch {
    /* store puede no existir en DBs antiguas */
  }

  try {
    const perdidas = (await db.getAll('perdidasPatrimonialesAhorro')) as Array<{
      id?: number;
      ejercicioOrigen: number;
      importeOriginal: number;
      importeAplicado?: number;
      importePendiente: number;
      ejercicioCaducidad: number;
      estado: string;
    }>;
    for (const p of perdidas) {
      if (p.importePendiente <= 0) continue;
      if (p.ejercicioCaducidad < añoActual) continue;
      if (p.estado === 'caducado') continue;
      rows.push({
        id: `perdida-${p.id ?? p.ejercicioOrigen}`,
        tipo: 'perdida_ahorro',
        origen: p.ejercicioOrigen,
        concepto: 'Pérdida patrimonial ahorro',
        importeOriginal: round2(p.importeOriginal),
        importeAplicado: round2(p.importeAplicado ?? 0),
        importePendiente: round2(p.importePendiente),
        caduca: `31/12/${p.ejercicioCaducidad}`,
        caducaEsteAño: p.ejercicioCaducidad === añoActual,
      });
    }
  } catch {
    /* store puede no existir */
  }

  rows.sort((a, b) => a.origen - b.origen);

  const totalPendiente = round2(
    rows.reduce((sum, r) => sum + r.importePendiente, 0),
  );

  return { rows, totalPendiente };
}

// ─── Helper compartido · perdidas patrimoniales del ahorro vivas ────────
// Centraliza la query a `perdidasPatrimonialesAhorro` que necesitan tanto
// el F1 dashboard (tab Arrastres), como el F4 venta (Step 4 compensación)
// y la nota informativa del F4. Devuelve la lista ordenada por caducidad
// (FIFO · más antiguos primero) para que el consumidor pueda iterar y
// aplicar el saldo.

export interface PerdidaPatrimonialViva {
  origen: number;
  importePendiente: number;
  ejercicioCaducidad: number;
}

export async function getPerdidasPatrimonialesVivas(añoCorte: number): Promise<PerdidaPatrimonialViva[]> {
  const db = await initDB();
  try {
    const todas = (await db.getAll('perdidasPatrimonialesAhorro')) as Array<{
      ejercicioOrigen: number;
      ejercicioCaducidad: number;
      importePendiente: number;
      estado: string;
    }>;
    return todas
      .filter((p) =>
        p.importePendiente > 0
        && p.ejercicioCaducidad >= añoCorte
        && p.estado !== 'caducado',
      )
      .map((p) => ({
        origen: p.ejercicioOrigen,
        importePendiente: p.importePendiente,
        ejercicioCaducidad: p.ejercicioCaducidad,
      }))
      .sort((a, b) => a.ejercicioCaducidad - b.ejercicioCaducidad);
  } catch {
    return [];
  }
}
