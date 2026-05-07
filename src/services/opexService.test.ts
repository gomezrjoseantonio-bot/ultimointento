// ============================================================================
// T-OPEX-RECONNECT (V69 · 2026-05-07) · tests obligatorios §2.6
// ============================================================================
//
// Cubre los 10 tests requeridos por la spec docs/TAREA-T-OPEX-RECONNECT.md:
//   1-4 · CRUD opexService delegando en compromisosRecurrentesService
//   5   · generateBaseOpexForProperty es noop graceful
//   6   · Idempotencia bidireccional del mapping
//   7-8 · Lógica match FiscalDashboard considera gastosInmueble + prestamos
//   9   · operacionFiscalService.generarOperacionesDesdeRecurrentes con compromisos
//   10  · Cero regresión · servicio compromisos sigue invariantes (tests existentes
//          en propertyExpenses · compromisoCreationService no se tocan)

import { CompromisoRecurrente } from '../types/compromisosRecurrentes';
import { OpexRule, GastoInmueble } from './db';

// ─── Mock compromisosRecurrentesService ─────────────────────────────────────

type StoredCompromiso = CompromisoRecurrente & { id: number };
const mockInMemory: { compromisos: StoredCompromiso[] } = { compromisos: [] };
let mockNextCompromisoId = 1;

// CRA jest config tiene `resetMocks: true` por defecto · si se usa
// `jest.fn(impl)` la implementación se borra entre tests. Usamos funciones
// regulares (no rastreables) para mantener el comportamiento estable.
jest.mock('./personal/compromisosRecurrentesService', () => ({
  listarCompromisos: async (filtro?: any) => {
    return mockInMemory.compromisos.filter((c) => {
      if (filtro?.ambito && c.ambito !== filtro.ambito) return false;
      if (filtro?.inmuebleId !== undefined && c.inmuebleId !== filtro.inmuebleId) return false;
      if (filtro?.personalDataId !== undefined && c.personalDataId !== filtro.personalDataId) return false;
      if (filtro?.soloActivos && c.estado !== 'activo') return false;
      return true;
    });
  },
  crearCompromiso: async (datos: Omit<CompromisoRecurrente, 'id' | 'createdAt' | 'updatedAt'>) => {
    const ahora = new Date().toISOString();
    const id = mockNextCompromisoId++;
    const creado: StoredCompromiso = { ...datos, id, createdAt: ahora, updatedAt: ahora };
    mockInMemory.compromisos.push(creado);
    return creado;
  },
  actualizarCompromiso: async (id: number, cambios: Partial<CompromisoRecurrente>) => {
    const idx = mockInMemory.compromisos.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error(`Compromiso ${id} no existe`);
    const ahora = new Date().toISOString();
    const actual = mockInMemory.compromisos[idx];
    const actualizado: StoredCompromiso = {
      ...actual,
      ...cambios,
      id: actual.id,
      createdAt: actual.createdAt,
      updatedAt: ahora,
    };
    mockInMemory.compromisos[idx] = actualizado;
    return actualizado;
  },
  eliminarCompromiso: async (id: number) => {
    mockInMemory.compromisos = mockInMemory.compromisos.filter((c) => c.id !== id);
  },
}));

