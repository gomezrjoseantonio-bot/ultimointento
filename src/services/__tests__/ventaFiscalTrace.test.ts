import { initDB } from '../db';
import { confirmPropertySale } from '../propertySaleService';
import {
  getGananciasPatrimonialesInmueblesEjercicio,
} from '../propertyDisposalTaxService';
import { ejecutarCompensacionAhorro } from '../compensacionAhorroService';

const createProperty = (overrides: Record<string, any> = {}) => ({
  alias: 'Sant Joan den Coll',
  address: 'Carrer Sant Joan 1',
  postalCode: '08001',
  province: 'Barcelona',
  municipality: 'Barcelona',
  ccaa: 'Cataluña',
  purchaseDate: '2018-01-01',
  transmissionRegime: 'usada' as const,
  state: 'activo' as const,
  documents: [],
  acquisitionCosts: { price: 120000 },
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

describe('rastro fiscal de una venta · la ganancia entra en la declaración del año de la venta', () => {
  beforeEach(async () => {
    const db = await initDB();
    await Promise.all([
      db.clear('properties'),
      db.clear('property_sales'),
      db.clear('accounts'),
      db.clear('prestamos'),
      db.clear('contracts'),
      db.clear('movements'),
      db.clear('compromisosRecurrentes'),
      db.clear('gastosInmueble'),
      db.clear('treasuryEvents'),
    ]);
  });

  it('una venta de marzo 2026 aparece en las ganancias patrimoniales del ejercicio 2026', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty()));
    const accountId = Number(await db.add('accounts', createAccount()));

    await confirmPropertySale({
      propertyId,
      saleDate: '2026-03-15',
      salePrice: 180000,
      settlementAccountId: accountId,
      source: 'wizard',
    });

    const ganancias2026 = await getGananciasPatrimonialesInmueblesEjercicio(2026);
    expect(ganancias2026.length).toBe(1);
    expect(ganancias2026[0].gananciaPatrimonial).toBeGreaterThan(0);

    // El ejercicio SIGUIENTE (2027) NO debe llevar la ganancia.
    const ganancias2027 = await getGananciasPatrimonialesInmueblesEjercicio(2027);
    expect(ganancias2027.length).toBe(0);
  });

  it('la ganancia de la venta llega a la compensación de base del ahorro del ejercicio 2026', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty()));
    const accountId = Number(await db.add('accounts', createAccount()));

    await confirmPropertySale({
      propertyId,
      saleDate: '2026-03-15',
      salePrice: 180000,
      settlementAccountId: accountId,
      source: 'wizard',
    });

    const compensacion = await ejecutarCompensacionAhorro(2026, 0);
    expect(compensacion.fuentes.inmuebles.detalle.length).toBeGreaterThan(0);
  });
});
