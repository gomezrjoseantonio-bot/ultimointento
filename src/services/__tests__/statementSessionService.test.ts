// Candado de la sesión de extracto como BORRADOR (§4.7).
//
// El riesgo que cubre: `processFile` inserta los movimientos al procesar el
// fichero, y nacen con `source: 'import'` — o sea, conciliados. Sin este
// filtro, soltar un extracto en la dropzone haría aparecer todas sus líneas en
// la lista de la cuenta y movería el saldo antes de que el usuario mirase
// ninguna. §4.7 dice justo lo contrario: "lo no resuelto no se mezcla con la
// lista de la cuenta: espera en el extracto".

import {
  batchesEnBorrador,
  sinBorradores,
  consolidarSesion,
  estaConsolidada,
} from '../statementSessionService';
import { initDB } from '../db';
import type { ImportBatch } from '../db/types-fiscal';

jest.mock('../db', () => ({ initDB: jest.fn() }));

let batches: ImportBatch[];

const batch = (id: string, over: Partial<ImportBatch> = {}): ImportBatch =>
  ({
    id,
    filename: `${id}.csv`,
    accountId: 1,
    hashLote: `h-${id}`,
    timestampImport: '2026-03-10T09:00:00.000Z',
    ...over,
  }) as ImportBatch;

beforeEach(() => {
  batches = [batch('borrador'), batch('guardado', { consolidadoAt: '2026-03-10T10:00:00.000Z' })];
  (initDB as jest.Mock).mockResolvedValue({
    getAll: async () => batches,
    get: async (_s: string, id: string) => batches.find((b) => b.id === id),
    put: async (_s: string, value: ImportBatch) => {
      const i = batches.findIndex((b) => b.id === value.id);
      if (i >= 0) batches[i] = value;
      return value.id;
    },
  });
});

describe('qué sesiones son borrador', () => {
  it('lo es la que no ha pasado por Guardar, y solo esa', async () => {
    const b = await batchesEnBorrador();
    expect(b.has('borrador')).toBe(true);
    expect(b.has('guardado')).toBe(false);
  });
});

describe('el filtro de la lista de cuenta', () => {
  const movs = [
    { importBatch: 'borrador' },
    { importBatch: 'guardado' },
    { importBatch: undefined },
  ];

  it('esconde lo que espera en un extracto sin guardar', () => {
    const visibles = sinBorradores(movs, new Set(['borrador']));
    expect(visibles.map((m) => m.importBatch)).toEqual(['guardado', undefined]);
  });

  it('deja pasar siempre lo que no viene de ninguna importación', () => {
    // Alta a mano, punteo, inbox: no hay sesión que esperar.
    const visibles = sinBorradores([{ importBatch: undefined }], new Set(['borrador']));
    expect(visibles).toHaveLength(1);
  });

  it('sin borradores no toca nada · y devuelve el mismo array', () => {
    expect(sinBorradores(movs, new Set())).toBe(movs);
  });
});

describe('consolidar', () => {
  it('marca la sesión y a partir de ahí sus movimientos cuentan', async () => {
    expect(await estaConsolidada('borrador')).toBe(false);
    await consolidarSesion('borrador');

    expect(await estaConsolidada('borrador')).toBe(true);
    expect((await batchesEnBorrador()).has('borrador')).toBe(false);
  });

  it('es idempotente y conserva la fecha de la PRIMERA vez', async () => {
    await consolidarSesion('guardado');
    expect(batches.find((b) => b.id === 'guardado')?.consolidadoAt).toBe(
      '2026-03-10T10:00:00.000Z'
    );
  });

  it('falla claro si la sesión no existe', async () => {
    await expect(consolidarSesion('fantasma')).rejects.toThrow('no encontrada');
  });
});
