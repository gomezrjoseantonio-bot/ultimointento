import { calcularReduccionArrendamientoVivienda } from '../irpfCalculationService';

describe('calcularReduccionArrendamientoVivienda', () => {
  it('aplica el porcentaje configurado sobre rendimiento neto positivo', () => {
    expect(calcularReduccionArrendamientoVivienda(18.91, 60)).toEqual({
      reduccionHabitual: 11.35,
      rendimientoNetoReducido: 7.56,
      porcentajeNormalizado: 0.6,
    });

    expect(calcularReduccionArrendamientoVivienda(1924.55, 0.6)).toEqual({
      reduccionHabitual: 1154.73,
      rendimientoNetoReducido: 769.82,
      porcentajeNormalizado: 0.6,
    });
  });

  it('no aplica reducción cuando el rendimiento neto es cero o negativo', () => {
    expect(calcularReduccionArrendamientoVivienda(-3019.47, 60)).toEqual({
      reduccionHabitual: 0,
      rendimientoNetoReducido: -3019.47,
      porcentajeNormalizado: 0.6,
    });

    expect(calcularReduccionArrendamientoVivienda(0, 50)).toEqual({
      reduccionHabitual: 0,
      rendimientoNetoReducido: 0,
      porcentajeNormalizado: 0.5,
    });
  });

  it('normaliza porcentajes 50/60/70/90 expresados como enteros', () => {
    expect(calcularReduccionArrendamientoVivienda(1000, 50)).toEqual({
      reduccionHabitual: 500,
      rendimientoNetoReducido: 500,
      porcentajeNormalizado: 0.5,
    });

    expect(calcularReduccionArrendamientoVivienda(1000, 90)).toEqual({
      reduccionHabitual: 900,
      rendimientoNetoReducido: 100,
      porcentajeNormalizado: 0.9,
    });
  });
});
