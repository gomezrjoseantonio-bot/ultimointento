import { inmuebleService } from '../inmuebleService';
import { initDB } from '../db';

const createTestProperty = (overrides: Record<string, any> = {}) => ({
  alias: 'Test Property',
  address: 'Calle Test 123',
  postalCode: '28001',
  province: 'Madrid',
  municipality: 'Madrid',
  ccaa: 'Comunidad de Madrid',
  purchaseDate: '2023-01-01',
  cadastralReference: 'TEST123',
  squareMeters: 80,
  bedrooms: 3,
  bathrooms: 1,
  transmissionRegime: 'usada' as const,
  state: 'activo' as const,
  documents: [],
  acquisitionCosts: {
    price: 100000,
  },
  ...overrides,
});

describe('InmuebleService - IndexedDB Integration', () => {
  beforeEach(async () => {
    const db = await initDB();
    await db.clear('properties');
  });

  it('debe retornar array vacío si no hay inmuebles', async () => {
    const inmuebles = await inmuebleService.getAll();
    expect(inmuebles).toEqual([]);
  });

  it('debe cargar inmuebles desde IndexedDB', async () => {
    const db = await initDB();
    await db.add('properties', createTestProperty());

    const inmuebles = await inmuebleService.getAll();

    expect(inmuebles).toHaveLength(1);
    expect(inmuebles[0].alias).toBe('Test Property');
    expect(inmuebles[0].estado).toBe('ACTIVO');
  });

  it('debe mapear correctamente los campos de Property a Inmueble', async () => {
    const db = await initDB();
    await db.add('properties', createTestProperty());

    const inmuebles = await inmuebleService.getAll();
    const inmueble = inmuebles[0];

    expect(inmueble.direccion.calle).toBe('Calle Test 123');
    expect(inmueble.direccion.municipio).toBe('Madrid');
    expect(inmueble.direccion.provincia).toBe('Madrid');
    expect(inmueble.direccion.cp).toBe('28001');
    expect(inmueble.caracteristicas.m2).toBe(80);
    expect(inmueble.caracteristicas.habitaciones).toBe(3);
    expect(inmueble.compra.precio_compra).toBe(100000);
    expect(inmueble.fiscalidad.ref_catastral).toBe('TEST123');
  });

  it('debe mapear estado vendido correctamente', async () => {
    const db = await initDB();
    await db.add('properties', createTestProperty({ state: 'vendido' }));

    const inmuebles = await inmuebleService.getAll();

    expect(inmuebles[0].estado).toBe('VENDIDO');
  });

  it('debe cargar múltiples inmuebles', async () => {
    const db = await initDB();
    await db.add('properties', createTestProperty({ alias: 'Inmueble 1', state: 'activo' }));
    await db.add('properties', createTestProperty({ alias: 'Inmueble 2', state: 'vendido' }));

    const inmuebles = await inmuebleService.getAll();

    expect(inmuebles).toHaveLength(2);
    const aliases = inmuebles.map(i => i.alias);
    expect(aliases).toContain('Inmueble 1');
    expect(aliases).toContain('Inmueble 2');
  });

  it('debe cargar inmueble por ID', async () => {
    const db = await initDB();
    const id = await db.add('properties', createTestProperty({ alias: 'Test ID' }));

    const inmueble = await inmuebleService.getById(id.toString());

    expect(inmueble).not.toBeNull();
    expect(inmueble?.alias).toBe('Test ID');
    expect(inmueble?.id).toBe(id.toString());
  });

  it('debe retornar null para ID inexistente', async () => {
    const inmueble = await inmuebleService.getById('99999');
    expect(inmueble).toBeNull();
  });

  it('debe retornar null para ID inválido (no numérico)', async () => {
    const inmueble = await inmuebleService.getById('not-a-number');
    expect(inmueble).toBeNull();
  });
});
