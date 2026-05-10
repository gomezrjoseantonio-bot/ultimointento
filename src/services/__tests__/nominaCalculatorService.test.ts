// ============================================================================
// S-WIZARD-NOMINA-V3 · sub-tarea 3 · tests función pura calcularNomina
// ============================================================================
//
// Caso real Jose (Orange Espagne SAU 2026) usado como dogfood:
//  · Bruto fijo anual    · 95.178,16 €
//  · Nº pagas            · 14 (extras junio + diciembre)
//  · Variable 60% marzo  · 14,28 % bruto = 13.591,44 €
//  · Variable 40% junio  ·  9,52 % bruto =  9.060,96 €
//  · IRPF                · 34,25 %
//  · SS empleado         · 6,50 % (4,70 + 1,55 + 0,10 + 0,15)
//  · Cuota solidaridad   · 91,80 €/año (≈ 7,65 €/mes)
//  · Plan pensiones      · empleado 122,76 €/mes · empresa 163,68 €/mes
//  · Especie             · 6 conceptos · 468,93 €/mes (todos exentos IRPF
//                          en el caso · sumaIRPF=false)
// ============================================================================

import { calcularNomina, type CalcularNominaInput } from '../nominaCalculatorService';

const BASE_MAXIMA_2026 = 5101.20; // tope SS mensual aproximado para el caso

function buildInput(overrides: Partial<CalcularNominaInput> = {}): CalcularNominaInput {
  return {
    brutoAnual: 95178.16,
    numeroPagas: 14,
    mesesPagaExtra: [6, 12],
    variables: [
      { id: 'v1', nombre: 'Variable 60%', tipo: 'porcentaje', valor: 14.28, mes: 3 },
      { id: 'v2', nombre: 'Variable 40%', tipo: 'porcentaje', valor: 9.52, mes: 6 },
    ],
    irpfPorcentaje: 34.25,
    ssPorcentaje: 6.50,
    ssBaseCotizacionMensual: BASE_MAXIMA_2026,
    ssOverrideManual: false,
    cuotaSolidaridadAnual: 91.80,
    planPensiones: { aportacionEmpleadoMes: 122.76, aportacionEmpresaMes: 163.68 },
    beneficiosEspecie: [
      { id: 'e1', concepto: 'Seguro vida',         importeMensual: 13.36,  sumaIRPF: false },
      { id: 'e2', concepto: 'Seguro médico',       importeMensual: 93.58,  sumaIRPF: false },
      { id: 'e3', concepto: 'Vehículo / gasolina', importeMensual: 60.00,  sumaIRPF: false },
      { id: 'e4', concepto: 'Teléfono móvil',      importeMensual: 140.20, sumaIRPF: false },
      { id: 'e5', concepto: 'Cheque restaurante',  importeMensual: 160.00, sumaIRPF: false },
      { id: 'e6', concepto: 'Otro',                importeMensual: 1.79,   sumaIRPF: false },
    ],
    ...overrides,
  };
}

