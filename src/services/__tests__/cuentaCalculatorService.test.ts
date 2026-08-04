import { calcularCuentaResumen } from '../cuentaCalculatorService';

describe('calcularCuentaResumen · S-WIZARD-CUENTA-V3', () => {
  it('caso del mockup · Santander principal · 30.000 € corriente sin remunerar', () => {
    const r = calcularCuentaResumen({
      tipo: 'CORRIENTE',
      saldoInicial: 30000,
      esRemunerada: false,
    });
    expect(r.saldoInicial).toBe(30000);
    expect(r.interesesAnualesEstimados).toBe(0);
    expect(r.interesesPorPeriodo).toBe(0);
  });

  it('cuenta ahorro remunerada · TAE 2,5% mensual sobre 30.000 €', () => {
    const r = calcularCuentaResumen({
      tipo: 'CORRIENTE',
      saldoInicial: 30000,
      esRemunerada: true,
      taeAnual: 2.5,
      frecuenciaLiquidacion: 'mensual',
    });
    expect(r.saldoInicial).toBe(30000);
    // 30.000 × 2,5% = 750
    expect(r.interesesAnualesEstimados).toBe(750);
    // 750 / 12 = 62,5
    expect(r.interesesPorPeriodo).toBe(62.5);
  });

  it('cuenta ahorro remunerada · TAE 4% trimestral sobre 10.000 €', () => {
    const r = calcularCuentaResumen({
      tipo: 'CORRIENTE',
      saldoInicial: 10000,
      esRemunerada: true,
      taeAnual: 4,
      frecuenciaLiquidacion: 'trimestral',
    });
    // 10.000 × 4% = 400
    expect(r.interesesAnualesEstimados).toBe(400);
    // 400 / 4 = 100
    expect(r.interesesPorPeriodo).toBe(100);
  });

  it('cuenta corriente sin remunerar · intereses = 0 aunque haya TAE', () => {
    const r = calcularCuentaResumen({
      tipo: 'CORRIENTE',
      saldoInicial: 50000,
      esRemunerada: false,
      taeAnual: 3,
      frecuenciaLiquidacion: 'mensual',
    });
    expect(r.interesesAnualesEstimados).toBe(0);
    expect(r.interesesPorPeriodo).toBe(0);
  });

  it('valores undefined / NaN / Infinity se tratan como 0', () => {
    const r = calcularCuentaResumen({
      tipo: 'CORRIENTE',
      saldoInicial: undefined,
      esRemunerada: true,
      taeAnual: NaN,
      frecuenciaLiquidacion: 'anual',
    });
    expect(r.saldoInicial).toBe(0);
    expect(r.interesesAnualesEstimados).toBe(0);
  });

  it('frecuencia anual · intereses por período = anual completo', () => {
    const r = calcularCuentaResumen({
      tipo: 'CORRIENTE',
      saldoInicial: 20000,
      esRemunerada: true,
      taeAnual: 3,
      frecuenciaLiquidacion: 'anual',
    });
    // 20.000 × 3% = 600 anual
    expect(r.interesesAnualesEstimados).toBe(600);
    expect(r.interesesPorPeriodo).toBe(600);
  });

  it('frecuencia semestral · intereses por período = anual / 2', () => {
    const r = calcularCuentaResumen({
      tipo: 'CORRIENTE',
      saldoInicial: 20000,
      esRemunerada: true,
      taeAnual: 3,
      frecuenciaLiquidacion: 'semestral',
    });
    expect(r.interesesAnualesEstimados).toBe(600);
    expect(r.interesesPorPeriodo).toBe(300);
  });
});
