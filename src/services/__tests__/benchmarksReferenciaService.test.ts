// Tests · benchmarksReferenciaService (PR 2 · spec §11 fila 3).
// CRUD básico + precarga inicial + update valor anual.

// ── Mock IndexedDB (idb wrapper) ──────────────────────────────────────────────
// Soporte para tanto el path directo (db.get/put/...) como el path con
// transacciones multi-store (db.transaction([...]).objectStore(...)).
// Las funciones del store delegan a las mismas jest.fn del mockDB · una sola
// fuente de verdad.

const mockDB: any = {
  get: jest.fn(),
  put: jest.fn(),
  getAll: jest.fn(),
  getFromIndex: jest.fn(),
  delete: jest.fn(),
  transaction: jest.fn(),
};

function buildStoreWrapper(storeName: string) {
  return {
    get: jest.fn((key: unknown) => mockDB.get(storeName, key)),
    put: jest.fn((value: unknown, key?: unknown) =>
      key !== undefined ? mockDB.put(storeName, value, key) : mockDB.put(storeName, value),
    ),
    delete: jest.fn((key: unknown) => mockDB.delete(storeName, key)),
    index: jest.fn((indexName: string) => ({
      get: jest.fn((value: unknown) => mockDB.getFromIndex(storeName, indexName, value)),
    })),
  };
}

function setupTxMock() {
  mockDB.transaction.mockImplementation((stores: string[]) => {
    const wrappers: Record<string, ReturnType<typeof buildStoreWrapper>> = {};
    for (const name of stores) wrappers[name] = buildStoreWrapper(name);
    return {
      objectStore: (name: string) => wrappers[name],
      done: Promise.resolve(),
    };
  });
}

jest.mock('../db', () => ({
  initDB: jest.fn(() => Promise.resolve(mockDB)),
}));

import {
  createBenchmark,
  deleteBenchmark,
  deleteValorAnual,
  getBenchmark,
  getBenchmarkByCodigo,
  listBenchmarks,
  restaurarSeedV72,
  runMigration_v72,
  setValorAnual,
  todosVacios,
  updateBenchmark,
  vaciosEnLista,
} from '../benchmarksReferenciaService';
import { SEED_BENCHMARKS_V72 } from '../../data/seeds/benchmarksReferencia';
import type { BenchmarkReferencia } from '../../types/benchmarksReferencia';
import { initDB } from '../db';

const mockBench = (
  patch: Partial<BenchmarkReferencia> = {},
): BenchmarkReferencia => ({
  id: 'b-1',
  codigo: 'MSCI_WORLD_EUR',
  nombre: 'MSCI World EUR',
  tipo: 'indice_equity',
  divisa: 'EUR',
  descripcion: 'mock',
  valoresAnuales: { 2023: 22.0, 2024: 18.7 },
  ultimaActualizacion: '2024-12-31',
  fechaCreacion: '2024-01-01T00:00:00.000Z',
  fechaModificacion: '2024-12-31T00:00:00.000Z',
  ...patch,
});

beforeEach(() => {
  jest.clearAllMocks();
  (initDB as jest.Mock).mockResolvedValue(mockDB);
  mockDB.get.mockResolvedValue(undefined);
  mockDB.put.mockResolvedValue(undefined);
  mockDB.getAll.mockResolvedValue([]);
  mockDB.getFromIndex.mockResolvedValue(undefined);
  mockDB.delete.mockResolvedValue(undefined);
  setupTxMock();
});

describe('benchmarksReferenciaService · lectura', () => {
  test('listBenchmarks · ordena por tipo y luego codigo', async () => {
    mockDB.getAll.mockResolvedValueOnce([
      mockBench({ id: 'b-3', codigo: 'CPI_ES', tipo: 'inflacion' }),
      mockBench({ id: 'b-2', codigo: 'SP500_EUR', tipo: 'indice_equity' }),
      mockBench({ id: 'b-1', codigo: 'MSCI_WORLD_EUR', tipo: 'indice_equity' }),
    ]);
    const lista = await listBenchmarks();
    expect(lista.map((b) => b.codigo)).toEqual(['MSCI_WORLD_EUR', 'SP500_EUR', 'CPI_ES']);
  });

  test('getBenchmark · delega a db.get(\'benchmarksReferencia\', id)', async () => {
    mockDB.get.mockResolvedValueOnce(mockBench({ id: 'b-7' }));
    const b = await getBenchmark('b-7');
    expect(mockDB.get).toHaveBeenCalledWith('benchmarksReferencia', 'b-7');
    expect(b?.id).toBe('b-7');
  });

  test('getBenchmarkByCodigo · usa índice codigo', async () => {
    mockDB.getFromIndex.mockResolvedValueOnce(mockBench({ codigo: 'CPI_ES' }));
    const b = await getBenchmarkByCodigo('CPI_ES');
    expect(mockDB.getFromIndex).toHaveBeenCalledWith('benchmarksReferencia', 'codigo', 'CPI_ES');
    expect(b?.codigo).toBe('CPI_ES');
  });
});

