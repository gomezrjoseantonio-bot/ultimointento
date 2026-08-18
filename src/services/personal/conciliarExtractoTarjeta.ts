// ============================================================================
// Conciliar el extracto de la TARJETA contra sus piezas · §3
// ============================================================================
//
// Igual que en banco: primero se LEE y se EMPAREJA (sin escribir nada) para que
// puedas COTEJAR línea a línea qué casa y qué no; y solo cuando confirmas se
// APLICA. Lo que casa —piezas previstas/confirmadas y compras manuales del
// periodo— sube a CONCILIADO con el importe REAL del extracto; lo que no casa
// nace ya conciliado (el extracto manda). No mueve caja: el dinero sale en el
// recibo. Mismo modelo previsto → confirmado → conciliado, con el extracto de la
// tarjeta en vez del banco.
// ============================================================================

import { initDB } from '../db';
import type { Movement, TreasuryEvent } from '../db';
import type { LineaExtractoTarjeta } from './extractoTarjeta';

/** Algo de la tarjeta contra lo que casa una línea del extracto. */
export interface ObjetivoConciliacion {
  id: number;
  kind: 'pieza' | 'compra';
  fecha: string;
  importe: number;
  /** Cómo se llama · para poder enseñarlo al cotejar. */
  descripcion?: string;
}

const centimos = (n: number) => Math.round(Math.abs(n) * 100);
const dias = (a: string, b: string) => {
  const ta = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  const tb = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(ta) || Number.isNaN(tb) ? Infinity : Math.abs(Math.round((ta - tb) / 86_400_000));
};

/**
 * Empareja cada línea del extracto con un objetivo · por IMPORTE exacto y fecha
 * cercana. 1:1 · cada objetivo casa con una sola línea (la más cercana) para que
 * dos gastos iguales no se pisen. Devuelve `índiceDeLínea → objetivo`.
 */
export function emparejarExtractoTarjeta(
  lineas: LineaExtractoTarjeta[],
  objetivos: ObjetivoConciliacion[],
  ventanaDias = 5
): Map<number, ObjetivoConciliacion> {
  const parejas: Array<{ i: number; obj: ObjetivoConciliacion; d: number }> = [];
  lineas.forEach((l, i) => {
    for (const obj of objetivos) {
      if (centimos(obj.importe) !== centimos(l.importe)) continue;
      const d = dias(l.fecha, obj.fecha);
      if (d > ventanaDias) continue;
      parejas.push({ i, obj, d });
    }
  });
  parejas.sort((a, b) => a.d - b.d || a.i - b.i || a.obj.id - b.obj.id);

  const porLinea = new Map<number, ObjetivoConciliacion>();
  const usados = new Set<string>();
  for (const p of parejas) {
    if (porLinea.has(p.i)) continue;
    const clave = `${p.obj.kind}-${p.obj.id}`;
    if (usados.has(clave)) continue;
    porLinea.set(p.i, p.obj);
    usados.add(clave);
  }
  return porLinea;
}

export interface ResultadoConciliacionTarjeta {
  conciliadas: number;
  nuevas: number;
}

/** Una línea del extracto ya emparejada · lo que se enseña para cotejar. */
export interface LineaConciliada {
  linea: LineaExtractoTarjeta;
  /** `casa` = casa con algo que ya tenías · `nueva` = gasto que no estaba. */
  estado: 'casa' | 'nueva';
  objetivo?: ObjetivoConciliacion;
}

/** El plan de conciliación · lo que PASARÁ cuando confirmes, sin escribir aún. */
export interface PlanConciliacionTarjeta {
  lineas: LineaConciliada[];
  conciliadas: number;
  nuevas: number;
}

/** Lee la tarjeta y construye sus objetivos (piezas + compras del periodo). */
async function objetivosDeTarjeta(tarjetaId: number): Promise<{
  objetivos: ObjetivoConciliacion[];
  piezaPorId: Map<number, TreasuryEvent>;
  compraPorId: Map<number, Movement>;
}> {
  const db = await initDB();
  const [eventos, movimientos] = await Promise.all([
    db.getAllFromIndex('treasuryEvents', 'sourceType', 'gasto_tarjeta') as Promise<TreasuryEvent[]>,
    db.getAll('movements') as Promise<Movement[]>,
  ]);
  const piezas = (eventos ?? []).filter((e) => e.id != null && e.tarjetaId === tarjetaId && e.descartado !== true);
  const compras = (movimientos ?? []).filter(
    (m) => m.id != null && m.tarjetaId === tarjetaId && m.gastoTarjetaCredito === true
  );
  const objetivos: ObjetivoConciliacion[] = [
    ...piezas.map((e) => ({
      id: e.id as number,
      kind: 'pieza' as const,
      fecha: (e.actualDate ?? e.predictedDate ?? '').slice(0, 10),
      importe: Math.abs(e.actualAmount ?? e.amount),
      descripcion: e.description || 'Gasto previsto de la tarjeta',
    })),
    ...compras.map((m) => ({
      id: m.id as number,
      kind: 'compra' as const,
      fecha: (m.date ?? '').slice(0, 10),
      importe: Math.abs(m.amount),
      descripcion: m.description || 'Compra anotada',
    })),
  ];
  return {
    objetivos,
    piezaPorId: new Map(piezas.map((e) => [e.id as number, e])),
    compraPorId: new Map(compras.map((m) => [m.id as number, m])),
  };
}

