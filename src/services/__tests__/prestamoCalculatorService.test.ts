/**
 * Tests del motor financiero v2 contra el contrato Santander Jose · al céntimo.
 *
 * Caso Santander:
 *   capital 78.500 € · TIN 4,99% · 96 cuotas · firma 12/05/2026 · primer
 *   cargo 01/07/2026 · cuota 993,43 € · carencia técnica 20 días · 214,64 €
 *   total intereses 17.083,96 €.
 */

import {
  detectarCarenciaTecnica,
  calcularInteresesCarenciaTecnica,
  calcularCuotaFrances,
  generarCuadroAmortizacion,
  generarTreasuryEventDescriptors,
  PrestamoCalculatorInput,
} from '../prestamoCalculatorService';

const santander: PrestamoCalculatorInput = {
  capital: 78500,
  tinAnual: 0.0499,
  numCuotas: 96,
  fechaFirma: '2026-05-12',
  primerCargoCuadro: '2026-07-01',
  diaCobro: 1,
};

describe('prestamoCalculatorService · caso Santander', () => {
  it('cuota francesa · 993,43 €', () => {
    const cuota = calcularCuotaFrances(78500, 0.0499 / 12, 96);
    expect(cuota).toBeCloseTo(993.43, 2);
  });

  it('detecta carencia técnica · 20 días', () => {
    const c = detectarCarenciaTecnica(santander.fechaFirma, santander.diaCobro);
    expect(c.existe).toBe(true);
    expect(c.dias).toBe(20);
    expect(c.fechaLiquidacion).toBe('2026-06-01');
  });

  it('intereses carencia técnica · 214,64 €', () => {
    expect(calcularInteresesCarenciaTecnica(78500, 0.0499, 20)).toBeCloseTo(214.64, 2);
  });

  it('cuadro · 97 líneas (1 carencia + 96 cuotas)', () => {
    const cuadro = generarCuadroAmortizacion(santander);
    expect(cuadro.lineas).toHaveLength(97);
    expect(cuadro.lineas[0].tipo).toBe('carencia_tecnica');
    expect(cuadro.lineas[0].numero).toBe(0);
    expect(cuadro.lineas[0].fecha).toBe('2026-06-01');
    expect(cuadro.lineas[0].intereses).toBeCloseTo(214.64, 2);
    expect(cuadro.lineas[0].capitalAmortizado).toBe(0);
    expect(cuadro.lineas[1].tipo).toBe('cuota');
    expect(cuadro.lineas[1].numero).toBe(1);
    expect(cuadro.lineas[1].fecha).toBe('2026-07-01');
    expect(cuadro.lineas[1].cuota).toBeCloseTo(993.43, 2);
    expect(cuadro.lineas[96].numero).toBe(96);
    expect(cuadro.lineas[96].fecha).toBe('2034-06-01');
    expect(cuadro.lineas[96].capitalPendiente).toBe(0);
  });

  it('total intereses · 17.083,96 € (± 1 céntimo)', () => {
    const cuadro = generarCuadroAmortizacion(santander);
    expect(cuadro.resumen.totalIntereses).toBeCloseTo(17083.96, 1);
    expect(cuadro.resumen.interesesCarenciaTecnica).toBeCloseTo(214.64, 2);
    expect(cuadro.resumen.interesesCuadro).toBeCloseTo(16869.32, 1);
  });

  it('resumen · cuota mensual 993,43 € · 97 líneas', () => {
    const cuadro = generarCuadroAmortizacion(santander);
    expect(cuadro.resumen.cuotaMensual).toBeCloseTo(993.43, 2);
    expect(cuadro.resumen.numLineas).toBe(97);
    expect(cuadro.resumen.fechaUltimaCuota).toBe('2034-06-01');
    expect(cuadro.resumen.tinEfectivo).toBeCloseTo(4.99, 2);
    // TAE Santander oficial: 5,10%; nuestra aproximación incluye la carencia técnica.
    expect(cuadro.resumen.tae).toBeGreaterThanOrEqual(5.05);
    expect(cuadro.resumen.tae).toBeLessThanOrEqual(5.15);
  });

  it('treasury event descriptors · 1 ingreso + 1 carencia + 96 cuotas = 98', () => {
    const events = generarTreasuryEventDescriptors({
      id: 'p1',
      alias: 'Santander preconcedido',
      capital: 78500,
      fechaFirma: '2026-05-12',
      primerCargoCuadro: '2026-07-01',
      diaCobro: 1,
      tinAnual: 0.0499,
      numCuotas: 96,
      cuentaCargoId: 1,
    });
    expect(events).toHaveLength(98);
    expect(events[0].tipo).toBe('ingreso');
    expect(events[0].fecha).toBe('2026-05-12');
    expect(events[0].importe).toBeCloseTo(78500, 2);
    expect(events[1].esCarenciaTecnica).toBe(true);
    expect(events[1].fecha).toBe('2026-06-01');
    expect(events[1].importe).toBeCloseTo(214.64, 2);
    expect(events[2].numeroCuota).toBe(1);
    expect(events[2].fecha).toBe('2026-07-01');
    expect(events[2].importe).toBeCloseTo(993.43, 2);
    expect(events[97].numeroCuota).toBe(96);
    expect(events[97].fecha).toBe('2034-06-01');
  });
});

describe('prestamoCalculatorService · sin carencia técnica', () => {
  it('firma día 1 · NO hay carencia técnica · cuadro de 96 líneas', () => {
    const input: PrestamoCalculatorInput = {
      ...santander,
      fechaFirma: '2026-05-01',
    };
    const c = detectarCarenciaTecnica(input.fechaFirma, input.diaCobro);
    expect(c.existe).toBe(false);
    expect(c.dias).toBe(0);
    expect(c.fechaLiquidacion).toBeNull();

    const cuadro = generarCuadroAmortizacion(input);
    expect(cuadro.lineas).toHaveLength(96);
    expect(cuadro.lineas[0].tipo).toBe('cuota');
    expect(cuadro.lineas[0].numero).toBe(1);
    expect(cuadro.resumen.interesesCarenciaTecnica).toBe(0);
    expect(cuadro.resumen.numLineas).toBe(96);
  });
});

describe('prestamoCalculatorService · edge cases', () => {
  it('TIN 0 · cuota = capital / N', () => {
    expect(calcularCuotaFrances(12000, 0, 12)).toBe(1000);
  });

  it('capital 0 o numCuotas 0 · cuota 0', () => {
    expect(calcularCuotaFrances(0, 0.003, 12)).toBe(0);
    expect(calcularCuotaFrances(10000, 0.003, 0)).toBe(0);
  });

  it('intereses carencia técnica · 0 si dias 0', () => {
    expect(calcularInteresesCarenciaTecnica(78500, 0.0499, 0)).toBe(0);
  });
});
