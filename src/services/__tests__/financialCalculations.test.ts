// Financial Calculations Service Tests

import {
  calcularCuotaMensual,
  generarCuadroAmortizacion,
  validarCuadroAmortizacion
} from '../financialCalculations';

describe('Financial Calculations', () => {

  it('debe calcular la cuota mensual correctamente (caso real)', () => {
    const cuota = calcularCuotaMensual(47000, 5.49, 84);

    // Tolerance of 1 cent
    expect(cuota).toBeCloseTo(675.17, 2);
  });

  it('debe calcular cuota correctamente con tasa cero', () => {
    const cuota = calcularCuotaMensual(12000, 0, 12);
    expect(cuota).toBe(1000); // 12000 / 12
  });

  it('debe generar cuadro de amortización que coincida con el banco', () => {
    const config = {
      capital: 47000,
      tasa_anual: 5.49,
      plazo_meses: 84,
      fecha_inicio: '2022-09-14',
      fecha_primera_cuota: '2022-10-03',
      tipo: 'FIJO' as const
    };

    const cuotas = generarCuadroAmortizacion(config);

    // Total installments should be 84
    expect(cuotas).toHaveLength(84);

    // Validate month 1 (partial period of 19 days)
    expect(cuotas[0].numero).toBe(1);
    expect(cuotas[0].dias_periodo).toBe(19);
    expect(cuotas[0].cuota_total).toBeCloseTo(675.17, 2);
    expect(cuotas[0].amortizacion_capital).toBeCloseTo(460.14, 2);
    expect(cuotas[0].intereses).toBeCloseTo(215.03, 2);
    expect(cuotas[0].capital_pendiente).toBeCloseTo(46539.86, 2);

    // Validate month 2 (full period)
    expect(cuotas[1].numero).toBe(2);
    expect(cuotas[1].dias_periodo).toBeGreaterThanOrEqual(30);
    expect(cuotas[1].cuota_total).toBeCloseTo(675.17, 2);
    expect(cuotas[1].amortizacion_capital).toBeCloseTo(462.25, 2);
    expect(cuotas[1].intereses).toBeCloseTo(212.92, 2);
    expect(cuotas[1].capital_pendiente).toBeCloseTo(46077.61, 2);

    // Validate month 3
    expect(cuotas[2].numero).toBe(3);
    expect(cuotas[2].cuota_total).toBeCloseTo(675.17, 2);
    expect(cuotas[2].amortizacion_capital).toBeCloseTo(464.36, 2);
    expect(cuotas[2].intereses).toBeCloseTo(210.81, 2);
    expect(cuotas[2].capital_pendiente).toBeCloseTo(45613.24, 2);

    // Validate last payment (outstanding capital = 0)
    const ultimaCuota = cuotas[cuotas.length - 1];
    expect(ultimaCuota.numero).toBe(84);
    expect(ultimaCuota.capital_pendiente).toBeCloseTo(0, 2);
  });

  it('debe validar correctamente un cuadro contra valores esperados', () => {
    const config = {
      capital: 47000,
      tasa_anual: 5.49,
      plazo_meses: 84,
      fecha_inicio: '2022-09-14',
      fecha_primera_cuota: '2022-10-03',
      tipo: 'FIJO' as const
    };

    const cuotas = generarCuadroAmortizacion(config);

    const esperado = [
      { cuota_total: 675.17, amortizacion_capital: 460.14, intereses: 215.03 },
      { cuota_total: 675.17, amortizacion_capital: 462.25, intereses: 212.92 },
      { cuota_total: 675.17, amortizacion_capital: 464.36, intereses: 210.81 }
    ];

    const resultado = validarCuadroAmortizacion(cuotas, esperado, 0.01);

    expect(resultado.valido).toBe(true);
    expect(resultado.errores).toHaveLength(0);
  });

  it('debe detectar errores en la validación del cuadro', () => {
    const config = {
      capital: 47000,
      tasa_anual: 5.49,
      plazo_meses: 84,
      fecha_inicio: '2022-09-14',
      fecha_primera_cuota: '2022-10-03',
      tipo: 'FIJO' as const
    };

    const cuotas = generarCuadroAmortizacion(config);

    const esperadoIncorrecto = [
      { cuota_total: 999.99, amortizacion_capital: 500.00, intereses: 499.99 }
    ];

    const resultado = validarCuadroAmortizacion(cuotas, esperadoIncorrecto, 0.01);

    expect(resultado.valido).toBe(false);
    expect(resultado.errores.length).toBeGreaterThan(0);
  });
});
