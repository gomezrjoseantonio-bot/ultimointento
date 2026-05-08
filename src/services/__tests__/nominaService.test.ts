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

// ════════════════════════════════════════════════════════════════════════════
// PR-C4 · resolución per-month con `historial` + `vigenciaDesde`
// (cubre review Copilot · #1295)
// ════════════════════════════════════════════════════════════════════════════

describe('nominaService.calculateSalary · historial vigenciaDesde (PR-C4)', () => {
  it('historial vacío o ausente → mantiene retrocompatibilidad (top-level rige)', () => {
    const nomina = makeNomina({
      salarioBrutoAnual: 30000,
      // historial intencionalmente undefined
    });
    const calculo = nominaService.calculateSalary(nomina, 2026);
    expect(calculo.totalAnualBruto).toBeCloseTo(30000, 2);
    // Todos los meses con el mismo bruto base.
    for (const mes of calculo.distribucionMensual) {
      expect(mes.salarioBase).toBeCloseTo(30000 / 12, 2);
    }
  });

  it('subida abril · enero-marzo con bruto antiguo · abril-diciembre con bruto nuevo', () => {
    const nomina = makeNomina({
      salarioBrutoAnual: 38000, // top-level refleja el snapshot vigente más reciente
      historial: [
        {
          id: 'h1',
          vigenciaDesde: '2024-01-01',
          motivo: 'Snapshot inicial',
          snapshot: { salarioBrutoAnual: 35000 },
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'h2',
          vigenciaDesde: '2026-04-01',
          motivo: 'Subida abril 2026',
          snapshot: { salarioBrutoAnual: 38000 },
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    });
    const calculo = nominaService.calculateSalary(nomina, 2026);
    // Enero (mes 1): 35000/12
    expect(calculo.distribucionMensual[0].salarioBase).toBeCloseTo(35000 / 12, 2);
    // Marzo (mes 3): 35000/12
    expect(calculo.distribucionMensual[2].salarioBase).toBeCloseTo(35000 / 12, 2);
    // Abril (mes 4): 38000/12
    expect(calculo.distribucionMensual[3].salarioBase).toBeCloseTo(38000 / 12, 2);
    // Diciembre (mes 12): 38000/12
    expect(calculo.distribucionMensual[11].salarioBase).toBeCloseTo(38000 / 12, 2);
    // Total anual = 3 meses a 35k + 9 meses a 38k = 35000*0.25 + 38000*0.75
    expect(calculo.totalAnualBruto).toBeCloseTo(35000 * 0.25 + 38000 * 0.75, 0);
  });

  it('mes sin match en historial cae al snapshot anterior (no al top-level)', () => {
    // Año 2026 con snapshot vigente desde 2025-06: todos los meses 2026 deben usar el snapshot 35k.
    const nomina = makeNomina({
      salarioBrutoAnual: 99000, // top-level con valor distinto · no debe aplicarse en 2026
      historial: [
        {
          id: 'h1',
          vigenciaDesde: '2025-06-01',
          motivo: 'Snapshot único',
          snapshot: { salarioBrutoAnual: 35000 },
          createdAt: '2025-06-01T00:00:00.000Z',
        },
      ],
    });
    const calculo = nominaService.calculateSalary(nomina, 2026);
    expect(calculo.totalAnualBruto).toBeCloseTo(35000, 2);
  });

  it('año previo a la primera entrada del historial · cae a top-level (fallback)', () => {
    const nomina = makeNomina({
      salarioBrutoAnual: 42000, // top-level fallback
      historial: [
        {
          id: 'h1',
          vigenciaDesde: '2026-01-01',
          motivo: 'Snapshot 2026',
          snapshot: { salarioBrutoAnual: 35000 },
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    // Cálculo para 2025: ningún mes tiene match en historial → top-level (42k).
    const calculo = nominaService.calculateSalary(nomina, 2025);
    expect(calculo.totalAnualBruto).toBeCloseTo(42000, 2);
  });

  it('historial desordenado (defensive sort) · resuelve correctamente', () => {
    const nomina = makeNomina({
      salarioBrutoAnual: 38000,
      historial: [
        // Intencionalmente desordenado para ejercitar el sort defensivo.
        {
          id: 'h2',
          vigenciaDesde: '2026-04-01',
          motivo: 'Subida',
          snapshot: { salarioBrutoAnual: 38000 },
          createdAt: '2026-04-01T00:00:00.000Z',
        },
        {
          id: 'h1',
          vigenciaDesde: '2024-01-01',
          motivo: 'Inicial',
          snapshot: { salarioBrutoAnual: 35000 },
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    });
    const calculo = nominaService.calculateSalary(nomina, 2026);
    // Marzo debe ser 35000/12 · abril 38000/12.
    expect(calculo.distribucionMensual[2].salarioBase).toBeCloseTo(35000 / 12, 2);
    expect(calculo.distribucionMensual[3].salarioBase).toBeCloseTo(38000 / 12, 2);
  });
});
