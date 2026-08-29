// ============================================================================
// La limpieza de lo que C1 (#1819) fabricó hacia atrás
// ============================================================================
//
// Retirar el generador (#1821) no borra lo que ya escribió. Esto sí, y solo
// eso: lo que se dice previsto de un mes ANTERIOR al mes en que nació.

import {
  esPrevisionRetroactiva,
  limpiarPrevisionesRetroactivas,
} from '../limpiarPrevisionesRetroactivas';
import { initDB } from '../../db';
import type { TreasuryEvent } from '../../db';

const ev = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 1,
    type: 'expense',
    amount: -50,
    predictedDate: '2026-03-10',
    description: 'Agua',
    sourceType: 'gasto_recurrente',
    generadoPor: 'treasurySyncService',
    status: 'predicted',
    createdAt: '2026-08-29T01:40:00.000Z',
    updatedAt: '2026-08-29T01:40:00.000Z',
    ...over,
  }) as TreasuryEvent;

describe('esPrevisionRetroactiva · qué se borra', () => {
  it('un previsto de marzo nacido en agosto se fabricó hacia atrás', () => {
    expect(esPrevisionRetroactiva(ev())).toBe(true);
  });

  it('cruza el año sin liarse · diciembre nacido en enero siguiente', () => {
    expect(
      esPrevisionRetroactiva(
        ev({ predictedDate: '2025-12-10', createdAt: '2026-01-05T00:00:00.000Z' })
      )
    ).toBe(true);
  });
});

describe('esPrevisionRetroactiva · qué NO se toca', () => {
  // El motor vivo proyecta del día 1 del mes en curso hacia delante, así que un
  // cargo del 15 de agosto creado el 29 de agosto es SUYO, no de C1. Y para
  // agosto C1 no llegó a emitir nada: la clave de origen ya estaba ocupada.
  it('un previsto del MISMO mes en que nació es del motor vivo', () => {
    expect(
      esPrevisionRetroactiva(
        ev({ predictedDate: '2026-08-15', createdAt: '2026-08-29T01:40:00.000Z' })
      )
    ).toBe(false);
  });

  it('un vencido de verdad · nació en su propio mes y se quedó sin confirmar', () => {
    expect(
      esPrevisionRetroactiva(
        ev({ predictedDate: '2026-03-10', createdAt: '2026-03-01T00:00:00.000Z' })
      )
    ).toBe(false);
  });

  it('un previsto del FUTURO no se toca nunca', () => {
    expect(
      esPrevisionRetroactiva(
        ev({ predictedDate: '2026-12-10', createdAt: '2026-08-29T01:40:00.000Z' })
      )
    ).toBe(false);
  });

  // Lo que el usuario ha tocado manda sobre cualquier limpieza. Un cargo
  // confirmado o conciliado es realidad bancaria y mueve el saldo: borrarlo
  // sería perder dinero de la vista. Un descartado es una decisión suya.
  it('un CONFIRMADO no se toca aunque su fecha sea retroactiva', () => {
    expect(esPrevisionRetroactiva(ev({ status: 'confirmed' }))).toBe(false);
  });

  it('un EJECUTADO tampoco', () => {
    expect(esPrevisionRetroactiva(ev({ status: 'executed' }))).toBe(false);
  });

  it('uno con movimiento enlazado tampoco · aunque siga en predicted', () => {
    expect(esPrevisionRetroactiva(ev({ executedMovementId: 7 }))).toBe(false);
  });

  it('un DESCARTADO tampoco · el usuario ya dijo lo suyo', () => {
    expect(esPrevisionRetroactiva(ev({ descartado: true }))).toBe(false);
  });

  // C1 solo emitía gastos recurrentes. Un apunte a mano con fecha pasada
  // también nace después de su fecha, y NO es de C1: borrarlo sería tirar lo
  // que el usuario acaba de escribir.
  it('un apunte MANUAL con fecha pasada no es de C1', () => {
    expect(esPrevisionRetroactiva(ev({ sourceType: 'manual', generadoPor: undefined }))).toBe(false);
  });

  it('una cuota de préstamo con fecha pasada tampoco', () => {
    expect(esPrevisionRetroactiva(ev({ sourceType: 'prestamo_cuota' }))).toBe(false);
  });

  it('un recibo de tarjeta tampoco', () => {
    expect(esPrevisionRetroactiva(ev({ sourceType: 'tarjeta_recibo' }))).toBe(false);
  });

  it('lo que no lo escribió el motor de previsiones tampoco', () => {
    expect(esPrevisionRetroactiva(ev({ generadoPor: 'otro' }))).toBe(false);
  });
});