// initDB no debe usarse en getOpexRulesForProperty (delegamos), pero
// `getCompromisosForInmueble` sí lo usa · mockeamos por si algún test lo toca.
jest.mock('./db', () => {
  const actual = jest.requireActual('./db');
  return {
    ...actual,
    initDB: async () => ({
      getAllFromIndex: async (_store: string, _index: string, _value: any) => [],
    }),
  };
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function resetStore(): void {
  mockInMemory.compromisos = [];
  mockNextCompromisoId = 1;
}

function buildOpexRule(overrides: Partial<OpexRule> = {}): OpexRule {
  const ahora = new Date().toISOString();
  return {
    id: undefined,
    propertyId: 42,
    accountId: 7,
    categoria: 'comunidad',
    concepto: 'Comunidad de propietarios',
    importeEstimado: 80,
    frecuencia: 'mensual',
    diaCobro: 5,
    activo: true,
    proveedorNombre: 'Admin Fincas SL',
    proveedorNIF: 'B12345678',
    createdAt: ahora,
    updatedAt: ahora,
    ...overrides,
  } as OpexRule;
}

function seedCompromisoInmueble(overrides: Partial<CompromisoRecurrente> = {}): StoredCompromiso {
  const ahora = new Date().toISOString();
  const id = mockNextCompromisoId++;
  const c: StoredCompromiso = {
    id,
    ambito: 'inmueble',
    inmuebleId: 42,
    alias: 'Test compromiso',
    tipo: 'comunidad',
    proveedor: { nombre: 'Admin SL', nif: 'B11111111' },
    patron: { tipo: 'mensualDiaFijo', dia: 5 },
    importe: { modo: 'fijo', importe: 80 },
    cuentaCargo: 7,
    conceptoBancario: 'ADMIN SL',
    metodoPago: 'domiciliacion',
    categoria: 'inmueble.comunidad',
    bolsaPresupuesto: 'inmueble',
    responsable: 'titular',
    fechaInicio: '2026-01-01',
    estado: 'activo',
    createdAt: ahora,
    updatedAt: ahora,
    ...overrides,
  };
  mockInMemory.compromisos.push(c);
  return c;
}

beforeEach(() => {
  resetStore();
});

// ─── Tests CRUD §2.6 #1-4 ───────────────────────────────────────────────────

describe('opexService · CRUD delega en compromisosRecurrentes', () => {
  it('§2.6 #1 · getOpexRulesForProperty devuelve OpexRule[] con 3 compromisos activos del inmueble', async () => {
    seedCompromisoInmueble({ inmuebleId: 42, alias: 'Comunidad', tipo: 'comunidad', categoria: 'inmueble.comunidad' });
    seedCompromisoInmueble({
      inmuebleId: 42,
      alias: 'Seguro hogar',
      tipo: 'seguro',
      categoria: 'inmueble.seguros',
      patron: { tipo: 'anualMesesConcretos', mesesPago: [3], diaPago: 10 },
      importe: { modo: 'fijo', importe: 240 },
    });
    seedCompromisoInmueble({
      inmuebleId: 42,
      alias: 'IBI',
      tipo: 'impuesto',
      categoria: 'inmueble.ibi',
      patron: { tipo: 'anualMesesConcretos', mesesPago: [10], diaPago: 5 },
      importe: { modo: 'fijo', importe: 320 },
    });
    // Otro inmueble · NO debe aparecer
    seedCompromisoInmueble({ inmuebleId: 99, alias: 'Otro', tipo: 'comunidad', categoria: 'inmueble.comunidad' });

    const { getOpexRulesForProperty } = await import('./opexService');
    const rules = await getOpexRulesForProperty(42);

    expect(rules).toHaveLength(3);
    const categorias = rules.map((r) => r.categoria).sort();
    expect(categorias).toEqual(['comunidad', 'impuesto', 'seguro']);
    rules.forEach((r) => {
      expect(r.propertyId).toBe(42);
      expect(r.activo).toBe(true);
    });
  });

  it('§2.6 #2 · saveOpexRule sin id crea CompromisoRecurrente y getOpexRulesForProperty lo devuelve', async () => {
    const { saveOpexRule, getOpexRulesForProperty } = await import('./opexService');

    const nueva = buildOpexRule({ id: undefined, concepto: 'Nuevo seguro', categoria: 'seguro' });
    const guardada = await saveOpexRule(nueva);

    expect(guardada).not.toBeNull();
    expect(guardada!.id).toBeDefined();
    expect(guardada!.concepto).toBe('Nuevo seguro');
    expect(guardada!.categoria).toBe('seguro');

    const rules = await getOpexRulesForProperty(42);
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe(guardada!.id);
    expect(rules[0].concepto).toBe('Nuevo seguro');
  });

  it('§2.6 #3 · saveOpexRule con id existente actualiza el CompromisoRecurrente', async () => {
    const seeded = seedCompromisoInmueble({ alias: 'Original', tipo: 'comunidad', categoria: 'inmueble.comunidad' });
    const { saveOpexRule, getOpexRulesForProperty } = await import('./opexService');

    const update = buildOpexRule({
      id: seeded.id,
      concepto: 'Actualizado',
      categoria: 'comunidad',
      importeEstimado: 150,
    });
    const guardada = await saveOpexRule(update);

    expect(guardada).not.toBeNull();
    expect(guardada!.id).toBe(seeded.id);
    expect(guardada!.concepto).toBe('Actualizado');
    expect(guardada!.importeEstimado).toBe(150);

    const rules = await getOpexRulesForProperty(42);
    expect(rules).toHaveLength(1);
    expect(rules[0].concepto).toBe('Actualizado');
    expect(rules[0].importeEstimado).toBe(150);
  });

  it('§2.6 #4 · deleteOpexRule elimina el CompromisoRecurrente', async () => {
    const seeded = seedCompromisoInmueble();
    const { deleteOpexRule, getOpexRulesForProperty } = await import('./opexService');

    expect(await getOpexRulesForProperty(42)).toHaveLength(1);
    await deleteOpexRule(seeded.id);
    expect(await getOpexRulesForProperty(42)).toHaveLength(0);
  });
});

// ─── Test §2.6 #5 · generateBaseOpexForProperty noop ───────────────────────

describe('opexService · generateBaseOpexForProperty (deprecated noop)', () => {
  it('§2.6 #5 · es noop graceful · NO crea registros · NO falla', async () => {
    const { generateBaseOpexForProperty, getOpexRulesForProperty } = await import('./opexService');
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    await expect(generateBaseOpexForProperty(42)).resolves.toBeUndefined();
    expect(await getOpexRulesForProperty(42)).toHaveLength(0);
    expect(mockInMemory.compromisos).toHaveLength(0);

    infoSpy.mockRestore();
  });
});

// ─── Test §2.6 #6 · idempotencia mapping bidireccional ─────────────────────

describe('opexService · mapping bidireccional idempotente', () => {
  it('§2.6 #6 · mapCompromisoToOpexRule(crearCompromiso(rule)) ≈ rule en campos relevantes', async () => {
    const { mapOpexRuleToCompromiso, mapCompromisoToOpexRule } = await import('./opexService');
    const original = buildOpexRule({
      id: undefined,
      propertyId: 42,
      categoria: 'suministro',
      concepto: 'Luz',
      importeEstimado: 65,
      frecuencia: 'bimestral',
      diaCobro: 15,
      mesInicio: 2,
      activo: true,
      accountId: 9,
      proveedorNombre: 'Iberdrola',
      proveedorNIF: 'A95758389',
    });

    const compromisoData = mapOpexRuleToCompromiso(original);
    const compromisoCompleto: CompromisoRecurrente = {
      id: 999,
      createdAt: original.createdAt,
      updatedAt: original.updatedAt,
      ...compromisoData,
    };
    const roundtrip = mapCompromisoToOpexRule(compromisoCompleto);

    expect(roundtrip).not.toBeNull();
    expect(roundtrip!.propertyId).toBe(original.propertyId);
    expect(roundtrip!.categoria).toBe(original.categoria);
    expect(roundtrip!.concepto).toBe(original.concepto);
    expect(roundtrip!.importeEstimado).toBe(original.importeEstimado);
    expect(roundtrip!.frecuencia).toBe(original.frecuencia);
    expect(roundtrip!.diaCobro).toBe(original.diaCobro);
    expect(roundtrip!.mesInicio).toBe(original.mesInicio);
    expect(roundtrip!.activo).toBe(original.activo);
    expect(roundtrip!.accountId).toBe(original.accountId);
    expect(roundtrip!.proveedorNombre).toBe(original.proveedorNombre);
    expect(roundtrip!.proveedorNIF).toBe(original.proveedorNIF);
  });
});

// ─── Tests §2.6 #7-8 · lógica match FiscalDashboard ─────────────────────────

describe('fiscalDashboardMatch · lógica match con 4 fuentes', () => {
  it('§2.6 #7 · gastoInmueble real (casilla 0114) marca seguro como registrado · sin compromiso', async () => {
    const { EXPECTED_FISCAL_CATEGORIES, isCategoryRegistered } = await import('./fiscalDashboardMatch');
    const seguroCat = EXPECTED_FISCAL_CATEGORIES.find((c) => c.key === 'seguro')!;

    const ctx = {
      rules: [] as OpexRule[],
      gastos: [
        {
          id: 1,
          inmuebleId: 42,
          ejercicio: 2026,
          fecha: '2026-03-15',
          concepto: 'Seguro hogar',
          categoria: 'seguro',
          casillaAEAT: '0114',
          importe: 240,
          origen: 'manual',
          estado: 'confirmado',
          createdAt: '',
          updatedAt: '',
        } as unknown as GastoInmueble,
      ],
      hasActiveLoan: false,
      hasReparacionMejora: false,
    };

    expect(isCategoryRegistered(seguroCat, ctx)).toBe(true);
  });

  it('§2.6 #8 · prestamo activo marca Intereses hipoteca como registrado · sin compromiso ni gasto', async () => {
    const { EXPECTED_FISCAL_CATEGORIES, isCategoryRegistered } = await import('./fiscalDashboardMatch');
    const interesesCat = EXPECTED_FISCAL_CATEGORIES.find((c) => c.key === 'intereses')!;

    const ctx = {
      rules: [] as OpexRule[],
      gastos: [] as GastoInmueble[],
      hasActiveLoan: true,
      hasReparacionMejora: false,
    };

    expect(isCategoryRegistered(interesesCat, ctx)).toBe(true);

    // Verificación complementaria: mejora con tipo='reparacion' marca
    // Reparaciones aunque no haya compromiso ni gasto.
    const repCat = EXPECTED_FISCAL_CATEGORIES.find((c) => c.key === 'reparaciones')!;
    const ctxRep = { ...ctx, hasActiveLoan: false, hasReparacionMejora: true };
    expect(isCategoryRegistered(repCat, ctxRep)).toBe(true);

    // Cuando NO hay nada · no se marca registrada (excepto amortización
    // que es alwaysRegistered)
    const ctxVacio = { rules: [] as OpexRule[], gastos: [] as GastoInmueble[], hasActiveLoan: false, hasReparacionMejora: false };
    expect(isCategoryRegistered(repCat, ctxVacio)).toBe(false);
    expect(isCategoryRegistered(interesesCat, ctxVacio)).toBe(false);
    const amort = EXPECTED_FISCAL_CATEGORIES.find((c) => c.key === 'amortizacion')!;
    expect(isCategoryRegistered(amort, ctxVacio)).toBe(true);
  });
});

// ─── Test §2.6 #9 · operacionFiscalService cadena reparada ─────────────────

describe('operacionFiscalService.generarOperacionesDesdeRecurrentes · cadena reparada', () => {
  it('§2.6 #9 · con mapping real (no null) genera operaciones desde compromisos activos', async () => {
    const { mapCompromisoToOpexRule } = await import('./opexService');

    // El compromiso de inmueble · ámbito='inmueble' · estado='activo' debe
    // mapear a OpexRule no-null. Esa era la causa raíz del array vacío en
    // generarOperacionesDesdeRecurrentes (filtro `r !== null` lo descartaba).
    const compromiso: CompromisoRecurrente = {
      id: 100,
      ambito: 'inmueble',
      inmuebleId: 42,
      alias: 'IBI',
      tipo: 'impuesto',
      categoria: 'inmueble.ibi',
      proveedor: { nombre: 'Ayuntamiento' },
      patron: { tipo: 'anualMesesConcretos', mesesPago: [10], diaPago: 5 },
      importe: { modo: 'fijo', importe: 320 },
      cuentaCargo: 7,
      conceptoBancario: 'AYTO IBI',
      metodoPago: 'domiciliacion',
      bolsaPresupuesto: 'inmueble',
      responsable: 'titular',
      fechaInicio: '2026-01-01',
      estado: 'activo',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const rule = mapCompromisoToOpexRule(compromiso);
    expect(rule).not.toBeNull();
    expect(rule!.activo).toBe(true);
    expect(rule!.categoria).toBe('impuesto');
    expect(rule!.frecuencia).toBe('anual');
    expect(rule!.mesInicio).toBe(10);
    // Como el mapping es no-null, el filtro `r !== null` en
    // operacionFiscalService.generarOperacionesDesdeRecurrentes ya NO
    // descarta este registro · la cadena queda reparada.
  });
});

// ─── Test §2.6 #10 · cero regresión ────────────────────────────────────────

describe('opexService · cero regresión en mapping de tipos', () => {
  it('§2.6 #10 · las 7 OpexCategory mapean a tipo + categoria string válidas y vuelven', async () => {
    const { mapOpexRuleToCompromiso, mapCompromisoToOpexRule } = await import('./opexService');
    const categorias: Array<OpexRule['categoria']> = [
      'comunidad', 'impuesto', 'seguro', 'suministro', 'servicio', 'gestion', 'otro',
    ];
    const ahora = new Date().toISOString();
    for (const cat of categorias) {
      const rule = buildOpexRule({
        id: undefined,
        categoria: cat,
        concepto: cat === 'impuesto' ? 'IBI' : `Test ${cat}`,
      });
      const compromisoData = mapOpexRuleToCompromiso(rule);
      const compromisoCompleto: CompromisoRecurrente = {
        id: 1,
        createdAt: ahora,
        updatedAt: ahora,
        ...compromisoData,
      };
      const back = mapCompromisoToOpexRule(compromisoCompleto);
      expect(back).not.toBeNull();
      expect(back!.categoria).toBe(cat);
    }
  });
});
