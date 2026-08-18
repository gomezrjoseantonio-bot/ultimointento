// ============================================================================
// Conciliar el extracto de la TARJETA contra sus piezas · §3 (Fase 3b)
// ============================================================================
//
// Subes el extracto de la Carrefour y sus líneas casan con lo que la tarjeta ya
// tenía —piezas previstas/confirmadas y compras manuales del periodo—: eso sube
// a CONCILIADO con el importe REAL del extracto. Una línea que no casa con nada
// nace ya conciliada (el extracto manda: ese gasto ocurrió aunque no estuviera
// previsto). Mismo modelo previsto → confirmado → conciliado, con el extracto de
// la tarjeta en vez del banco.
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

/**
 * Aplica el extracto de una tarjeta · concilia lo que casa y materializa lo
 * suelto. No crea movimientos de caja: el dinero sale en el recibo.
 */
export async function aplicarExtractoTarjeta(
  tarjetaId: number,
  lineas: LineaExtractoTarjeta[]
): Promise<ResultadoConciliacionTarjeta> {
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
    })),
    ...compras.map((m) => ({
      id: m.id as number,
      kind: 'compra' as const,
      fecha: (m.date ?? '').slice(0, 10),
      importe: Math.abs(m.amount),
    })),
  ];

  const emparejadas = emparejarExtractoTarjeta(lineas, objetivos);
  const now = new Date().toISOString();
  const piezaPorId = new Map(piezas.map((e) => [e.id as number, e]));
  const compraPorId = new Map(compras.map((m) => [m.id as number, m]));

  let conciliadas = 0;
  for (const [, obj] of emparejadas) {
    if (obj.kind === 'pieza') {
      const e = piezaPorId.get(obj.id);
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
      const m = compraPorId.get(obj.id);
      if (!m) continue;
      // Una compra manual avalada por el extracto pasa a source 'import' · en el
      // modelo de punteo eso es CONCILIADO ("la palabra del banco/extracto").
      await db.put('movements', { ...m, source: 'import', updatedAt: now } as Movement);
    }
    conciliadas += 1;
  }

  // Líneas sin objetivo · nacen como pieza YA conciliada (el extracto manda).
  let nuevas = 0;
  const conciliadasIdx = new Set(emparejadas.keys());
  for (let i = 0; i < lineas.length; i += 1) {
    if (conciliadasIdx.has(i)) continue;
    const l = lineas[i];
    if (l.importe <= 0) continue; // una devolución sin par no crea gasto
    await db.add('treasuryEvents', {
      type: 'expense',
      amount: -Math.abs(l.importe),
      predictedDate: l.fecha,
      description: l.concepto,
      sourceType: 'gasto_tarjeta',
      sourceId: `gasto_tarjeta-ext-${tarjetaId}-${l.fecha}-${i}`,
      tarjetaId,
      status: 'confirmed',
      conciliadoExtracto: true,
      actualDate: l.fecha,
      actualAmount: Math.abs(l.importe),
      certeza: 'estimado',
      ambito: 'PERSONAL',
      año: Number(l.fecha.slice(0, 4)),
      mes: Number(l.fecha.slice(5, 7)),
      createdAt: now,
      updatedAt: now,
    } as TreasuryEvent);
    nuevas += 1;
  }

  return { conciliadas, nuevas };
}
