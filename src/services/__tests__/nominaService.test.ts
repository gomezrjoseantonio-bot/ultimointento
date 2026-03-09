// Tests for nominaService.calculateSalary — tarea 1.7 epic #414

import { nominaService } from '../nominaService';
import { Nomina } from '../../types/personal';

// Minimal valid Nomina factory for tests
function makeNomina(overrides: Partial<Nomina> = {}): Nomina {
  return {
    personalDataId: 1,
    titular: 'yo',
    nombre: 'Test',
    fechaAntiguedad: '2020-01-01',
    salarioBrutoAnual: 30000,
    distribucion: { tipo: 'doce', meses: 12 },
    variables: [],
    bonus: [],
    beneficiosSociales: [],
    retencion: {
      irpfPorcentaje: 15,
      ss: {
        baseCotizacionMensual: 4909.5,
        contingenciasComunes: 4.70,
        desempleo: 1.55,
        formacionProfesional: 0.10,
        mei: 0.13,
        overrideManual: false,
      },
    },
    deduccionesAdicionales: [],
    cuentaAbono: 1,
    reglaCobroDia: { tipo: 'fijo', dia: 28 },
    activa: true,
    fechaCreacion: '2024-01-01T00:00:00.000Z',
    fechaActualizacion: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('nominaService.calculateSalary', () => {
  it('30.000€ bruto, 12 pagas, sin variables → totalAnualBruto = 30.000€', () => {
    const nomina = makeNomina({ salarioBrutoAnual: 30000, distribucion: { tipo: 'doce', meses: 12 } });
    const calculo = nominaService.calculateSalary(nomina);
    expect(calculo.totalAnualBruto).toBeCloseTo(30000, 2);
  });

  it('30.000€ bruto, 14 pagas → totalAnualBruto = 30.000€ (14 pagas distribuye el mismo bruto)', () => {
    const nomina = makeNomina({ salarioBrutoAnual: 30000, distribucion: { tipo: 'catorce', meses: 14 } });
    const calculo = nominaService.calculateSalary(nomina);
    // 14 pagas: base unit = 30000/14, June and December each get 2 units
    // Total devengado = 12 * (30000/14) + 2 * (30000/14) = 14 * (30000/14) = 30000
    expect(calculo.totalAnualBruto).toBeCloseTo(30000, 2);
  });

  it('30.000€ bruto + bonus de 3.000€ en marzo → totalAnualBruto = 33.000€', () => {
    const nomina = makeNomina({
      salarioBrutoAnual: 30000,
      bonus: [{ descripcion: 'Bonus anual', importe: 3000, mes: 3 }],
    });
    const calculo = nominaService.calculateSalary(nomina);
    expect(calculo.totalAnualBruto).toBeCloseTo(33000, 2);
  });

  it('especie 200€/mes → totalAnualEspecie = 2.400€', () => {
    const nomina = makeNomina({
      beneficiosSociales: [
        { id: '1', concepto: 'Seguro médico', tipo: 'seguro-medico', importeMensual: 200, incrementaBaseIRPF: true },
      ],
    });
    const calculo = nominaService.calculateSalary(nomina);
    expect(calculo.totalAnualEspecie).toBeCloseTo(2400, 2);
  });

  it('especie exenta no incrementa la base IRPF', () => {
    const nomina = makeNomina({
      beneficiosSociales: [
        { id: '1', concepto: 'Cheque guardería', tipo: 'cheque-guarderia', importeMensual: 100, incrementaBaseIRPF: false },
      ],
    });
    const calculo = nominaService.calculateSalary(nomina);
    expect(calculo.totalAnualEspecie).toBe(0);
  });

  it('PP empresa 3% de 30.000€ → totalAnualPPEmpresa = 900€', () => {
    const nomina = makeNomina({
      planPensiones: {
        aportacionEmpresa: { tipo: 'porcentaje', valor: 3 },
        aportacionEmpleado: { tipo: 'porcentaje', valor: 0 },
      },
    });
    const calculo = nominaService.calculateSalary(nomina);
    expect(calculo.totalAnualPPEmpresa).toBeCloseTo(900, 2);
  });

  it('PP empleado 5% de 30.000€ → totalAnualPPEmpleado = 1.500€', () => {
    const nomina = makeNomina({
      planPensiones: {
        aportacionEmpresa: { tipo: 'porcentaje', valor: 0 },
        aportacionEmpleado: { tipo: 'porcentaje', valor: 5 },
      },
    });
    const calculo = nominaService.calculateSalary(nomina);
    expect(calculo.totalAnualPPEmpleado).toBeCloseTo(1500, 2);
  });

  it('totalAnualPP = totalAnualPPEmpleado + totalAnualPPEmpresa', () => {
    const nomina = makeNomina({
      planPensiones: {
        aportacionEmpresa: { tipo: 'porcentaje', valor: 3 },
        aportacionEmpleado: { tipo: 'porcentaje', valor: 5 },
      },
    });
    const calculo = nominaService.calculateSalary(nomina);
    expect(calculo.totalAnualPP).toBeCloseTo(calculo.totalAnualPPEmpleado + calculo.totalAnualPPEmpresa, 2);
  });

  it('SS se calcula topada contra baseCotizacionMensual', () => {
    // 30.000€ / 12 = 2.500€/mes, base cotización = 4.909,50€ → aplica el bruto (menor)
    const nomina = makeNomina({ salarioBrutoAnual: 30000 });
    const calculo = nominaService.calculateSalary(nomina);
    const ssTotalAnual = calculo.distribucionMensual.reduce((s, m) => s + m.ssTotal, 0);
    // 2500 * (4.70+1.55+0.10+0.13)/100 * 12
    const expectedSS = 2500 * (4.70 + 1.55 + 0.10 + 0.13) / 100 * 12;
    expect(ssTotalAnual).toBeCloseTo(expectedSS, 1);
  });
});
