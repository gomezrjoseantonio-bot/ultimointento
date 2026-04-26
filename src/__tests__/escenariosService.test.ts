// Tests para escenariosService (Mi Plan v3)
// Cubre: migración · lectura · escritura · hitos

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
  getEscenarioActivo,
  saveEscenarioActivo,
  resetEscenario,
  addHito,
  updateHito,
  removeHito,
  listHitos,
  ESCENARIO_DEFAULTS,
} from '../services/escenariosService';
import { initDB } from '../services/db';

describe('escenariosService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (initDB as jest.Mock).mockResolvedValue(mockDB);
  });

  // ── getEscenarioActivo ──────────────────────────────────────────────────────

  describe('getEscenarioActivo', () => {
    it('retorna los defaults cuando el store está vacío', async () => {
      mockDB.get.mockResolvedValue(undefined);
      const result = await getEscenarioActivo();
      expect(result.id).toBe(1);
      expect(result.modoVivienda).toBe('alquiler');
      expect(result.estrategia).toBe('hibrido');
      expect(result.gastosVidaLibertadMensual).toBe(2500);
      expect(result.hitos).toEqual([]);
    });

    it('preserva los 7 campos KPI cuando existen en DB', async () => {
      const stored = {
        id: 1,
        modoVivienda: 'propia',
        gastosVidaLibertadMensual: 3000,
        estrategia: 'conservador',
        hitos: [],
        rentaPasivaObjetivo: 4500,
        patrimonioNetoObjetivo: 750000,
        cajaMinima: 15000,
        dtiMaximo: 30,
        ltvMaximo: 45,
        yieldMinimaCartera: 9,
        tasaAhorroMinima: 20,
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      mockDB.get.mockResolvedValue(stored);
      const result = await getEscenarioActivo();
      expect(result.rentaPasivaObjetivo).toBe(4500);
      expect(result.patrimonioNetoObjetivo).toBe(750000);
      expect(result.cajaMinima).toBe(15000);
      expect(result.dtiMaximo).toBe(30);
      expect(result.ltvMaximo).toBe(45);
      expect(result.yieldMinimaCartera).toBe(9);
      expect(result.tasaAhorroMinima).toBe(20);
      expect(result.modoVivienda).toBe('propia');
      expect(result.estrategia).toBe('conservador');
    });

    it('retorna defaults cuando initDB falla', async () => {
      (initDB as jest.Mock).mockRejectedValueOnce(new Error('DB error'));
      const result = await getEscenarioActivo();
      expect(result.id).toBe(1);
      expect(result.rentaPasivaObjetivo).toBe(ESCENARIO_DEFAULTS.rentaPasivaObjetivo);
    });

    it('garantiza hitos como array aunque la DB tenga null', async () => {
      mockDB.get.mockResolvedValue({ id: 1, hitos: null, updatedAt: '2026-01-01T00:00:00.000Z' });
      const result = await getEscenarioActivo();
      expect(Array.isArray(result.hitos)).toBe(true);
    });
  });

  // ── saveEscenarioActivo ─────────────────────────────────────────────────────

  describe('saveEscenarioActivo', () => {
    it('actualiza campos y bumps updatedAt', async () => {
      mockDB.get.mockResolvedValue({
        id: 1,
        modoVivienda: 'alquiler',
        gastosVidaLibertadMensual: 2500,
        estrategia: 'hibrido',
        hitos: [],
        updatedAt: '2025-01-01T00:00:00.000Z',
      });
      mockDB.put.mockResolvedValue(undefined);

      const before = new Date().toISOString();
      const result = await saveEscenarioActivo({ rentaPasivaObjetivo: 5000 });

      expect(result.rentaPasivaObjetivo).toBe(5000);
      expect(result.id).toBe(1);
      expect(result.updatedAt >= before).toBe(true);
      expect(mockDB.put).toHaveBeenCalledWith('escenarios', expect.objectContaining({
        id: 1,
        rentaPasivaObjetivo: 5000,
      }));
    });

    it('no permite cambiar el id', async () => {
      mockDB.get.mockResolvedValue({ id: 1, hitos: [], updatedAt: '2025-01-01T00:00:00.000Z' });
      mockDB.put.mockResolvedValue(undefined);
      const result = await saveEscenarioActivo({ id: 99 } as any);
      expect(result.id).toBe(1);
    });
  });

  // ── resetEscenario ──────────────────────────────────────────────────────────

  describe('resetEscenario', () => {
    it('restaura los defaults y limpia hitos', async () => {
      mockDB.put.mockResolvedValue(undefined);
      const result = await resetEscenario();
      expect(result.modoVivienda).toBe('alquiler');
      expect(result.estrategia).toBe('hibrido');
      expect(result.gastosVidaLibertadMensual).toBe(2500);
      expect(result.hitos).toEqual([]);
      expect(result.rentaPasivaObjetivo).toBe(3000);
    });
  });

  // ── Hitos ───────────────────────────────────────────────────────────────────

  describe('addHito', () => {
    it('añade un hito con UUID generado', async () => {
      mockDB.get.mockResolvedValue({ id: 1, hitos: [], updatedAt: '2025-01-01T00:00:00.000Z' });
      mockDB.put.mockResolvedValue(undefined);

      const hito = await addHito({
        fecha: '2027-06-01',
        tipo: 'compra',
        impactoMensual: 800,
        descripcion: 'Compra 5º piso',
      });

      expect(hito.id).toBeTruthy();
      expect(hito.tipo).toBe('compra');
      expect(hito.impactoMensual).toBe(800);
      expect(mockDB.put).toHaveBeenCalledWith('escenarios', expect.objectContaining({
        hitos: expect.arrayContaining([expect.objectContaining({ tipo: 'compra' })]),
      }));
    });
  });

  describe('updateHito', () => {
    it('actualiza un hito existente por id', async () => {
      const existingHito = { id: 'hito-1', fecha: '2027-06-01', tipo: 'compra', impactoMensual: 800, descripcion: 'original' };
      mockDB.get.mockResolvedValue({
        id: 1,
        hitos: [existingHito],
        updatedAt: '2025-01-01T00:00:00.000Z',
      });
      mockDB.put.mockResolvedValue(undefined);

      const updated = await updateHito('hito-1', { impactoMensual: 900, descripcion: 'updated' });
      expect(updated.impactoMensual).toBe(900);
      expect(updated.descripcion).toBe('updated');
      expect(updated.id).toBe('hito-1');
    });

    it('lanza error si el hito no existe', async () => {
      mockDB.get.mockResolvedValue({ id: 1, hitos: [], updatedAt: '2025-01-01T00:00:00.000Z' });
      await expect(updateHito('no-existe', { impactoMensual: 100 })).rejects.toThrow(
        "Hito con id 'no-existe' no encontrado",
      );
    });
  });

  describe('removeHito', () => {
    it('elimina un hito del array', async () => {
      const hito1 = { id: 'h1', fecha: '2027-01-01', tipo: 'compra', impactoMensual: 500, descripcion: 'a' };
      const hito2 = { id: 'h2', fecha: '2028-01-01', tipo: 'venta', impactoMensual: -300, descripcion: 'b' };
      mockDB.get.mockResolvedValue({ id: 1, hitos: [hito1, hito2], updatedAt: '2025-01-01T00:00:00.000Z' });
      mockDB.put.mockResolvedValue(undefined);

      await removeHito('h1');

      expect(mockDB.put).toHaveBeenCalledWith('escenarios', expect.objectContaining({
        hitos: [hito2],
      }));
    });
  });

  describe('listHitos', () => {
    it('retorna el array de hitos del escenario activo', async () => {
      const hitos = [
        { id: 'h1', fecha: '2027-01-01', tipo: 'compra', impactoMensual: 500, descripcion: 'a' },
      ];
      mockDB.get.mockResolvedValue({ id: 1, hitos, updatedAt: '2025-01-01T00:00:00.000Z' });

      const result = await listHitos();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('h1');
    });
  });
});
