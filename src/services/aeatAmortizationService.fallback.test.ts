import { calculateAEATAmortization, getUnifiedFiscalData } from './aeatAmortizationService';
import { Property } from './db';

jest.mock('./db', () => ({
  initDB: jest.fn(),
}));

const { initDB } = jest.requireMock('./db') as { initDB: jest.Mock };

const buildProperty = (overrides: Partial<Property> = {}): Property => ({
  id: 7,
  alias: 'Tenderina 64 4D',
  address: 'Tenderina 64 4D',
  postalCode: '33010',
  province: 'Asturias',
  municipality: 'Oviedo',
  ccaa: 'Asturias',
  purchaseDate: '2024-01-01',
  squareMeters: 80,
  bedrooms: 2,
  transmissionRegime: 'usada',
  state: 'activo',
  acquisitionCosts: {
    price: 49000,
    notary: 1000,
    registry: 850.61,
    management: 0,
    itp: 4000,
  },
  documents: [],
  fiscalData: {
    cadastralValue: 47656.37,
    constructionCadastralValue: 17833.86,
  },
  ...overrides,
});

describe('aeatAmortizationService unified fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds unified data from fiscalData + acquisitionCosts when AEAT fields are empty', () => {
    const property = buildProperty({
      aeatAmortization: {
        acquisitionType: 'onerosa',
        firstAcquisitionDate: '2024-01-01',
        cadastralValue: 0,
        constructionCadastralValue: 0,
        constructionPercentage: 0,
        onerosoAcquisition: {
          acquisitionAmount: 0,
          acquisitionExpenses: 0,
        },
      },
    });

    const unified = getUnifiedFiscalData(property);

    expect(unified.acquisitionAmount).toBe(49000);
    expect(unified.acquisitionExpenses).toBeCloseTo(5850.61, 2);
    expect(unified.cadastralValue).toBeCloseTo(47656.37, 2);
    expect(unified.constructionCadastralValue).toBeCloseTo(17833.86, 2);
    expect(unified.constructionPercentage).toBeCloseTo(37.42, 2);
  });

  it('calculates amortization using fiscal fallback and legacy improvements when AEAT store is empty', async () => {
    initDB.mockResolvedValue({
      get: jest.fn(async (store: string, id: number) => {
        if (store === 'properties' && id === 7) return buildProperty();
        return null;
      }),
      getAllFromIndex: jest.fn(async (store: string) => {
        if (store === 'mejorasActivo') throw new Error('missing mejorasActivo');
        if (store === 'mejorasInmueble') {
          return [
            { inmuebleId: 7, ejercicio: 2024, importe: 3545.3, descripcion: 'Reforma', tipo: 'mejora', fecha: '2024-12-31', createdAt: '', updatedAt: '' },
          ];
        }
        return [];
      }),
    });

    const result = await calculateAEATAmortization(7, 2024, 184);

    expect(result.breakdown.historicalImprovements).toBeCloseTo(3545.3, 2);
    expect(result.breakdown.selectedBase).toBe('construction-cost');
    expect(result.baseAmount).toBeCloseTo(24071.37, 2);
    expect(result.propertyAmortization).toBeCloseTo(363.04, 2);
    expect(result.improvementsAmortization).toBeCloseTo(106.36, 2);
    expect(result.totalAmortization).toBeCloseTo(469.4, 1);
  });

  it('prefers explicit AEAT values over fallback model data', () => {
    const property = buildProperty({
      aeatAmortization: {
        acquisitionType: 'onerosa',
        firstAcquisitionDate: '2022-02-02',
        cadastralValue: 100000,
        constructionCadastralValue: 25000,
        constructionPercentage: 25,
        onerosoAcquisition: {
          acquisitionAmount: 80000,
          acquisitionExpenses: 8000,
        },
      },
    });

    const unified = getUnifiedFiscalData(property);

    expect(unified.acquisitionDate).toBe('2022-02-02');
    expect(unified.acquisitionAmount).toBe(80000);
    expect(unified.acquisitionExpenses).toBe(8000);
    expect(unified.cadastralValue).toBe(100000);
    expect(unified.constructionCadastralValue).toBe(25000);
    expect(unified.constructionPercentage).toBe(25);
  });
});
