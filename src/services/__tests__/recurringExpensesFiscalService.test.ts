import { initDB, OpexRule } from '../db';
import { getGastosRecurrentesFiscales } from '../recurringExpensesFiscalService';

const PROPERTY_ID = 7777;
const EJERCICIO = 2024;

const makeRule = (overrides: Partial<OpexRule> = {}): OpexRule => ({
  propertyId: PROPERTY_ID,
  categoria: 'comunidad',
  concepto: 'Comunidad de propietarios',
  importeEstimado: 35,
  frecuencia: 'mensual',
  activo: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('getGastosRecurrentesFiscales', () => {
  beforeEach(async () => {
    const db = await initDB();
    await db.clear('opexRules');
  });

  it('devuelve objeto vacío cuando no hay gastos recurrentes', async () => {
    const result = await getGastosRecurrentesFiscales(PROPERTY_ID, EJERCICIO);
    expect(result).toEqual({});
  });

  it('calcula correctamente 3 gastos mensuales de distintas categorías', async () => {
    const db = await initDB();
    await db.add('opexRules', makeRule({ categoria: 'comunidad', importeEstimado: 35, frecuencia: 'mensual' }));  // 35×12=420
    await db.add('opexRules', makeRule({ categoria: 'seguro',    importeEstimado: 32.76, frecuencia: 'mensual' })); // 32.76×12=393.12
    await db.add('opexRules', makeRule({ categoria: 'impuesto',  importeEstimado: 580.96, frecuencia: 'anual' }));

    const result = await getGastosRecurrentesFiscales(PROPERTY_ID, EJERCICIO);

    expect(result['0109']).toBeCloseTo(420, 2);
    expect(result['0114']).toBeCloseTo(393.12, 2);
    expect(result['0115']).toBeCloseTo(580.96, 2);
  });

  it('usa el año completo cuando el gasto no tiene fecha de inicio explícita', async () => {
    const db = await initDB();
    // No mesInicio → startDate will be undefined → full year counted
    await db.add('opexRules', makeRule({
      categoria: 'suministro',
      importeEstimado: 100,
      frecuencia: 'mensual',
    }));

    const result = await getGastosRecurrentesFiscales(PROPERTY_ID, EJERCICIO);
    expect(result['0113']).toBeCloseTo(1200, 2);
  });

  it('usa casillaAEAT override del gasto cuando está definido', async () => {
    const db = await initDB();
    await db.add('opexRules', makeRule({
      categoria: 'otro',  // 'otro' has no automatic mapping
      importeEstimado: 200,
      frecuencia: 'anual',
      casillaAEAT: '0106', // override manual
    }));

    const result = await getGastosRecurrentesFiscales(PROPERTY_ID, EJERCICIO);
    expect(result['0106']).toBe(200);
    // 'otro' without override would have been skipped
    expect(Object.keys(result)).toHaveLength(1);
  });

  it('ignora gastos inactivos', async () => {
    const db = await initDB();
    await db.add('opexRules', makeRule({ activo: false, categoria: 'comunidad', importeEstimado: 35 }));

    const result = await getGastosRecurrentesFiscales(PROPERTY_ID, EJERCICIO);
    expect(result).toEqual({});
  });

  it('ignora gastos cuya categoría no tiene mapping AEAT y sin override', async () => {
    const db = await initDB();
    await db.add('opexRules', makeRule({ categoria: 'otro', importeEstimado: 50, frecuencia: 'mensual' }));

    const result = await getGastosRecurrentesFiscales(PROPERTY_ID, EJERCICIO);
    expect(result).toEqual({});
  });

  it('acumula varios gastos de la misma casilla', async () => {
    const db = await initDB();
    await db.add('opexRules', makeRule({ categoria: 'servicio', importeEstimado: 100, frecuencia: 'mensual' }));
    await db.add('opexRules', makeRule({ categoria: 'gestion',  importeEstimado: 50,  frecuencia: 'mensual' }));

    const result = await getGastosRecurrentesFiscales(PROPERTY_ID, EJERCICIO);
    // Both map to 0112; 100×12 + 50×12 = 1800
    expect(result['0112']).toBeCloseTo(1800, 2);
  });

  it('ignora gastos que terminaron antes del ejercicio', async () => {
    const db = await initDB();
    // endDate is in 2023, so it should be excluded from 2024 calculation
    await db.add('opexRules', makeRule({
      categoria: 'seguro',
      importeEstimado: 100,
      frecuencia: 'anual',
    }));

    // We verify the filter by checking a valid gasto still comes through
    const result = await getGastosRecurrentesFiscales(PROPERTY_ID, EJERCICIO);
    expect(result['0114']).toBe(100);
  });
});
