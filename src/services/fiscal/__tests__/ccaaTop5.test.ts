// ============================================================================
// ATLAS · TAREA 18.1 · Tests · Cobertura CCAA Top 5 mercado
// ============================================================================
//
// 5 CCAA × 4-5 tests · 22 tests totales · cubre §4.5 spec.
// Cataluña · Andalucía · Comunitat Valenciana · Illes Balears · Castilla y León.
// ============================================================================

import type { FiscalContext } from '../../fiscalContextService';
import type { DatosBaseDeduccion } from '../tipos';
import {
  getReglasCcaa,
  evaluarElegibilidad,
} from '../deduccionesAutonomicasService';
import { CATALUNA_RULES } from '../ccaaRules/cataluna';
import { ANDALUCIA_RULES } from '../ccaaRules/andalucia';
import { VALENCIA_RULES } from '../ccaaRules/valencia';
import { BALEARES_RULES } from '../ccaaRules/baleares';
import { CASTILLA_Y_LEON_RULES } from '../ccaaRules/castilla_y_leon';
import {
  calcularCuotaBaseGeneralCCAA,
  calcularCuotaPorTramos,
} from '../../irpfCalculationService';

function buildCtx(overrides: Partial<FiscalContext> = {}): FiscalContext {
  return {
    personalDataId: 1,
    nombre: 'Test',
    apellidos: 'User',
    dni: '12345678Z',
    tributacion: 'individual',
    comunidadAutonoma: null,
    fechaNacimiento: null,
    edadActual: null,
    descendientes: [],
    ascendientes: [],
    discapacidadTitular: 'ninguna',
    viviendaHabitual: null,
    fechaActualizacion: '2025-01-01T00:00:00.000Z',
    warnings: [],
    ...overrides,
  };
}

function buildDatos(overrides: Partial<DatosBaseDeduccion> = {}): DatosBaseDeduccion {
  return {
    baseImponibleIndividual: 18000,
    alquilerAnual: 6000,
    fianzaDepositada: true,
    esTitularContrato: true,
    tipoVivienda: 'habitual',
    duracionContratoAnios: 2,
    ...overrides,
  };
}

// ─── 1 · CATALUÑA ───────────────────────────────────────────────────────────

