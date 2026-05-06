// ============================================================================
// ATLAS · TAREA 18.3 · Tests · Cobertura CCAA resto + cierre T18
// ============================================================================
//
// 4 CCAA × 4-5 tests = 19 tests · cierre cobertura 15 CCAA régimen común.
// Canarias · Castilla-La Mancha · Extremadura · La Rioja.
// ============================================================================

import type { FiscalContext } from '../../fiscalContextService';
import type { DatosBaseDeduccion } from '../tipos';
import {
  getReglasCcaa,
  evaluarElegibilidad,
  listarCcaaImplementadas,
} from '../deduccionesAutonomicasService';
import { CANARIAS_RULES } from '../ccaaRules/canarias';
import { CASTILLA_LA_MANCHA_RULES } from '../ccaaRules/castilla_la_mancha';
import { EXTREMADURA_RULES } from '../ccaaRules/extremadura';
import { LA_RIOJA_RULES } from '../ccaaRules/la_rioja';

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
    referenciaCatastralPresente: true,
    ...overrides,
  };
}

// ─── 1 · CANARIAS · alquiler >10% BI + ref catastral ───────────────────────

describe('T18.3 · Canarias', () => {
  test('escala · 7 tramos · paquete registrado', () => {
    expect(getReglasCcaa('Canarias')).toBe(CANARIAS_RULES);
    expect(CANARIAS_RULES.escalaAutonomica.length).toBe(7);
  });

  test('alquiler · 30 años · BI 18.000 · alquiler 6.000 (>10% BI) → ELEGIBLE 760€ (tope incrementado <40)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Canarias', edadActual: 30 });
    const datos = buildDatos({ baseImponibleIndividual: 18000, alquilerAnual: 6000 });
    const r = evaluarElegibilidad(CANARIAS_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 24% × 6000 = 1440 · tope <40 760
    expect(r.importeAplicable).toBe(760);
  });

  test('★ alquiler 1.500 € (≤10% BI 18.000) → NO ELEGIBLE motivo "alquiler <10% BI"', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Canarias', edadActual: 30 });
    const datos = buildDatos({ baseImponibleIndividual: 18000, alquilerAnual: 1500 });
    const r = evaluarElegibilidad(CANARIAS_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('alquiler <10%'))).toBe(true);
  });

  test('referencia catastral NO informada → NO ELEGIBLE motivo claro', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Canarias', edadActual: 30 });
    const datos = buildDatos({
      baseImponibleIndividual: 18000,
      alquilerAnual: 6000,
      referenciaCatastralPresente: false,
    });
    const r = evaluarElegibilidad(CANARIAS_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('referencia catastral'))).toBe(true);
  });

  test('alquiler · 50 años (no <40 ni ≥75) → tope general 740€', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Canarias', edadActual: 50 });
    const datos = buildDatos({ baseImponibleIndividual: 18000, alquilerAnual: 6000 });
    const r = evaluarElegibilidad(CANARIAS_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    expect(r.importeAplicable).toBe(740);
  });
});

// ─── 2 · CASTILLA-LA MANCHA · 4 modalidades incompatibles ──────────────────

