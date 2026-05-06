// ============================================================================
// ATLAS · TAREA 18.2 · Tests · Cobertura CCAA mercado medio
// ============================================================================
//
// 5 CCAA × 4-5 tests = 22 tests · cubre §5.4 spec.
// Galicia · Aragón · Asturias · Murcia · Cantabria.
// ============================================================================

import type { FiscalContext } from '../../fiscalContextService';
import type { DatosBaseDeduccion } from '../tipos';
import {
  getReglasCcaa,
  evaluarElegibilidad,
} from '../deduccionesAutonomicasService';
import { GALICIA_RULES } from '../ccaaRules/galicia';
import { ARAGON_RULES } from '../ccaaRules/aragon';
import { ASTURIAS_RULES } from '../ccaaRules/asturias';
import { MURCIA_RULES } from '../ccaaRules/murcia';
import { CANTABRIA_RULES } from '../ccaaRules/cantabria';

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
    alquilerAnual: 4000,
    fianzaDepositada: true,
    esTitularContrato: true,
    tipoVivienda: 'habitual',
    duracionContratoAnios: 2,
    ...overrides,
  };
}

// ─── 1 · GALICIA ────────────────────────────────────────────────────────────

describe('T18.2 · Galicia', () => {
  test('escala · 5 tramos · paquete registrado', () => {
    expect(getReglasCcaa('Galicia')).toBe(GALICIA_RULES);
    expect(GALICIA_RULES.escalaAutonomica.length).toBe(5);
  });

  test('mínimo · contribuyente <65 = estatal 5550 (provisional · TODO auditar)', () => {
    expect(GALICIA_RULES.minimoPersonalFamiliar.minimoContribuyente).toBe(5550);
  });

  test('alquiler · 30 años · BI 18.000 · alquiler 4.000 → ELEGIBLE 300€ (10% · tope base)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Galicia', edadActual: 30 });
    const datos = buildDatos({ baseImponibleIndividual: 18000, alquilerAnual: 4000 });
    const r = evaluarElegibilidad(GALICIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 10% × 4000 = 400 · tope 300
    expect(r.importeAplicable).toBe(300);
  });

  test('alquiler · 30 años · 2 hijos menores → 600€ (20% · tope incrementado)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Galicia', edadActual: 30 });
    const datos = buildDatos({
      baseImponibleIndividual: 18000,
      alquilerAnual: 4000,
      numeroHijosMenores: 2,
    });
    const r = evaluarElegibilidad(GALICIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 20% × 4000 = 800 · tope 600
    expect(r.importeAplicable).toBe(600);
  });

  test('alquiler · 30 años · discapacidad ≥33% · 2 hijos → 1.200€ (DOBLE)', () => {
    const ctx = buildCtx({
      comunidadAutonoma: 'Galicia',
      edadActual: 30,
      discapacidadTitular: 'entre33y65',
    });
    const datos = buildDatos({
      baseImponibleIndividual: 18000,
      alquilerAnual: 4000,
      numeroHijosMenores: 2,
    });
    const r = evaluarElegibilidad(GALICIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 40% × 4000 = 1600 · tope 1200
    expect(r.importeAplicable).toBe(1200);
  });

  test('alquiler · 36 años (>35) → NO ELEGIBLE motivo edad', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Galicia', edadActual: 36 });
    const datos = buildDatos({ baseImponibleIndividual: 18000, alquilerAnual: 4000 });
    const r = evaluarElegibilidad(GALICIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('edad >'))).toBe(true);
  });
});

// ─── 2 · ARAGÓN · CASO ESPECIAL · NO general arrendamiento ─────────────────

describe('T18.2 · Aragón ★ HALLAZGO · NO deducción general arrendamiento', () => {
  test('escala · 9 tramos · paquete registrado', () => {
    expect(getReglasCcaa('Aragón')).toBe(ARAGON_RULES);
    expect(ARAGON_RULES.escalaAutonomica.length).toBe(9);
  });

  test('cliente Aragón inquilino general · CUALQUIER perfil → NO ELEGIBLE motivo claro', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Aragón', edadActual: 30 });
    const datos = buildDatos({ baseImponibleIndividual: 18000, alquilerAnual: 4000 });
    const r = evaluarElegibilidad(ARAGON_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.importeAplicable).toBe(0);
    expect(
      r.motivosNoElegible.some((m) => m.includes('Aragón no tiene deducción general arrendamiento')),
    ).toBe(true);
    expect(
      r.motivosNoElegible.some((m) => m.includes('dación en pago')),
    ).toBe(true);
  });

  test('cliente Aragón · joven con perfil ideal · sigue NO ELEGIBLE (ley NO contempla)', () => {
    // Confirmar que NO hay forma legal de hacer la deducción elegible.
    const ctx = buildCtx({
      comunidadAutonoma: 'Aragón',
      edadActual: 25,
      discapacidadTitular: 'mas65',
    });
    const datos = buildDatos({
      baseImponibleIndividual: 10000,
      alquilerAnual: 6000,
      familiaNumerosa: 'especial',
      familiaMonoparental: true,
    });
    const r = evaluarElegibilidad(ARAGON_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
  });

  test('paquete · solo 1 deducción placeholder · TODOs documentados para nichos', () => {
    expect(ARAGON_RULES.deducciones).toHaveLength(1);
    expect(ARAGON_RULES.deducciones[0].noAplicableEnCcaaMotivo).toBeDefined();
    expect(
      ARAGON_RULES.notasMigracion?.some((n) => n.includes('dación en pago')),
    ).toBe(true);
    expect(
      ARAGON_RULES.notasMigracion?.some((n) => n.includes('vivienda social')),
    ).toBe(true);
  });
});

