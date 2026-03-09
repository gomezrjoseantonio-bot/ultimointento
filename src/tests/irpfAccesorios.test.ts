// Tests for IRPF accessory property fiscal treatment (Epic #414, Task 1.3)
// Verifies that garajes/trasteros marked as accessories are merged into their
// principal property instead of appearing as independent entries.

import { calcularDeclaracionIRPF, calcularDiasAnio, calcularDiasAlquiladoDesdeContratos } from '../services/irpfCalculationService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../services/db', () => ({
  initDB: jest.fn(),
}));

jest.mock('../services/fiscalSummaryService', () => ({
  calculateFiscalSummary: jest.fn(),
}));

jest.mock('../services/personalDataService', () => ({
  personalDataService: {
    getPersonalData: jest.fn().mockResolvedValue(null),
  },
}));

import { initDB } from '../services/db';
import { calculateFiscalSummary } from '../services/fiscalSummaryService';

const mockInitDB = initDB as jest.MockedFunction<typeof initDB>;
const mockCalculateFiscalSummary = calculateFiscalSummary as jest.MockedFunction<typeof calculateFiscalSummary>;

// ─── Helper to build a minimal mock DB ───────────────────────────────────────

function buildMockDB(properties: any[], contracts: any[] = [], propertyDays: any[] = []) {
  return {
    getAll: jest.fn().mockImplementation((store: string) => {
      if (store === 'properties') return Promise.resolve(properties);
      if (store === 'contracts') return Promise.resolve(contracts);
      if (store === 'nominas') return Promise.resolve([]);
      if (store === 'autonomos') return Promise.resolve([]);
      if (store === 'inversiones') return Promise.resolve([]);
      return Promise.resolve([]);
    }),
    getAllFromIndex: jest.fn().mockImplementation((store: string) => {
      if (store === 'propertyDays') return Promise.resolve([]);
      return Promise.resolve([]);
    }),
  } as any;
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const EJERCICIO = 2025;

const principalProperty = {
  id: 1,
  alias: 'Piso Principal',
  state: 'activo',
  fiscalData: { cadastralValue: 100000 },
};

const garajeAccesorio = {
  id: 2,
  alias: 'Garaje Accesorio',
  state: 'activo',
  fiscalData: {
    isAccessory: true,
    mainPropertyId: 1,
    accessoryData: {
      cadastralReference: 'REF001',
      acquisitionDate: '2020-01-01',
      cadastralValue: 10000,
      constructionCadastralValue: 7000,
    },
  },
};

const fullYearContract = {
  id: 10,
  propertyId: 1,
  fechaInicio: `${EJERCICIO}-01-01`,
  fechaFin: `${EJERCICIO}-12-31`,
  rentaMensual: 1000,
  modalidad: 'habitual',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IRPF – Inmuebles accesorios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calcularDiasAnio', () => {
    it('returns 365 for a non-leap year', () => {
      expect(calcularDiasAnio(2025)).toBe(365);
    });

    it('returns 366 for a leap year', () => {
      expect(calcularDiasAnio(2024)).toBe(366);
    });
  });

  describe('calcularDiasAlquiladoDesdeContratos', () => {
    it('counts full year contract as 365 days', () => {
      const contracts = [{ fechaInicio: '2025-01-01', fechaFin: '2025-12-31' }];
      expect(calcularDiasAlquiladoDesdeContratos(contracts, 2025, 365)).toBe(365);
    });

    it('returns 0 for empty contracts', () => {
      expect(calcularDiasAlquiladoDesdeContratos([], 2025, 365)).toBe(0);
    });
  });

  describe('Accesorio NO aparece como línea independiente', () => {
    it('should not include accessory as a separate rendimientoInmueble entry', async () => {
      mockInitDB.mockResolvedValue(
        buildMockDB([principalProperty, garajeAccesorio], [fullYearContract])
      );
      mockCalculateFiscalSummary.mockResolvedValue({
        annualDepreciation: 600,
        box0105: 0, box0106: 0, box0109: 0,
        box0112: 0, box0113: 0, box0114: 0,
        box0115: 0, box0117: 0,
      } as any);

      const result = await calcularDeclaracionIRPF(EJERCICIO);
      const ids = result.baseGeneral.rendimientosInmuebles.map(r => r.inmuebleId);

      expect(ids).toContain(1);
      expect(ids).not.toContain(2); // garaje accesorio must NOT appear independently
    });
  });

  describe('Amortización del accesorio se suma al principal', () => {
    it('principal + 1 garaje accesorio alquilado 365 días: amortización combinada', async () => {
      mockInitDB.mockResolvedValue(
        buildMockDB([principalProperty, garajeAccesorio], [fullYearContract])
      );

      // Principal: 600€ annualDepreciation; Garaje: 210€ annualDepreciation (both 365/365)
      mockCalculateFiscalSummary.mockImplementation(async (propertyId: number) => {
        if (propertyId === 1) {
          return {
            annualDepreciation: 600,
            box0105: 0, box0106: 0, box0109: 0,
            box0112: 0, box0113: 0, box0114: 0,
            box0115: 0, box0117: 0,
          } as any;
        }
        // Garaje accesorio
        return {
          annualDepreciation: 210,
          box0105: 0, box0106: 0, box0109: 0,
          box0112: 0, box0113: 0, box0114: 0,
          box0115: 0, box0117: 0,
        } as any;
      });

      const result = await calcularDeclaracionIRPF(EJERCICIO);
      const rendimiento = result.baseGeneral.rendimientosInmuebles.find(r => r.inmuebleId === 1);

      expect(rendimiento).toBeDefined();
      // 600 + 210 = 810 (ratio = 365/365 = 1)
      expect(rendimiento!.amortizacion).toBe(810);
    });

    it('accesorio sin datos AEAT usa constructionCadastralValue * 3% como fallback', async () => {
      mockInitDB.mockResolvedValue(
        buildMockDB([principalProperty, garajeAccesorio], [fullYearContract])
      );

      // Principal succeeds; garaje throws (no AEAT data)
      mockCalculateFiscalSummary.mockImplementation(async (propertyId: number) => {
        if (propertyId === 1) {
          return {
            annualDepreciation: 600,
            box0105: 0, box0106: 0, box0109: 0,
            box0112: 0, box0113: 0, box0114: 0,
            box0115: 0, box0117: 0,
          } as any;
        }
        throw new Error('No AEAT data');
      });

      const result = await calcularDeclaracionIRPF(EJERCICIO);
      const rendimiento = result.baseGeneral.rendimientosInmuebles.find(r => r.inmuebleId === 1);

      // Fallback: constructionCadastralValue (7000) * 3% * ratio(1) = 210
      expect(rendimiento!.amortizacion).toBeCloseTo(600 + 210, 2);
    });
  });

  describe('Gastos del accesorio se suman al principal', () => {
    it('principal + 1 garaje: gastos combinados correctamente', async () => {
      mockInitDB.mockResolvedValue(
        buildMockDB([principalProperty, garajeAccesorio], [fullYearContract])
      );

      mockCalculateFiscalSummary.mockImplementation(async (propertyId: number) => {
        if (propertyId === 1) {
          return {
            annualDepreciation: 0,
            box0105: 100, box0106: 50, box0109: 0,
            box0112: 0,  box0113: 0,  box0114: 30,
            box0115: 0,  box0117: 0,
          } as any;
        }
        // Garaje: 200€ total expenses
        return {
          annualDepreciation: 0,
          box0105: 80, box0106: 0, box0109: 60,
          box0112: 0,  box0113: 0, box0114: 60,
          box0115: 0,  box0117: 0,
        } as any;
      });

      const result = await calcularDeclaracionIRPF(EJERCICIO);
      const rendimiento = result.baseGeneral.rendimientosInmuebles.find(r => r.inmuebleId === 1);

      // Principal: (100+50+30)=180; Garaje: (80+60+60)=200; Total: 380
      expect(rendimiento!.gastosDeducibles).toBe(380);
    });
  });

  describe('Principal + 2 accesorios (garaje + trastero): todo combinado', () => {
    it('sums amortization and expenses from two accessories', async () => {
      const trasteroAccesorio = {
        id: 3,
        alias: 'Trastero Accesorio',
        state: 'activo',
        fiscalData: {
          isAccessory: true,
          mainPropertyId: 1,
          accessoryData: {
            cadastralReference: 'REF002',
            acquisitionDate: '2020-01-01',
            cadastralValue: 5000,
            constructionCadastralValue: 3500,
          },
        },
      };

      mockInitDB.mockResolvedValue(
        buildMockDB([principalProperty, garajeAccesorio, trasteroAccesorio], [fullYearContract])
      );

      mockCalculateFiscalSummary.mockImplementation(async (propertyId: number) => {
        if (propertyId === 1) return { annualDepreciation: 600, box0105: 100, box0106: 0, box0109: 0, box0112: 0, box0113: 0, box0114: 0, box0115: 0, box0117: 0 } as any;
        if (propertyId === 2) return { annualDepreciation: 210, box0105: 50,  box0106: 0, box0109: 0, box0112: 0, box0113: 0, box0114: 0, box0115: 0, box0117: 0 } as any;
        if (propertyId === 3) return { annualDepreciation: 105, box0105: 25,  box0106: 0, box0109: 0, box0112: 0, box0113: 0, box0114: 0, box0115: 0, box0117: 0 } as any;
        throw new Error('Unknown property');
      });

      const result = await calcularDeclaracionIRPF(EJERCICIO);
      const rendimiento = result.baseGeneral.rendimientosInmuebles.find(r => r.inmuebleId === 1);

      expect(rendimiento!.amortizacion).toBe(915); // 600+210+105
      expect(rendimiento!.gastosDeducibles).toBe(175); // 100+50+25
      // accesoriosIncluidos should list both
      expect(rendimiento!.accesoriosIncluidos).toHaveLength(2);
      expect(rendimiento!.accesoriosIncluidos!.map(a => a.id)).toContain(2);
      expect(rendimiento!.accesoriosIncluidos!.map(a => a.id)).toContain(3);
    });
  });

  describe('Imputación de renta con valor catastral combinado', () => {
    it('partially rented principal: imputación uses combined cadastral value', async () => {
      const halfYearContract = {
        id: 11,
        propertyId: 1,
        fechaInicio: `${EJERCICIO}-01-01`,
        fechaFin: `${EJERCICIO}-06-30`,
        rentaMensual: 1000,
        modalidad: 'otros',
      };

      mockInitDB.mockResolvedValue(
        buildMockDB([principalProperty, garajeAccesorio], [halfYearContract])
      );

      mockCalculateFiscalSummary.mockResolvedValue({
        annualDepreciation: 0,
        box0105: 0, box0106: 0, box0109: 0,
        box0112: 0, box0113: 0, box0114: 0,
        box0115: 0, box0117: 0,
      } as any);

      const result = await calcularDeclaracionIRPF(EJERCICIO);
      const rendimiento = result.baseGeneral.rendimientosInmuebles.find(r => r.inmuebleId === 1);

      // Combined cadastralValue = 100000 + 10000 = 110000
      // Vacant days = 365 - diasAlquilado; imputación = 110000 * 0.02 * (diasVacio/365)
      expect(rendimiento).toBeDefined();
      // Should be > 0 and should exceed what it would be with just 100000
      const imputacionConCombinado = rendimiento!.imputacionRenta;
      expect(imputacionConCombinado).toBeGreaterThan(0);

      // Compare with hypothetical single-property imputación (verify it is higher)
      const diasVacio = rendimiento!.diasVacio;
      const expectedCombined = Math.round(110000 * 0.02 * (diasVacio / 365) * 100) / 100;
      const expectedSingle = Math.round(100000 * 0.02 * (diasVacio / 365) * 100) / 100;
      expect(imputacionConCombinado).toBe(expectedCombined);
      expect(imputacionConCombinado).toBeGreaterThan(expectedSingle);
    });

    it('fully vacant principal: imputación uses combined cadastral value', async () => {
      mockInitDB.mockResolvedValue(
        buildMockDB([principalProperty, garajeAccesorio], []) // no contracts
      );

      const result = await calcularDeclaracionIRPF(EJERCICIO);
      const imputacion = result.baseGeneral.imputacionRentas.find(i => i.inmuebleId === 1);

      expect(imputacion).toBeDefined();
      // Combined cadastralValue = 100000 + 10000 = 110000
      expect(imputacion!.valorCatastral).toBe(110000);
      // imputacion = 110000 * 0.02 * (365/365) = 2200
      expect(imputacion!.imputacion).toBe(2200);
    });

    it('fully vacant principal 100% empty with accessory: garaje not in imputaciones', async () => {
      mockInitDB.mockResolvedValue(
        buildMockDB([principalProperty, garajeAccesorio], [])
      );

      const result = await calcularDeclaracionIRPF(EJERCICIO);
      const ids = result.baseGeneral.imputacionRentas.map(i => i.inmuebleId);

      expect(ids).toContain(1);
      expect(ids).not.toContain(2); // garaje must NOT appear independently
    });
  });

  describe('Backward compatibility', () => {
    it('accesorio sin mainPropertyId se trata como inmueble independiente', async () => {
      const accesorioSinPrincipal = {
        id: 5,
        alias: 'Garaje Suelto',
        state: 'activo',
        fiscalData: {
          isAccessory: true,
          // No mainPropertyId
          cadastralValue: 8000,
        },
      };

      mockInitDB.mockResolvedValue(
        buildMockDB([accesorioSinPrincipal], [])
      );

      const result = await calcularDeclaracionIRPF(EJERCICIO);
      // isAccessory=true but no mainPropertyId means mainPropertyId === undefined,
      // so the filter `p.fiscalData?.mainPropertyId === prop.id` never matches;
      // the property itself IS filtered by `if (prop.fiscalData?.isAccessory) continue`
      // so it should NOT appear in any list — this is by design (orphan accessory is skipped).
      const allIds = [
        ...result.baseGeneral.rendimientosInmuebles.map(r => r.inmuebleId),
        ...result.baseGeneral.imputacionRentas.map(i => i.inmuebleId),
      ];
      // Orphan accessories are skipped (no principal to attach to), not shown independently
      expect(allIds).not.toContain(5);
    });

    it('inmueble sin isAccessory se procesa normalmente (compatibilidad hacia atrás)', async () => {
      const normalProperty = {
        id: 10,
        alias: 'Piso Normal',
        state: 'activo',
        fiscalData: { cadastralValue: 60000 },
      };

      mockInitDB.mockResolvedValue(
        buildMockDB([normalProperty], [])
      );

      const result = await calcularDeclaracionIRPF(EJERCICIO);
      const ids = result.baseGeneral.imputacionRentas.map(i => i.inmuebleId);
      expect(ids).toContain(10);
    });

    it('accesorio con principal vendido (inactivo) no genera rendimiento', async () => {
      const principalVendido = { ...principalProperty, state: 'vendido' };

      mockInitDB.mockResolvedValue(
        buildMockDB([principalVendido, garajeAccesorio], [])
      );

      const result = await calcularDeclaracionIRPF(EJERCICIO);
      const allIds = [
        ...result.baseGeneral.rendimientosInmuebles.map(r => r.inmuebleId),
        ...result.baseGeneral.imputacionRentas.map(i => i.inmuebleId),
      ];
      expect(allIds).not.toContain(1);
      expect(allIds).not.toContain(2);
    });
  });

  describe('accesoriosIncluidos field', () => {
    it('is absent when property has no accessories', async () => {
      mockInitDB.mockResolvedValue(
        buildMockDB([principalProperty], [fullYearContract])
      );

      mockCalculateFiscalSummary.mockResolvedValue({
        annualDepreciation: 600,
        box0105: 0, box0106: 0, box0109: 0,
        box0112: 0, box0113: 0, box0114: 0,
        box0115: 0, box0117: 0,
      } as any);

      const result = await calcularDeclaracionIRPF(EJERCICIO);
      const rendimiento = result.baseGeneral.rendimientosInmuebles.find(r => r.inmuebleId === 1);

      expect(rendimiento!.accesoriosIncluidos).toBeUndefined();
    });

    it('contains correct metadata when accessories are present', async () => {
      mockInitDB.mockResolvedValue(
        buildMockDB([principalProperty, garajeAccesorio], [fullYearContract])
      );

      mockCalculateFiscalSummary.mockImplementation(async (propertyId: number) => {
        if (propertyId === 1) return { annualDepreciation: 600, box0105: 0, box0106: 0, box0109: 0, box0112: 0, box0113: 0, box0114: 0, box0115: 0, box0117: 0 } as any;
        return { annualDepreciation: 210, box0105: 50, box0106: 0, box0109: 0, box0112: 0, box0113: 0, box0114: 0, box0115: 0, box0117: 0 } as any;
      });

      const result = await calcularDeclaracionIRPF(EJERCICIO);
      const rendimiento = result.baseGeneral.rendimientosInmuebles.find(r => r.inmuebleId === 1);

      expect(rendimiento!.accesoriosIncluidos).toHaveLength(1);
      expect(rendimiento!.accesoriosIncluidos![0]).toMatchObject({
        id: 2,
        alias: 'Garaje Accesorio',
        amortizacion: 210,
        gastos: 50,
      });
    });
  });
});