describe('T18.1 · Cataluña', () => {
  test('escala · BI 30.000 · cuota autonómica > 0 · paquete reconocible', () => {
    expect(getReglasCcaa('Cataluña')).toBe(CATALUNA_RULES);
    expect(getReglasCcaa('Catalunya')).toBe(CATALUNA_RULES);
    expect(CATALUNA_RULES.escalaAutonomica.length).toBe(9);
    // Cataluña con verified=false a nivel paquete · escala NO se aplica
    // automáticamente desde irpfCalculationService (cae a fallback estatal).
    // El test escala valida la estructura del paquete · no el integration.
    const tramos = CATALUNA_RULES.escalaAutonomica.map((t) => ({
      hasta: t.baseHasta,
      tipo: t.tipoMarginal,
    }));
    const cuota = calcularCuotaPorTramos(30000, tramos);
    expect(cuota).toBeGreaterThan(0);
  });

  test('mínimo · contribuyente <65 = estatal 5550', () => {
    expect(CATALUNA_RULES.minimoPersonalFamiliar.minimoContribuyente).toBe(5550);
  });

  test('arrendamiento · joven 30 años · BI 18.000 · alquiler 5.000 → ELEGIBLE 500€ (tope alcanzado)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Cataluña', edadActual: 30 });
    const datos = buildDatos({ baseImponibleIndividual: 18000, alquilerAnual: 5000 });
    const r = evaluarElegibilidad(CATALUNA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 10% de 5.000 = 500 · tope individual 500
    expect(r.importeAplicable).toBe(500);
  });

  test('arrendamiento · 50 años · sin paro · sin familia numerosa/monoparental → NO ELEGIBLE', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Cataluña', edadActual: 50 });
    const datos = buildDatos({ alquilerAnual: 8000 });
    const r = evaluarElegibilidad(CATALUNA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(
      r.motivosNoElegible.some((m) => m.includes('no cumple ninguna condición')),
    ).toBe(true);
  });

  test('arrendamiento · 40 años · paro 200 días → ELEGIBLE (vía OR · paro ≥183)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Cataluña', edadActual: 40 });
    const datos = buildDatos({ alquilerAnual: 8000, diasEnParo: 200 });
    const r = evaluarElegibilidad(CATALUNA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 10% × 8000 = 800 · tope 500
    expect(r.importeAplicable).toBe(500);
  });

  test('arrendamiento · familia monoparental conjunta · alquiler 12.000 → ELEGIBLE 1.000€ (tope incrementado)', () => {
    const ctx = buildCtx({
      comunidadAutonoma: 'Cataluña',
      tributacion: 'conjunta',
      edadActual: 40,
    });
    const datos = buildDatos({
      baseImponibleIndividual: 22000,
      baseImponibleConjunta: 22000,
      alquilerAnual: 12000,
      familiaMonoparental: true,
    });
    const r = evaluarElegibilidad(CATALUNA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 10% × 12000 = 1200 · tope incrementado 1000
    expect(r.importeAplicable).toBe(1000);
  });

  test('arrendamiento · familia monoparental INDIVIDUAL · alquiler 12.000 → ELEGIBLE 1.000€ (tope incrementado en individual también)', () => {
    // T18.1 fix Copilot · tope 1.000€ aplica también en individual cuando
    // hay familia numerosa/monoparental · DL 1/2024 art. 612-3.
    const ctx = buildCtx({
      comunidadAutonoma: 'Cataluña',
      tributacion: 'individual',
      edadActual: 40,
    });
    const datos = buildDatos({
      baseImponibleIndividual: 22000,
      alquilerAnual: 12000,
      familiaMonoparental: true,
    });
    const r = evaluarElegibilidad(CATALUNA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    expect(r.importeAplicable).toBe(1000);
  });

  test('arrendamiento · familia numerosa INDIVIDUAL · alquiler 8.000 → ELEGIBLE 800€ (10% bruto · NO alcanza tope incrementado)', () => {
    const ctx = buildCtx({
      comunidadAutonoma: 'Cataluña',
      edadActual: 40,
    });
    const datos = buildDatos({
      baseImponibleIndividual: 18000,
      alquilerAnual: 8000,
      familiaNumerosa: 'general',
    });
    const r = evaluarElegibilidad(CATALUNA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 10% × 8000 = 800 · tope incrementado 1000 NO alcanzado
    expect(r.importeAplicable).toBe(800);
  });
});

// ─── 2 · ANDALUCÍA ──────────────────────────────────────────────────────────

describe('T18.1 · Andalucía', () => {
  test('escala · 5 tramos · paquete registrado', () => {
    expect(getReglasCcaa('Andalucía')).toBe(ANDALUCIA_RULES);
    expect(ANDALUCIA_RULES.escalaAutonomica.length).toBe(5);
  });

  test('mínimo · contribuyente <65 = estatal 5550 (provisional · TODO auditar)', () => {
    expect(ANDALUCIA_RULES.minimoPersonalFamiliar.minimoContribuyente).toBe(5550);
  });

  test('arrendamiento · 30 años · BI 20.000 · alquiler 5.000 → ELEGIBLE 750€ (15% × 5.000)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Andalucía', edadActual: 30 });
    const datos = buildDatos({ baseImponibleIndividual: 20000, alquilerAnual: 5000 });
    const r = evaluarElegibilidad(ANDALUCIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 15% × 5000 = 750 · tope 1200
    expect(r.importeAplicable).toBe(750);
  });

  test('arrendamiento · 70 años · BI 20.000 · alquiler 9.000 → ELEGIBLE 1.200€ (tope general)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Andalucía', edadActual: 70 });
    const datos = buildDatos({ baseImponibleIndividual: 20000, alquilerAnual: 9000 });
    const r = evaluarElegibilidad(ANDALUCIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 15% × 9000 = 1350 · tope 1200
    expect(r.importeAplicable).toBe(1200);
  });

  test('arrendamiento · 30 años · BI 26.000 (>25.000) → NO ELEGIBLE motivo BI', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Andalucía', edadActual: 30 });
    const datos = buildDatos({ baseImponibleIndividual: 26000, alquilerAnual: 5000 });
    const r = evaluarElegibilidad(ANDALUCIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('25.000'))).toBe(true);
  });

  test('arrendamiento · 30 años · discapacidad ≥33% → tope 1.500€ aplicado', () => {
    const ctx = buildCtx({
      comunidadAutonoma: 'Andalucía',
      edadActual: 30,
      discapacidadTitular: 'entre33y65',
    });
    const datos = buildDatos({ baseImponibleIndividual: 20000, alquilerAnual: 12000 });
    const r = evaluarElegibilidad(ANDALUCIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 15% × 12000 = 1800 · tope discapacidad 1500
    expect(r.importeAplicable).toBe(1500);
  });
});