// ─── 3 · ASTURIAS · 3 modalidades arrendamiento ────────────────────────────

describe('T18.2 · Asturias · 3 modalidades arrendamiento', () => {
  test('escala · 8 tramos · paquete registrado', () => {
    expect(getReglasCcaa('Asturias')).toBe(ASTURIAS_RULES);
    expect(ASTURIAS_RULES.escalaAutonomica.length).toBe(8);
  });

  test('mínimo · contribuyente <65 = estatal 5550 (provisional · TODO BOPA)', () => {
    expect(ASTURIAS_RULES.minimoPersonalFamiliar.minimoContribuyente).toBe(5550);
  });

  test('arrendamiento · modalidad BASE · 40 años · BI 30k · 6.000 alquiler → 500€ (10% · tope base)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Asturias', edadActual: 40 });
    const datos = buildDatos({ baseImponibleIndividual: 30000, alquilerAnual: 6000 });
    const r = evaluarElegibilidad(ASTURIAS_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 10% × 6000 = 600 · tope base 500
    expect(r.importeAplicable).toBe(500);
  });

  test('arrendamiento · modalidad INCREMENTADA · joven 30 años + familia numerosa → 1.500€ (30% · tope)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Asturias', edadActual: 30 });
    const datos = buildDatos({
      baseImponibleIndividual: 25000,
      alquilerAnual: 8000,
      familiaNumerosa: 'general',
    });
    const r = evaluarElegibilidad(ASTURIAS_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 30% × 8000 = 2400 · tope incrementado 1500
    expect(r.importeAplicable).toBe(1500);
  });

  test('arrendamiento · modalidad DESPOBLAMIENTO · 50 años · concejo riesgo → 1.500€ (30%)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Asturias', edadActual: 50 });
    const datos = buildDatos({
      baseImponibleIndividual: 30000,
      alquilerAnual: 8000,
      viviendaEnZonaDespoblamiento: true,
    });
    const r = evaluarElegibilidad(ASTURIAS_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    expect(r.importeAplicable).toBe(1500);
  });

  test('arrendamiento · BI 36.000 (>35.000) individual → NO ELEGIBLE motivo BI', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Asturias', edadActual: 30 });
    const datos = buildDatos({ baseImponibleIndividual: 36000, alquilerAnual: 6000 });
    const r = evaluarElegibilidad(ASTURIAS_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('35.000'))).toBe(true);
  });
});

// ─── 4 · MURCIA · BI 40k Ley 3/2025 + ITP/AJD + pagos trazables ────────────

