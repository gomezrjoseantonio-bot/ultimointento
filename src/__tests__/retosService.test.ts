// Tests para retosService (Mi Plan v3) — store 'retos'

const mockDB = {
  get: jest.fn(),
  put: jest.fn(),
  getAll: jest.fn(),
  getAllFromIndex: jest.fn(),
  getFromIndex: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../services/db', () => ({
  initDB: jest.fn(() => Promise.resolve(mockDB)),
}));

import {
  createReto,
  getReto,
  getRetoByMes,
  listRetos,
  updateReto,
  deleteReto,
  getRetoActivo,
  getRetosUltimos12Meses,
  cerrarReto,
} from '../services/retosService';
import { initDB } from '../services/db';

describe('retosService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (initDB as jest.Mock).mockResolvedValue(mockDB);
    mockDB.put.mockResolvedValue(undefined);
    mockDB.getAll.mockResolvedValue([]);
    mockDB.getAllFromIndex.mockResolvedValue([]);
    mockDB.getFromIndex.mockResolvedValue(undefined);
    mockDB.delete.mockResolvedValue(undefined);
    mockDB.get.mockResolvedValue(undefined);
  });

  // ── createReto ──────────────────────────────────────────────────────────────

  describe('createReto', () => {
    it('crea reto activo para abril 2026', async () => {
      const result = await createReto({
        tipo: 'ahorro',
        mes: '2026-04',
        titulo: 'Ahorrar 500€ este mes',
        metaCantidad: 500,
        estado: 'activo',
      });

      expect(result.id).toBeTruthy();
      expect(result.mes).toBe('2026-04');
      expect(result.tipo).toBe('ahorro');
      expect(result.estado).toBe('activo');
      expect(result.origenSugerencia).toBe('usuario');
      expect(result.createdAt).toBeTruthy();
      expect(mockDB.put).toHaveBeenCalledWith('retos', expect.objectContaining({ mes: '2026-04', estado: 'activo' }));
    });

    it('crea retos de los 4 tipos distintos', async () => {
      const tipos = ['ahorro', 'ejecucion', 'disciplina', 'revision'] as const;
      for (const tipo of tipos) {
        const extra: Record<string, unknown> = {};
        if (tipo === 'ahorro' || tipo === 'ejecucion') extra.metaCantidad = 100;
        if (tipo === 'revision') extra.metaBinaria = true;

        const result = await createReto({
          tipo,
          mes: `2099-${String(tipos.indexOf(tipo) + 1).padStart(2, '0')}`,
          titulo: `Reto ${tipo}`,
          estado: 'futuro',
          ...extra,
        });
        expect(result.tipo).toBe(tipo);
      }
    });

    it('asigna origenSugerencia=usuario por defecto', async () => {
      const result = await createReto({
        tipo: 'disciplina',
        mes: '2099-05',
        titulo: 'No gastar en caprichos',
        estado: 'futuro',
      });
      expect(result.origenSugerencia).toBe('usuario');
    });
  });

  // ── Validaciones ────────────────────────────────────────────────────────────

  describe('validaciones', () => {
    it('rechaza mes con formato incorrecto', async () => {
      await expect(
        createReto({
          tipo: 'ahorro',
          mes: '26-04',
          titulo: 'Formato malo',
          metaCantidad: 100,
          estado: 'futuro',
        }),
      ).rejects.toThrow('mes debe tener formato YYYY-MM');
    });

    it('rechaza mes con formato YYYY-MM-DD (demasiado largo)', async () => {
      await expect(
        createReto({
          tipo: 'ahorro',
          mes: '2026-04-01',
          titulo: 'Formato largo',
          metaCantidad: 100,
          estado: 'futuro',
        }),
      ).rejects.toThrow('mes debe tener formato YYYY-MM');
    });

    it("tipo='ahorro' requiere metaCantidad", async () => {
      await expect(
        createReto({
          tipo: 'ahorro',
          mes: '2099-06',
          titulo: 'Sin meta',
          estado: 'futuro',
        }),
      ).rejects.toThrow("tipo='ahorro' requiere metaCantidad");
    });

    it("tipo='revision' requiere metaBinaria", async () => {
      await expect(
        createReto({
          tipo: 'revision',
          mes: '2099-07',
          titulo: 'Sin binaria',
          estado: 'futuro',
        }),
      ).rejects.toThrow("tipo='revision' requiere metaBinaria");
    });

    it('impide crear 2º reto activo mientras hay otro activo', async () => {
      // Hay un reto activo para 2026-04
      mockDB.getAll.mockResolvedValue([
        {
          id: 'reto-activo', tipo: 'ahorro', mes: '2026-04', titulo: 'Activo',
          metaCantidad: 100, estado: 'activo', createdAt: '', updatedAt: '',
        },
      ]);

      await expect(
        createReto({
          tipo: 'disciplina',
          mes: '2026-05',
          titulo: 'Segundo activo',
          estado: 'activo',
        }),
      ).rejects.toThrow('Ya existe un reto activo');
    });
  });

  // ── ConstraintError (mes UNIQUE) ────────────────────────────────────────────

  describe('ConstraintError mes UNIQUE', () => {
    it('traduce ConstraintError a mensaje útil', async () => {
      const constraintError = new Error('ConstraintError');
      constraintError.name = 'ConstraintError';
      mockDB.put.mockRejectedValueOnce(constraintError);

      await expect(
        createReto({
          tipo: 'disciplina',
          mes: '2026-06',
          titulo: 'Duplicado',
          estado: 'futuro',
        }),
      ).rejects.toThrow("Ya existe un reto para el mes '2026-06'");
    });
  });

  // ── getRetoByMes ─────────────────────────────────────────────────────────────

  describe('getRetoByMes', () => {
    it('retorna el reto para 2026-04', async () => {
      const stored = {
        id: 'reto-1', tipo: 'ahorro', mes: '2026-04', titulo: 'Test', metaCantidad: 100,
        estado: 'activo', createdAt: '', updatedAt: '',
      };
      mockDB.getFromIndex.mockResolvedValue(stored);

      const result = await getRetoByMes('2026-04');
      expect(result?.mes).toBe('2026-04');
    });

    it('retorna undefined si no hay reto para ese mes', async () => {
      mockDB.getFromIndex.mockResolvedValue(undefined);
      const result = await getRetoByMes('2099-12');
      expect(result).toBeUndefined();
    });
  });

  // ── getRetosUltimos12Meses ──────────────────────────────────────────────────

  describe('getRetosUltimos12Meses', () => {
    it('retorna retos ordenados cronológicamente', async () => {
      const retos = [
        { id: '3', mes: '2025-12', tipo: 'ahorro', metaCantidad: 100, titulo: 'C', estado: 'completado', createdAt: '', updatedAt: '' },
        { id: '1', mes: '2025-10', tipo: 'ahorro', metaCantidad: 100, titulo: 'A', estado: 'fallado', createdAt: '', updatedAt: '' },
        { id: '2', mes: '2025-11', tipo: 'disciplina', titulo: 'B', estado: 'completado', createdAt: '', updatedAt: '' },
      ];
      // listRetos usa getAll y filtra por mes range
      mockDB.getAll.mockResolvedValue(retos);

      const result = await getRetosUltimos12Meses();
      // Debe estar ordenado cronológicamente
      for (let i = 1; i < result.length; i++) {
        expect(result[i].mes >= result[i - 1].mes).toBe(true);
      }
    });
  });

  // ── cerrarReto ───────────────────────────────────────────────────────────────

  describe('cerrarReto', () => {
    it('cierra con resultado completado y guarda notasCierre', async () => {
      const stored = {
        id: 'reto-2', tipo: 'ahorro', mes: '2026-04', titulo: 'Ahorrar 300€',
        metaCantidad: 300, estado: 'activo', createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
      };
      mockDB.get.mockResolvedValue(stored);
      mockDB.put.mockResolvedValue(undefined);

      const result = await cerrarReto('reto-2', 'completado', 'meta superada');

      expect(result.estado).toBe('completado');
      expect(result.notasCierre).toBe('meta superada');
    });
  });

  // ── deleteReto ───────────────────────────────────────────────────────────────

  describe('deleteReto', () => {
    it('elimina el reto por id', async () => {
      const stored = { id: 'reto-3', tipo: 'disciplina', mes: '2099-01', titulo: 'Del', estado: 'futuro', createdAt: '', updatedAt: '' };
      mockDB.get.mockResolvedValue(stored);

      await deleteReto('reto-3');
      expect(mockDB.delete).toHaveBeenCalledWith('retos', 'reto-3');
    });

    it('lanza error si el reto no existe', async () => {
      mockDB.get.mockResolvedValue(undefined);
      await expect(deleteReto('no-existe')).rejects.toThrow("Reto con id 'no-existe' no encontrado");
    });
  });
});
