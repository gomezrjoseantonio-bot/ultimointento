// Tests · posicionesCerradasAnalisis (PR 5 · spec §11 fila 11).
// Cobertura · cagrMedioPonderado · aciertosRatio · histograma · best/worst · ranking.

import {
  aciertosRatio,
  analisisHistogramaCopy,
  analisisRankingCopy,
  bestWorstPorPorcentaje,
  cagrMedioPonderado,
  computeHistogramaBins,
  computeRankingPorTipo,
} from '../posicionesCerradasAnalisis';
import type { PosicionCerrada } from '../posicionesCerradas';

const mk = (patch: Partial<PosicionCerrada> = {}): PosicionCerrada => ({
  id: 'p-1',
  nombre: 'Posición test',
  tipo: 'fondo_inversion',
  entidad: 'Banco X',
  fechaCierre: '2024-12-31T00:00:00.000Z',
  aportado: 10_000,
  vendido: 12_000,
  resultado: 2_000,
  resultadoPercent: 20,
  ...patch,
});

describe('aciertosRatio', () => {
  test('vacío · 0', () => {
    expect(aciertosRatio([])).toBe(0);
  });

  test('3 de 5 ganadoras · 0.6', () => {
    const cs = [
      mk({ id: 'a', resultado: 100 }),
      mk({ id: 'b', resultado: 50 }),
      mk({ id: 'c', resultado: -20 }),
      mk({ id: 'd', resultado: 200 }),
      mk({ id: 'e', resultado: -10 }),
    ];
    expect(aciertosRatio(cs)).toBe(0.6);
  });

  test('todas pérdida · 0', () => {
    const cs = [mk({ id: 'a', resultado: -1 }), mk({ id: 'b', resultado: -2 })];
    expect(aciertosRatio(cs)).toBe(0);
  });

  test('resultado 0 · no cuenta como acierto', () => {
    const cs = [mk({ id: 'a', resultado: 0 }), mk({ id: 'b', resultado: 100 })];
    expect(aciertosRatio(cs)).toBe(0.5);
  });
});

describe('cagrMedioPonderado', () => {
  test('vacío · 0', () => {
    expect(cagrMedioPonderado([])).toBe(0);
  });

  test('ponderado por capital · capital mayor pesa más', () => {
    // 10k al 10 % + 90k al 2 %.
    // weighted = (10·10 + 90·2) / 100 = 280/100 = 2.8 %.
    const cs = [
      mk({ id: 'a', aportado: 10_000, cagr: 10 }),
      mk({ id: 'b', aportado: 90_000, cagr: 2 }),
    ];
    expect(cagrMedioPonderado(cs)).toBeCloseTo(2.8, 4);
  });

  test('ignora posiciones sin cagr', () => {
    const cs = [
      mk({ id: 'a', aportado: 10_000, cagr: 5 }),
      mk({ id: 'b', aportado: 10_000, cagr: undefined }),
    ];
    // Solo la primera cuenta · weighted = 5 %.
    expect(cagrMedioPonderado(cs)).toBeCloseTo(5, 4);
  });

  test('todos sin cagr · 0', () => {
    const cs = [mk({ id: 'a', cagr: undefined }), mk({ id: 'b', cagr: undefined })];
    expect(cagrMedioPonderado(cs)).toBe(0);
  });
});

describe('computeRankingPorTipo · cagrMedio nullable', () => {
  test('todos sin cagr en el tipo · cagrMedio = null · ranking lo coloca al final', () => {
    const sinCagr = [
      mk({ id: 'a', tipo: 'fondo_inversion', aportado: 10_000, resultado: 100, cagr: undefined }),
      mk({ id: 'b', tipo: 'fondo_inversion', aportado: 10_000, resultado: 200, cagr: undefined }),
    ];
    const conCagr = [
      mk({ id: 'c', tipo: 'accion', aportado: 5_000, resultado: 300, cagr: 12 }),
    ];
    const r = computeRankingPorTipo([...sinCagr, ...conCagr]);
    // Acciones (12 %) primero · Fondos (null) al final.
    expect(r[0].tipo).toBe('Acciones');
    expect(r[0].cagrMedio).toBeCloseTo(12, 4);
    expect(r[1].tipo).toBe('Fondos');
    expect(r[1].cagrMedio).toBeNull();
  });

  test('tiempoMedioDias = null si ninguna posición tiene duracion', () => {
    const cs = [
      mk({ id: 'a', tipo: 'crypto', aportado: 1_000, resultado: 200, cagr: undefined, duracionDias: undefined }),
    ];
    const r = computeRankingPorTipo(cs);
    expect(r[0].tiempoMedioDias).toBeNull();
  });
});

