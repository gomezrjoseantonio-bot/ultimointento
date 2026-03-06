import { calculateMesaAtlasIndex } from '../services/mesaAtlasService';

describe('mesaAtlasService', () => {
  it('calcula score alto con ingresos diversificados y colchón robusto', () => {
    const result = calculateMesaAtlasIndex({
      ingresos: {
        trabajo: 2000,
        inmuebles: 1800,
        inversiones: 1200
      },
      gastoMedioMensual: 2500,
      colchonMeses: 6,
      variacionMensualPorcentaje: 8
    });

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.patasActivas).toBe(4);
    expect(result.riesgoConcentracion).toBeLessThan(50);
  });

  it('detecta alta dependencia cuando una fuente concentra casi todo', () => {
    const result = calculateMesaAtlasIndex({
      ingresos: {
        trabajo: 4500,
        inmuebles: 0,
        inversiones: 100
      },
      gastoMedioMensual: 3500,
      colchonMeses: 1,
      variacionMensualPorcentaje: -5
    });

    expect(result.riesgoConcentracion).toBeGreaterThanOrEqual(90);
    expect(result.principalRiesgo).toContain('Alta dependencia');
    expect(result.patasActivas).toBe(3);
  });
});
