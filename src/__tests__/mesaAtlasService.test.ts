import {
  calculateMesaAtlasIndex,
  getMesaAtlasInstabilityAlerts,
  getMesaAtlasRecommendations,
  simulateMesaAtlasResilience
} from '../services/mesaAtlasService';

describe('mesaAtlasService', () => {
  it('calcula score alto con ingresos diversificados y colchón robusto', () => {
    const input = {
      ingresos: {
        trabajo: 2000,
        inmuebles: 1800,
        inversiones: 1200
      },
      gastoMedioMensual: 2500,
      colchonMeses: 6,
      variacionMensualPorcentaje: 8
    };

    const result = calculateMesaAtlasIndex(input);

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.patasActivas).toBe(4);
    expect(result.riesgoConcentracion).toBeLessThan(50);
    expect(getMesaAtlasRecommendations(input, result).length).toBeGreaterThan(0);
  });

  it('detecta alta dependencia cuando una fuente concentra casi todo', () => {
    const input = {
      ingresos: {
        trabajo: 4500,
        inmuebles: 0,
        inversiones: 100
      },
      gastoMedioMensual: 3500,
      colchonMeses: 1,
      variacionMensualPorcentaje: -5
    };

    const result = calculateMesaAtlasIndex(input);
    const alerts = getMesaAtlasInstabilityAlerts(input, result);

    expect(result.riesgoConcentracion).toBeGreaterThanOrEqual(90);
    expect(result.principalRiesgo).toContain('Alta dependencia');
    expect(result.patasActivas).toBe(3);
    expect(alerts.some((a) => a.id === 'mesa-riesgo-concentracion')).toBe(true);
  });

  it('simula resiliencia para tres escenarios base', () => {
    const scenarios = simulateMesaAtlasResilience({
      ingresos: {
        trabajo: 2500,
        inmuebles: 300,
        inversiones: 200
      },
      gastoMedioMensual: 2000,
      colchonMeses: 4,
      variacionMensualPorcentaje: 3
    });

    expect(scenarios).toHaveLength(3);
    expect(scenarios[0].nombre).toContain('Pérdida');
    expect(scenarios.every((s) => s.mesesEstabilidad >= 0)).toBe(true);
  });
});
