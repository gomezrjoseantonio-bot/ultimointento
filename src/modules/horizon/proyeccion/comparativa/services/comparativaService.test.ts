// V81 · TAREA CC · Bloque B.2 — prueba de aceptación:
// para un mes YA PASADO, la comparación previsto↔real da cifras coherentes y NO cero,
// cruzando el enlace previsión→movimiento (sin doble contar el movimiento vinculado).
import { initDB } from '../../../../../services/db';
import { comparativaService } from './comparativaService';

describe('comparativaService · Bloque B.2 · el real cruza el enlace previsión↔movimiento', () => {
  beforeEach(async () => {
    const db = await initDB();
    for (const store of ['treasuryEvents', 'movements'] as const) {
      const tx = db.transaction(store, 'readwrite');
      await tx.objectStore(store).clear();
      await tx.done;
    }
  });

  it('reconstruye el real de un mes pasado (no cero), atribuye el evento ejecutado a su mes de previsión y no cuenta dos veces el movimiento vinculado', async () => {
    const db = await initDB();

    // Evento previsto para MARZO/2020 y EJECUTADO, enlazado al movimiento #1.
    await db.put('treasuryEvents', {
      id: 1,
      type: 'income',
      amount: 1000,
      predictedDate: '2020-03-10T00:00:00.000Z',
      año: 2020,
      mes: 3,
      status: 'executed',
      actualAmount: 1000,
      executedMovementId: 1,
      movementId: 1,
      description: 'Renta marzo',
      sourceType: 'contrato',
      createdAt: '',
      updatedAt: '',
    } as never);

    // Movimiento real vinculado (conciliado) — NO debe contarse aparte (evita doble conteo).
    await db.put('movements', {
      id: 1,
      accountId: 1,
      date: '2020-03-12',
      amount: 1000,
      description: 'RENTA',
      unifiedStatus: 'conciliado',
      status: 'conciliado',
      source: 'import',
      category: { tipo: 'Ingresos' },
      createdAt: '',
      updatedAt: '',
    } as never);

    // Movimiento conciliado NO planificado (sin evento) — gasto de 200 en marzo.
    await db.put('movements', {
      id: 2,
      accountId: 1,
      date: '2020-03-15',
      amount: -200,
      description: 'COMPRA',
      unifiedStatus: 'conciliado',
      status: 'conciliado',
      source: 'import',
      category: { tipo: 'Gastos' },
      createdAt: '',
      updatedAt: '',
    } as never);

    // getActualData es privado; lo llamamos directamente para aislar el cálculo del "real"
    // (sin invocar el motor de proyección completo).
    const actual: number[] = await (comparativaService as unknown as {
      getActualData: (p: { year: number; scope: 'consolidado' }) => Promise<number[]>;
    }).getActualData({ year: 2020, scope: 'consolidado' });

    // Marzo = índice 2. +1000 (evento ejecutado, no doble contado) − 200 (no planificado) = 800.
    expect(actual[2]).toBe(800);
    // Coherente y NO cero.
    expect(actual[2]).not.toBe(0);
    // Los demás meses, cero (no hay más datos).
    expect(actual[0]).toBe(0);
    expect(actual[5]).toBe(0);
  });
});