describe('calcularNomina · función pura', () => {
  test('caso simple · 12 pagas · sin variables · sin especie · sin PP', () => {
    const out = calcularNomina({
      brutoAnual: 24000,
      numeroPagas: 12,
      mesesPagaExtra: [],
      variables: [],
      irpfPorcentaje: 15,
      ssPorcentaje: 6,
      ssBaseCotizacionMensual: 5000,
      cuotaSolidaridadAnual: 0,
      beneficiosEspecie: [],
    });

    expect(out.meses).toHaveLength(12);
    expect(out.brutoFijoAnual).toBeCloseTo(24000, 2);
    expect(out.variablesAnual).toBeCloseTo(0, 2);
    expect(out.brutoTotalAnual).toBeCloseTo(24000, 2);
    // Cada mes: 2000 bruto · SS 2000*0.06=120 · IRPF 2000*0.15=300 · neto 1580
    expect(out.meses[0].neto).toBeCloseTo(1580, 2);
    expect(out.netoAnual).toBeCloseTo(1580 * 12, 2);
  });

  test('14 pagas · paga extra duplica el bruto del mes', () => {
    const out = calcularNomina({
      brutoAnual: 14000,
      numeroPagas: 14,
      mesesPagaExtra: [6, 12],
      variables: [],
      irpfPorcentaje: 0,
      ssPorcentaje: 0,
      ssBaseCotizacionMensual: 0,
      cuotaSolidaridadAnual: 0,
      beneficiosEspecie: [],
    });

    const mensual = 14000 / 14; // 1000
    expect(out.meses[0].totalDevengado).toBeCloseTo(mensual, 2); // enero
    expect(out.meses[5].totalDevengado).toBeCloseTo(mensual * 2, 2); // junio
    expect(out.meses[11].totalDevengado).toBeCloseTo(mensual * 2, 2); // diciembre
    expect(out.brutoFijoAnual).toBeCloseTo(14000, 2);
  });

  test('variable porcentaje · se cobra íntegra en el mes indicado', () => {
    const out = calcularNomina(buildInput());
    const marzo = out.meses[2];
    const junio = out.meses[5];
    expect(marzo.tieneVariable).toBe(true);
    expect(marzo.variables).toBeCloseTo(95178.16 * 0.1428, 2); // 13591.44
    expect(junio.tieneVariable).toBe(true);
    expect(junio.variables).toBeCloseTo(95178.16 * 0.0952, 2); // 9060.96
  });

  test('variable importe fijo · se cobra el importe íntegro', () => {
    const out = calcularNomina({
      brutoAnual: 24000,
      numeroPagas: 12,
      mesesPagaExtra: [],
      variables: [{ id: 'v', nombre: 'Bonus', tipo: 'importe', valor: 5000, mes: 4 }],
      irpfPorcentaje: 0,
      ssPorcentaje: 0,
      ssBaseCotizacionMensual: 0,
      cuotaSolidaridadAnual: 0,
      beneficiosEspecie: [],
    });
    expect(out.meses[3].variables).toBeCloseTo(5000, 2);
    expect(out.variablesAnual).toBeCloseTo(5000, 2);
  });

  test('SS se topa contra base máxima cuando devengado > base', () => {
    const out = calcularNomina({
      brutoAnual: 14000, // mensual 1000
      numeroPagas: 14,
      mesesPagaExtra: [6, 12], // junio devenga 2000
      variables: [],
      irpfPorcentaje: 0,
      ssPorcentaje: 10,
      ssBaseCotizacionMensual: 1500, // tope
      cuotaSolidaridadAnual: 0,
      beneficiosEspecie: [],
    });
    // Enero · 1000 < 1500 · SS = 1000*0.10 = 100
    expect(out.meses[0].ss).toBeCloseTo(100, 2);
    // Junio · 2000 > 1500 · SS = 1500*0.10 = 150 (tope)
    expect(out.meses[5].ss).toBeCloseTo(150, 2);
  });

  test('especie suma a base IRPF si sumaIRPF=true · NO al neto', () => {
    const out = calcularNomina({
      brutoAnual: 24000,
      numeroPagas: 12,
      mesesPagaExtra: [],
      variables: [],
      irpfPorcentaje: 10,
      ssPorcentaje: 0,
      ssBaseCotizacionMensual: 0,
      cuotaSolidaridadAnual: 0,
      beneficiosEspecie: [
        { id: 'a', concepto: 'Vehículo', importeMensual: 200, sumaIRPF: true },
        { id: 'b', concepto: 'Cheque',   importeMensual: 100, sumaIRPF: false },
      ],
    });
    // IRPF mes = (2000 + 200) * 0.10 = 220 (cheque exento NO suma)
    expect(out.meses[0].irpf).toBeCloseTo(220, 2);
    // Neto = 2000 - 0 - 220 = 1780 (especie no llega a la cuenta)
    expect(out.meses[0].neto).toBeCloseTo(1780, 2);
    expect(out.meses[0].especie).toBeCloseTo(300, 2);
    expect(out.especieAnual).toBeCloseTo(300 * 12, 2);
  });

  test('plan pensiones · descuenta empleado del neto · empresa NO afecta neto', () => {
    const out = calcularNomina({
      brutoAnual: 24000,
      numeroPagas: 12,
      mesesPagaExtra: [],
      variables: [],
      irpfPorcentaje: 0,
      ssPorcentaje: 0,
      ssBaseCotizacionMensual: 0,
      cuotaSolidaridadAnual: 0,
      planPensiones: { aportacionEmpleadoMes: 100, aportacionEmpresaMes: 200 },
      beneficiosEspecie: [],
    });
    // Mes · 2000 - 0 - 0 - 100 = 1900
    expect(out.meses[0].neto).toBeCloseTo(1900, 2);
    expect(out.meses[0].ppEmpleado).toBeCloseTo(100, 2);
    expect(out.meses[0].ppEmpresa).toBeCloseTo(200, 2);
    expect(out.ppEmpleadoAnual).toBeCloseTo(1200, 2);
    expect(out.ppEmpresaAnual).toBeCloseTo(2400, 2);
    expect(out.ppTotalAnual).toBeCloseTo(3600, 2);
  });

  test('cuota solidaridad · se reparte como 1/12 por mes y suma a SS', () => {
    const out = calcularNomina({
      brutoAnual: 24000,
      numeroPagas: 12,
      mesesPagaExtra: [],
      variables: [],
      irpfPorcentaje: 0,
      ssPorcentaje: 6,
      ssBaseCotizacionMensual: 5000,
      cuotaSolidaridadAnual: 120,
      beneficiosEspecie: [],
    });
    // Mes · SS = 2000*0.06 + 10 = 130
    expect(out.meses[0].ss).toBeCloseTo(130, 2);
    expect(out.ssAnual).toBeCloseTo(130 * 12, 2);
  });

  test('caso real Jose · totales coherentes con expectativa', () => {
    const out = calcularNomina(buildInput());

    // Bruto total anual = bruto fijo + variables = 95178.16 + 22652.40
    expect(out.variablesAnual).toBeCloseTo(13591.44 + 9060.96, 2);
    expect(out.brutoTotalAnual).toBeCloseTo(95178.16 + 22652.40, 1);

    // PP anual · empleado 122.76*12 = 1473.12 · empresa 163.68*12 = 1964.16
    expect(out.ppEmpleadoAnual).toBeCloseTo(1473.12, 2);
    expect(out.ppEmpresaAnual).toBeCloseTo(1964.16, 2);
    expect(out.ppTotalAnual).toBeCloseTo(3437.28, 2);

    // IRPF anual ≈ (bruto total + especie sumaIRPF) * 34.25 %
    // Como especie es exenta · IRPF = 117830.56 * 0.3425 = 40362.97 (~mockup 40356.97)
    expect(out.irpfAnual).toBeGreaterThan(40000);
    expect(out.irpfAnual).toBeLessThan(40500);

    // 12 meses
    expect(out.meses).toHaveLength(12);
    // Marzo y junio son los más altos · diciembre tiene paga extra sin variable
    const marzo = out.meses[2].totalDevengado;
    const junio = out.meses[5].totalDevengado;
    const enero = out.meses[0].totalDevengado;
    expect(marzo).toBeGreaterThan(enero);
    expect(junio).toBeGreaterThan(enero);
  });

  test('mes normal · neto coherente sin variables ni paga extra', () => {
    const out = calcularNomina(buildInput());
    const enero = out.meses[0];
    expect(enero.tieneVariable).toBe(false);
    expect(enero.tienePagaExtra).toBe(false);
    expect(out.netoMesNormal).toBeCloseTo(enero.neto, 2);
  });

  test('número de pagas fuera de rango · se clampa a [12, 16]', () => {
    const out12 = calcularNomina({ ...buildInput(), numeroPagas: 5, mesesPagaExtra: [] });
    expect(out12.brutoFijoAnual).toBeCloseTo(95178.16, 2);
    const out16 = calcularNomina({ ...buildInput(), numeroPagas: 99, mesesPagaExtra: [3, 6, 9, 12] });
    expect(out16.brutoFijoAnual).toBeCloseTo(95178.16, 2);
  });

  test('input vacío / cero · no rompe', () => {
    const out = calcularNomina({
      brutoAnual: 0,
      numeroPagas: 12,
      mesesPagaExtra: [],
      variables: [],
      irpfPorcentaje: 0,
      ssPorcentaje: 0,
      ssBaseCotizacionMensual: 0,
      cuotaSolidaridadAnual: 0,
      beneficiosEspecie: [],
    });
    expect(out.netoAnual).toBe(0);
    expect(out.meses.every((m) => m.neto === 0)).toBe(true);
  });
});
