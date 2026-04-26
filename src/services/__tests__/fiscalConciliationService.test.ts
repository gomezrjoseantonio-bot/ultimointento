// Tests for fiscalConciliationService — Tarea 1.9 Epic #414

import { initDB } from '../db';
import {
  conciliarEjercicioFiscal,
  obtenerImporteFiscalConciliado,
  esMesPasadoOPresente,
  buildLineItem,
  FiscalLineItem,
} from '../fiscalConciliationService';
import { calcularDeclaracionIRPF } from '../irpfCalculationService';

const EJERCICIO = 2023; // Año completamente pasado → todos los meses son pasados
const EJERCICIO_FUTURO = 2099;

// ─── Setup helpers ────────────────────────────────────────────────────────────

async function clearStores() {
  const db = await initDB();
  await Promise.all([
    db.clear('properties'),
    db.clear('contracts'),
    db.clear('ingresos'),
    db.clear('gastosInmueble'),
    db.clear('treasuryEvents'),
    // V63 (sub-tarea 4): los stores `nominas` y `autonomos` se eliminaron;
    // los registros viven en `ingresos`. `opexRules` se eliminó en V62.
    db.clear('prestamos'),
  ]);
}

function makeProperty(id: number, alias = `Inmueble ${id}`) {
  return { id, alias, state: 'activo' };
}

function makeContract(id: number, propertyId: number, rentaMensual: number, mesInicio = 1, mesFin = 12) {
  return {
    id,
    inmuebleId: propertyId,
    rentaMensual,
    fechaInicio: `${EJERCICIO}-${String(mesInicio).padStart(2, '0')}-01`,
    fechaFin: `${EJERCICIO}-${String(mesFin).padStart(2, '0')}-28`,
    modalidad: 'habitual',
  };
}