// ─── 3 · COMUNITAT VALENCIANA ──────────────────────────────────────────────

describe('T18.1 · Valencia', () => {
  test('escala · 9 tramos · 10% min · 29,5% max', () => {
    expect(getReglasCcaa('Valencia')).toBe(VALENCIA_RULES);
    expect(VALENCIA_RULES.escalaAutonomica.length).toBe(9);
    expect(VALENCIA_RULES.escalaAutonomica[0].tipoMarginal).toBe(0.1);
    expect(VALENCIA_RULES.escalaAutonomica[8].tipoMarginal).toBe(0.295);
  });

  test('mínimo · contribuyente <65 = estatal 5550 (provisional)', () => {
    expect(VALENCIA_RULES.minimoPersonalFamiliar.minimoContribuyente).toBe(5550);
  });

  test('arrendamiento · 32 años · BI 18.000 · alquiler 6.000 → ELEGIBLE 950€ (25% / tope · 1 condición ≤35)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Comunitat Valenciana', edadActual: 32 });
    const datos = buildDatos({ baseImponibleIndividual: 18000, alquilerAnual: 6000 });
    const r = evaluarElegibilidad(VALENCIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 1 condición (≤35) → 25% · tope 950
    // 25% × 6000 × factorReduccion(BI=18000) = 1500 × 1 = 1500 → tope 950
    expect(r.importeAplicable).toBe(950);
  });

  test('arrendamiento · 30 años + víctima violencia · alquiler 6.000 → ELEGIBLE 1.100€ (2 condiciones · 30%)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Valencia', edadActual: 30 });
    const datos = buildDatos({
      baseImponibleIndividual: 18000,
      alquilerAnual: 6000,
      esVictimaViolenciaGenero: true,
    });
    const r = evaluarElegibilidad(VALENCIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 2 condiciones (≤35 + violencia) → 30% · tope 1.100
    // 30% × 6000 × 1 = 1800 → tope 1100
    expect(r.importeAplicable).toBe(1100);
  });

  test('arrendamiento · BI 28.500 (zona reducción progresiva 27k-30k) · importe reducido por fórmula', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Valencia', edadActual: 30 });
    const datos = buildDatos({ baseImponibleIndividual: 28500, alquilerAnual: 6000 });
    const r = evaluarElegibilidad(VALENCIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // BI 28500 · factor = 1 - (28500-27000)/3000 = 1 - 0.5 = 0.5
    // 1 condición (edad) → 25% · tope 950
    // 25% × 6000 × 0.5 = 750 (NO alcanza tope · reducción aplicada)
    expect(r.importeAplicable).toBe(750);
    expect(r.importeAplicable).toBeLessThan(950); // tope NO alcanzado por fórmula
  });

  test('arrendamiento · BI 31.000 (>30.000 max) → NO ELEGIBLE', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Valencia', edadActual: 30 });
    const datos = buildDatos({ baseImponibleIndividual: 31000, alquilerAnual: 6000 });
    const r = evaluarElegibilidad(VALENCIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('29.999'))).toBe(true);
  });

  test('arrendamiento · BI 30.000 EXACTO (umbral) → NO ELEGIBLE (factor 0 de fórmula · alineado)', () => {
    // T18.1 fix Copilot · umbral exact 30.000 ahora se trata como NO
    // elegible · evita el caso confuso "elegible con importe 0".
    const ctx = buildCtx({ comunidadAutonoma: 'Valencia', edadActual: 30 });
    const datos = buildDatos({ baseImponibleIndividual: 30000, alquilerAnual: 6000 });
    const r = evaluarElegibilidad(VALENCIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('29.999'))).toBe(true);
  });
});

