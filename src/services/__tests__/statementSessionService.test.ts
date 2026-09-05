// La sesión de extracto · guardada o a medias (§4.7 · E1.3 · E1.5).
//
// E1.5 retiró de aquí el «borrador» (`batchesEnBorrador`, `sinBorradores`):
// existía para esconder los movimientos que el import insertaba antes de que
// el usuario mirara nada, y tras el corte importar no inserta ninguno. Y
// consolidar ya no borra nada: lo sin resolver es una LÍNEA, no un movimiento.
// Lo que queda por proteger es la marca de guardado, que es lo que decide si
// un lote se ofrece retomar.

import { consolidarSesion } from '../statementSessionService';
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

describe('consolidar', () => {
  it('marca la sesión · deja de estar a medias', async () => {
    expect(batches.find((b) => b.id === 'borrador')?.consolidadoAt).toBeUndefined();
    await consolidarSesion('borrador');

    expect(batches.find((b) => b.id === 'borrador')?.consolidadoAt).toMatch(/^\d{4}-/);
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

// E1.5 · consolidar NO borra nada ni guarda listas de pendientes: lo sin
// resolver sigue siendo línea del extracto y cuenta en el saldo como tal.
describe('consolidar no toca nada más que la marca', () => {
  it('no deja el campo de pendientes ni escribe nada fuera del batch', async () => {
    await consolidarSesion('borrador');
    const b = batches.find((x) => x.id === 'borrador');
    expect(b).not.toHaveProperty('lineasPendientes');
    expect(Object.keys(b ?? {}).sort()).toEqual(
      ['accountId', 'consolidadoAt', 'filename', 'hashLote', 'id', 'timestampImport']
    );
  });
});
