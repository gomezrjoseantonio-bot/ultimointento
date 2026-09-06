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
  it('mudo si no tiene familia', () => {
    expect(estaMudo({ familia: undefined })).toBe(true);
    expect(estaMudo({ familia: 'gestion' })).toBe(false);
  });
});

describe('parcheDeClasificacion', () => {
  it('hereda categoría, subtipo, concepto, ámbito e inmueble de la previsión', () => {
    const m = mov({ ambito: 'personal', inmuebleId: undefined });
    const ev = evt({ familia: 'suministro', subtipo: 'gas', ambito: 'inmueble', inmuebleId: 7 });
    expect(parcheDeClasificacion(m, ev)).toEqual({
      familia: 'suministro',
      subtipo: 'gas',
      ambito: 'inmueble',
      inmuebleId: '7',
    });
  });

  it('no pisa un apunte ya clasificado', () => {
    const m = mov({ familia: 'otra_cosa' });
    const ev = evt({ familia: 'suministro' });
    expect(parcheDeClasificacion(m, ev)).toEqual({});
  });

  it('si la previsión no clasifica, no hereda ámbito ni inmueble', () => {
    const m = mov({ ambito: 'personal' });
    const ev = evt({ ambito: 'inmueble', inmuebleId: 7 });
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
      [evt({ id: 100, familia: 'gestion', subtipo: 'gestoria', ambito: 'inmueble', inmuebleId: 3 })]
    );
    const r = await backfillClasificacionConciliados();
    expect(r.rellenados).toBe(1);
    expect(store.get(1)?.familia).toBe('gestion');
    expect(store.get(1)?.subtipo).toBe('gestoria');
    expect(store.get(1)?.inmuebleId).toBe('3');
  });

  it('rellena por el enlace de la previsión (executedMovementId)', async () => {
    const store = setup(
      [mov({ id: 5, reference: undefined })],
      [evt({ id: 100, executedMovementId: 5, familia: 'comunidad' })]
    );
    const r = await backfillClasificacionConciliados();
    expect(r.rellenados).toBe(1);
    expect(store.get(5)?.familia).toBe('comunidad');
  });

  it('no toca un apunte ya clasificado ni uno sin previsión', async () => {
    const store = setup(
      [
        mov({ id: 1, familia: 'ya_tengo' }),
        mov({ id: 2, reference: undefined }), // sin previsión
      ],
      []
    );
    const r = await backfillClasificacionConciliados();
    expect(r.rellenados).toBe(0);
    expect(store.get(1)?.familia).toBe('ya_tengo');
    expect(store.get(2)?.familia).toBeUndefined();
  });
});
