// Candado del descarte (V6 · adenda 02 · D1).
//
// Lo que protege: que descartar NO sea borrar, que sea reversible, y que no se
// pueda usar para esconder algo que ya ocurrió (eso falsearía el saldo).

import { descartarPrevisto, recuperarPrevisto } from '../treasuryDiscardService';
import { initDB, type TreasuryEvent } from '../db';

jest.mock('../db', () => ({ initDB: jest.fn() }));

let eventos: TreasuryEvent[];

const ev = (over: Partial<TreasuryEvent> = {}): TreasuryEvent => ({
  id: 1,
  type: 'expense',
  amount: 100,
  predictedDate: '2026-07-10',
  description: 'Recibo',
  sourceType: 'manual',
  status: 'predicted',
  createdAt: '',
  updatedAt: '',
  ...over,
});

beforeEach(() => {
  eventos = [ev()];
  (initDB as jest.Mock).mockResolvedValue({
    get: async (_s: string, id: number) => eventos.find((e) => e.id === id),
    put: async (_s: string, value: TreasuryEvent) => {
      const i = eventos.findIndex((e) => e.id === value.id);
      if (i >= 0) eventos[i] = value;
      return value.id;
    },
  });
});

describe('descartar un previsto', () => {
  it('lo marca sin borrarlo: el motor de previsiones tiene que saberlo', async () => {
    await descartarPrevisto(1, 'no procede', '2026-07-05T10:00:00.000Z');

    expect(eventos).toHaveLength(1); // sigue ahí
    expect(eventos[0]).toMatchObject({
      descartado: true,
      descartadoAt: '2026-07-05T10:00:00.000Z',
      motivoDescarte: 'no procede',
    });
  });

  it('es idempotente y no reescribe la marca de tiempo', async () => {
    await descartarPrevisto(1, undefined, '2026-07-05T10:00:00.000Z');
    await descartarPrevisto(1, undefined, '2026-07-09T18:00:00.000Z');
    expect(eventos[0].descartadoAt).toBe('2026-07-05T10:00:00.000Z');
  });

  it('sin motivo, no deja la propiedad vacía colgando', async () => {
    await descartarPrevisto(1);
    expect('motivoDescarte' in eventos[0]).toBe(false);
  });

  it('NO deja descartar algo ya ejecutado', async () => {
    // Su realidad la afirmó el usuario o el banco; esconderla falsearía el
    // saldo. Para eso está desconfirmar, no descartar.
    eventos = [ev({ status: 'executed' })];
    await expect(descartarPrevisto(1)).rejects.toThrow(/ya ocurrió/i);
  });

  it('falla claro si el evento no existe', async () => {
    await expect(descartarPrevisto(999)).rejects.toThrow(/no encontrada/i);
  });
});

describe('recuperar un descartado', () => {
  it('lo devuelve a Pendientes sin dejar rastro de la marca', async () => {
    await descartarPrevisto(1, 'error mío');
    await recuperarPrevisto(1);

    expect(eventos[0].descartado).toBeUndefined();
    // Se eliminan las propiedades, no se ponen a false: un registro sin marca
    // se lee mejor que uno con `descartado: false` colgando.
    expect('descartadoAt' in eventos[0]).toBe(false);
    expect('motivoDescarte' in eventos[0]).toBe(false);
  });

  it('recuperar algo que no estaba descartado no rompe', async () => {
    await expect(recuperarPrevisto(1)).resolves.toBeUndefined();
  });
});
