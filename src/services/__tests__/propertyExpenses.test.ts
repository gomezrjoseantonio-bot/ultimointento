import { initDB, OpexRule, Gasto, ExpenseH5 } from '../db';
import {
  getAllExpensesForProperty,
  getAnnualOpexForProperty,
  getExpenseDiagnosticsForProperty,
  normalizeExpenseToAnnual,
} from '../propertyExpenses';
import type { PropertyExpense } from '../../types/propertyExpenses';

describe('propertyExpenses service', () => {
  const PROPERTY_ID = 999;

  beforeEach(async () => {
    const db = await initDB();
    await Promise.all([
      db.clear('opexRules'),
      db.clear('gastosInmueble'),
      db.clear('expenses'),
      db.clear('capex'),
    ]);
  });

  it('normaliza periodicidades a anual', () => {
    const monthly: PropertyExpense = {
      id: '1',
      propertyId: PROPERTY_ID,
      category: 'suministro',
      concept: 'Luz',
      amount: 100,
      frequency: 'mensual',
      source: 'opex_rule',
      expenseClass: 'opex',
      isLegacy: false,
      isActive: true,
    };

    const yearly = normalizeExpenseToAnnual(monthly);
    expect(yearly).toBe(1200);
  });

  it('prioriza reglas OPEX cuando existen, ignorando fallback legacy', async () => {
    const db = await initDB();
    const now = new Date().toISOString();

    const opexRule: OpexRule = {
      propertyId: PROPERTY_ID,
      categoria: 'comunidad',
      concepto: 'Comunidad',
      importeEstimado: 120,
      frecuencia: 'mensual',
      activo: true,
      createdAt: now,
      updatedAt: now,
    };

    const legacyGasto: Gasto = {
      contraparte_nombre: 'Proveedor legacy',
      fecha_emision: now,
      fecha_pago_prevista: now,
      total: 300,
      categoria_AEAT: 'suministros',
      destino: 'inmueble_id',
      destino_id: PROPERTY_ID,
      estado: 'completo',
      createdAt: now,
      updatedAt: now,
    };

    await db.add('opexRules', opexRule);
    await db.add('gastosInmueble', {
      inmuebleId: PROPERTY_ID, ejercicio: new Date().getFullYear(),
      fecha: now, concepto: 'Proveedor test', categoria: 'suministro',
      casillaAEAT: '0113', importe: 300, origen: 'tesoreria', estado: 'confirmado',
      createdAt: now, updatedAt: now,
    });

    const annual = await getAnnualOpexForProperty(PROPERTY_ID);
    expect(annual).toBe(1440);
  });

  it('usa fallback legacy cuando no hay reglas OPEX', async () => {
    const db = await initDB();
    const now = new Date().toISOString();

    await db.add('gastosInmueble', {
      inmuebleId: PROPERTY_ID, ejercicio: new Date().getFullYear(),
      fecha: now, concepto: 'Proveedor legacy', categoria: 'comunidad',
      casillaAEAT: '0109', importe: 500, origen: 'tesoreria', estado: 'confirmado',
      createdAt: now, updatedAt: now,
    });

    const annual = await getAnnualOpexForProperty(PROPERTY_ID);
    expect(annual).toBe(500);

    const diagnostics = await getExpenseDiagnosticsForProperty(PROPERTY_ID);
    expect(diagnostics.usingLegacyFallback).toBe(true);
  });

  it('mapea gastos H5 y legacy en listado unificado', async () => {
    const db = await initDB();
    const now = new Date().toISOString();

    const expenseH5: ExpenseH5 = {
      date: now,
      counterparty: 'Proveedor H5',
      concept: 'Seguro hogar',
      amount: 250,
      currency: 'EUR',
      fiscalType: 'seguros',
      taxYear: new Date().getFullYear(),
      taxIncluded: true,
      propertyId: PROPERTY_ID,
      unit: 'completo',
      prorationMethod: 'porcentaje-manual',
      prorationDetail: '100',
      status: 'validado',
      origin: 'manual',
      tipo_gasto: 'seguro',
      destino: 'inmueble',
      destino_id: PROPERTY_ID,
      estado_conciliacion: 'pendiente',
      createdAt: now,
      updatedAt: now,
    };

    await db.add('gastosInmueble', {
      inmuebleId: PROPERTY_ID, ejercicio: new Date().getFullYear(),
      fecha: now, concepto: 'Seguro hogar', categoria: 'seguro',
      casillaAEAT: '0114', importe: 250, origen: 'manual', estado: 'confirmado',
      proveedorNombre: 'Proveedor H5', createdAt: now, updatedAt: now,
    });

    const all = await getAllExpensesForProperty(PROPERTY_ID);
    expect(all.length).toBe(1);
    expect(all[0].source).toBe('expense_h5');
    expect(all[0].expenseClass).toBe('opex');
  });
});