/**
 * PLANIFICA la conciliación · lee y empareja, SIN escribir. Devuelve cada línea
 * del extracto con su veredicto, para cotejar antes de aplicar.
 */
export async function planificarExtractoTarjeta(
  tarjetaId: number,
  lineas: LineaExtractoTarjeta[]
): Promise<PlanConciliacionTarjeta> {
  const { objetivos } = await objetivosDeTarjeta(tarjetaId);
  const emparejadas = emparejarExtractoTarjeta(lineas, objetivos);
  const detalladas: LineaConciliada[] = lineas.map((linea, i) => {
    const objetivo = emparejadas.get(i);
    return objetivo ? { linea, estado: 'casa', objetivo } : { linea, estado: 'nueva' };
  });
  // Una devolución (importe ≤ 0) sin par no crea gasto · no cuenta como nueva.
  const nuevasReales = detalladas.filter((d) => d.estado === 'nueva' && d.linea.importe > 0);
  return {
    lineas: detalladas,
    conciliadas: detalladas.length - detalladas.filter((d) => d.estado === 'nueva').length,
    nuevas: nuevasReales.length,
  };
}

/**
 * APLICA un plan ya cotejado · escribe. Lo que casa sube a conciliado con el
 * importe real; lo suelto (importe > 0) nace ya conciliado. No crea movimientos
 * de caja: el dinero sale en el recibo.
 */
export async function aplicarPlanTarjeta(
  tarjetaId: number,
  plan: PlanConciliacionTarjeta
): Promise<ResultadoConciliacionTarjeta> {
  const db = await initDB();
  const { piezaPorId, compraPorId } = await objetivosDeTarjeta(tarjetaId);
  const now = new Date().toISOString();

  let conciliadas = 0;
  let nuevas = 0;
  for (let i = 0; i < plan.lineas.length; i += 1) {
    const { linea, estado, objetivo } = plan.lineas[i];
    if (estado === 'casa' && objetivo) {
      if (objetivo.kind === 'pieza') {
        const e = piezaPorId.get(objetivo.id);
        if (!e) continue;
        await db.put('treasuryEvents', {
          ...e,
          status: 'confirmed',
          conciliadoExtracto: true,
          actualDate: e.actualDate ?? e.predictedDate,
          actualAmount: Math.abs(e.actualAmount ?? e.amount),
          updatedAt: now,
        } as TreasuryEvent);
      } else {
        const m = compraPorId.get(objetivo.id);
        if (!m) continue;
        // Una compra manual avalada por el extracto pasa a source 'import' · en
        // el modelo de punteo eso es CONCILIADO ("la palabra del extracto").
        await db.put('movements', { ...m, source: 'import', updatedAt: now } as Movement);
      }
      conciliadas += 1;
      continue;
    }
    // Línea sin objetivo · nace como pieza YA conciliada (el extracto manda).
    if (linea.importe <= 0) continue; // una devolución sin par no crea gasto
    await db.add('treasuryEvents', {
      type: 'expense',
      amount: -Math.abs(linea.importe),
      predictedDate: linea.fecha,
      description: linea.concepto,
      sourceType: 'gasto_tarjeta',
      sourceId: `gasto_tarjeta-ext-${tarjetaId}-${linea.fecha}-${i}`,
      tarjetaId,
      status: 'confirmed',
      conciliadoExtracto: true,
      actualDate: linea.fecha,
      actualAmount: Math.abs(linea.importe),
      certeza: 'estimado',
      ambito: 'PERSONAL',
      año: Number(linea.fecha.slice(0, 4)),
      mes: Number(linea.fecha.slice(5, 7)),
      createdAt: now,
      updatedAt: now,
    } as TreasuryEvent);
    nuevas += 1;
  }

  return { conciliadas, nuevas };
}

/**
 * Lee, empareja y aplica de una vez · atajo para los tests y para el código que
 * no necesita cotejar. La UI usa `planificar` + `aplicarPlan` por separado.
 */
export async function aplicarExtractoTarjeta(
  tarjetaId: number,
  lineas: LineaExtractoTarjeta[]
): Promise<ResultadoConciliacionTarjeta> {
  const plan = await planificarExtractoTarjeta(tarjetaId, lineas);
  return aplicarPlanTarjeta(tarjetaId, plan);
}
