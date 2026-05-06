// ============================================================================
// ATLAS · TAREA 18.0 · Tests motor elegibilidad + Madrid verified
// ============================================================================
//
// Cubre los 7 casos obligatorios del spec §3.3:
//   1. getReglasCcaa('Madrid') devuelve cifras Madrid completas
//   2. getReglasCcaa('CCAA_NO_EXISTE') devuelve fallback estatal con warning
//   3. arrendamiento Madrid · 30 años · BI 18.000 · alquiler 6.000 (>20% BI) →
//      ELEGIBLE · 1.237,20 € (tope alcanzado · 30% × 4.124 = 1.237,20)
//   4. arrendamiento Madrid · 45 años · BI 18.000 · alquiler 6.000 → NO
//      ELEGIBLE · motivo "edad >40"
//   5. arrendamiento Madrid · 30 años · BI 30.000 · alquiler 8.000 → NO
//      ELEGIBLE · motivo "BI individual excede 25.620"
//   6. arrendamiento Madrid · 30 años · BI 18.000 · alquiler 2.000 (<20% BI)
//      → NO ELEGIBLE · motivo "alquiler <20% BI"
//   7. irpfCalculationService.calcularCuotaBaseGeneralCCAA('Madrid', X) lee
//      del módulo nuevo · resultado coherente con la escala Madrid
// ============================================================================

import type { FiscalContext } from '../../fiscalContextService';
import type { DatosBaseDeduccion } from '../tipos';
import {
  getReglasCcaa,
  getDeduccionesAutonomicasEvaluadas,
  getDeduccionesAutonomicasAplicables,
} from '../deduccionesAutonomicasService';
import { BASE_ESTATAL_RULES } from '../ccaaRules/_base_estatal';
import { MADRID_RULES } from '../ccaaRules/madrid';
import {
  calcularCuotaBaseGeneralCCAA,
  calcularCuotaPorTramos,
} from '../../irpfCalculationService';

// ─── Builders ───────────────────────────────────────────────────────────────

function buildCtx(overrides: Partial<FiscalContext> = {}): FiscalContext {
  return {
    personalDataId: 1,
    nombre: 'Jose',
    apellidos: 'García',
    dni: '12345678Z',
    tributacion: 'individual',
    comunidadAutonoma: 'Madrid',
    fechaNacimiento: '1995-06-01',
    edadActual: 30,
    descendientes: [],
    ascendientes: [],
    discapacidadTitular: 'ninguna',
    viviendaHabitual: null,
    fechaActualizacion: '2024-01-01T00:00:00.000Z',
    warnings: [],
    ...overrides,
  };
}

function buildDatosBase(overrides: Partial<DatosBaseDeduccion> = {}): DatosBaseDeduccion {
  return {
    baseImponibleIndividual: 18000,
    alquilerAnual: 6000,
    fianzaDepositada: true,
    esTitularContrato: true,
    ...overrides,
  };
}

// ─── Tests obligatorios spec §3.3 ──────────────────────────────────────────

