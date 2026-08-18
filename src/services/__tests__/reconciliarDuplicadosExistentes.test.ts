/* eslint-disable import/first -- el mock de la BD debe ir antes de los imports */
// Limpieza de duplicados de previstos punteados que dejó el bug de conciliación.

const mockDB = {
  getAll: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};
jest.mock('../db', () => ({ initDB: jest.fn(() => Promise.resolve(mockDB)) }));

import {
  detectarDuplicadosPunteados,
  reconciliarDuplicadosExistentes,
} from '../reconciliarDuplicadosExistentes';
import { initDB } from '../db';
import type { Movement } from '../db';

const punteado = (over: Partial<Movement> = {}): Movement =>
  ({
    id: 9,
    accountId: 3,
    date: '2026-08-14',
    amount: -98.44,
    description: 'Comunidad',
    source: 'manual',
    unifiedStatus: 'conciliado',
    reference: 'treasury_event:700',
    categoryKey: 'inmueble.comunidad',
    ...over,
  }) as Movement;

const importLine = (over: Partial<Movement> = {}): Movement =>
  ({
    id: 50,
    accountId: 3,
    date: '2026-08-15',
    amount: -98.44,
    description: 'RECIBO FUERTES ACEVEDO 32',
    source: 'import',
    unifiedStatus: 'no_planificado',
    ...over,
  }) as Movement;

describe('detectar duplicados punteados', () => {
  it('casa la línea del import con el previsto punteado del mismo cargo', () => {
    const m = detectarDuplicadosPunteados([punteado(), importLine()]);
    expect(m.get(50)).toBe(9);
  });

  it('un confirmado a mano SIN reference de previsto no se toca (conservador)', () => {
    const m = detectarDuplicadosPunteados([punteado({ reference: undefined }), importLine()]);
    expect(m.size).toBe(0);
  });

  it('sin línea del import no hay nada que colapsar', () => {
    const m = detectarDuplicadosPunteados([punteado()]);
    expect(m.size).toBe(0);
  });
});

describe('reconciliar duplicados existentes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (initDB as jest.Mock).mockResolvedValue(mockDB);
    mockDB.getAll.mockResolvedValue([punteado(), importLine()]);
    mockDB.get.mockImplementation(async (store: string, id: number) => {
      if (store === 'movements') return id === 9 ? punteado() : id === 50 ? importLine() : undefined;
      if (store === 'treasuryEvents' && id === 700) {
        return { id: 700, movementId: 9, executedMovementId: 9, type: 'expense', amount: -98.44 };
      }
      return undefined;
    });
    mockDB.put.mockResolvedValue(undefined);
    mockDB.delete.mockResolvedValue(undefined);
  });

  it('colapsa el par · borra el confirmado y sube la línea del import a conciliado', async () => {
    const n = await reconciliarDuplicadosExistentes();
    expect(n).toBe(1);
    // La línea del import sube a conciliado heredando la clasificación.
    const putMov = mockDB.put.mock.calls.find((c) => c[0] === 'movements')![1];
    expect(putMov.id).toBe(50);
    expect(putMov.unifiedStatus).toBe('conciliado');
    expect(putMov.categoryKey).toBe('inmueble.comunidad');
    // El evento se re-apunta a la línea del import.
    const putEv = mockDB.put.mock.calls.find((c) => c[0] === 'treasuryEvents')![1];
    expect(putEv.movementId).toBe(50);
    // El confirmado se borra.
    expect(mockDB.delete).toHaveBeenCalledWith('movements', 9);
  });
});