describe('esPrevisionRetroactiva · datos incompletos', () => {
  it('sin createdAt no se decide · en la duda no se borra', () => {
    expect(esPrevisionRetroactiva(ev({ createdAt: undefined as unknown as string })))
      .toBe(false);
  });

  it('sin predictedDate tampoco', () => {
    expect(esPrevisionRetroactiva(ev({ predictedDate: '' }))).toBe(false);
  });
});

// ============================================================================
// De extremo a extremo · sobre la base de verdad
// ============================================================================
//
// La frontera está fijada arriba. Esto vigila lo que de verdad importa cuando
// se borra dato: que se vaya lo que sobra y NO se vaya nada más.

const guardar = async (e: Partial<TreasuryEvent>): Promise<number> => {
  const db = await initDB();
  // El `id` del molde es de los tests puros · aquí lo pone el autoIncrement.
  const { id: _sinUsar, ...sinId } = ev(e);
  return (await db.add('treasuryEvents', sinId as never)) as number;
};

const existe = async (id: number): Promise<boolean> => {
  const db = await initDB();
  return (await db.get('treasuryEvents', id)) != null;
};

describe('limpiarPrevisionesRetroactivas · sobre la base', () => {
  it('se lleva las fabricadas y deja intacto lo demás', async () => {
    const fabricada = await guardar({ predictedDate: '2026-03-10' });
    const delMesEnCurso = await guardar({
      predictedDate: '2026-08-15',
      createdAt: '2026-08-29T01:40:00.000Z',
    });
    const vencidaDeVerdad = await guardar({
      predictedDate: '2026-04-10',
      createdAt: '2026-04-01T00:00:00.000Z',
    });
    const confirmada = await guardar({ predictedDate: '2026-02-10', status: 'confirmed' });
    const descartada = await guardar({ predictedDate: '2026-02-11', descartado: true });
    const aMano = await guardar({ predictedDate: '2026-01-10', sourceType: 'manual' });

    const db = await initDB();
    const recibo = await limpiarPrevisionesRetroactivas(db as never);

    expect(await existe(fabricada)).toBe(false);
    expect(recibo.borradas).toBe(1);

    expect(await existe(delMesEnCurso)).toBe(true);
    expect(await existe(vencidaDeVerdad)).toBe(true);
    expect(await existe(confirmada)).toBe(true);
    expect(await existe(descartada)).toBe(true);
    expect(await existe(aMano)).toBe(true);
  });

  // Borrar no se deshace, así que el recibo tiene que decir la verdad de lo que
  // se llevó: cuánto, cuántos euros dejan de figurar y de qué meses.
  it('el recibo cuadra con lo que se borró', async () => {
    await guardar({ predictedDate: '2026-01-10', amount: -30 });
    await guardar({ predictedDate: '2026-01-20', amount: -20 });
    await guardar({ predictedDate: '2026-02-10', amount: -50 });

    const db = await initDB();
    const recibo = await limpiarPrevisionesRetroactivas(db as never);

    expect(recibo.borradas).toBe(3);
    expect(recibo.importe).toBeCloseTo(-100, 2);
    expect(recibo.porMes).toEqual({ '2026-01': 2, '2026-02': 1 });
  });

  // Correrla dos veces deja lo mismo que correrla una: la segunda no encuentra
  // nada que borrar. Es lo que permite que el flag sea una optimización y no la
  // única defensa.
  it('es idempotente', async () => {
    await guardar({ predictedDate: '2026-03-10' });

    const db = await initDB();
    const primera = await limpiarPrevisionesRetroactivas(db as never);
    const segunda = await limpiarPrevisionesRetroactivas(db as never);

    expect(primera.borradas).toBe(1);
    expect(segunda.borradas).toBe(0);
  });

  it('sobre una base sin nada que limpiar no toca nada', async () => {
    const sano = await guardar({
      predictedDate: '2026-04-10',
      createdAt: '2026-04-01T00:00:00.000Z',
    });

    const db = await initDB();
    const recibo = await limpiarPrevisionesRetroactivas(db as never);

    expect(recibo.borradas).toBe(0);
    expect(await existe(sano)).toBe(true);
  });
});
