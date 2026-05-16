// src/services/__tests__/rentabilidadPlanService.test.ts
// TAREA 13 v4 · Commit 6 (A · servicio) · §4.8 spec.
//
// Tests del servicio de rentabilidad TWR/MWR y por bloque. El caso CRÍTICO es
// el caso Jose ING/Indexa/MyInvestor (§1.2 spec) · verificación numérica
// frente a cálculo externo · tolerancia ±0.1 pp.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

const PLAN_ID = 'plan-jose-uuid';

async function seedPlanJose() {
  const { initDB } = await import('../db');
  const { traspasosPlanPensionesService } = await import(
    '../traspasosPlanPensionesService'
  );
  const { aportacionesPlanService } = await import('../aportacionesPlanService');
  const db = await initDB();
  const ahora = new Date().toISOString();

  // Plan PPI · contratado en ING en 2017
  await (db as any).add('planesPensiones', {
    id: PLAN_ID,
    nombre: 'Plan jubilación 2017',
    titular: 'yo',
    personalDataId: 1,
    tipoAdministrativo: 'PPI',
    gestoraActual: 'ING',
    fechaContratacion: '2017-01-15',
    valorActual: 45_000,
    fechaUltimaValoracion: '2017-01-15',
    estado: 'activo',
    origen: 'manual',
    fechaCreacion: ahora,
    fechaActualizacion: ahora,
  });

  // Aportación inicial 45.000 €
  await aportacionesPlanService.crearAportacion({
    planId: PLAN_ID,
    fecha: '2017-01-15',
    ejercicioFiscal: 2017,
    importeTitular: 45_000,
    importeEmpresa: 0,
    origen: 'manual',
    granularidad: 'puntual',
  });

  // Traspaso ING → Indexa · 2021-03-22 · valor 56.000 €
  await traspasosPlanPensionesService.registrarTraspaso({
    planId: PLAN_ID,
    fechaEjecucion: '2021-03-22',
    gestoraOrigen: 'ING',
    gestoraDestino: 'Indexa',
    valorTraspaso: 56_000,
    importeTraspasado: 56_000,
    esTotal: true,
  });

  // Traspaso Indexa → MyInvestor · 2025-06-10 · valor 86.000 €
  await traspasosPlanPensionesService.registrarTraspaso({
    planId: PLAN_ID,
    fechaEjecucion: '2025-06-10',
    gestoraOrigen: 'Indexa',
    gestoraDestino: 'MyInvestor',
    valorTraspaso: 86_000,
    importeTraspasado: 86_000,
    esTotal: true,
  });

  // Valor actual hoy (sintético · 2026-05-05) = 96.000 €
  const plan = await (db as any).get('planesPensiones', PLAN_ID);
  await (db as any).put('planesPensiones', {
    ...plan,
    valorActual: 96_000,
    fechaUltimaValoracion: '2026-05-05',
  });
}