function makeIngreso(
  id: number,
  propertyId: number,
  importe: number,
  mes: number,
  estado: 'previsto' | 'cobrado' = 'cobrado',
  movementId: number | null = 1
) {
  return {
    id,
    origen: 'contrato_id' as const,
    origen_id: 1,
    contraparte: 'Inquilino',
    fecha_emision: `${EJERCICIO}-${String(mes).padStart(2, '0')}-01`,
    fecha_prevista_cobro: `${EJERCICIO}-${String(mes).padStart(2, '0')}-05`,
    importe,
    moneda: 'EUR' as const,
    destino: 'inmueble_id' as const,
    destino_id: propertyId,
    estado,
    movement_id: movementId ?? undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeGasto(
  _id: number,
  propertyId: number,
  total: number,
  mes: number,
  estado: 'completo' | 'incompleto' | 'pagado' = 'pagado',
  movementId: number | null = 1
) {
  return {
    inmuebleId: propertyId,
    ejercicio: EJERCICIO,
    fecha: `${EJERCICIO}-${String(mes).padStart(2, '0')}-01`,
    concepto: 'Proveedor',
    categoria: 'comunidad',
    casillaAEAT: '0109',
    importe: total,
    origen: 'tesoreria',
    estado: estado === 'pagado' ? 'confirmado' : 'previsto',
    movimientoId: movementId ? String(movementId) : undefined,
    proveedorNombre: 'Proveedor',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('esMesPasadoOPresente', () => {
  it('returns true for a completely past year', () => {
    expect(esMesPasadoOPresente(1, 2020)).toBe(true);
    expect(esMesPasadoOPresente(12, 2020)).toBe(true);
  });

  it('returns false for a completely future year', () => {
    expect(esMesPasadoOPresente(1, EJERCICIO_FUTURO)).toBe(false);
    expect(esMesPasadoOPresente(12, EJERCICIO_FUTURO)).toBe(false);
  });
});

describe('buildLineItem', () => {
  it('sets fuente=estimado when real is null', () => {
    const item = buildLineItem({
      ejercicio: EJERCICIO,
      concepto: 'Test',
      categoria: 'ingresos_alquiler',
      mes: 1,
      estimado: 1000,
      real: null,
    });
    expect(item.fuente).toBe('estimado');
    expect(item.desviacion).toBeNull();
    expect(item.desviacionPct).toBeNull();
  });

  it('calculates deviation correctly when real is provided for a past month', () => {
    const item = buildLineItem({
      ejercicio: EJERCICIO,
      concepto: 'Test',
      categoria: 'ingresos_alquiler',
      mes: 3,
      estimado: 1000,
      real: 950,
    });
    expect(item.fuente).toBe('real');
    expect(item.real).toBe(950);
    expect(item.desviacion).toBe(-50);
    expect(item.desviacionPct).toBe(-5);
  });

  it('forces fuente=estimado for future months even if real is provided', () => {
    const item = buildLineItem({
      ejercicio: EJERCICIO_FUTURO,
      concepto: 'Test',
      categoria: 'nomina',
      mes: 6,
      estimado: 2000,
      real: 2100, // This should be ignored for future months
    });
    expect(item.fuente).toBe('estimado');
    expect(item.real).toBeNull();
    expect(item.desviacion).toBeNull();
  });

  it('desviacion=-50 y desviacionPct=-5 para estimado=1000 real=950', () => {
    const item = buildLineItem({
      ejercicio: EJERCICIO,
      concepto: 'Alquiler',
      categoria: 'ingresos_alquiler',
      mes: 5,
      estimado: 1000,
      real: 950,
    });
    expect(item.desviacion).toBe(-50);
    expect(item.desviacionPct).toBe(-5);
  });
});

describe('conciliarEjercicioFiscal', () => {
  beforeEach(async () => {
    await clearStores();
  });

  // Test 1: Ejercicio sin datos reales → todas las líneas con fuente='estimado', real=null, cobertura 0%
  it('ejercicio sin datos reales: fuente=estimado, real=null, cobertura 0%', async () => {
    const db = await initDB();
    await db.add('properties', makeProperty(1));
    await db.add('contracts', makeContract(1, 1, 1000));

    const result = await conciliarEjercicioFiscal(EJERCICIO);

    expect(result.ejercicio).toBe(EJERCICIO);
    expect(result.lineas.length).toBeGreaterThan(0);
    expect(result.lineas.every(l => l.fuente === 'estimado')).toBe(true);
    expect(result.lineas.every(l => l.real === null)).toBe(true);
    expect(result.resumen.mesesConReal).toBe(0);
    expect(result.resumen.coberturaPunteo).toBe(0);
  });

  // Test 2: Mes pasado con ingreso cobrado → línea con fuente='real', real=importe cobrado, desviación correcta
  it('mes pasado con ingreso cobrado: fuente=real, desviacion calculada', async () => {
    const db = await initDB();
    await db.add('properties', makeProperty(1));
    await db.add('contracts', makeContract(1, 1, 1000)); // 1000€/mes todo el año
    // Mes 3: cobrado 950€ (desviación = -50€)
    await db.add('ingresos', makeIngreso(1, 1, 950, 3, 'cobrado', 42));

    const result = await conciliarEjercicioFiscal(EJERCICIO);

    const lineaMes3 = result.lineas.find(
      l => l.categoria === 'ingresos_alquiler' && l.mes === 3
    );
    expect(lineaMes3).toBeDefined();
    expect(lineaMes3!.fuente).toBe('real');
    expect(lineaMes3!.real).toBe(950);
    expect(lineaMes3!.estimado).toBe(1000);
    expect(lineaMes3!.desviacion).toBe(-50);
    expect(lineaMes3!.desviacionPct).toBe(-5);
    expect(lineaMes3!.movementId).toBe(42);
  });

  // Test 3: Mes futuro → siempre fuente='estimado' aunque existan eventos predicted
  it('mes futuro: siempre fuente=estimado aunque existan eventos', async () => {
    const db = await initDB();
    await db.add('properties', makeProperty(1));
    // Contrato en ejercicio futuro
    const futuro = EJERCICIO_FUTURO;
    await db.add('contracts', {
      id: 1,
      inmuebleId: 1,
      rentaMensual: 1200,
      fechaInicio: `${futuro}-01-01`,
      fechaFin: `${futuro}-12-31`,
      modalidad: 'habitual',
    });
    // Ingreso "cobrado" en mes futuro — no debería usarse
    await db.add('ingresos', {
      id: 1,
      origen: 'contrato_id',
      contraparte: 'Test',
      fecha_emision: `${futuro}-06-01`,
      fecha_prevista_cobro: `${futuro}-06-05`,
      importe: 1300,
      moneda: 'EUR',
      destino: 'inmueble_id',
      destino_id: 1,
      estado: 'cobrado',
      movement_id: 99,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await conciliarEjercicioFiscal(futuro);

    // Todas las líneas deben ser estimado
    expect(result.lineas.every(l => l.fuente === 'estimado')).toBe(true);
    expect(result.lineas.every(l => l.real === null)).toBe(true);
  });

  // Test 4: Mixto — 6 meses con real, 6 estimados → cobertura 50%
  it('mixto: 6 meses cobrados, 6 sin cobrar → cobertura 50%', async () => {
    const db = await initDB();
    await db.add('properties', makeProperty(3));
    await db.add('contracts', makeContract(1, 3, 1000)); // Todo el año

    // 6 ingresos cobrados (meses 1-6)
    for (let mes = 1; mes <= 6; mes++) {
      await db.add('ingresos', makeIngreso(mes, 3, 1000, mes, 'cobrado', mes * 10));
    }

    const result = await conciliarEjercicioFiscal(EJERCICIO);
    const alquilerLineas = result.lineas.filter(l => l.categoria === 'ingresos_alquiler');

    expect(alquilerLineas).toHaveLength(12);
    const conReal = alquilerLineas.filter(l => l.real !== null).length;
    const sinReal = alquilerLineas.filter(l => l.real === null).length;
    expect(conReal).toBe(6);
    expect(sinReal).toBe(6);
    // Cobertura de la categoría debería ser ~50%
    expect(result.porCategoria['ingresos_alquiler']?.cobertura).toBeCloseTo(50, 1);
  });

  // Test 6: Desviación correcta — estimado 1000€, real 950€ → desviación -50€, desviacionPct -5%
  it('desviacion correcta: estimado 1000, real 950 → desviacion=-50, desviacionPct=-5', async () => {
    const db = await initDB();
    await db.add('properties', makeProperty(4));
    await db.add('contracts', makeContract(1, 4, 1000, 1, 12));
    await db.add('ingresos', makeIngreso(1, 4, 950, 6, 'cobrado', 1));

    const result = await conciliarEjercicioFiscal(EJERCICIO);
    const linea = result.lineas.find(l => l.categoria === 'ingresos_alquiler' && l.mes === 6);

    expect(linea).toBeDefined();
    expect(linea!.desviacion).toBe(-50);
    expect(linea!.desviacionPct).toBe(-5);
  });

  // Test 8 (backward compat): calcularDeclaracionIRPF sin parámetro extra no incluye campo conciliacion
  it('backward compatibility: calcularDeclaracionIRPF sin opciones no incluye conciliacion', async () => {
    const result = await calcularDeclaracionIRPF(EJERCICIO);
    expect(result).not.toHaveProperty('conciliacion');
    expect(result.ejercicio).toBe(EJERCICIO);
  });

  it('calcularDeclaracionIRPF con usarConciliacion=false no incluye conciliacion', async () => {
    const result = await calcularDeclaracionIRPF(EJERCICIO, { usarConciliacion: false });
    expect(result).not.toHaveProperty('conciliacion');
  });

  it('calcularDeclaracionIRPF con usarConciliacion=true incluye campo conciliacion', async () => {
    const result = await calcularDeclaracionIRPF(EJERCICIO, { usarConciliacion: true });
    expect(result).toHaveProperty('conciliacion');
    expect(result.conciliacion).toBeDefined();
    expect(result.conciliacion!.ejercicio).toBe(EJERCICIO);
  });
});

describe('obtenerImporteFiscalConciliado', () => {
  const lineas: FiscalLineItem[] = [
    {
      concepto: 'Alquiler A',
      categoria: 'ingresos_alquiler',
      mes: 1,
      estimado: 1000,
      real: 950,
      fuente: 'real',
      desviacion: -50,
      desviacionPct: -5,
    },
    {
      concepto: 'Alquiler A',
      categoria: 'ingresos_alquiler',
      mes: 2,
      estimado: 1000,
      real: null,
      fuente: 'estimado',
      desviacion: null,
      desviacionPct: null,
    },
    {
      concepto: 'Nómina',
      categoria: 'nomina',
      mes: 1,
      estimado: 2000,
      real: 1980,
      fuente: 'real',
      desviacion: -20,
      desviacionPct: -1,
    },
  ];

  it('returns sum of real where available, estimado otherwise', () => {
    const total = obtenerImporteFiscalConciliado(lineas, 'ingresos_alquiler');
    // mes 1: real=950, mes 2: estimado=1000 → total=1950
    expect(total).toBe(1950);
  });

  it('filters by mes when provided', () => {
    const mes1 = obtenerImporteFiscalConciliado(lineas, 'ingresos_alquiler', 1);
    expect(mes1).toBe(950); // real
    const mes2 = obtenerImporteFiscalConciliado(lineas, 'ingresos_alquiler', 2);
    expect(mes2).toBe(1000); // estimado
  });

  it('returns 0 for unknown category', () => {
    expect(obtenerImporteFiscalConciliado(lineas, 'otros')).toBe(0);
  });
});