describe('T18.3 · Castilla-La Mancha · 4 modalidades incompatibles', () => {
  test('escala · 5 tramos · paquete registrado', () => {
    expect(getReglasCcaa('Castilla-La Mancha')).toBe(CASTILLA_LA_MANCHA_RULES);
    expect(CASTILLA_LA_MANCHA_RULES.escalaAutonomica.length).toBe(5);
  });

  test('arrendamiento · joven 30 años · BI 10.000 · alquiler 4.000 → ELEGIBLE 500€ (15% · tope base · NO rural)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Castilla-La Mancha', edadActual: 30 });
    const datos = buildDatos({ baseImponibleIndividual: 10000, alquilerAnual: 4000 });
    const r = evaluarElegibilidad(CASTILLA_LA_MANCHA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 15% × 4000 = 600 · tope 500
    expect(r.importeAplicable).toBe(500);
  });

  test('★ joven + familia numerosa + monoparental + discapacidad → 4 modalidades cumplen · UNA aplica · misma cuantía', () => {
    // Las 4 modalidades dan misma cuantía · cliente que cumple varias
    // recibe la deducción única (no se suman).
    const ctx = buildCtx({
      comunidadAutonoma: 'Castilla-La Mancha',
      edadActual: 30,
      discapacidadTitular: 'mas65',
    });
    const datos = buildDatos({
      baseImponibleIndividual: 10000,
      alquilerAnual: 4000,
      familiaNumerosa: 'general',
      familiaMonoparental: true,
    });
    const r = evaluarElegibilidad(CASTILLA_LA_MANCHA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // Misma cuantía 500 € (NO se suman las 4 modalidades · regla incompatibilidad)
    expect(r.importeAplicable).toBe(500);
  });

  test('arrendamiento · municipio rural ≤2.500 hab → tope incrementado 612€ (20%)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Castilla-La Mancha', edadActual: 30 });
    const datos = buildDatos({
      baseImponibleIndividual: 10000,
      alquilerAnual: 4000,
      municipioPoblacionHabitantes: 1500,
    });
    const r = evaluarElegibilidad(CASTILLA_LA_MANCHA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 20% × 4000 = 800 · tope rural 612
    expect(r.importeAplicable).toBe(612);
  });

  test('arrendamiento · BI 13.000 (>12.500 individual) → NO ELEGIBLE motivo BI', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Castilla-La Mancha', edadActual: 30 });
    const datos = buildDatos({ baseImponibleIndividual: 13000, alquilerAnual: 4000 });
    const r = evaluarElegibilidad(CASTILLA_LA_MANCHA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('12.500'))).toBe(true);
  });

  test('arrendamiento · 50 años SIN ninguna modalidad → NO ELEGIBLE motivo OR', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Castilla-La Mancha', edadActual: 50 });
    const datos = buildDatos({ baseImponibleIndividual: 10000, alquilerAnual: 4000 });
    const r = evaluarElegibilidad(CASTILLA_LA_MANCHA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(
      r.motivosNoElegible.some((m) => m.includes('no cumple ninguna condición')),
    ).toBe(true);
  });
});

// ─── 3 · EXTREMADURA · BI exenta rural+familia ─────────────────────────────

describe('T18.3 · Extremadura · excepción BI rural', () => {
  test('escala · 9 tramos · paquete registrado', () => {
    expect(getReglasCcaa('Extremadura')).toBe(EXTREMADURA_RULES);
    expect(EXTREMADURA_RULES.escalaAutonomica.length).toBe(9);
  });

  test('arrendamiento · joven 30 años · BI 25.000 · alquiler 4.000 · NO rural → ELEGIBLE 1.000€ (30% · tope base)', () => {
    const ctx = buildCtx({
      comunidadAutonoma: 'Extremadura',
      edadActual: 30,
    });
    const datos = buildDatos({
      baseImponibleIndividual: 25000,
      alquilerAnual: 4000,
      propiedadMasMitadOtraVivienda: false,
    });
    const r = evaluarElegibilidad(EXTREMADURA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 30% × 4000 = 1200 · tope 1000
    expect(r.importeAplicable).toBe(1000);
  });

  test('★ familia numerosa rural <3.000 hab · BI 50.000 (excede 30k) → ELEGIBLE (BI exenta) 1.500€ rural', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Extremadura', edadActual: 40 });
    const datos = buildDatos({
      baseImponibleIndividual: 50000,
      alquilerAnual: 6000,
      familiaNumerosa: 'general',
      municipioPoblacionHabitantes: 1500, // rural <3000
      propiedadMasMitadOtraVivienda: false,
    });
    const r = evaluarElegibilidad(EXTREMADURA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 30% × 6000 = 1800 · tope rural 1500
    expect(r.importeAplicable).toBe(1500);
  });

  test('arrendamiento · 50 años · NO joven NI familia NI discapacidad → NO ELEGIBLE motivo OR', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Extremadura', edadActual: 50 });
    const datos = buildDatos({
      baseImponibleIndividual: 25000,
      alquilerAnual: 4000,
      propiedadMasMitadOtraVivienda: false,
    });
    const r = evaluarElegibilidad(EXTREMADURA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(
      r.motivosNoElegible.some((m) => m.includes('no cumple ninguna condición')),
    ).toBe(true);
  });

  test('arrendamiento · titular >50% otra vivienda → NO ELEGIBLE', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Extremadura', edadActual: 30 });
    const datos = buildDatos({
      baseImponibleIndividual: 25000,
      alquilerAnual: 4000,
      propiedadMasMitadOtraVivienda: true,
    });
    const r = evaluarElegibilidad(EXTREMADURA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('50%'))).toBe(true);
  });
});

// ─── 4 · LA RIOJA · ITP/AJD presentado ─────────────────────────────────────

