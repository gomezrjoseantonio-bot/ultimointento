import { initDB } from '../db';
import { cancelPropertySale, confirmPropertySale, getLatestConfirmedSaleForProperty, preparePropertySale } from '../propertySaleService';

const createProperty = (overrides: Record<string, any> = {}) => ({
  alias: 'Piso Centro',
  address: 'Calle Mayor 1',
  postalCode: '28001',
  province: 'Madrid',
  municipality: 'Madrid',
  ccaa: 'Comunidad de Madrid',
  purchaseDate: '2020-01-01',
  transmissionRegime: 'usada' as const,
  state: 'activo' as const,
  documents: [],
  acquisitionCosts: {
    price: 120000,
  },
  ...overrides,
});

const createAccount = (overrides: Record<string, any> = {}) => ({
  iban: 'ES6600491500051234567892',
  status: 'ACTIVE' as const,
  activa: true,
  isActive: true,
  alias: 'Cuenta principal',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('propertySaleService', () => {
  beforeEach(async () => {
    const db = await initDB();
    await Promise.all([
      db.clear('properties'),
      db.clear('property_sales'),
      db.clear('accounts'),
      db.clear('prestamos'),
      db.clear('contracts'),
      db.clear('movements'),
      db.clear('opexRules'),
      db.clear('ingresos'),
      db.clear('gastos'),
      db.clear('treasuryEvents'),
    ]);
  });

  it('cancela préstamo vinculado por alias al confirmar la venta', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty()));
    const accountId = Number(await db.add('accounts', createAccount()));

    await db.add('prestamos', {
      id: 'loan-alias-1',
      inmuebleId: 'Piso Centro',
      activo: true,
      principalVivo: 48000,
      estado: 'vivo',
      ambito: 'INMUEBLE',
    } as any);

    await confirmPropertySale({
      propertyId,
      saleDate: '2026-02-10',
      salePrice: 180000,
      settlementAccountId: accountId,
      source: 'cartera',
    });

    const updatedLoan = await db.get('prestamos', 'loan-alias-1');
    expect(updatedLoan?.activo).toBe(false);
    expect(updatedLoan?.principalVivo).toBe(0);
    expect(updatedLoan?.estado).toBe('cancelado');
  });

  it('permite revertir una venta confirmada y reactivar el inmueble', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty({ alias: 'Piso Retorno' })));
    const accountId = Number(await db.add('accounts', createAccount({ iban: 'ES2101823401123456789012' })));

    await confirmPropertySale({
      propertyId,
      saleDate: '2026-01-15',
      salePrice: 165000,
      settlementAccountId: accountId,
      source: 'analisis',
    });

    const latestSale = await getLatestConfirmedSaleForProperty(propertyId);
    expect(latestSale?.id).toBeDefined();

    const prepareAfterSale = await preparePropertySale(propertyId, '2026-01-16');
    expect(prepareAfterSale.property.state).toBe('vendido');

    await cancelPropertySale(latestSale!.id!);

    const revertedProperty = await db.get('properties', propertyId);
    expect(revertedProperty?.state).toBe('activo');

    const revertedSale = await db.get('property_sales', latestSale!.id!);
    expect(revertedSale?.status).toBe('reverted');
  });
});