describe('bestWorstPorPorcentaje', () => {
  test('vacío · ambos null', () => {
    const r = bestWorstPorPorcentaje([]);
    expect(r.mejor).toBeNull();
    expect(r.peor).toBeNull();
  });

  test('selecciona por resultadoPercent · NO por resultado absoluto', () => {
    // 'big-loss' tiene mayor resultado absoluto pero NO mayor % · y
    // 'small-win' tiene menor resultado absoluto pero mejor %.
    const cs = [
      mk({ id: 'big-loss', aportado: 100_000, resultado: 500, resultadoPercent: 0.5 }),
      mk({ id: 'small-win', aportado: 100, resultado: 50, resultadoPercent: 50 }),
      mk({ id: 'bad', aportado: 1_000, resultado: -200, resultadoPercent: -20 }),
    ];
    const r = bestWorstPorPorcentaje(cs);
    expect(r.mejor?.id).toBe('small-win');
    expect(r.peor?.id).toBe('bad');
  });

  test('una sola posición · es mejor y peor a la vez', () => {
    const cs = [mk({ id: 'single', resultadoPercent: 5 })];
    const r = bestWorstPorPorcentaje(cs);
    expect(r.mejor?.id).toBe('single');
    expect(r.peor?.id).toBe('single');
  });
});

describe('computeHistogramaBins', () => {
  test('siempre devuelve 5 bins · count=0 si vacíos', () => {
    const bins = computeHistogramaBins([]);
    expect(bins).toHaveLength(5);
    expect(bins.map((b) => b.bin)).toEqual(['<0%', '0-3%', '3-10%', '10-20%', '>20%']);
    expect(bins.every((b) => b.count === 0)).toBe(true);
  });

  test('clasifica correctamente · bordes inclusivos hacia abajo', () => {
    const cs = [
      mk({ id: '1', resultadoPercent: -5 }),  // <0%
      mk({ id: '2', resultadoPercent: 0 }),   // 0-3%  (>= 0)
      mk({ id: '3', resultadoPercent: 2.9 }), // 0-3%
      mk({ id: '4', resultadoPercent: 3 }),   // 3-10% (>= 3)
      mk({ id: '5', resultadoPercent: 9.9 }), // 3-10%
      mk({ id: '6', resultadoPercent: 10 }),  // 10-20% (>= 10)
      mk({ id: '7', resultadoPercent: 19.9 }),// 10-20%
      mk({ id: '8', resultadoPercent: 20 }),  // >20% (>= 20)
      mk({ id: '9', resultadoPercent: 35 }),  // >20%
    ];
    const bins = computeHistogramaBins(cs);
    const counts = Object.fromEntries(bins.map((b) => [b.bin, b.count]));
    expect(counts).toEqual({
      '<0%': 1,
      '0-3%': 2,
      '3-10%': 2,
      '10-20%': 2,
      '>20%': 2,
    });
  });

  test('agrupa posiciones por bin · accesibles vía .posiciones', () => {
    const cs = [
      mk({ id: 'a', resultadoPercent: 5 }),
      mk({ id: 'b', resultadoPercent: 7 }),
    ];
    const bins = computeHistogramaBins(cs);
    const bin310 = bins.find((b) => b.bin === '3-10%')!;
    expect(bin310.posiciones.map((p) => p.id).sort()).toEqual(['a', 'b']);
  });
});