describe('T18.3 · La Rioja · ITP/AJD presentado', () => {
  test('escala · 5 tramos · paquete registrado', () => {
    expect(getReglasCcaa('La Rioja')).toBe(LA_RIOJA_RULES);
    expect(LA_RIOJA_RULES.escalaAutonomica.length).toBe(5);
  });

  test('arrendamiento · joven 30 · BI 15k · alquiler 4k · ITP presentado → ELEGIBLE 300€ (10% · tope base)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'La Rioja', edadActual: 30 });
    const datos = buildDatos({
      baseImponibleIndividual: 15000,
      alquilerAnual: 4000,
      itpAjdPresentado: true,
    });
    const r = evaluarElegibilidad(LA_RIOJA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 10% × 4000 = 400 · tope 300
    expect(r.importeAplicable).toBe(300);
  });

  test('arrendamiento · municipio rural ≤2.500 hab · ITP presentado → tope reforzado 400€ (20%)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'La Rioja', edadActual: 30 });
    const datos = buildDatos({
      baseImponibleIndividual: 15000,
      alquilerAnual: 3000,
      itpAjdPresentado: true,
      municipioPoblacionHabitantes: 800,
    });
    const r = evaluarElegibilidad(LA_RIOJA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 20% × 3000 = 600 · tope rural 400
    expect(r.importeAplicable).toBe(400);
  });

  test('★ ITP/AJD NO presentado → NO ELEGIBLE motivo claro', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'La Rioja', edadActual: 30 });
    const datos = buildDatos({
      baseImponibleIndividual: 15000,
      alquilerAnual: 4000,
      itpAjdPresentado: false,
    });
    const r = evaluarElegibilidad(LA_RIOJA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('ITP/AJD'))).toBe(true);
  });

  test('arrendamiento · 36 años (>35) → NO ELEGIBLE motivo edad', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'La Rioja', edadActual: 36 });
    const datos = buildDatos({
      baseImponibleIndividual: 15000,
      alquilerAnual: 4000,
      itpAjdPresentado: true,
    });
    const r = evaluarElegibilidad(LA_RIOJA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('edad >'))).toBe(true);
  });
});

// ─── Cierre T18 · cobertura 15 CCAA régimen común ──────────────────────────

describe('T18.3 · Cierre · 15 CCAA régimen común cubiertas', () => {
  test('listarCcaaImplementadas · 15 paquetes (cierre T18)', () => {
    const lista = listarCcaaImplementadas();
    expect(lista).toHaveLength(15);
    // Los 15 esperados · régimen común
    const esperados = [
      'madrid', 'cataluna', 'andalucia', 'valencia', 'baleares',
      'castilla_y_leon', 'galicia', 'aragon', 'asturias', 'murcia',
      'cantabria', 'canarias', 'castilla_la_mancha', 'extremadura', 'la_rioja',
    ];
    for (const ccaa of esperados) {
      expect(lista).toContain(ccaa);
    }
  });

  test('cero regresión · Madrid + Cataluña + Andalucía + Valencia + Baleares + CyL + Galicia + Aragón + Asturias + Murcia + Cantabria · paquetes registrados', () => {
    expect(getReglasCcaa('Madrid').ccaa).toBe('Madrid');
    expect(getReglasCcaa('Cataluña').ccaa).toBe('Cataluña');
    expect(getReglasCcaa('Andalucía').ccaa).toBe('Andalucía');
    expect(getReglasCcaa('Valencia').ccaa).toBe('Comunitat Valenciana');
    expect(getReglasCcaa('Baleares').ccaa).toBe('Illes Balears');
    expect(getReglasCcaa('Castilla y León').ccaa).toBe('Castilla y León');
    expect(getReglasCcaa('Galicia').ccaa).toBe('Galicia');
    expect(getReglasCcaa('Aragón').ccaa).toBe('Aragón');
    expect(getReglasCcaa('Asturias').ccaa).toBe('Asturias');
    expect(getReglasCcaa('Murcia').ccaa).toBe('Murcia');
    expect(getReglasCcaa('Cantabria').ccaa).toBe('Cantabria');
  });

  test('País Vasco / Navarra · NO incluidas (TAREA futura régimen foral) · caen al fallback estatal', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const reglasPaisVasco = getReglasCcaa('País Vasco');
      const reglasNavarra = getReglasCcaa('Navarra');
      // Caen al fallback estatal · ATLAS NO crashea pero NO aplica deducciones forales.
      expect(reglasPaisVasco.ccaa).toBe('Estatal (fallback)');
      expect(reglasNavarra.ccaa).toBe('Estatal (fallback)');
    } finally {
      warnSpy.mockRestore();
    }
  });
});
