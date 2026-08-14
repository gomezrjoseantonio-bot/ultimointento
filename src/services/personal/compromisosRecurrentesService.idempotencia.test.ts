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
} from './compromisosRecurrentesService';
import { claveOrigenPrevision } from './previsionesIdempotencia';
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

// Un recibo domiciliado VARIABLE cuyo cargo real ya está confirmado en la cuenta
// NO debe volver a emitir su previsión de ese mes · si no, el saldo descuenta el
// previsto (30) además del real (13,38): el fantasma.
describe('no reemitir un mes cuyo cargo real ya está confirmado', () => {
  it('el gas variable (previsto 30, real 13,38 ya confirmado) no proyecta fantasma en ese mes', async () => {
    const db = await initDB();
    const hoy = new Date();
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

    const c = await crearCompromiso(
      base({
        alias: 'Gas',
        proveedor: { nombre: 'Naturgy' },
        conceptoBancario: 'NATURGY',
        cuentaCargo: 7,
        importe: { modo: 'fijo', importe: 30 },
        patron: { tipo: 'mensualDiaFijo', dia: 2 },
      }),
    );

    // Antes del cargo real: sí hay previsión del mes en curso.
    const antes = await eventosDe(c.id!);
    expect(antes.some((e) => (e.predictedDate ?? '').startsWith(mesActual))).toBe(true);

    // Entra el cargo REAL por el extracto (13,38 €, mismo mes, misma cuenta).
    await db.add('movements', {
      accountId: 7,
      date: `${mesActual}-03`,
      valueDate: `${mesActual}-03`,
      amount: -13.38,
      description: 'RECIBO NATURGY IBERIA S.A.',
      status: 'conciliado',
      unifiedStatus: 'conciliado',
      source: 'import',
      category: { tipo: 'Suministros' },
      type: 'Gasto',
    } as any);

    // Al regenerar, el mes en curso ya NO proyecta el previsto (30) fantasma.
    await regenerarEventosCompromiso(c);

    const despues = await eventosDe(c.id!);
    const delMesActual = despues.filter((e) => (e.predictedDate ?? '').startsWith(mesActual));
    expect(delMesActual).toHaveLength(0);
    // Pero los meses FUTUROS (sin cargo real) se siguen proyectando.
    expect(despues.some((e) => (e.predictedDate ?? '') > `${mesActual}-31`)).toBe(true);
  });

  it('sin cargo real en la cuenta, la previsión del mes se proyecta normal', async () => {
    const hoy = new Date();
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    // Cuenta y proveedor SIN cargo real en la BD (los otros tests usan Naturgy en
    // la 7) · debe proyectarse el mes en curso con normalidad.
    const c = await crearCompromiso(
      base({ alias: 'Luz', proveedor: { nombre: 'Iberdrola' }, conceptoBancario: 'IBERDROLA', cuentaCargo: 3, patron: { tipo: 'mensualDiaFijo', dia: 2 } }),
    );
    await regenerarEventosCompromiso(c);
    const evs = await eventosDe(c.id!);
    expect(evs.some((e) => (e.predictedDate ?? '').startsWith(mesActual))).toBe(true);
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