describe('analisisHistogramaCopy', () => {
  test('sin posiciones · copy vacío explícito', () => {
    const bins = computeHistogramaBins([]);
    expect(analisisHistogramaCopy(bins)).toMatch(/Sin posiciones/i);
  });

  test('mayoría pérdidas · revisa estrategia', () => {
    const cs = [
      mk({ id: 'a', resultadoPercent: -5 }),
      mk({ id: 'b', resultadoPercent: -10 }),
      mk({ id: 'c', resultadoPercent: -2 }),
      mk({ id: 'd', resultadoPercent: 5 }),
    ];
    expect(analisisHistogramaCopy(computeHistogramaBins(cs))).toMatch(/pérdidas/i);
  });

  test('mayoría 0-3 % · cierres tibios', () => {
    const cs = [
      mk({ id: 'a', resultadoPercent: 1 }),
      mk({ id: 'b', resultadoPercent: 2 }),
      mk({ id: 'c', resultadoPercent: 0.5 }),
      mk({ id: 'd', resultadoPercent: 25 }),
    ];
    expect(analisisHistogramaCopy(computeHistogramaBins(cs))).toMatch(/tibios/i);
  });

  test('al menos 50 % por encima de 3 % · trayectoria sólida', () => {
    const cs = [
      mk({ id: 'a', resultadoPercent: 5 }),
      mk({ id: 'b', resultadoPercent: 10 }),
      mk({ id: 'c', resultadoPercent: 25 }),
      mk({ id: 'd', resultadoPercent: 1 }),
    ];
    expect(analisisHistogramaCopy(computeHistogramaBins(cs))).toMatch(/sólida|3 %/i);
  });
});

describe('computeRankingPorTipo', () => {
  test('vacío · []', () => {
    expect(computeRankingPorTipo([])).toEqual([]);
  });

  test('agrupa por tipo · ordena por CAGR descendente · primera fila es líder', () => {
    const cs = [
      mk({ id: 'f1', tipo: 'fondo_inversion', aportado: 5_000, resultado: 500, cagr: 5 }),
      mk({ id: 'f2', tipo: 'fondo_inversion', aportado: 5_000, resultado: 300, cagr: 3 }),
      mk({ id: 'a1', tipo: 'accion', aportado: 1_000, resultado: 300, cagr: 15 }),
      mk({ id: 'a2', tipo: 'accion', aportado: 2_000, resultado: 800, cagr: 18 }),
      mk({ id: 'd1', tipo: 'deposito_plazo', aportado: 10_000, resultado: 200, cagr: 1.5 }),
    ];
    const r = computeRankingPorTipo(cs);
    expect(r.map((it) => it.tipo)).toEqual(['Acciones', 'Fondos', 'Depósitos']);
    // Acciones · 3.000 capital · 1.100 plusvalía · CAGR weighted
    // = (1·15 + 2·18) / 3 = (15 + 36)/3 = 17%
    expect(r[0].numOps).toBe(2);
    expect(r[0].capital).toBe(3_000);
    expect(r[0].plusvalia).toBe(1_100);
    expect(r[0].cagrMedio).toBeCloseTo(17, 4);
  });

  test('tipo único · ranking de 1', () => {
    const cs = [mk({ tipo: 'crypto', cagr: 30 })];
    const r = computeRankingPorTipo(cs);
    expect(r).toHaveLength(1);
    expect(r[0].tipo).toBe('Crypto');
  });
});

describe('analisisRankingCopy', () => {
  test('vacío · copy explícito', () => {
    expect(analisisRankingCopy([])).toMatch(/Aún no hay/i);
  });

  test('menciona líder + nº ops + CAGR', () => {
    const r = computeRankingPorTipo([
      mk({ tipo: 'accion', cagr: 18, aportado: 1_000 }),
      mk({ tipo: 'accion', cagr: 15, aportado: 1_000 }),
    ]);
    const c = analisisRankingCopy(r);
    expect(c).toMatch(/acciones/i);
    expect(c).toMatch(/2 operac/);
    expect(c).toMatch(/16\.5/);
  });

  test('líder sin CAGR calculable · copy neutro que invita a revisar fechas', () => {
    const r = computeRankingPorTipo([
      mk({ tipo: 'fondo_inversion', cagr: undefined, aportado: 1_000 }),
    ]);
    const c = analisisRankingCopy(r);
    expect(c).toMatch(/Sin CAGR calculable/i);
    expect(c).toMatch(/fechas de apertura/i);
    expect(c).not.toMatch(/te han funcionado mejor/i);
  });
});