// ─── 4 · ILLES BALEARS ─────────────────────────────────────────────────────

describe('T18.1 · Baleares', () => {
  test('escala · 9 tramos · 9% min · 24,75% max', () => {
    expect(getReglasCcaa('Baleares')).toBe(BALEARES_RULES);
    expect(BALEARES_RULES.escalaAutonomica.length).toBe(9);
    expect(BALEARES_RULES.escalaAutonomica[0].tipoMarginal).toBe(0.09);
    expect(BALEARES_RULES.escalaAutonomica[8].tipoMarginal).toBe(0.2475);
    expect(getReglasCcaa('Illes Balears')).toBe(BALEARES_RULES);
  });

  test('mínimo · contribuyente <65 = estatal 5550 (provisional)', () => {
    expect(BALEARES_RULES.minimoPersonalFamiliar.minimoContribuyente).toBe(5550);
  });

  test('arrendamiento · 33 años · BI 25.000 · alquiler 5.000 → ELEGIBLE 530€ (15% base · tope alcanzado)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Illes Balears', edadActual: 33 });
    const datos = buildDatos({ baseImponibleIndividual: 25000, alquilerAnual: 5000 });
    const r = evaluarElegibilidad(BALEARES_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 15% × 5000 = 750 · tope 530 · NO cumple incrementado (33 años > 30)
    expect(r.importeAplicable).toBe(530);
  });

  test('arrendamiento · 28 años (≤30) · alquiler 5.000 → ELEGIBLE 650€ (20% incrementado · tope alcanzado)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Baleares', edadActual: 28 });
    const datos = buildDatos({ baseImponibleIndividual: 25000, alquilerAnual: 5000 });
    const r = evaluarElegibilidad(BALEARES_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 20% × 5000 = 1000 · tope incrementado 650
    expect(r.importeAplicable).toBe(650);
  });

  test('arrendamiento · 50 años · NO ≤36 ni ≥65 → NO ELEGIBLE motivo OR', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Baleares', edadActual: 50 });
    const datos = buildDatos({ alquilerAnual: 6000 });
    const r = evaluarElegibilidad(BALEARES_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(
      r.motivosNoElegible.some((m) => m.includes('no cumple ninguna condición')),
    ).toBe(true);
  });

  test('arrendamiento · 33 años · BI 35.000 (>33.000) → NO ELEGIBLE motivo BI', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Baleares', edadActual: 33 });
    const datos = buildDatos({ baseImponibleIndividual: 35000, alquilerAnual: 5000 });
    const r = evaluarElegibilidad(BALEARES_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('33.000'))).toBe(true);
  });
});

// ─── 5 · CASTILLA Y LEÓN ────────────────────────────────────────────────────

