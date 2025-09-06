// UNICORNIO REFACTOR - Demo data for unified expenses testing

import { ExpenseH5, TipoGasto, EstadoConciliacion } from '../services/db';

export const createSampleUnifiedExpenses = (): ExpenseH5[] => {
  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return [
    {
      id: 1001,
      date: today,
      provider: 'Iberdrola',
      providerNIF: 'A95758389',
      concept: 'Factura electricidad enero 2024',
      amount: 89.45,
      currency: 'EUR',
      fiscalType: 'suministros',
      taxYear: 2024,
      taxIncluded: true,
      unit: 'completo',
      prorationMethod: 'metros-cuadrados',
      prorationDetail: '100%',
      status: 'validado',
      origin: 'inbox',
      // UNICORNIO REFACTOR: New unified fields
      tipo_gasto: 'suministro_electricidad' as TipoGasto,
      destino: 'inmueble',
      destino_id: 1,
      estado_conciliacion: 'pendiente' as EstadoConciliacion,
      utility_type: 'electricity',
      supply_address: 'C/ Tenderina 48, 2ºA',
      iban_masked: '****1234',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 1002,
      date: lastMonth,
      provider: 'Reformas García',
      providerNIF: 'B12345678',
      concept: 'Reforma integral cocina',
      amount: 2500.00,
      currency: 'EUR',
      fiscalType: 'capex-mejora-ampliacion',
      taxYear: 2024,
      taxIncluded: true,
      unit: 'completo',
      prorationMethod: 'metros-cuadrados',
      prorationDetail: '100%',
      status: 'validado',
      origin: 'inbox',
      // UNICORNIO REFACTOR: New unified fields
      tipo_gasto: 'mejora' as TipoGasto,
      destino: 'inmueble',
      destino_id: 1,
      estado_conciliacion: 'conciliado' as EstadoConciliacion,
      desglose_amortizable: {
        mejora_importe: 1800.00,
        mobiliario_importe: 700.00,
        ficha_activo_id: 101
      },
      reform_breakdown: {
        mejora: 1800.00,
        mobiliario: 700.00,
        reparacion_conservacion: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 1003,
      date: today,
      provider: 'Administración Fincas López',
      providerNIF: 'B87654321',
      concept: 'Cuota comunidad enero 2024',
      amount: 120.00,
      currency: 'EUR',
      fiscalType: 'comunidad',
      taxYear: 2024,
      taxIncluded: true,
      unit: 'completo',
      prorationMethod: 'metros-cuadrados',
      prorationDetail: '100%',
      status: 'validado',
      origin: 'manual',
      // UNICORNIO REFACTOR: New unified fields
      tipo_gasto: 'comunidad' as TipoGasto,
      destino: 'inmueble',
      destino_id: 1,
      estado_conciliacion: 'pendiente' as EstadoConciliacion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 1004,
      date: lastMonth,
      provider: 'Mapfre Seguros',
      providerNIF: 'A28141932',
      concept: 'Seguro hogar - prima anual',
      amount: 180.50,
      currency: 'EUR',
      fiscalType: 'seguros',
      taxYear: 2024,
      taxIncluded: true,
      unit: 'completo',
      prorationMethod: 'metros-cuadrados',
      prorationDetail: '100%',
      status: 'validado',
      origin: 'manual',
      // UNICORNIO REFACTOR: New unified fields
      tipo_gasto: 'seguro' as TipoGasto,
      destino: 'inmueble',
      destino_id: 1,
      estado_conciliacion: 'conciliado' as EstadoConciliacion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 1005,
      date: today,
      provider: 'Fontanero Express',
      providerNIF: 'Z12345678',
      concept: 'Reparación grifo cocina',
      amount: 85.00,
      currency: 'EUR',
      fiscalType: 'reparacion-conservacion',
      taxYear: 2024,
      taxIncluded: true,
      unit: 'completo',
      prorationMethod: 'metros-cuadrados',
      prorationDetail: '100%',
      status: 'pendiente',
      origin: 'manual',
      // UNICORNIO REFACTOR: New unified fields
      tipo_gasto: 'reparacion_conservacion' as TipoGasto,
      destino: 'inmueble',
      destino_id: 1,
      estado_conciliacion: 'pendiente' as EstadoConciliacion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 1006,
      date: today,
      provider: 'Netflix',
      providerNIF: 'W0184081H',
      concept: 'Suscripción mensual Netflix',
      amount: 15.99,
      currency: 'EUR',
      fiscalType: 'servicios-personales',
      taxYear: 2024,
      taxIncluded: true,
      unit: 'completo',
      prorationMethod: 'metros-cuadrados',
      prorationDetail: '100%',
      status: 'validado',
      origin: 'manual',
      // UNICORNIO REFACTOR: New unified fields - Personal expense
      tipo_gasto: 'otros' as TipoGasto,
      destino: 'personal',
      estado_conciliacion: 'conciliado' as EstadoConciliacion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
};

export const loadUnifiedExpensesDemo = async () => {
  console.log('🎯 UNICORNIO REFACTOR - Cargando demo de gastos unificados...');
  
  const expenses = createSampleUnifiedExpenses();
  console.log(`📊 Creados ${expenses.length} gastos de ejemplo con estructura unificada:`);
  
  expenses.forEach(expense => {
    console.log(`- ${expense.concept} (${expense.tipo_gasto}) - ${expense.amount}€ - ${expense.destino === 'personal' ? 'Personal' : 'Inmueble'}`);
  });
  
  return expenses;
};