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
// Fuente de verdad: `ejerciciosFiscalesCoord[añoCorte].arrastresIn.
// perdidasPatrimoniales` (lo que llegó al año desde la cascada de
// `guardarEjercicioFiscal`). Fallback a `[añoCorte-1].arrastresOut.
// perdidasPatrimoniales` cuando el coord del año-corte no tenía la
// cascada propagada al importar.
//
// Filtra `tipo === 'ahorro_general'` (lo que el distribuidor mapea desde
// las pérdidas del ahorro del XML AEAT), aplica caducidad de 4 años
// desde el año de origen y devuelve la lista ordenada FIFO por año de
// origen (las más antiguas primero) para que el consumidor las aplique
// en ese orden y maximice el aprovechamiento antes de la caducidad.
//
// Consumidores: F4 venta (`ventaCalculoService` step 4 compensación),
// nota informativa del F4 (`FiscalVentaPage`).

const CADUCIDAD_PERDIDAS_AHORRO_AÑOS = 4;

export interface PerdidaPatrimonialViva {
  origen: number;
  importePendiente: number;
  ejercicioCaducidad: number;
}

interface ArrastrePerdidaCoord {
  tipo: 'ahorro_general' | 'ahorro_renta_variable' | 'patrimonial';
  importePendiente: number;
  añoOrigen: number;
}

function normalizarPerdidasCoord(
  entradas: ArrastrePerdidaCoord[] | undefined,
  añoCorte: number,
): PerdidaPatrimonialViva[] {
  if (!entradas || entradas.length === 0) return [];
  return entradas
    .filter((p) => p.tipo === 'ahorro_general')
    .filter((p) => p.importePendiente > 0)
    .map((p) => ({
      origen: p.añoOrigen,
      importePendiente: round2(p.importePendiente),
      ejercicioCaducidad: p.añoOrigen + CADUCIDAD_PERDIDAS_AHORRO_AÑOS,
    }))
    .filter((p) => p.ejercicioCaducidad >= añoCorte)
    .sort((a, b) => a.origen - b.origen);
}

async function leerPerdidasDesdeCoord(añoCorte: number): Promise<PerdidaPatrimonialViva[] | null> {
  const db = await initDB();
  try {
    const ejAño = (await db.get('ejerciciosFiscalesCoord', añoCorte)) as
      | { arrastresIn?: { perdidasPatrimoniales?: ArrastrePerdidaCoord[] } }
      | undefined;
    const desdeIn = normalizarPerdidasCoord(ejAño?.arrastresIn?.perdidasPatrimoniales, añoCorte);
    if (desdeIn.length > 0) return desdeIn;

    // Cascada perdida · cae al `arrastresOut` del año anterior.
    const ejAnterior = (await db.get('ejerciciosFiscalesCoord', añoCorte - 1)) as
      | { arrastresOut?: { perdidasPatrimoniales?: ArrastrePerdidaCoord[] } }
      | undefined;
    const desdeOutPrevio = normalizarPerdidasCoord(
      ejAnterior?.arrastresOut?.perdidasPatrimoniales,
      añoCorte,
    );
    if (desdeOutPrevio.length > 0) return desdeOutPrevio;

    // Ambos sitios vacíos en el coord · devolvemos null para que el caller
    // pueda decidir si caer al store legacy (datos migrados antiguos).
    return null;
  } catch {
    return null;
  }
}

async function leerPerdidasDesdeStoreLegacy(añoCorte: number): Promise<PerdidaPatrimonialViva[]> {
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
        importePendiente: round2(p.importePendiente),
        ejercicioCaducidad: p.ejercicioCaducidad,
      }))
      .sort((a, b) => a.origen - b.origen);
  } catch {
    return [];
  }
}

export async function getPerdidasPatrimonialesVivas(añoCorte: number): Promise<PerdidaPatrimonialViva[]> {
  const desdeCoord = await leerPerdidasDesdeCoord(añoCorte);
  if (desdeCoord !== null) return desdeCoord;
  return leerPerdidasDesdeStoreLegacy(añoCorte);
}
