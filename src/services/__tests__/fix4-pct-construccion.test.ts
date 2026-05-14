// S-FISCAL-FIXES Fix 4 · % construcción almacenado con 4 decimales internos
// Cuando hay VC y VCc reales, recalcular el % desde catastro en lugar de usar
// el declarado en XML (que viene truncado a 2 decimales).

import { calcularBaseAmortizacion } from '../baseAmortizacionService';
import { initDB } from '../db';
import { getTotalMejorasHastaEjercicio } from '../mejoraActivoService';

jest.mock('../db', () => ({ initDB: jest.fn() }));
jest.mock('../mejoraActivoService', () => ({
  getTotalMejorasHastaEjercicio: jest.fn(),
}));

function setupProperty(prop: any, mejoras = 0) {
  (initDB as jest.Mock).mockResolvedValue({
    get: jest.fn(async (store: string, id: number) =>
      store === 'properties' && prop?.id === id ? prop : null,
    ),
  });
  (getTotalMejorasHastaEjercicio as jest.Mock).mockResolvedValue(mejoras);
}

describe('Fix 4 · % construcción 4 decimales internos', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Usa el % desde VC con 4+ decimales · supera precisión del declarado a 2 decimales', async () => {
    // Caso · declarado 54,55% (XML) vs real desde VC (37294,08 / 68371,03) = 54,5466%
    // baseporCoste declarado: 106304,97 × 0,5455 = 57989,36
    // baseporCoste real:       106304,97 × 0,5454661 = 57985,75
    // El servicio debe usar el real (más decimales).
    const vcTotal = 68371.03;
    const vcConstr = 37294.08;
    const precio = 98831.47;
    const gastos = 7473.5;

    setupProperty(
      {
        id: 100,
        acquisitionCosts: {
          price: precio,
          notary: 1500,
          registry: 500,
          itp: 5473.5,
        },
        fiscalData: {
          cadastralValue: vcTotal,
          constructionCadastralValue: vcConstr,
          constructionPercentage: 54.55, // declarado (2 decimales)
        },
      },
      0,
    );

    const r = await calcularBaseAmortizacion(100, 2024);

    // % usado debe ser el calculado, no el declarado redondeado
    const pctEsperado = (vcConstr / vcTotal) * 100;
    expect(r.desglose.porcentajeConstruccion).toBeCloseTo(pctEsperado, 4);
    expect(r.desglose.porcentajeConstruccion).not.toBeCloseTo(54.55, 4); // distinto del declarado
    expect(r.desglose.baseporCoste).toBeCloseTo((precio + gastos) * (pctEsperado / 100), 2);
  });

  it('Si solo hay % declarado (sin VC) · usa el declarado tal cual', async () => {
    setupProperty(
      {
        id: 101,
        acquisitionCosts: { price: 100000, notary: 5000 },
        fiscalData: { constructionPercentage: 60.5 },
      },
      0,
    );
    const r = await calcularBaseAmortizacion(101, 2024);
    expect(r.desglose.porcentajeConstruccion).toBe(60.5);
  });

  it('Conserva precisión completa · 6 decimales no se trunca a 2', async () => {
    const vcTotal = 100000;
    const vcConstr = 12345.6789;
    setupProperty(
      {
        id: 102,
        acquisitionCosts: { price: 50000 },
        fiscalData: {
          cadastralValue: vcTotal,
          constructionCadastralValue: vcConstr,
        },
      },
      0,
    );
    const r = await calcularBaseAmortizacion(102, 2024);
    // pct = 12.3457... (no 12.35)
    expect(r.desglose.porcentajeConstruccion).toBeCloseTo(12.3456789, 6);
  });
});