describe('T18.1 · Castilla y León', () => {
  test('escala · 5 tramos · 9% min · 21,5% max', () => {
    expect(getReglasCcaa('Castilla y León')).toBe(CASTILLA_Y_LEON_RULES);
    expect(CASTILLA_Y_LEON_RULES.escalaAutonomica.length).toBe(5);
    expect(CASTILLA_Y_LEON_RULES.escalaAutonomica[0].tipoMarginal).toBe(0.09);
    expect(CASTILLA_Y_LEON_RULES.escalaAutonomica[4].tipoMarginal).toBe(0.215);
  });

  test('mínimo · contribuyente <65 = estatal 5550 (CyL idéntico a estatal)', () => {
    expect(CASTILLA_Y_LEON_RULES.minimoPersonalFamiliar.minimoContribuyente).toBe(5550);
    expect(CASTILLA_Y_LEON_RULES.minimoPersonalFamiliar.descendiente1).toBe(2400);
  });

  test('arrendamiento jóvenes · 30 años · BI 16.000 · alquiler 3.000 · sin ayudas → ELEGIBLE 459€ (20% · tope)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Castilla y León', edadActual: 30 });
    const datos = buildDatos({ baseImponibleIndividual: 16000, alquilerAnual: 3000 });
    const r = evaluarElegibilidad(CASTILLA_Y_LEON_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 20% × 3000 = 600 · tope 459
    expect(r.importeAplicable).toBe(459);
  });

  test('arrendamiento jóvenes · ayudas bono alquiler 1.000 · base se reduce ANTES del tope', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Castilla y León', edadActual: 30 });
    const datos = buildDatos({
      baseImponibleIndividual: 16000,
      alquilerAnual: 3000,
      ayudasPublicasArrendamiento: 1000,
    });
    const r = evaluarElegibilidad(CASTILLA_Y_LEON_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // base = max(0, 3000 - 1000) = 2000 · 20% × 2000 = 400 · tope 459 NO alcanzado
    expect(r.importeAplicable).toBe(400);
  });

  test('arrendamiento jóvenes · 36 años (no <36) → NO ELEGIBLE motivo edad', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Castilla y León', edadActual: 36 });
    const datos = buildDatos({ baseImponibleIndividual: 16000, alquilerAnual: 3000 });
    const r = evaluarElegibilidad(CASTILLA_Y_LEON_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('edad >'))).toBe(true);
  });

  test('arrendamiento jóvenes · BI 20.000 (>18.900) → NO ELEGIBLE motivo BI', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Castilla y León', edadActual: 30 });
    const datos = buildDatos({ baseImponibleIndividual: 20000, alquilerAnual: 3000 });
    const r = evaluarElegibilidad(CASTILLA_Y_LEON_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('18.900'))).toBe(true);
  });
});

// ─── Cero regresión Madrid ──────────────────────────────────────────────────

describe('T18.1 · Cero regresión Madrid', () => {
  test('Madrid sigue funcionando · 30 años · BI 18.000 · alquiler 6.000 → 1.237,20€', () => {
    const reglas = getReglasCcaa('Madrid');
    expect(reglas.ccaa).toBe('Madrid');
    expect(reglas.verified).toBe(true);
    const ctx = buildCtx({ comunidadAutonoma: 'Madrid', edadActual: 30 });
    const datos = buildDatos({
      baseImponibleIndividual: 18000,
      alquilerAnual: 6000,
      // Madrid requiere fianza · ya seteada en buildDatos
    });
    const r = evaluarElegibilidad(reglas.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    expect(r.importeAplicable).toBe(1237.2);
  });

  test('Madrid · escala BOE aplicada (verified=true · sin regresión)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Madrid' });
    const r = calcularCuotaBaseGeneralCCAA(30000, ctx, 2024);
    expect(r.escalaAutonomicaAplicada).toBe(true);
    expect(r.escalaAutonomicaUsada.verified).toBe(true);
  });
});