describe('benchmarksReferenciaService · createBenchmark', () => {
  test('crea con metadata + valoresAnuales vacíos · ultimaActualizacion null', async () => {
    mockDB.getFromIndex.mockResolvedValueOnce(undefined);
    const b = await createBenchmark({
      codigo: 'MSCI_EM_EUR',
      nombre: 'MSCI Emerging Markets EUR',
      tipo: 'indice_equity',
      divisa: 'EUR',
    });
    expect(b.codigo).toBe('MSCI_EM_EUR');
    expect(b.valoresAnuales).toEqual({});
    expect(b.ultimaActualizacion).toBeNull();
    expect(b.id).toBeTruthy();
    expect(mockDB.put).toHaveBeenCalledWith(
      'benchmarksReferencia',
      expect.objectContaining({ codigo: 'MSCI_EM_EUR' }),
    );
  });

  test('crea con valores · ultimaActualizacion = hoy ISO date', async () => {
    mockDB.getFromIndex.mockResolvedValueOnce(undefined);
    const b = await createBenchmark({
      codigo: 'TEST_OK',
      nombre: 'Test',
      tipo: 'inflacion',
      divisa: 'EUR',
      valoresAnuales: { 2024: 3.1 },
    });
    expect(b.ultimaActualizacion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('rechaza código duplicado', async () => {
    mockDB.getFromIndex.mockResolvedValueOnce(mockBench({ codigo: 'MSCI_WORLD_EUR' }));
    await expect(
      createBenchmark({
        codigo: 'MSCI_WORLD_EUR',
        nombre: 'Otro',
        tipo: 'indice_equity',
        divisa: 'EUR',
      }),
    ).rejects.toThrow(/Ya existe/);
  });

  test('rechaza código vacío', async () => {
    await expect(
      createBenchmark({ codigo: '', nombre: 'x', tipo: 'inflacion', divisa: 'EUR' }),
    ).rejects.toThrow(/codigo/);
  });

  test('normaliza codigo (trim + upper) y divisa (upper) antes de lookup y persist', async () => {
    mockDB.getFromIndex.mockResolvedValueOnce(undefined);
    const b = await createBenchmark({
      codigo: '  msci_em_eur  ',
      nombre: 'MSCI EM',
      tipo: 'indice_equity',
      divisa: 'eur',
    });
    expect(b.codigo).toBe('MSCI_EM_EUR');
    expect(b.divisa).toBe('EUR');
    // El lookup también usó el código normalizado · evita falsos negativos
    // que terminarían en ConstraintError en el put.
    expect(mockDB.getFromIndex).toHaveBeenCalledWith(
      'benchmarksReferencia',
      'codigo',
      'MSCI_EM_EUR',
    );
  });
});

describe('benchmarksReferenciaService · updateBenchmark + valores', () => {
  test('updateBenchmark · merge de campos · conserva valoresAnuales', async () => {
    const actual = mockBench({ nombre: 'Original', valoresAnuales: { 2024: 5 } });
    mockDB.get.mockResolvedValueOnce(actual);
    const r = await updateBenchmark(actual.id, { nombre: 'Nuevo nombre' });
    expect(r.nombre).toBe('Nuevo nombre');
    expect(r.valoresAnuales).toEqual({ 2024: 5 });
    expect(r.fechaModificacion).not.toBe(actual.fechaModificacion);
  });

  test('updateBenchmark · benchmark inexistente · error', async () => {
    mockDB.get.mockResolvedValueOnce(undefined);
    await expect(updateBenchmark('no-existe', { nombre: 'x' })).rejects.toThrow(/no encontrado/);
  });

  test('updateBenchmark · fuenteUrl="" limpia el campo (→ undefined)', async () => {
    const actual = mockBench({ fuenteUrl: 'https://old.com' });
    mockDB.get.mockResolvedValueOnce(actual);
    const r = await updateBenchmark(actual.id, { fuenteUrl: '' });
    expect(r.fuenteUrl).toBeUndefined();
  });

  test('updateBenchmark · fuenteUrl no en patch · mantiene valor actual', async () => {
    const actual = mockBench({ fuenteUrl: 'https://old.com' });
    mockDB.get.mockResolvedValueOnce(actual);
    const r = await updateBenchmark(actual.id, { nombre: 'Otro nombre' });
    expect(r.fuenteUrl).toBe('https://old.com');
  });

  test('updateBenchmark · notaInterna="" limpia el campo', async () => {
    const actual = mockBench({ notaInterna: 'nota previa' });
    mockDB.get.mockResolvedValueOnce(actual);
    const r = await updateBenchmark(actual.id, { notaInterna: '' });
    expect(r.notaInterna).toBeUndefined();
  });

  test('updateBenchmark · divisa vacía · ignorada (mantiene actual)', async () => {
    const actual = mockBench({ divisa: 'EUR' });
    mockDB.get.mockResolvedValueOnce(actual);
    const r = await updateBenchmark(actual.id, { divisa: '   ' });
    expect(r.divisa).toBe('EUR');
  });

  test('setValorAnual · añade año · actualiza ultimaActualizacion', async () => {
    const actual = mockBench({ valoresAnuales: { 2023: 22 } });
    mockDB.get.mockResolvedValueOnce(actual);
    const r = await setValorAnual(actual.id, 2024, 18.7);
    expect(r.valoresAnuales).toEqual({ 2023: 22, 2024: 18.7 });
    expect(r.ultimaActualizacion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('setValorAnual · año fuera de rango · error', async () => {
    await expect(setValorAnual('b-1', 1700, 5)).rejects.toThrow(/año/);
  });

  test('setValorAnual · valor no numérico · error', async () => {
    await expect(setValorAnual('b-1', 2024, Infinity)).rejects.toThrow(/valorPct/);
  });

  test('deleteValorAnual · borra el año · si quedan otros conserva ultimaActualizacion', async () => {
    const actual = mockBench({ valoresAnuales: { 2023: 22, 2024: 18.7 } });
    mockDB.get.mockResolvedValueOnce(actual);
    const r = await deleteValorAnual(actual.id, 2023);
    expect(r.valoresAnuales).toEqual({ 2024: 18.7 });
    expect(r.ultimaActualizacion).not.toBeNull();
  });

  test('deleteValorAnual · borra el último · ultimaActualizacion = null', async () => {
    const actual = mockBench({ valoresAnuales: { 2024: 18.7 } });
    mockDB.get.mockResolvedValueOnce(actual);
    const r = await deleteValorAnual(actual.id, 2024);
    expect(r.valoresAnuales).toEqual({});
    expect(r.ultimaActualizacion).toBeNull();
  });

  test('deleteBenchmark · delega a db.delete', async () => {
    await deleteBenchmark('b-9');
    expect(mockDB.delete).toHaveBeenCalledWith('benchmarksReferencia', 'b-9');
  });
});

describe('benchmarksReferenciaService · runMigration_v72 (idempotente)', () => {
  test('flag ausente · inserta los 6 seeds · pone flag', async () => {
    mockDB.get.mockImplementation((store, key) => {
      if (store === 'keyval' && key === 'migration_v72_benchmarksReferencia_v1') {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(undefined);
    });
    mockDB.getFromIndex.mockResolvedValue(undefined); // ningún seed ya existe

    const r = await runMigration_v72();
    expect(r.ejecutada).toBe(true);
    expect(r.insertados).toBe(SEED_BENCHMARKS_V72.length);
    // 6 inserts en benchmarksReferencia + 1 flag put en keyval
    expect(mockDB.put).toHaveBeenCalledTimes(SEED_BENCHMARKS_V72.length + 1);
    expect(mockDB.put).toHaveBeenCalledWith(
      'keyval',
      expect.objectContaining({ ejecutada: expect.any(String) }),
      'migration_v72_benchmarksReferencia_v1',
    );
  });

  test('flag presente · no hace nada', async () => {
    mockDB.get.mockResolvedValueOnce({ ejecutada: '2026-01-01T00:00:00.000Z', seedCount: 6 });
    const r = await runMigration_v72();
    expect(r.ejecutada).toBe(false);
    expect(r.insertados).toBe(0);
    expect(mockDB.put).not.toHaveBeenCalled();
  });

  test('flag ausente pero seed ya existe (manual prev) · no duplica', async () => {
    mockDB.get.mockResolvedValueOnce(undefined); // flag ausente
    // Cada llamada a getFromIndex devuelve "ya existe"
    mockDB.getFromIndex.mockResolvedValue(mockBench());
    const r = await runMigration_v72();
    expect(r.ejecutada).toBe(true);
    expect(r.insertados).toBe(0);
    // Solo un put · el del flag (ninguno del seed)
    expect(mockDB.put).toHaveBeenCalledTimes(1);
  });

  test('ConstraintError en un put · no aborta · sigue con el resto', async () => {
    mockDB.get.mockResolvedValueOnce(undefined); // flag ausente
    // Todos los lookups dicen "no existe" → intenta insertar
    mockDB.getFromIndex.mockResolvedValue(undefined);
    // Primer put de benchmark falla con ConstraintError · resto OK
    let llamada = 0;
    mockDB.put.mockImplementation((store: string) => {
      llamada++;
      if (store === 'benchmarksReferencia' && llamada === 1) {
        const err: any = new Error('Constraint');
        err.name = 'ConstraintError';
        return Promise.reject(err);
      }
      return Promise.resolve();
    });
    const r = await runMigration_v72();
    // Ejecutada y flag escrito · aunque uno falló, los otros 5 se insertaron
    expect(r.ejecutada).toBe(true);
    expect(r.insertados).toBe(5);
  });
});

describe('benchmarksReferenciaService · restaurarSeedV72', () => {
  test('sobreescribe los 6 conservando id si ya existían', async () => {
    mockDB.getFromIndex.mockImplementation((_store, _index, codigo) => {
      return Promise.resolve(mockBench({ id: `existente-${codigo}`, codigo: String(codigo) }));
    });
    const escritos = await restaurarSeedV72();
    expect(escritos).toBe(SEED_BENCHMARKS_V72.length);
    // Cada put usa el id existente
    const calls = mockDB.put.mock.calls;
    expect(calls[0][1].id).toMatch(/^existente-/);
  });
});

describe('benchmarksReferenciaService · todosVacios + vaciosEnLista', () => {
  test('lista vacía · true', async () => {
    mockDB.getAll.mockResolvedValueOnce([]);
    expect(await todosVacios()).toBe(true);
  });

  test('todos con valoresAnuales={} · true', async () => {
    mockDB.getAll.mockResolvedValueOnce([
      mockBench({ id: 'a', valoresAnuales: {} }),
      mockBench({ id: 'b', valoresAnuales: {} }),
    ]);
    expect(await todosVacios()).toBe(true);
  });

  test('al menos uno con valor · false', async () => {
    mockDB.getAll.mockResolvedValueOnce([
      mockBench({ id: 'a', valoresAnuales: {} }),
      mockBench({ id: 'b', valoresAnuales: { 2024: 5 } }),
    ]);
    expect(await todosVacios()).toBe(false);
  });

  test('vaciosEnLista · predicado puro · sin I/O', () => {
    expect(vaciosEnLista([])).toBe(true);
    expect(vaciosEnLista([mockBench({ valoresAnuales: {} })])).toBe(true);
    expect(
      vaciosEnLista([
        mockBench({ id: 'a', valoresAnuales: {} }),
        mockBench({ id: 'b', valoresAnuales: { 2024: 5 } }),
      ]),
    ).toBe(false);
  });
});

describe('benchmarksReferenciaService · seed metadata', () => {
  test('los 6 seeds vienen con valoresAnuales vacíos y ultimaActualizacion null (opción B)', () => {
    expect(SEED_BENCHMARKS_V72).toHaveLength(6);
    for (const s of SEED_BENCHMARKS_V72) {
      expect(s.valoresAnuales).toEqual({});
      expect(s.ultimaActualizacion).toBeNull();
      expect(s.fuenteUrl).toBeTruthy();
    }
    const codigos = SEED_BENCHMARKS_V72.map((s) => s.codigo);
    expect(codigos).toEqual(
      expect.arrayContaining([
        'MSCI_WORLD_EUR',
        'SP500_EUR',
        'EUROSTOXX_50',
        'BONDS_AGG_EUR',
        'CPI_ES',
        'CPI_EUR',
      ]),
    );
  });
});
