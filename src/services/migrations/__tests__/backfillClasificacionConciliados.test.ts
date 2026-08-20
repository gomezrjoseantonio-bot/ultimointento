// P7 · rellenar la clasificación de los apuntes conciliados mudos desde su previsión.

import {
  estaMudo,
  parcheDeClasificacion,
  backfillClasificacionConciliados,
} from '../backfillClasificacionConciliados';
import type { Movement, TreasuryEvent } from '../../db';
import { initDB } from '../../db';

jest.mock('../../db', () => ({ initDB: jest.fn() }));

const mov = (over: Partial<Movement>): Movement => ({ id: 1, amount: -48, ...over }) as Movement;
const evt = (over: Partial<TreasuryEvent>): TreasuryEvent => ({ id: 100, ...over }) as TreasuryEvent;

describe('estaMudo', () => {
  it('mudo si no tiene ni categoría ni concepto', () => {
    expect(estaMudo({ categoryKey: undefined, conceptoId: undefined })).toBe(true);
    expect(estaMudo({ categoryKey: 'servicio_inmueble', conceptoId: undefined })).toBe(false);
    expect(estaMudo({ categoryKey: undefined, conceptoId: 'limpieza' })).toBe(false);
  });
});

describe('parcheDeClasificacion', () => {
  it('hereda categoría, subtipo, concepto, ámbito e inmueble de la previsión', () => {
    const m = mov({ ambito: 'PERSONAL', inmuebleId: undefined });
    const ev = evt({ categoryKey: 'suministro_inmueble', subtypeKey: 'gas', conceptoId: 'gas', ambito: 'INMUEBLE', inmuebleId: 7 });
    expect(parcheDeClasificacion(m, ev)).toEqual({
      categoryKey: 'suministro_inmueble',
      subtypeKey: 'gas',
      conceptoId: 'gas',
      ambito: 'INMUEBLE',
      inmuebleId: '7',
    });
  });

  it('no pisa un apunte ya clasificado', () => {
    const m = mov({ categoryKey: 'otra_cosa' });
    const ev = evt({ categoryKey: 'suministro_inmueble' });
    expect(parcheDeClasificacion(m, ev)).toEqual({});
  });

  it('si la previsión no clasifica, no hereda ámbito ni inmueble', () => {
    const m = mov({ ambito: 'PERSONAL' });
    const ev = evt({ ambito: 'INMUEBLE', inmuebleId: 7 });
    expect(parcheDeClasificacion(m, ev)).toEqual({});
  });
});

describe('backfillClasificacionConciliados', () => {
  const setup = (movements: Movement[], eventos: TreasuryEvent[]) => {
    const store = new Map(movements.map((m) => [m.id, { ...m }]));
    (initDB as jest.Mock).mockResolvedValue({
      getAll: async (s: string) => (s === 'movements' ? [...store.values()] : eventos),
      transaction: () => ({
        objectStore: () => ({ put: async (v: Movement) => store.set(v.id, v) }),
        done: Promise.resolve(),
      }),
    });
    return store;
  };

  it('rellena por reference treasury_event:<id>', async () => {
    const store = setup(
      [mov({ id: 1, reference: 'treasury_event:100' })],
      [evt({ id: 100, categoryKey: 'servicio_inmueble', conceptoId: 'limpieza', ambito: 'INMUEBLE', inmuebleId: 3 })]
    );
    const r = await backfillClasificacionConciliados();
    expect(r.rellenados).toBe(1);
    expect(store.get(1)?.categoryKey).toBe('servicio_inmueble');
    expect(store.get(1)?.conceptoId).toBe('limpieza');
    expect(store.get(1)?.inmuebleId).toBe('3');
  });

  it('rellena por el enlace de la previsión (executedMovementId)', async () => {
    const store = setup(
      [mov({ id: 5, reference: undefined })],
      [evt({ id: 100, executedMovementId: 5, categoryKey: 'comunidad_inmueble' })]
    );
    const r = await backfillClasificacionConciliados();
    expect(r.rellenados).toBe(1);
    expect(store.get(5)?.categoryKey).toBe('comunidad_inmueble');
  });

  it('no toca un apunte ya clasificado ni uno sin previsión', async () => {
    const store = setup(
      [
        mov({ id: 1, categoryKey: 'ya_tengo' }),
        mov({ id: 2, reference: undefined }), // sin previsión
      ],
      []
    );
    const r = await backfillClasificacionConciliados();
    expect(r.rellenados).toBe(0);
    expect(store.get(1)?.categoryKey).toBe('ya_tengo');
    expect(store.get(2)?.categoryKey).toBeUndefined();
  });
});
