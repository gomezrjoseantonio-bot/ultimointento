// Tests · proyeccionActivoService
// T-INVERSIONES-DETALLE-PP-v1 · spec §11 PR 1 fila 1 + smoke adicionales.

import { proyectarInversion, computeTwrRolling5y } from '../proyeccionActivoService';
import type { ProyeccionInputs } from '../proyeccionActivoService';
import type { BenchmarkReferencia } from '../../types/benchmarksReferencia';

const benchmarkMock: BenchmarkReferencia = {
  id: 'bmk-1',
  codigo: 'MSCI_WORLD_EUR',
  nombre: 'MSCI World EUR',
  tipo: 'indice_equity',
  divisa: 'EUR',
  descripcion: 'mock',
  valoresAnuales: { 2020: 5.8, 2021: 21.8, 2022: -18.1, 2023: 22.0, 2024: 18.7 },
  ultimaActualizacion: '2024-12-31',
  fechaCreacion: '2024-12-31T00:00:00.000Z',
  fechaModificacion: '2024-12-31T00:00:00.000Z',
};

const inputsPlanOrange: ProyeccionInputs = {
  saldoActual: 35491,
  aportadoActual: 36327,
  aportacionAnualEstimada: 1500,
  anosTranscurridos: 17,
  twrHistorico: -0.001, // -0.1 %
  fechaNacimientoUsuario: null, // → usa fallback
  edadObjetivoRescate: 65,
  inflacionAnualAsumida: 2,
  benchmarkReferencia: benchmarkMock,
  anosHastaRescateFallback: 23,
};

describe('proyeccionActivoService · proyectarInversion', () => {
  test('caso Plan Orange · 23 años · TWR −0,1 % · aporte 1.500/año', () => {
    const r = proyectarInversion(inputsPlanOrange);

    // Spec §11 fila 1 dice "valor final aprox 79k ±5 %". Sin embargo aplicando
    // la fórmula §4.D (aporte al inicio de cada año · rentabilidad compuesta
    // anual sobre el balance) con TWR −0,1 % obtenemos ~68,8 k. El mockup
    // muestra 79.327 € que no es compatible con esos inputs · queda pendiente
    // de revisar al cablear PR 4 (puede ser que el mockup asumiera otro TWR o
    // aporte). El smoke valida que la fórmula es la del spec.
    expect(r.valorFinalNominal).toBeGreaterThan(65000);
    expect(r.valorFinalNominal).toBeLessThan(72000);

    expect(r.anosHastaRescate).toBe(23);
    expect(r.escenarioActual.puntos.length).toBe(24); // 23 años + año base
    expect(r.escenarioActual.puntos[0].valor).toBeCloseTo(35491, 0);
  });

  test('escenario con benchmark · TWR positivo · valor final muy superior', () => {
    const r = proyectarInversion(inputsPlanOrange);
    expect(r.escenarioConBenchmark).not.toBeNull();
    expect(r.escenarioConBenchmark!.valorFinal).toBeGreaterThan(r.valorFinalNominal);
    expect(r.diferenciaConBenchmark).not.toBeNull();
    expect(r.diferenciaConBenchmark!).toBeGreaterThan(0);
  });

  test('escenario sin benchmark · escenarioConBenchmark = null · diferencia = null', () => {
    const r = proyectarInversion({ ...inputsPlanOrange, benchmarkReferencia: null });
    expect(r.escenarioConBenchmark).toBeNull();
    expect(r.diferenciaConBenchmark).toBeNull();
  });

  test('twrHistorico null + benchmark presente · usa rolling 5y como fallback', () => {
    const r = proyectarInversion({ ...inputsPlanOrange, twrHistorico: null });
    // CAGR 5y del mock ≈ 8,9 % · debería estar entre 5 y 12 %.
    expect(r.escenarioActual.twrAplicado).toBeGreaterThan(0.05);
    expect(r.escenarioActual.twrAplicado).toBeLessThan(0.12);
  });

  test('twrHistorico null + benchmark null · usa 2 % neutro', () => {
    const r = proyectarInversion({
      ...inputsPlanOrange,
      twrHistorico: null,
      benchmarkReferencia: null,
    });
    expect(r.escenarioActual.twrAplicado).toBeCloseTo(0.02, 5);
  });

  test('conos · bajo y alto = base ±2 pp', () => {
    const r = proyectarInversion(inputsPlanOrange);
    expect(r.conoBajo.twrAplicado).toBeCloseTo(-0.021, 5);
    expect(r.conoAlto.twrAplicado).toBeCloseTo(0.019, 5);
    expect(r.conoBajo.valorFinal).toBeLessThan(r.valorFinalNominal);
    expect(r.conoAlto.valorFinal).toBeGreaterThan(r.valorFinalNominal);
  });

  test('valor real descuenta inflación', () => {
    const r = proyectarInversion(inputsPlanOrange);
    expect(r.valorFinalReal).toBeLessThan(r.valorFinalNominal);
    // 2 % anual durante 23 años · factor ≈ 1.577 · real ≈ nominal / 1.577.
    const esperadoReal = r.valorFinalNominal / Math.pow(1.02, 23);
    expect(r.valorFinalReal).toBeCloseTo(esperadoReal, 0);
  });

  test('escenario max aportación · valor final mayor que escenario actual', () => {
    const r = proyectarInversion(inputsPlanOrange);
    expect(r.escenarioConMaxAportacion.valorFinal).toBeGreaterThan(r.valorFinalNominal);
  });

  test('fechaNacimientoUsuario presente · calcula años hasta rescate', () => {
    // Usuario nacido en 1984 · edad rescate 65 · debe quedar entre 22 y 24 años.
    const r = proyectarInversion({
      ...inputsPlanOrange,
      fechaNacimientoUsuario: '1984-06-15',
      anosHastaRescateFallback: undefined,
    });
    expect(r.anosHastaRescate).toBeGreaterThanOrEqual(22);
    expect(r.anosHastaRescate).toBeLessThanOrEqual(24);
  });

  test('fechaNacimientoUsuario inválida · cae al fallback', () => {
    const r = proyectarInversion({
      ...inputsPlanOrange,
      fechaNacimientoUsuario: 'no-es-fecha',
      anosHastaRescateFallback: 18,
    });
    expect(r.anosHastaRescate).toBe(18);
  });
});

describe('proyeccionActivoService · computeTwrRolling5y', () => {
  test('benchmark con 5 valores · devuelve CAGR compuesto', () => {
    const cagr = computeTwrRolling5y(benchmarkMock);
    expect(cagr).not.toBeNull();
    // 5 años con la serie del mock · CAGR ≈ 8-10 %.
    expect(cagr!).toBeGreaterThan(0.05);
    expect(cagr!).toBeLessThan(0.12);
  });

  test('benchmark con 1 valor · devuelve null (insuficiente)', () => {
    expect(
      computeTwrRolling5y({ ...benchmarkMock, valoresAnuales: { 2024: 5 } }),
    ).toBeNull();
  });

  test('benchmark sin valores · devuelve null', () => {
    expect(computeTwrRolling5y({ ...benchmarkMock, valoresAnuales: {} })).toBeNull();
  });

  test('benchmark null · devuelve null', () => {
    expect(computeTwrRolling5y(null)).toBeNull();
  });
});
