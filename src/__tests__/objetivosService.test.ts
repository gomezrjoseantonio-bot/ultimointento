// Tests para objetivosService (Mi Plan v3) — store 'objetivos' (lista)

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
  createObjetivo,
  getObjetivo,
  listObjetivos,
  updateObjetivo,
  archiveObjetivo,
  deleteObjetivo,
  getObjetivosByFondo,
  getObjetivosByPrestamo,
} from '../services/objetivosService';
import { initDB } from '../services/db';

// Fecha futura para usar en tests
const FUTURO = '2099-12-31';

describe('objetivosService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (initDB as jest.Mock).mockResolvedValue(mockDB);
    // Por defecto, getFondo y getPrestamo retornan objetos válidos (FK existe)
    mockDB.get.mockImplementation((store: string, id: unknown) => {
      if (store === 'fondos_ahorro') return Promise.resolve({ id, nombre: 'Test Fondo' });
      if (store === 'prestamos') return Promise.resolve({ id, nombre: 'Test Préstamo' });
      if (store === 'objetivos') return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });
    mockDB.put.mockResolvedValue(undefined);
    mockDB.getAll.mockResolvedValue([]);
    mockDB.getAllFromIndex.mockResolvedValue([]);
    mockDB.delete.mockResolvedValue(undefined);
  });

  // ── createObjetivo ──────────────────────────────────────────────────────────

  describe('createObjetivo - tipo acumular', () => {
    it('crea objetivo acumular con todos los campos', async () => {
      const result = await createObjetivo({
        tipo: 'acumular',
        nombre: 'Colchón de emergencia',
        fechaCierre: FUTURO,
        estado: 'en-progreso',
        metaCantidad: 10000,
        fondoId: 'fondo-uuid-1',
      });

      expect(result.id).toBeTruthy();
      expect(result.tipo).toBe('acumular');
      expect(result.nombre).toBe('Colchón de emergencia');
      expect(result.metaCantidad).toBe(10000);
      expect(result.fondoId).toBe('fondo-uuid-1');
      expect(result.createdAt).toBeTruthy();
      expect(result.updatedAt).toBeTruthy();
      expect(mockDB.put).toHaveBeenCalledWith('objetivos', expect.objectContaining({ tipo: 'acumular' }));
    });
  });

  describe('createObjetivo - tipo amortizar', () => {
    it('crea objetivo amortizar con prestamoId FK válido', async () => {
      const result = await createObjetivo({
        tipo: 'amortizar',
        nombre: 'Amortizar hipoteca',
        fechaCierre: FUTURO,
        estado: 'en-progreso',
        metaCantidad: 50000,
        prestamoId: 'prestamo-uuid-1',
      });

      expect(result.tipo).toBe('amortizar');
      expect(result.prestamoId).toBe('prestamo-uuid-1');
    });
  });

  describe('createObjetivo - tipo comprar', () => {
    it('crea objetivo comprar con capacidadEndeudamientoEsperada opcional', async () => {
      const result = await createObjetivo({
        tipo: 'comprar',
        nombre: 'Comprar piso',
        fechaCierre: FUTURO,
        estado: 'en-progreso',
        metaCantidad: 80000,
        fondoId: 'fondo-uuid-2',
        capacidadEndeudamientoEsperada: 200000,
      });

      expect(result.tipo).toBe('comprar');
      expect(result.capacidadEndeudamientoEsperada).toBe(200000);
    });

    it('crea objetivo comprar sin capacidadEndeudamientoEsperada', async () => {
      const result = await createObjetivo({
        tipo: 'comprar',
        nombre: 'Comprar piso sin capacidad',
        fechaCierre: FUTURO,
        estado: 'en-progreso',
        metaCantidad: 50000,
        fondoId: 'fondo-uuid-2',
      });

      expect(result.tipo).toBe('comprar');
      expect((result as any).capacidadEndeudamientoEsperada).toBeUndefined();
    });
  });

  describe('createObjetivo - tipo reducir', () => {
    it('crea objetivo reducir con categoriaGasto', async () => {
      const result = await createObjetivo({
        tipo: 'reducir',
        nombre: 'Reducir suscripciones',
        fechaCierre: FUTURO,
        estado: 'en-progreso',
        metaCantidadMensual: 50,
        categoriaGasto: 'suscripciones',
      });

      expect(result.tipo).toBe('reducir');
      expect(result.metaCantidadMensual).toBe(50);
      expect(result.categoriaGasto).toBe('suscripciones');
    });
  });

  // ── Validaciones ────────────────────────────────────────────────────────────

  describe('validaciones', () => {
    it('rechaza fechaCierre pasada', async () => {
      await expect(
        createObjetivo({
          tipo: 'acumular',
          nombre: 'Test',
          fechaCierre: '2020-01-01',
          estado: 'en-progreso',
          metaCantidad: 1000,
          fondoId: 'fondo-1',
        }),
      ).rejects.toThrow('fechaCierre no puede ser una fecha pasada');
    });

    it("rechaza tipo='acumular' sin fondoId", async () => {
      await expect(
        createObjetivo({
          tipo: 'acumular',
          nombre: 'Test sin fondo',
          fechaCierre: FUTURO,
          estado: 'en-progreso',
          metaCantidad: 5000,
          fondoId: '',
        } as any),
      ).rejects.toThrow("tipo='acumular' requiere fondoId");
    });

    it('rechaza fondoId inexistente', async () => {
      mockDB.get.mockImplementation((store: string) => {
        if (store === 'fondos_ahorro') return Promise.resolve(undefined);
        return Promise.resolve(undefined);
      });

      await expect(
        createObjetivo({
          tipo: 'acumular',
          nombre: 'FK fallo',
          fechaCierre: FUTURO,
          estado: 'en-progreso',
          metaCantidad: 1000,
          fondoId: 'fondo-inexistente',
        }),
      ).rejects.toThrow("no existe en fondos_ahorro");
    });

    it('rechaza metaCantidad <= 0', async () => {
      await expect(
        createObjetivo({
          tipo: 'acumular',
          nombre: 'Sin meta',
          fechaCierre: FUTURO,
          estado: 'en-progreso',
          metaCantidad: 0,
          fondoId: 'fondo-uuid-1',
        }),
      ).rejects.toThrow('metaCantidad debe ser > 0');
    });
  });

  // ── getObjetivo ─────────────────────────────────────────────────────────────

  describe('getObjetivo', () => {
    it('retorna el objetivo por id', async () => {
      const stored = {
        id: 'obj-1', tipo: 'acumular', nombre: 'Test', fondoId: 'f1',
        metaCantidad: 1000, estado: 'en-progreso', fechaCierre: FUTURO,
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      };
      mockDB.get.mockImplementation((store: string, id: unknown) => {
        if (store === 'objetivos' && id === 'obj-1') return Promise.resolve(stored);
        return Promise.resolve(undefined);
      });

      const result = await getObjetivo('obj-1');
      expect(result?.id).toBe('obj-1');
    });

    it('retorna undefined si no existe', async () => {
      mockDB.get.mockResolvedValue(undefined);
      const result = await getObjetivo('no-existe');
      expect(result).toBeUndefined();
    });
  });

  // ── listObjetivos ───────────────────────────────────────────────────────────

  describe('listObjetivos', () => {
    it('filtra por estado en-progreso', async () => {
      mockDB.getAll.mockResolvedValue([
        { id: '1', tipo: 'acumular', estado: 'en-progreso', fondoId: 'f1', metaCantidad: 1000, nombre: 'A', fechaCierre: FUTURO, createdAt: '', updatedAt: '' },
        { id: '2', tipo: 'amortizar', estado: 'archivado', prestamoId: 'p1', metaCantidad: 5000, nombre: 'B', fechaCierre: FUTURO, createdAt: '', updatedAt: '' },
      ]);

      const result = await listObjetivos({ estado: 'en-progreso' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });
  });

  // ── updateObjetivo ──────────────────────────────────────────────────────────

  describe('updateObjetivo', () => {
    it('cambia estado y bumps updatedAt', async () => {
      const stored = {
        id: 'obj-1', tipo: 'acumular', nombre: 'Test', fondoId: 'f1',
        metaCantidad: 1000, estado: 'en-progreso', fechaCierre: FUTURO,
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      };
      mockDB.get.mockImplementation((store: string, id: unknown) => {
        if (store === 'objetivos' && id === 'obj-1') return Promise.resolve(stored);
        return Promise.resolve(undefined);
      });
      mockDB.put.mockResolvedValue(undefined);

      const before = new Date().toISOString();
      const result = await updateObjetivo('obj-1', { estado: 'en-riesgo' });

      expect(result.estado).toBe('en-riesgo');
      expect(result.updatedAt >= before).toBe(true);
      expect(result.createdAt).toBe('2026-01-01T00:00:00Z');
    });
  });

  // ── archiveObjetivo / deleteObjetivo ────────────────────────────────────────

  describe('archiveObjetivo y deleteObjetivo', () => {
    it('archivar mantiene el registro', async () => {
      const stored = {
        id: 'obj-1', tipo: 'acumular', nombre: 'Test', fondoId: 'f1',
        metaCantidad: 1000, estado: 'en-progreso', fechaCierre: FUTURO,
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      };
      mockDB.get.mockImplementation((store: string, id: unknown) => {
        if (store === 'objetivos' && id === 'obj-1') return Promise.resolve(stored);
        return Promise.resolve(undefined);
      });
      mockDB.put.mockResolvedValue(undefined);

      await archiveObjetivo('obj-1');
      expect(mockDB.put).toHaveBeenCalledWith('objetivos', expect.objectContaining({ estado: 'archivado' }));
      expect(mockDB.delete).not.toHaveBeenCalled();
    });

    it('delete elimina solo si está archivado', async () => {
      const archived = {
        id: 'obj-arch', tipo: 'acumular', nombre: 'Archivado', fondoId: 'f1',
        metaCantidad: 1000, estado: 'archivado', fechaCierre: FUTURO,
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      };
      mockDB.get.mockImplementation((store: string, id: unknown) => {
        if (store === 'objetivos') return Promise.resolve(archived);
        return Promise.resolve(undefined);
      });
      mockDB.delete.mockResolvedValue(undefined);

      await deleteObjetivo('obj-arch');
      expect(mockDB.delete).toHaveBeenCalledWith('objetivos', 'obj-arch');
    });

    it('delete lanza error si no está archivado', async () => {
      const active = {
        id: 'obj-active', tipo: 'acumular', nombre: 'Activo', fondoId: 'f1',
        metaCantidad: 1000, estado: 'en-progreso', fechaCierre: FUTURO,
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      };
      mockDB.get.mockImplementation((store: string) => {
        if (store === 'objetivos') return Promise.resolve(active);
        return Promise.resolve(undefined);
      });

      await expect(deleteObjetivo('obj-active')).rejects.toThrow('Solo se pueden eliminar objetivos archivados');
    });
  });

  // ── getObjetivosByFondo ─────────────────────────────────────────────────────

  describe('getObjetivosByFondo', () => {
    it('retorna solo objetivos vinculados al fondoId', async () => {
      mockDB.getAllFromIndex.mockResolvedValue([
        { id: '1', tipo: 'acumular', fondoId: 'fondo-x', metaCantidad: 1000, nombre: 'A', estado: 'en-progreso', fechaCierre: FUTURO, createdAt: '', updatedAt: '' },
      ]);

      const result = await getObjetivosByFondo('fondo-x');
      expect(result).toHaveLength(1);
      expect(result[0].fondoId).toBe('fondo-x');
    });
  });

  // ── getObjetivosByPrestamo ──────────────────────────────────────────────────

  describe('getObjetivosByPrestamo', () => {
    it('retorna solo objetivos vinculados al prestamoId', async () => {
      mockDB.getAllFromIndex.mockResolvedValue([
        { id: '2', tipo: 'amortizar', prestamoId: 'prest-y', metaCantidad: 5000, nombre: 'B', estado: 'en-progreso', fechaCierre: FUTURO, createdAt: '', updatedAt: '' },
      ]);

      const result = await getObjetivosByPrestamo('prest-y');
      expect(result).toHaveLength(1);
      expect(result[0].prestamoId).toBe('prest-y');
    });
  });
});
