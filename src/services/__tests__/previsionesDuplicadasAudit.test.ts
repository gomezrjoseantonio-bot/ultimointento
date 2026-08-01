// P0 · limpieza de datos · el recuento cuenta y la limpieza solo retira lo vivo.
import 'fake-indexeddb/auto';
import { initDB } from '../db';
import type { TreasuryEvent } from '../db';
import {
  contarPrevisionesDuplicadas,
  limpiarPrevisionesDuplicadas,
  formatearReporte,
} from '../__previsionesDuplicadasAudit';

const ahora = '2026-08-01T00:00:00.000Z';

function evento(over: Partial<TreasuryEvent> = {}): TreasuryEvent {
  return {
    type: 'expense',
    amount: -40,
    predictedDate: '2026-09-15',
    description: 'Gimnasio',
    sourceType: 'gasto_recurrente',
    sourceId: 1,
    año: 2026,
    mes: 9,
    accountId: 7,
    status: 'predicted',
    createdAt: ahora,
    updatedAt: ahora,
    ...over,
  } as TreasuryEvent;
}

async function sembrar(eventos: TreasuryEvent[]): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('treasuryEvents', 'readwrite');
  const store = tx.objectStore('treasuryEvents');
  let cursor = await store.openCursor();
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  for (const ev of eventos) await store.add(ev);
  await tx.done;
}

describe('contarPrevisionesDuplicadas', () => {
  it('no ve duplicados donde solo hay una previsión por clave', async () => {
    await sembrar([evento(), evento({ predictedDate: '2026-10-15', mes: 10 })]);
    const r = await contarPrevisionesDuplicadas();
    expect(r.grupos).toHaveLength(0);
    expect(r.importeSobranteTotal).toBe(0);
  });

  it('cuenta el duplicado exacto y cuánto infla el cierre', async () => {
    await sembrar([evento(), evento(), evento()]);
    const r = await contarPrevisionesDuplicadas();
    expect(r.grupos).toHaveLength(1);
    expect(r.gruposExactos).toBe(1);
    expect(r.sobrantesLimpiables).toBe(2);
    expect(r.importeSobranteTotal).toBe(-80);
    expect(r.impactoPorMes).toEqual([
      { periodo: '2026-09', gruposAfectados: 1, importeSobrante: -80 },
    ]);
    expect(formatearReporte(r)).toContain('Grupos duplicados: 1');
  });

  it('detecta el gemelo predicted de una confirmada y conserva la confirmada', async () => {
    await sembrar([evento({ status: 'confirmed', amount: -42 }), evento({ amount: -50 })]);
    const r = await contarPrevisionesDuplicadas();
    expect(r.grupos).toHaveLength(1);
    expect(r.gruposMismoPeriodo).toBe(1);
    expect(r.grupos[0].eventos[0].destino).toBe('conservar');
    expect(r.grupos[0].eventos[0].status).toBe('confirmed');
    expect(r.grupos[0].eventos[1].destino).toBe('sobrante_limpiable');
  });

  it('dos cargos ya conciliados en el mismo periodo van a revisión manual', async () => {
    await sembrar([
      evento({ status: 'executed', executedMovementId: 1 }),
      evento({ status: 'executed', executedMovementId: 2 }),
    ]);
    const r = await contarPrevisionesDuplicadas();
    expect(r.sobrantesRevisionManual).toBe(1);
    expect(r.sobrantesLimpiables).toBe(0);
  });

  it('ignora los eventos introducidos a mano', async () => {
    await sembrar([
      evento({ sourceType: 'manual', sourceId: undefined }),
      evento({ sourceType: 'manual', sourceId: undefined }),
    ]);
    const r = await contarPrevisionesDuplicadas();
    expect(r.eventosExaminados).toBe(0);
    expect(r.grupos).toHaveLength(0);
  });
});

describe('limpiarPrevisionesDuplicadas', () => {
  it('en seco por defecto · no borra nada', async () => {
    await sembrar([evento(), evento()]);
    const res = await limpiarPrevisionesDuplicadas();
    expect(res.aplicado).toBe(false);
    expect(res.retiradas).toBe(1);
    const db = await initDB();
    expect((await db.getAll('treasuryEvents'))).toHaveLength(2);
  });

  it('con confirmar retira solo las predicted vivas sobrantes', async () => {
    await sembrar([
      evento({ status: 'executed', executedMovementId: 9 }),
      evento(),
      evento(),
      evento({ descartado: true }),
    ]);
    const res = await limpiarPrevisionesDuplicadas({ confirmar: true });
    expect(res.aplicado).toBe(true);
    expect(res.retiradas).toBe(2);

    const db = await initDB();
    const quedan = (await db.getAll('treasuryEvents')) as TreasuryEvent[];
    expect(quedan).toHaveLength(2);
    expect(quedan.some((e) => e.status === 'executed')).toBe(true);
    expect(quedan.some((e) => e.descartado === true)).toBe(true);
  });

  it('tras limpiar, el recuento vuelve a 0 y es reproducible', async () => {
    await sembrar([evento(), evento(), evento()]);
    await limpiarPrevisionesDuplicadas({ confirmar: true });
    const r1 = await contarPrevisionesDuplicadas();
    const r2 = await contarPrevisionesDuplicadas();
    expect(r1.grupos).toHaveLength(0);
    expect(r2.grupos).toEqual(r1.grupos);
  });
});
