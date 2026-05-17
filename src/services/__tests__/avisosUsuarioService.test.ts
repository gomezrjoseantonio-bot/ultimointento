// Tests · avisosUsuarioService (PR 3 · spec §11 fila 6).
// cerrarAviso · estaAvisoActivo · restaurarAviso · restaurarTodos · listarCerrados.

const mockDB: any = {
  get: jest.fn(),
  put: jest.fn(),
  getAll: jest.fn(),
  delete: jest.fn(),
  transaction: jest.fn(),
};

function setupTxMock() {
  mockDB.transaction.mockImplementation(() => {
    const wrapper = {
      getAllKeys: jest.fn(() => mockDB.getAll('avisosUsuario').then((rows: any[]) => rows.map((r) => r.avisoId))),
      delete: jest.fn((key: unknown) => mockDB.delete('avisosUsuario', key)),
    };
    return {
      objectStore: () => wrapper,
      done: Promise.resolve(),
    };
  });
}

jest.mock('../db', () => ({
  initDB: jest.fn(() => Promise.resolve(mockDB)),
}));

import {
  cerrarAviso,
  estaAvisoActivo,
  listarCerrados,
  restaurarAviso,
  restaurarTodos,
} from '../avisosUsuarioService';
import { initDB } from '../db';
import type { AvisoCerrado } from '../../types/avisosUsuario';

beforeEach(() => {
  jest.clearAllMocks();
  (initDB as jest.Mock).mockResolvedValue(mockDB);
  mockDB.get.mockResolvedValue(undefined);
  mockDB.put.mockResolvedValue(undefined);
  mockDB.getAll.mockResolvedValue([]);
  mockDB.delete.mockResolvedValue(undefined);
  setupTxMock();
});

describe('avisosUsuarioService · cerrarAviso', () => {
  test('cierra un aviso con metadata · persiste fechaCierre ISO', async () => {
    const aviso = await cerrarAviso('benchmark-orange-loss', {
      ubicacionContexto: '/inversiones/plan-orange',
      etiqueta: 'Tu Plan Orange pierde contra la inflación',
    });
    expect(aviso.avisoId).toBe('benchmark-orange-loss');
    expect(aviso.fechaCierre).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(aviso.ubicacionContexto).toBe('/inversiones/plan-orange');
    expect(mockDB.put).toHaveBeenCalledWith('avisosUsuario', expect.objectContaining({
      avisoId: 'benchmark-orange-loss',
    }));
  });

  test('cerrar sin metadata · solo avisoId + fechaCierre', async () => {
    const aviso = await cerrarAviso('coste-ppe-info');
    expect(aviso.avisoId).toBe('coste-ppe-info');
    expect(aviso.ubicacionContexto).toBeUndefined();
    expect(aviso.etiqueta).toBeUndefined();
  });

  test('cerrarAviso · trim del id · rechaza vacío', async () => {
    await expect(cerrarAviso('')).rejects.toThrow(/obligatorio/);
    await expect(cerrarAviso('   ')).rejects.toThrow(/obligatorio/);
    const a = await cerrarAviso('  hitos-info  ');
    expect(a.avisoId).toBe('hitos-info');
  });

  test('cerrar dos veces · sobrescribe fechaCierre', async () => {
    await cerrarAviso('cerradas-histo');
    await cerrarAviso('cerradas-histo');
    expect(mockDB.put).toHaveBeenCalledTimes(2);
  });
});

describe('avisosUsuarioService · estaAvisoActivo', () => {
  test('aviso NO cerrado · activo (true)', async () => {
    mockDB.get.mockResolvedValueOnce(undefined);
    expect(await estaAvisoActivo('benchmark-orange-loss')).toBe(true);
  });

  test('aviso cerrado · inactivo (false)', async () => {
    mockDB.get.mockResolvedValueOnce({
      avisoId: 'benchmark-orange-loss',
      fechaCierre: '2026-05-17T12:00:00.000Z',
    });
    expect(await estaAvisoActivo('benchmark-orange-loss')).toBe(false);
  });

  test('avisoId vacío · activo por defecto (true)', async () => {
    expect(await estaAvisoActivo('')).toBe(true);
  });
});

describe('avisosUsuarioService · restaurar', () => {
  test('restaurarAviso · delega a db.delete con el id trim', async () => {
    await restaurarAviso('  benchmark-orange-loss  ');
    expect(mockDB.delete).toHaveBeenCalledWith('avisosUsuario', 'benchmark-orange-loss');
  });

  test('restaurarAviso · id vacío · no toca DB', async () => {
    await restaurarAviso('');
    expect(mockDB.delete).not.toHaveBeenCalled();
  });

  test('restaurarTodos · borra todos · devuelve cuenta', async () => {
    mockDB.getAll.mockResolvedValueOnce([
      { avisoId: 'a', fechaCierre: '2026-05-01T00:00:00.000Z' },
      { avisoId: 'b', fechaCierre: '2026-05-02T00:00:00.000Z' },
      { avisoId: 'c', fechaCierre: '2026-05-03T00:00:00.000Z' },
    ]);
    const n = await restaurarTodos();
    expect(n).toBe(3);
    expect(mockDB.delete).toHaveBeenCalledTimes(3);
  });

  test('restaurarTodos · 0 cerrados · no falla', async () => {
    mockDB.getAll.mockResolvedValueOnce([]);
    const n = await restaurarTodos();
    expect(n).toBe(0);
    expect(mockDB.delete).not.toHaveBeenCalled();
  });
});

describe('avisosUsuarioService · listarCerrados', () => {
  test('ordena por fechaCierre descendente (más recientes primero)', async () => {
    mockDB.getAll.mockResolvedValueOnce<AvisoCerrado[]>([
      { avisoId: 'antiguo', fechaCierre: '2026-01-01T00:00:00.000Z' },
      { avisoId: 'reciente', fechaCierre: '2026-05-15T00:00:00.000Z' },
      { avisoId: 'medio', fechaCierre: '2026-03-10T00:00:00.000Z' },
    ]);
    const lista = await listarCerrados();
    expect(lista.map((a) => a.avisoId)).toEqual(['reciente', 'medio', 'antiguo']);
  });
});
