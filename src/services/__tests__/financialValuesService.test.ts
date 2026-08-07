import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

const makeProperty = (id: number) => ({
  id,
  alias: `Inmueble ${id}`,
  address: `Calle ${id}`,
  postalCode: '28001',
  province: 'Madrid',
  municipality: 'Madrid',
  ccaa: 'Madrid',
  purchaseDate: '2020-01-01',
  squareMeters: 80,
  bedrooms: 2,
  transmissionRegime: 'usada' as const,
  state: 'activo' as const,
  acquisitionCosts: { price: 180000 },
  documents: [],
});

const makeInvestment = (id: number) => ({
  id,
  nombre: `Inversión ${id}`,
  tipo: 'fondo_inversion' as const,
  entidad: 'Indexa',
  valor_actual: 5000,
  fecha_valoracion: '2026-08-01',
  aportaciones: [],
  total_aportado: 4500,
  rentabilidad_euros: 500,
  rentabilidad_porcentaje: 11.11,
  activo: true,
  created_at: '2026-08-01T10:00:00.000Z',
  updated_at: '2026-08-01T10:00:00.000Z',
});

describe('financialValuesService', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('mezcla los indicadores persistidos con los activos vivos del sistema', async () => {
    const [{ initDB }, { getFinancialValuesSnapshot }] = await Promise.all([
      import('../db'),
      import('../financialValuesService'),
    ]);

    const db = await initDB();
    await db.add('properties', makeProperty(1) as never);
    await db.add('inversiones', makeInvestment(7) as never);
    await db.put(
      'keyval',
      {
        ipcMonthlyPercent: 0.4,
        euriborPercent: 2.15,
        effectiveDate: '2026-08-07',
        realEstateValuations: [{ id: '1', name: 'viejo', value: 210000 }],
        investmentValuations: [{ id: '7', name: 'viejo', value: 6200 }],
        updatedAt: '2026-08-07T09:00:00.000Z',
      } as never,
      'financialValuesSnapshot',
    );

    const snapshot = await getFinancialValuesSnapshot();

    expect(snapshot.ipcMonthlyPercent).toBe(0.4);
    expect(snapshot.euriborPercent).toBe(2.15);
    expect(snapshot.effectiveDate).toBe('2026-08-07');
    expect(snapshot.realEstateValuations).toEqual([
      { id: '1', name: 'Inmueble 1', value: 210000 },
    ]);
    expect(snapshot.investmentValuations).toEqual([
      { id: '7', name: 'Inversión 7', value: 6200, tipo: 'Fondo de inversión' },
    ]);
  });

  it('guarda el snapshot y sincroniza inmuebles, inversiones e histórico de valoraciones', async () => {
    const [{ initDB }, financialValuesModule, valoracionesModule] = await Promise.all([
      import('../db'),
      import('../financialValuesService'),
      import('../valoracionesService'),
    ]);

    const db = await initDB();
    await db.add('properties', makeProperty(1) as never);
    await db.add('inversiones', makeInvestment(7) as never);

    const snapshot = await financialValuesModule.saveFinancialValuesSnapshot({
      ipcMonthlyPercent: 0.55,
      euriborPercent: -0.12,
      effectiveDate: '2026-08-31',
      realEstateValuations: [{ id: '1', name: 'Inmueble 1', value: 215000 }],
      investmentValuations: [{ id: '7', name: 'Inversión 7', value: 6400 }],
    });

    expect(snapshot.updatedAt).not.toBeNull();

    const property = await db.get('properties', 1);
    const investment = await db.get('inversiones', 7);
    const storedSnapshot = await db.get('keyval', 'financialValuesSnapshot');

    expect((property as any).valor_actual).toBe(215000);
    expect((investment as any).valor_actual).toBe(6400);
    expect((investment as any).fecha_valoracion).toBe('2026-08-31');
    expect((storedSnapshot as any).ipcMonthlyPercent).toBe(0.55);
    expect((storedSnapshot as any).euriborPercent).toBe(-0.12);
    expect(await valoracionesModule.getValorActual('1')).toBe(215000);
    expect(await valoracionesModule.getValorActual('7')).toBe(6400);
  });
});