describe('T18.0 · getReglasCcaa', () => {
  test('1 · "Madrid" devuelve cifras Madrid completas', () => {
    const reglas = getReglasCcaa('Madrid');
    expect(reglas).toBe(MADRID_RULES);
    expect(reglas.ccaa).toBe('Madrid');
    expect(reglas.codigoIso).toBe('ES-MD');
    expect(reglas.verified).toBe(true);
    expect(reglas.escalaAutonomica).toHaveLength(5);
    expect(reglas.deducciones).toHaveLength(1);
    expect(reglas.deducciones[0].id).toBe('madrid-arrendamiento-vivienda-habitual');
    // Variantes de nombre · normalización funciona
    expect(getReglasCcaa('comunidad de madrid')).toBe(MADRID_RULES);
    expect(getReglasCcaa('MADRID')).toBe(MADRID_RULES);
  });

  test('2 · CCAA no existente devuelve fallback estatal con warning', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const reglas = getReglasCcaa('Atlantis');
      expect(reglas).toBe(BASE_ESTATAL_RULES);
      expect(warnSpy).toHaveBeenCalled();
      const callArgs = warnSpy.mock.calls[0][0] as string;
      expect(callArgs).toMatch(/Atlantis/);
      expect(callArgs).toMatch(/fallback estatal/);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('T18.0 · Deducción Madrid arrendamiento vivienda habitual', () => {
  test('3 · 30 años · BI 18.000 · alquiler 6.000 (>20% BI) · ELEGIBLE · 1.237,20 €', async () => {
    const ctx = buildCtx({ edadActual: 30 });
    const datos = buildDatosBase({
      baseImponibleIndividual: 18000,
      alquilerAnual: 6000, // 6000/18000 = 33% > 20%
    });
    const aplicables = await getDeduccionesAutonomicasAplicables(ctx, datos);
    expect(aplicables).toHaveLength(1);
    const r = aplicables[0];
    expect(r.elegible).toBe(true);
    expect(r.motivosNoElegible).toEqual([]);
    // 30% sobre min(6000, 4124) = 30% × 4124 = 1237.20 €
    expect(r.importeAplicable).toBe(1237.2);
    expect(r.topeAplicado).toBe(true);
    expect(r.fuenteOficial).toMatch(/Decreto Legislativo 1\/2010/);
  });

  test('4 · 45 años · BI 18.000 · alquiler 6.000 · NO ELEGIBLE · "edad >40"', async () => {
    const ctx = buildCtx({ edadActual: 45 });
    const datos = buildDatosBase();
    const evaluadas = await getDeduccionesAutonomicasEvaluadas(ctx, datos);
    expect(evaluadas).toHaveLength(1);
    const r = evaluadas[0];
    expect(r.elegible).toBe(false);
    expect(r.importeAplicable).toBe(0);
    expect(r.motivosNoElegible.some((m) => m.includes('edad >'))).toBe(true);
    expect(r.motivosNoElegible.some((m) => m.includes('40'))).toBe(true);
  });

  test('5 · 30 años · BI 30.000 · alquiler 8.000 · NO ELEGIBLE · "BI individual excede 25.620"', async () => {
    const ctx = buildCtx({ edadActual: 30 });
    const datos = buildDatosBase({
      baseImponibleIndividual: 30000,
      alquilerAnual: 8000,
    });
    const evaluadas = await getDeduccionesAutonomicasEvaluadas(ctx, datos);
    expect(evaluadas[0].elegible).toBe(false);
    expect(
      evaluadas[0].motivosNoElegible.some((m) => m.includes('BI individual')),
    ).toBe(true);
    expect(
      evaluadas[0].motivosNoElegible.some((m) => m.includes('25.620')),
    ).toBe(true);
  });

  test('6 · 30 años · BI 18.000 · alquiler 2.000 (<20% BI = 3.600) · NO ELEGIBLE · "alquiler <20% BI"', async () => {
    const ctx = buildCtx({ edadActual: 30 });
    const datos = buildDatosBase({
      baseImponibleIndividual: 18000,
      alquilerAnual: 2000, // 2000/18000 = 11% < 20%
    });
    const evaluadas = await getDeduccionesAutonomicasEvaluadas(ctx, datos);
    expect(evaluadas[0].elegible).toBe(false);
    expect(
      evaluadas[0].motivosNoElegible.some((m) =>
        m.includes('alquiler <20%'),
      ),
    ).toBe(true);
  });
});

describe('T18.0 · Integración irpfCalculationService.calcularCuotaBaseGeneralCCAA', () => {
  test('7 · Madrid · lee del módulo nuevo · escala Madrid aplicada (verified=true) · cuota coherente con tramos', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Madrid' });
    const r = calcularCuotaBaseGeneralCCAA(30000, ctx, 2024);
    // Madrid post-T18.0 verified=true · escala aplicada · sin reason de fallback.
    expect(r.escalaAutonomicaAplicada).toBe(true);
    expect(r.reason).toBeUndefined();
    expect(r.escalaAutonomicaUsada.verified).toBe(true);

    // La cuota autonómica debe coincidir con aplicar la escala Madrid del
    // módulo nuevo a la base 30.000 €. Verificamos lectura del módulo
    // nuevo · NO de tablas inline antiguas.
    const tramosMadrid = MADRID_RULES.escalaAutonomica.map((t) => ({
      hasta: t.baseHasta,
      tipo: t.tipoMarginal,
    }));
    const expectedCuotaMadrid = calcularCuotaPorTramos(30000, tramosMadrid);
    expect(r.cuotaAutonomica).toBe(expectedCuotaMadrid);

    // Sanity · base 30.000 · cuota Madrid manual:
    // 13362.22 × 8.5%   = 1135.79
    // (19004.63-13362.22) × 10.7% = 603.74
    // (30000-19004.63) × 12.8%   = 1407.41
    // Total ≈ 3146.94
    expect(r.cuotaAutonomica).toBeGreaterThan(3100);
    expect(r.cuotaAutonomica).toBeLessThan(3200);
  });

  test('7-bis · CCAA no implementada (Galicia) · fallback estatal · reason explica', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Galicia' });
    const r = calcularCuotaBaseGeneralCCAA(30000, ctx, 2024);
    expect(r.escalaAutonomicaAplicada).toBe(false);
    expect(r.reason).toMatch(/Galicia.*no implementada/);
    // Cuota autonómica = supletoria estatal (idéntica a la estatal en tramos)
    const tramosFallback = BASE_ESTATAL_RULES.escalaAutonomica.map((t) => ({
      hasta: t.baseHasta,
      tipo: t.tipoMarginal,
    }));
    expect(r.cuotaAutonomica).toBe(calcularCuotaPorTramos(30000, tramosFallback));
  });
});