describe('rentabilidadPlanService · caso Jose ING/Indexa/MyInvestor', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('getRentabilidadPorBloque · 3 bloques con TWR esperado ±0.5 pp', async () => {
    await seedPlanJose();
    const { getRentabilidadPorBloque } = await import(
      '../rentabilidadPlanService'
    );
    const bloques = await getRentabilidadPorBloque(PLAN_ID);
    expect(bloques).toHaveLength(3);

    // Bloque 1 ING · 45k → 56k · ~4.18 años
    expect(bloques[0].gestora).toBe('ING');
    expect(bloques[0].valorInicio).toBe(0);
    expect(bloques[0].valorFin).toBe(56_000);
    expect(bloques[0].aportacionesBloque).toBe(45_000);
    expect(bloques[0].TWR).not.toBeNull();
    // Esperado ~5.4 %/año (spec dice 5.5%) · tolerancia 0.5 pp
    expect(bloques[0].TWR! * 100).toBeGreaterThan(5.0);
    expect(bloques[0].TWR! * 100).toBeLessThan(6.0);

    // Bloque 2 Indexa · 56k → 86k · ~4.22 años
    expect(bloques[1].gestora).toBe('Indexa');
    expect(bloques[1].valorInicio).toBe(56_000);
    expect(bloques[1].valorFin).toBe(86_000);
    expect(bloques[1].aportacionesBloque).toBe(0);
    expect(bloques[1].TWR).not.toBeNull();
    // Esperado ~10.8 %/año (spec dice 11.2%) · tolerancia 0.5 pp
    expect(bloques[1].TWR! * 100).toBeGreaterThan(10.0);
    expect(bloques[1].TWR! * 100).toBeLessThan(12.0);

    // Bloque 3 MyInvestor · 86k → 96k · ~0.90 años · TWR sin anualizar
    expect(bloques[2].gestora).toBe('MyInvestor');
    expect(bloques[2].valorInicio).toBe(86_000);
    expect(bloques[2].valorFin).toBe(96_000);
    expect(bloques[2].esBloqueActual).toBe(true);
    expect(bloques[2].TWR).not.toBeNull();
    // Esperado ~11.6 % en ~11 meses (HPR sin anualizar)
    expect(bloques[2].TWR! * 100).toBeGreaterThan(10.0);
    expect(bloques[2].TWR! * 100).toBeLessThan(13.0);
  });

  it('semáforos correctos entre bloques', async () => {
    await seedPlanJose();
    const { getRentabilidadComparativaBloques } = await import(
      '../rentabilidadPlanService'
    );
    const r = await getRentabilidadComparativaBloques(PLAN_ID);
    expect(r.bloques[0].diferenciaConAnterior?.semaforo).toBe('sin_comparar');
    // bloque 2 (10.8%) vs bloque 1 (5.4%) · ~+5.4 pp · MEJOR
    expect(r.bloques[1].diferenciaConAnterior?.semaforo).toBe('mejor');
    // bloque 3 (~11.6%) vs bloque 2 (~10.8%) · +0.8 pp · IGUAL (umbral 1pp)
    expect(['mejor', 'igual']).toContain(
      r.bloques[2].diferenciaConAnterior?.semaforo,
    );
    expect(r.conclusionGeneral === 'mejorando' || r.conclusionGeneral === 'mixto').toBe(true);
  });

  it('getRentabilidadTotal · TWR total ~8.5 %/año · plusvalía 51k · 113%', async () => {
    await seedPlanJose();
    const { getRentabilidadTotal } = await import('../rentabilidadPlanService');
    const r = await getRentabilidadTotal(PLAN_ID);
    expect(r.capitalAportadoTotal).toBe(45_000);
    expect(r.valorActual).toBe(96_000);
    expect(r.plusvaliaAbsoluta).toBe(51_000);
    expect(r.plusvaliaRelativa).toBeCloseTo(51_000 / 45_000, 3);
    expect(r.numeroBloques).toBe(3);
    expect(r.periodoAños).toBeGreaterThan(9);
    expect(r.periodoAños).toBeLessThan(10);
    // TWR anualizado · esperado ~8.5 %/año · tolerancia 0.5 pp
    expect(r.TWR).not.toBeNull();
    expect(r.TWR! * 100).toBeGreaterThan(8.0);
    expect(r.TWR! * 100).toBeLessThan(9.5);
    // MWR ~ TWR cuando solo hay aportación inicial (el dinero entró todo al
    // principio).
    expect(r.MWR).not.toBeNull();
    expect(r.MWR! * 100).toBeGreaterThan(8.0);
    expect(r.MWR! * 100).toBeLessThan(9.5);
  });
});

