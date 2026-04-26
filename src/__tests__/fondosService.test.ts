// Tests para fondosService (Mi Plan v3) — store 'fondos_ahorro'

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
  createFondo,
  getFondo,
  listFondos,
  updateFondo,
  archiveFondo,
  reactivateFondo,
  getSaldoActualFondo,
  getDistribucionFondos,
} from '../services/fondosService';
import { initDB } from '../services/db';

describe('fondosService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (initDB as jest.Mock).mockResolvedValue(mockDB);
    mockDB.put.mockResolvedValue(undefined);
    mockDB.getAll.mockResolvedValue([]); // sin fondos existentes por defecto
    mockDB.getAllFromIndex.mockResolvedValue([]);
    mockDB.delete.mockResolvedValue(undefined);
    mockDB.get.mockResolvedValue(undefined);
  });

  // ── createFondo ─────────────────────────────────────────────────────────────

  describe('createFondo', () => {
    it('crea fondo colchon con cuenta en modo completo', async () => {
      const result = await createFondo({
        tipo: 'colchon',
        nombre: 'Colchón emergencia',
        cuentasAsignadas: [{ cuentaId: 1, modo: 'completo' }],
        metaMeses: 6,
      });

      expect(result.id).toBeTruthy();
      expect(result.tipo).toBe('colchon');
      expect(result.activo).toBe(true);
      expect(result.createdAt).toBeTruthy();
      expect(mockDB.put).toHaveBeenCalledWith('fondos_ahorro', expect.objectContaining({ tipo: 'colchon', activo: true }));
    });

    it('crea fondo compra con cuenta parcial fija', async () => {
      const result = await createFondo({
        tipo: 'compra',
        nombre: 'Entrada piso',
        cuentasAsignadas: [{ cuentaId: 2, modo: 'parcial', modoImporte: 'fijo', importeAsignado: 3200 }],
        metaImporte: 80000,
      });

      expect(result.tipo).toBe('compra');
      expect(result.cuentasAsignadas[0]).toMatchObject({ modo: 'parcial', modoImporte: 'fijo', importeAsignado: 3200 });
    });

    it('crea fondo reforma con cuenta parcial porcentaje', async () => {
      const result = await createFondo({
        tipo: 'reforma',
        nombre: 'Reforma baño',
        cuentasAsignadas: [{ cuentaId: 3, modo: 'parcial', modoImporte: 'porcentaje', porcentajeAsignado: 30 }],
      });

      expect(result.tipo).toBe('reforma');
      expect(result.cuentasAsignadas[0]).toMatchObject({ porcentajeAsignado: 30 });
    });
  });

  // ── Validaciones solapamiento ───────────────────────────────────────────────

  describe('validaciones de solapamiento', () => {
    it("rechaza 2 fondos con la misma cuenta en modo 'completo'", async () => {
      // Hay un fondo existente con cuentaId=1 en modo 'completo'
      mockDB.getAll.mockResolvedValue([
        {
          id: 'fondo-existente',
          nombre: 'Fondo Existente',
          tipo: 'colchon',
          activo: true,
          cuentasAsignadas: [{ cuentaId: 1, modo: 'completo' }],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ]);

      await expect(
        createFondo({
          tipo: 'compra',
          nombre: 'Nuevo fondo',
          cuentasAsignadas: [{ cuentaId: 1, modo: 'completo' }],
        }),
      ).rejects.toThrow("ya está asignada en modo 'completo'");
    });

    it('rechaza suma de porcentajes >100 sobre la misma cuenta', async () => {
      mockDB.getAll.mockResolvedValue([
        {
          id: 'fondo-pct',
          nombre: 'Fondo 70%',
          tipo: 'colchon',
          activo: true,
          cuentasAsignadas: [{ cuentaId: 5, modo: 'parcial', modoImporte: 'porcentaje', porcentajeAsignado: 70 }],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ]);

      await expect(
        createFondo({
          tipo: 'reforma',
          nombre: 'Fondo 40%',
          cuentasAsignadas: [{ cuentaId: 5, modo: 'parcial', modoImporte: 'porcentaje', porcentajeAsignado: 40 }],
        }),
      ).rejects.toThrow('superaría el 100%');
    });
  });

  // ── getSaldoActualFondo ─────────────────────────────────────────────────────

  describe('getSaldoActualFondo', () => {
    it('modo completo: retorna el saldo total de la cuenta', async () => {
      const fondo = {
        id: 'f1', tipo: 'colchon', nombre: 'Test', activo: true,
        cuentasAsignadas: [{ cuentaId: 10, modo: 'completo' }],
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      };
      mockDB.get.mockImplementation((store: string, id: unknown) => {
        if (store === 'fondos_ahorro' && id === 'f1') return Promise.resolve(fondo);
        if (store === 'accounts' && id === 10) return Promise.resolve({ id: 10, openingBalance: 15000 });
        return Promise.resolve(undefined);
      });

      const saldo = await getSaldoActualFondo('f1');
      expect(saldo).toBe(15000);
    });

    it('modo parcial fijo: retorna importeAsignado', async () => {
      const fondo = {
        id: 'f2', tipo: 'compra', nombre: 'Test', activo: true,
        cuentasAsignadas: [{ cuentaId: 11, modo: 'parcial', modoImporte: 'fijo', importeAsignado: 3200 }],
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      };
      mockDB.get.mockImplementation((store: string, id: unknown) => {
        if (store === 'fondos_ahorro' && id === 'f2') return Promise.resolve(fondo);
        if (store === 'accounts') return Promise.resolve({ openingBalance: 50000 });
        return Promise.resolve(undefined);
      });

      const saldo = await getSaldoActualFondo('f2');
      expect(saldo).toBe(3200);
    });

    it('modo parcial porcentaje 30% sobre cuenta de 10000 → saldo 3000', async () => {
      const fondo = {
        id: 'f3', tipo: 'reforma', nombre: 'Test', activo: true,
        cuentasAsignadas: [{ cuentaId: 12, modo: 'parcial', modoImporte: 'porcentaje', porcentajeAsignado: 30 }],
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      };
      mockDB.get.mockImplementation((store: string, id: unknown) => {
        if (store === 'fondos_ahorro' && id === 'f3') return Promise.resolve(fondo);
        if (store === 'accounts' && id === 12) return Promise.resolve({ openingBalance: 10000 });
        return Promise.resolve(undefined);
      });

      const saldo = await getSaldoActualFondo('f3');
      expect(saldo).toBe(3000);
    });
  });

  // ── archiveFondo / reactivateFondo ──────────────────────────────────────────

  describe('archiveFondo y reactivateFondo', () => {
    it('archiveFondo pone activo=false', async () => {
      const fondo = { id: 'f4', tipo: 'capricho', nombre: 'Test', activo: true, cuentasAsignadas: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
      mockDB.get.mockResolvedValue(fondo);

      await archiveFondo('f4');
      expect(mockDB.put).toHaveBeenCalledWith('fondos_ahorro', expect.objectContaining({ activo: false }));
    });

    it('reactivateFondo pone activo=true', async () => {
      const fondo = { id: 'f5', tipo: 'capricho', nombre: 'Test', activo: false, cuentasAsignadas: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
      mockDB.get.mockResolvedValue(fondo);

      await reactivateFondo('f5');
      expect(mockDB.put).toHaveBeenCalledWith('fondos_ahorro', expect.objectContaining({ activo: true }));
    });
  });

  // ── getDistribucionFondos ───────────────────────────────────────────────────

  describe('getDistribucionFondos', () => {
    it('calcula sinProposito correctamente con 4 fondos activos y cuenta sin asignar', async () => {
      // 4 fondos activos con importes fijos
      const fondos = [
        { id: 'f1', tipo: 'colchon', nombre: 'F1', activo: true, cuentasAsignadas: [{ cuentaId: 1, modo: 'parcial', modoImporte: 'fijo', importeAsignado: 1000 }], createdAt: '', updatedAt: '' },
        { id: 'f2', tipo: 'compra', nombre: 'F2', activo: true, cuentasAsignadas: [{ cuentaId: 1, modo: 'parcial', modoImporte: 'fijo', importeAsignado: 2000 }], createdAt: '', updatedAt: '' },
        { id: 'f3', tipo: 'reforma', nombre: 'F3', activo: true, cuentasAsignadas: [{ cuentaId: 2, modo: 'parcial', modoImporte: 'fijo', importeAsignado: 500 }], createdAt: '', updatedAt: '' },
        { id: 'f4', tipo: 'impuestos', nombre: 'F4', activo: true, cuentasAsignadas: [{ cuentaId: 2, modo: 'parcial', modoImporte: 'fijo', importeAsignado: 300 }], createdAt: '', updatedAt: '' },
      ];

      mockDB.getAll.mockImplementation((store: string) => {
        if (store === 'fondos_ahorro') return Promise.resolve(fondos);
        if (store === 'accounts') return Promise.resolve([
          { id: 1, activa: true, openingBalance: 10000 },
          { id: 2, activa: true, openingBalance: 5000 },
          { id: 3, activa: true, openingBalance: 3000 }, // cuenta sin propósito
        ]);
        return Promise.resolve([]);
      });
      mockDB.get.mockImplementation((store: string, id: unknown) => {
        if (store === 'fondos_ahorro') return Promise.resolve(fondos.find((f) => f.id === id));
        if (store === 'accounts' && id === 1) return Promise.resolve({ openingBalance: 10000 });
        if (store === 'accounts' && id === 2) return Promise.resolve({ openingBalance: 5000 });
        return Promise.resolve(undefined);
      });

      const dist = await getDistribucionFondos();

      // Total de cuentas: 10000 + 5000 + 3000 = 18000
      // Asignado: 1000 + 2000 + 500 + 300 = 3800
      // sinProposito: 18000 - 3800 = 14200
      expect(dist.total).toBe(18000);
      expect(dist.porFondo).toHaveLength(4);
      expect(dist.sinProposito).toBe(14200);
    });
  });
});
