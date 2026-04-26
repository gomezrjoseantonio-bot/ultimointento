import { initDB, Gasto } from '../db';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';
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
      // V5.4+: use compromisosRecurrentes (opexRules DEPRECATED)
      db.clear('compromisosRecurrentes'),
      db.clear('gastosInmueble'),
      // Note: 'expenses' store was removed in V44; skip clearing it
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

  it('prioriza compromisos recurrentes cuando existen, ignorando fallback legacy', async () => {
    const db = await initDB();
    const now = new Date().toISOString();

    // V5.4+: add CompromisoRecurrente instead of OpexRule
    const compromiso: Omit<CompromisoRecurrente, 'id'> = {
      ambito: 'inmueble',
      inmuebleId: PROPERTY_ID,
      alias: 'Comunidad',
      tipo: 'comunidad',
      proveedor: { nombre: 'Comunidad de vecinos' },
      patron: { tipo: 'mensualDiaFijo', dia: 1 },
      importe: { modo: 'fijo', importe: 120 },
      cuentaCargo: 0,
      conceptoBancario: 'Comunidad',
      metodoPago: 'domiciliacion',
      categoria: 'inmueble.comunidad' as any,
      bolsaPresupuesto: 'inmueble',
      responsable: 'titular',
      fechaInicio: now,
      estado: 'activo',
      notas: JSON.stringify({ _opexCategoria: 'comunidad' }),
      createdAt: now,
      updatedAt: now,
    };

    await db.add('compromisosRecurrentes', compromiso as CompromisoRecurrente);
    await db.add('gastosInmueble', {
      inmuebleId: PROPERTY_ID, ejercicio: new Date().getFullYear(),
      fecha: now, concepto: 'Proveedor test', categoria: 'suministro',
      casillaAEAT: '0113', importe: 300, origen: 'tesoreria', estado: 'confirmado',
      createdAt: now, updatedAt: now,
    });

    const annual = await getAnnualOpexForProperty(PROPERTY_ID);
    expect(annual).toBe(1440);
  });

  it('usa fallback legacy cuando no hay compromisos recurrentes', async () => {
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

    await db.add('gastosInmueble', {
      inmuebleId: PROPERTY_ID, ejercicio: new Date().getFullYear(),
      fecha: now, concepto: 'Seguro hogar', categoria: 'seguro',
      casillaAEAT: '0114', importe: 250, origen: 'manual', estado: 'confirmado',
      proveedorNombre: 'Proveedor H5', createdAt: now, updatedAt: now,
    });

    const all = await getAllExpensesForProperty(PROPERTY_ID);
    expect(all.length).toBe(1);
    // gastosInmueble are mapped via mapGasto → source: 'gasto'
    expect(all[0].source).toBe('gasto');
    expect(all[0].expenseClass).toBe('opex');
  });
});

