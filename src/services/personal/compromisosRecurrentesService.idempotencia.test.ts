// P0 · DUPLICACIÓN AL EDITAR UN GASTO RECURRENTE.
//
// Regenerar una previsión tiene que ser IDEMPOTENTE: ejecutarlo una vez o cinco
// deja exactamente el mismo resultado. Lo que se fija aquí:
//   · editar N veces no añade previsiones (una por clave de origen)
//   · una previsión confirmada/conciliada no recibe un gemelo `predicted`
//   · una previsión descartada no resucita
//   · reactivar tampoco duplica (va por la misma puerta)
import 'fake-indexeddb/auto';
import { initDB } from '../db';
import type { TreasuryEvent } from '../db';
import {
  crearCompromiso,
  actualizarCompromiso,
  darDeBajaCompromiso,
  reactivarCompromiso,
  regenerarEventosCompromiso,
  claveOrigenPrevision,
} from './compromisosRecurrentesService';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';

const base = (over: Partial<CompromisoRecurrente> = {}): Omit<
  CompromisoRecurrente,
  'id' | 'createdAt' | 'updatedAt'
> =>
  ({
    ambito: 'personal',
    personalDataId: 1,
    alias: 'Gimnasio',
    tipo: 'suscripcion',
    proveedor: { nombre: 'GymCo' },
    patron: { tipo: 'mensualDiaFijo', dia: 15 },
    importe: { modo: 'fijo', importe: 40 },
    cuentaCargo: 7,
    conceptoBancario: 'GYMCO',
    metodoPago: 'domiciliacion',
    categoria: 'personal.suscripciones',
    bolsaPresupuesto: 'deseos',
    responsable: 'titular',
    fechaInicio: '2020-01-01',
    estado: 'activo',
    ...over,
  }) as unknown as Omit<CompromisoRecurrente, 'id' | 'createdAt' | 'updatedAt'>;

async function eventosDe(sourceId: number): Promise<TreasuryEvent[]> {
  const db = await initDB();
  const idx = db
    .transaction('treasuryEvents', 'readonly')
    .objectStore('treasuryEvents')
    .index('sourceId');
  return (await idx.getAll(sourceId)) as TreasuryEvent[];
}

/** Claves de origen con más de una previsión · tiene que estar siempre vacío. */
function clavesDuplicadas(eventos: TreasuryEvent[]): string[] {
  const cuenta = new Map<string, number>();
  for (const e of eventos) {
    const k = claveOrigenPrevision(e);
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
  }
  return Array.from(cuenta.entries())
    .filter(([, n]) => n > 1)
    .map(([k]) => k);
}

describe('idempotencia · editar no duplica', () => {
  it('cinco ediciones dejan el mismo número de previsiones que una', async () => {
    const c = await crearCompromiso(base());
    const tras1 = (await eventosDe(c.id!)).length;
    expect(tras1).toBeGreaterThan(0);

    for (let i = 1; i <= 5; i++) {
      await actualizarCompromiso(c.id!, { importe: { modo: 'fijo', importe: 40 + i } });
    }

    const finales = await eventosDe(c.id!);
    expect(finales).toHaveLength(tras1);
    expect(clavesDuplicadas(finales)).toEqual([]);
    // La edición SUSTITUYE: el importe vigente es el último.
    expect(finales.every((e) => e.amount === -45)).toBe(true);
  });

  it('regenerar cinco veces seguidas deja el mismo resultado', async () => {
    const c = await crearCompromiso(base({ alias: 'Seguro hogar' }));
    const antes = (await eventosDe(c.id!)).length;
    for (let i = 0; i < 5; i++) await regenerarEventosCompromiso(c);
    const despues = await eventosDe(c.id!);
    expect(despues).toHaveLength(antes);
    expect(clavesDuplicadas(despues)).toEqual([]);
  });
});

describe('idempotencia · lo intocable no se reemite', () => {
  it('una previsión CONFIRMADA no recibe un gemelo predicted al editar', async () => {
    const db = await initDB();
    const c = await crearCompromiso(base({ alias: 'Luz' }));
    const evs = await eventosDe(c.id!);
    const objetivo = evs[evs.length - 1];
    await db.put('treasuryEvents', { ...objetivo, status: 'confirmed' });

    await actualizarCompromiso(c.id!, { importe: { modo: 'fijo', importe: 99 } });

    const finales = await eventosDe(c.id!);
    const mismoPeriodo = finales.filter((e) => e.predictedDate === objetivo.predictedDate);
    expect(mismoPeriodo).toHaveLength(1);
    expect(mismoPeriodo[0].status).toBe('confirmed');
    // El importe confirmado es realidad bancaria · la edición no lo pisa.
    expect(mismoPeriodo[0].amount).toBe(objetivo.amount);
    expect(clavesDuplicadas(finales)).toEqual([]);
  });

  it('una previsión CONCILIADA (executed + movimiento) tampoco recibe gemelo', async () => {
    const db = await initDB();
    const c = await crearCompromiso(base({ alias: 'Comunidad' }));
    const evs = await eventosDe(c.id!);
    const objetivo = evs[evs.length - 1];
    await db.put('treasuryEvents', {
      ...objetivo,
      status: 'executed',
      executedMovementId: 4242,
    });

    await actualizarCompromiso(c.id!, { importe: { modo: 'fijo', importe: 88 } });

    const finales = await eventosDe(c.id!);
    expect(finales.filter((e) => e.predictedDate === objetivo.predictedDate)).toHaveLength(1);
    expect(clavesDuplicadas(finales)).toEqual([]);
  });

  it('una previsión DESCARTADA no resucita ni se duplica al editar', async () => {
    const db = await initDB();
    const c = await crearCompromiso(base({ alias: 'Netflix' }));
    const evs = await eventosDe(c.id!);
    const objetivo = evs[evs.length - 1];
    await db.put('treasuryEvents', {
      ...objetivo,
      descartado: true,
      descartadoAt: '2026-08-01T00:00:00.000Z',
      motivoDescarte: 'no va a ocurrir',
    });

    await actualizarCompromiso(c.id!, { importe: { modo: 'fijo', importe: 77 } });

    const finales = await eventosDe(c.id!);
    const mismoPeriodo = finales.filter((e) => e.predictedDate === objetivo.predictedDate);
    expect(mismoPeriodo).toHaveLength(1);
    expect(mismoPeriodo[0].descartado).toBe(true);
    expect(clavesDuplicadas(finales)).toEqual([]);
  });
});

describe('idempotencia · reactivar', () => {
  it('baja + reactivación no deja previsiones duplicadas', async () => {
    const c = await crearCompromiso(base({ alias: 'Alarma' }));
    const hoy = new Date();
    const dentroDe2Meses = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 15)
      .toISOString()
      .slice(0, 10);

    await darDeBajaCompromiso(c.id!, hoy.toISOString().slice(0, 10), 'cambioDomicilio');
    await reactivarCompromiso(c.id!, dentroDe2Meses);

    const finales = await eventosDe(c.id!);
    expect(clavesDuplicadas(finales)).toEqual([]);

    // Reactivar dos veces seguidas tampoco añade nada.
    const antes = finales.length;
    await reactivarCompromiso(c.id!, dentroDe2Meses).catch(() => {
      /* ya está activo · no aplica */
    });
    expect((await eventosDe(c.id!)).length).toBeLessThanOrEqual(antes);
  });
});