describe('T18.2 · Murcia · Ley 3/2025 BI 40.000 €', () => {
  test('escala · 5 tramos · paquete registrado', () => {
    expect(getReglasCcaa('Murcia')).toBe(MURCIA_RULES);
    expect(MURCIA_RULES.escalaAutonomica.length).toBe(5);
  });

  test('arrendamiento · BI 38.000 (entre antiguo 24.380 y nuevo 40.000) · alquiler 4.000 → ELEGIBLE 300€', () => {
    // Test caso real Ley 3/2025 · BI 38.000 antes de 2025 NO elegible · ahora SÍ.
    const ctx = buildCtx({ comunidadAutonoma: 'Murcia', edadActual: 40 });
    const datos = buildDatos({
      baseImponibleIndividual: 38000,
      alquilerAnual: 4000,
      itpAjdPresentado: true,
      pagosTrazables: true,
      propiedadMasMitadOtraVivienda: false,
    });
    const r = evaluarElegibilidad(MURCIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 10% × 4000 = 400 · tope 300
    expect(r.importeAplicable).toBe(300);
  });

  test('arrendamiento · BI 41.000 (>40.000 Ley 3/2025) → NO ELEGIBLE motivo BI', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Murcia', edadActual: 40 });
    const datos = buildDatos({
      baseImponibleIndividual: 41000,
      alquilerAnual: 4000,
      itpAjdPresentado: true,
      pagosTrazables: true,
    });
    const r = evaluarElegibilidad(MURCIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('40.000'))).toBe(true);
  });

  test('arrendamiento · ITP/AJD NO presentado → NO ELEGIBLE motivo ITP', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Murcia', edadActual: 40 });
    const datos = buildDatos({
      baseImponibleIndividual: 30000,
      alquilerAnual: 4000,
      itpAjdPresentado: false,
      pagosTrazables: true,
    });
    const r = evaluarElegibilidad(MURCIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('ITP/AJD'))).toBe(true);
  });

  test('arrendamiento · pagos en efectivo (NO trazables) → NO ELEGIBLE motivo pagos', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Murcia', edadActual: 40 });
    const datos = buildDatos({
      baseImponibleIndividual: 30000,
      alquilerAnual: 4000,
      itpAjdPresentado: true,
      pagosTrazables: false,
    });
    const r = evaluarElegibilidad(MURCIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('trazables'))).toBe(true);
  });

  test('arrendamiento · titular >50% otra vivienda → NO ELEGIBLE motivo otra vivienda', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Murcia', edadActual: 40 });
    const datos = buildDatos({
      baseImponibleIndividual: 30000,
      alquilerAnual: 4000,
      itpAjdPresentado: true,
      pagosTrazables: true,
      propiedadMasMitadOtraVivienda: true,
    });
    const r = evaluarElegibilidad(MURCIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(r.motivosNoElegible.some((m) => m.includes('50%'))).toBe(true);
  });
});

// ─── 5 · CANTABRIA · BI máx TODO · verified=false ──────────────────────────

describe('T18.2 · Cantabria · verified=false (BI máx pendiente)', () => {
  test('escala · 6 tramos · paquete registrado', () => {
    expect(getReglasCcaa('Cantabria')).toBe(CANTABRIA_RULES);
    expect(CANTABRIA_RULES.escalaAutonomica.length).toBe(6);
  });

  test('mínimo · contribuyente <65 = estatal 5550 (provisional)', () => {
    expect(CANTABRIA_RULES.minimoPersonalFamiliar.minimoContribuyente).toBe(5550);
  });

  test('arrendamiento · 30 años · alquiler 4.000 → ELEGIBLE 300€ (10% · tope individual)', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Cantabria', edadActual: 30 });
    const datos = buildDatos({ alquilerAnual: 4000 });
    const r = evaluarElegibilidad(CANTABRIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 10% × 4000 = 400 · tope 300
    expect(r.importeAplicable).toBe(300);
  });

  test('arrendamiento · 70 años · alquiler 8.000 conjunta → ELEGIBLE 600€ (tope conjunta)', () => {
    const ctx = buildCtx({
      comunidadAutonoma: 'Cantabria',
      tributacion: 'conjunta',
      edadActual: 70,
    });
    const datos = buildDatos({
      baseImponibleIndividual: 25000,
      baseImponibleConjunta: 25000,
      alquilerAnual: 8000,
    });
    const r = evaluarElegibilidad(CANTABRIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(true);
    // 10% × 8000 = 800 · tope conjunta 600
    expect(r.importeAplicable).toBe(600);
  });

  test('arrendamiento · 50 años · NI ≤35 NI ≥65 → NO ELEGIBLE motivo OR', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Cantabria', edadActual: 50 });
    const datos = buildDatos({ alquilerAnual: 4000 });
    const r = evaluarElegibilidad(CANTABRIA_RULES.deducciones[0], ctx, datos);
    expect(r.elegible).toBe(false);
    expect(
      r.motivosNoElegible.some((m) => m.includes('no cumple ninguna condición')),
    ).toBe(true);
  });
});

// ─── Cero regresión Madrid + Top 5 ──────────────────────────────────────────

describe('T18.2 · Cero regresión Madrid + Top 5', () => {
  test('Madrid sigue funcionando · paquete reconocible', () => {
    const reglas = getReglasCcaa('Madrid');
    expect(reglas.ccaa).toBe('Madrid');
    expect(reglas.verified).toBe(true);
  });

  test('Top 5 paquetes siguen registrados (Cataluña · Andalucía · Valencia · Baleares · CyL)', () => {
    expect(getReglasCcaa('Cataluña').ccaa).toBe('Cataluña');
    expect(getReglasCcaa('Andalucía').ccaa).toBe('Andalucía');
    expect(getReglasCcaa('Valencia').ccaa).toBe('Comunitat Valenciana');
    expect(getReglasCcaa('Baleares').ccaa).toBe('Illes Balears');
    expect(getReglasCcaa('Castilla y León').ccaa).toBe('Castilla y León');
  });
});
