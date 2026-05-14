// S-FISCAL-FIXES Fix 2 · N2 max() base amortización · N1 mejoras enteras
// Tolerancia ≤ 0,01€ contra cálculo cerrado (precio + gastos) × %constr

import { calcularBaseAmortizacion } from '../baseAmortizacionService';
import { initDB } from '../db';
import { getTotalMejorasHastaEjercicio } from '../mejoraActivoService';

jest.mock('../db', () => ({ initDB: jest.fn() }));
jest.mock('../mejoraActivoService', () => ({
  getTotalMejorasHastaEjercicio: jest.fn(),
}));

interface PropertyMock {
  id: number;
  acquisitionCosts?: any;
  fiscalData?: any;
  aeatAmortization?: any;
}

function setupProperty(prop: PropertyMock, mejorasAcumuladas: number) {
  (initDB as jest.Mock).mockResolvedValue({
    get: jest.fn(async (store: string, id: number) =>
      store === 'properties' && id === prop.id ? prop : null,
    ),
  });
  (getTotalMejorasHastaEjercicio as jest.Mock).mockResolvedValue(mejorasAcumuladas);
}

describe('Fix 2 · N2 max() base amortización', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Trastero · gana valor catastral construcción · sin mejoras', async () => {
    // precio 10.000 · gastos 1.040,16 · %constr derivado VC · VCt 21.367,30 · VCc 11.743,57
    // %constr = 11743.57 / 21367.30 = 0.5496170... = 54.9617%
    // baseporCoste = 11.040,16 × 0.5496170 = 6.067,73
    // baseporVC = 11.743,57 → gana VC
    const vcTotal = 21367.3;
    const vcConstr = 11743.57;
    const precio = 10000;
    const gastos = 1040.16;
    const pctExacto = (vcConstr / vcTotal) * 100;
    const expectedCoste = (precio + gastos) * (pctExacto / 100);

    setupProperty(
      {
        id: 501,
        acquisitionCosts: { price: precio, notary: 500, registry: 200, itp: 340.16 },
        fiscalData: { cadastralValue: vcTotal, constructionCadastralValue: vcConstr },
      },
      0,
    );

    const r = await calcularBaseAmortizacion(501, 2024);

    expect(r.desglose.precioAdquisicion).toBeCloseTo(precio, 2);
    expect(r.desglose.gastosAdquisicion).toBeCloseTo(gastos, 2);
    expect(r.desglose.baseporCoste).toBeCloseTo(expectedCoste, 2);
    expect(r.desglose.baseporVC).toBeCloseTo(vcConstr, 2);
    expect(r.metodo).toBe('por_vc_construccion');
    expect(r.base).toBeCloseTo(vcConstr, 2); // gana VC sin mejoras
  });

  it('Principal · gana coste · mejoras se suman ENTERAS (regla N1)', async () => {
    // Coste construcción supera VC; mejoras 3.545,30 se suman sin aplicar %constr
    const vcTotal = 47657.86;
    const vcConstr = 17833.86;
    const precio = 49000;
    const gastos = 5850.61;
    const mejoras = 3545.3;
    const pctExacto = (vcConstr / vcTotal) * 100;
    const expectedCoste = (precio + gastos) * (pctExacto / 100);

    setupProperty(
      {
        id: 4001,
        acquisitionCosts: { price: precio, notary: 700, registry: 300, itp: 4850.61 },
        fiscalData: { cadastralValue: vcTotal, constructionCadastralValue: vcConstr },
      },
      mejoras,
    );

    const r = await calcularBaseAmortizacion(4001, 2024);

    expect(r.desglose.baseporCoste).toBeCloseTo(expectedCoste, 2);
    expect(r.desglose.baseporVC).toBeCloseTo(vcConstr, 2);
    expect(r.metodo).toBe('por_coste');
    expect(r.desglose.mejorasAcumuladas).toBeCloseTo(mejoras, 2);
    // base = max(coste, vc) + mejoras (ENTERAS, no por %constr)
    expect(r.base).toBeCloseTo(expectedCoste + mejoras, 2);
  });

  it('Sin VC catastral · usa %constr declarado en fiscalData', async () => {
    setupProperty(
      {
        id: 88,
        acquisitionCosts: { price: 100000, notary: 5000 },
        fiscalData: {
          constructionPercentage: 70, // 70% declarado
        },
      },
      0,
    );

    const r = await calcularBaseAmortizacion(88, 2024);

    expect(r.desglose.porcentajeConstruccion).toBe(70);
    expect(r.desglose.baseporCoste).toBeCloseTo(105000 * 0.7, 2);
    expect(r.desglose.baseporVC).toBe(0);
    expect(r.metodo).toBe('por_coste');
  });

  it('Adquisición lucrativa · usa ISD value + impuestos + gastos inherentes', async () => {
    setupProperty(
      {
        id: 99,
        acquisitionCosts: { price: 0 },
        fiscalData: { cadastralValue: 80000, constructionCadastralValue: 50000 },
        aeatAmortization: {
          acquisitionType: 'lucrativa',
          lucrativoAcquisition: { isdValue: 120000, isdTax: 6000, inherentExpenses: 1000 },
        },
      },
      0,
    );

    const r = await calcularBaseAmortizacion(99, 2024);

    expect(r.desglose.precioAdquisicion).toBe(120000);
    expect(r.desglose.gastosAdquisicion).toBe(7000);
    // baseporCoste = 127.000 × (50000/80000) = 127.000 × 0.625 = 79.375
    expect(r.desglose.baseporCoste).toBeCloseTo(79375, 2);
    expect(r.metodo).toBe('por_coste'); // 79375 > 50000
  });

  it('Property no existe · lanza error', async () => {
    setupProperty({ id: 7 }, 0);
    await expect(calcularBaseAmortizacion(999, 2024)).rejects.toThrow(/no existe/);
  });
});