describe('rentabilidadPlanService · casos especiales §4.6', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('plan recién creado sin aportaciones ni valoración · TWR/MWR null', async () => {
    const { initDB } = await import('../db');
    const db = await initDB();
    const ahora = new Date().toISOString();
    await (db as any).add('planesPensiones', {
      id: 'plan-vacio',
      nombre: 'Vacío',
      titular: 'yo',
      personalDataId: 1,
      tipoAdministrativo: 'PPI',
      gestoraActual: 'X',
      fechaContratacion: '2026-01-01',
      valorActual: 0,
      estado: 'activo',
      origen: 'manual',
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    });
    const { getRentabilidadTotal } = await import('../rentabilidadPlanService');
    const r = await getRentabilidadTotal('plan-vacio');
    expect(r.TWR).toBeNull();
    expect(r.MWR).toBeNull();
    expect(r.plusvaliaAbsoluta).toBe(0);
  });

  it('plan único bloque · semáforo sin_comparar', async () => {
    const { initDB } = await import('../db');
    const { aportacionesPlanService } = await import('../aportacionesPlanService');
    const db = await initDB();
    const ahora = new Date().toISOString();
    await (db as any).add('planesPensiones', {
      id: 'plan-1bloque',
      nombre: '1 bloque',
      titular: 'yo',
      personalDataId: 1,
      tipoAdministrativo: 'PPI',
      gestoraActual: 'ING',
      fechaContratacion: '2020-01-01',
      valorActual: 12_000,
      fechaUltimaValoracion: '2026-01-01',
      estado: 'activo',
      origen: 'manual',
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    });
    await aportacionesPlanService.crearAportacion({
      planId: 'plan-1bloque',
      fecha: '2020-01-01',
      ejercicioFiscal: 2020,
      importeTitular: 10_000,
      importeEmpresa: 0,
      origen: 'manual',
      granularidad: 'puntual',
    });
    const { getRentabilidadPorBloque } = await import(
      '../rentabilidadPlanService'
    );
    const bloques = await getRentabilidadPorBloque('plan-1bloque');
    expect(bloques).toHaveLength(1);
    expect(bloques[0].diferenciaConAnterior?.semaforo).toBe('sin_comparar');
  });
});

describe('rentabilidadPlanService · helpers internos', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('calcularMWR · 1 entrada y 1 salida · IRR cercano a r esperado', async () => {
    const { _internals } = await import('../rentabilidadPlanService');
    // Aportación 1.000 € hoy · valor 1.500 € en 5 años · IRR esperado ~8.45%
    const cfs = [
      { fecha: '2020-01-01', importe: 1000 },
      { fecha: '2025-01-01', importe: -1500 },
    ];
    const r = _internals.calcularMWR(cfs);
    expect(r).not.toBeNull();
    expect(r! * 100).toBeGreaterThan(8.0);
    expect(r! * 100).toBeLessThan(9.0);
  });

  it('calcularMWR · 1 solo signo · null', async () => {
    const { _internals } = await import('../rentabilidadPlanService');
    const r = _internals.calcularMWR([
      { fecha: '2020-01-01', importe: 1000 },
      { fecha: '2025-01-01', importe: 500 },
    ]);
    expect(r).toBeNull();
  });

  it('calcularTWRSimple · valorInicio 100 · final 110 · CF 0 · 10%', async () => {
    const { _internals } = await import('../rentabilidadPlanService');
    expect(_internals.calcularTWRSimple(100, 110, 0)).toBeCloseTo(0.1, 5);
  });

  it('anualizar · <1 año · null', async () => {
    const { _internals } = await import('../rentabilidadPlanService');
    expect(_internals.anualizar(0.05, 0.5)).toBeNull();
  });

  it('anualizar · 5 años · 0.10 → ~1.92 %/año', async () => {
    const { _internals } = await import('../rentabilidadPlanService');
    const r = _internals.anualizar(0.10, 5);
    expect(r).not.toBeNull();
    expect(r! * 100).toBeCloseTo(1.92, 1);
  });

  // Pulido T13 v4 final · issue 3 · cuando `1 + rPeriodo <= 0` (valorFin=0 y
  // cashFlow positivo), anualizar haría Math.pow(negativo, fracción)=NaN. El
  // fix devuelve null para que el caller renderice '—' en lugar de "NaN%" o
  // "-100,0%" engañoso.
  it('anualizar · 1 + rPeriodo == 0 · null (sin valoración registrada)', async () => {
    const { _internals } = await import('../rentabilidadPlanService');
    expect(_internals.anualizar(-1, 5)).toBeNull();
  });
  it('anualizar · 1 + rPeriodo < 0 · null (no NaN)', async () => {
    const { _internals } = await import('../rentabilidadPlanService');
    expect(_internals.anualizar(-9.36, 5)).toBeNull();
  });
});
