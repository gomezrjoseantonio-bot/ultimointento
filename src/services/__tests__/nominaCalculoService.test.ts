// ============================================================================
// Tests · nominaCalculoService (ÚNICA FUENTE DE VERDAD · decisión F6)
// ============================================================================
//
// Suite principal · caso real Jose (ORANGE ESPAGNE 2026), validando que la
// función única `calcularNetoMesNomina(nomina, mes, año)` reproduce las cifras
// del wizard (la verdad) a partir de un `Nomina` persistido:
//
//   ENE  4.007,99 €  (mes normal)        MAY  4.007,99 €  (mes normal · crítico)
//   MAR 12.950,62 €  (normal + variable) JUN 14.435,54 €  (paga extra + variable)
//   ABR  6.986,78 €  (normal + bonus)    DIC  8.477,96 €  (paga extra)
//   Neto anual 74.914,79 €  ·  Bruto fijo + variables 122.370,56 €
//
// Tolerancia ±0,5 € · los importes del spec están redondeados a mano sobre
// inputs en % (el motor calcula con € exactos).
// ============================================================================

import type { Nomina } from '../../types/personal';
import {
  calcularNetoMesNomina,
  calcularNetoAnualNomina,
  calcularBrutoAnualNomina,
} from '../nominaCalculoService';

function buildJoseNomina(overrides: Partial<Nomina> = {}): Nomina {
  return {
    id: 1,
    personalDataId: 1,
    titular: 'yo',
    nombre: 'ORANGE ESPAGNE SA',
    fechaAntiguedad: '2020-01-01',
    salarioBrutoAnual: 95178.16,
    distribucion: { tipo: 'catorce', meses: 14 },
    // Variables y bonus en importe € exacto (evita ambigüedad del %).
    variables: [
      {
        id: 'var-marzo',
        nombre: 'Variable marzo',
        tipo: 'importe',
        valor: 13600.96,
        distribucionMeses: [{ mes: 3, porcentaje: 100 }],
      },
      {
        id: 'var-junio',
        nombre: 'Variable junio',
        tipo: 'importe',
        valor: 9060.96,
        distribucionMeses: [{ mes: 6, porcentaje: 100 }],
      },
    ],
    bonus: [{ id: 'bonus-abril', descripcion: 'Bonus abril', importe: 4530.48, mes: 4 }],
    beneficiosSociales: [],
    retencion: {
      irpfPorcentaje: 34.25,
      ss: {
        baseCotizacionMensual: 5101.20,
        contingenciasComunes: 4.70,
        desempleo: 1.55,
        formacionProfesional: 0.10,
        mei: 0.15,
        overrideManual: false,
      },
      cuotaSolidaridadMensual: 91.80 / 12,
    },
    planPensiones: {
      aportacionEmpleado: { tipo: 'importe', valor: 122.76 },
      aportacionEmpresa: { tipo: 'importe', valor: 163.68 },
      productoDestinoId: 'plan-1',
    },
    deduccionesAdicionales: [],
    cuentaAbono: 1,
    reglaCobroDia: { tipo: 'fijo', dia: 28 },
    pagasExtra: { mesesExtra: [6, 12] },
    activa: true,
    fechaCreacion: '2020-01-01T00:00:00.000Z',
    fechaActualizacion: '2020-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const AÑO = 2026;

describe('nominaCalculoService · caso real Jose (suite principal)', () => {
  const nomina = buildJoseNomina();

  test('ENE · mes normal → 4.007,99 €', () => {
    const { netoMes, tipoMes } = calcularNetoMesNomina(nomina, 1, AÑO);
    expect(netoMes).toBeCloseTo(4007.99, 0);
    expect(tipoMes).toBe('normal');
  });

  test('MAY · mes normal (test crítico) → 4.007,99 €', () => {
    const { netoMes, tipoMes } = calcularNetoMesNomina(nomina, 5, AÑO);
    expect(netoMes).toBeCloseTo(4007.99, 0);
    expect(tipoMes).toBe('normal');
  });

  test('MAR · normal + variable → 12.950,62 €', () => {
    const { netoMes, desglose, tipoMes } = calcularNetoMesNomina(nomina, 3, AÑO);
    expect(netoMes).toBeCloseTo(12950.62, 0);
    expect(desglose.variablesAplicables).toBeCloseTo(13600.96, 2);
    expect(desglose.pagaExtra).toBe(0);
    expect(tipoMes).toBe('variable');
  });

  test('ABR · normal + bonus → 6.986,78 €', () => {
    const { netoMes, desglose, tipoMes } = calcularNetoMesNomina(nomina, 4, AÑO);
    expect(netoMes).toBeCloseTo(6986.78, 0);
    expect(desglose.bonusAplicable).toBeCloseTo(4530.48, 2);
    expect(tipoMes).toBe('bonus');
  });

  test('JUN · paga extra + variable → 14.435,54 €', () => {
    const { netoMes, desglose, tipoMes } = calcularNetoMesNomina(nomina, 6, AÑO);
    expect(netoMes).toBeCloseTo(14435.54, 0);
    expect(desglose.pagaExtra).toBeGreaterThan(0);
    expect(desglose.variablesAplicables).toBeCloseTo(9060.96, 2);
    expect(tipoMes).toBe('extra+variable');
  });

  test('DIC · paga extra → 8.477,96 €', () => {
    const { netoMes, desglose, tipoMes } = calcularNetoMesNomina(nomina, 12, AÑO);
    expect(netoMes).toBeCloseTo(8477.96, 0);
    expect(desglose.pagaExtra).toBeGreaterThan(0);
    expect(tipoMes).toBe('extra');
  });

  test('Neto anual → 74.914,79 € (suma de los 12 meses reales)', () => {
    const { netoAnual, porMes } = calcularNetoAnualNomina(nomina, AÑO);
    expect(netoAnual).toBeCloseTo(74914.79, 0);
    // El anual debe ser exactamente la suma de los netos mensuales.
    const sumaMeses = porMes.reduce((s, m) => s + m.neto, 0);
    expect(netoAnual).toBeCloseTo(sumaMeses, 6);
  });

  test('Bruto anual fijo + variables → 122.370,56 €', () => {
    expect(calcularBrutoAnualNomina(nomina, AÑO)).toBeCloseTo(122370.56, 1);
  });

  test('coherencia · neto mensual de mayo == porMes[mayo] del anual', () => {
    const mensual = calcularNetoMesNomina(nomina, 5, AÑO).netoMes;
    const anual = calcularNetoAnualNomina(nomina, AÑO);
    expect(mensual).toBeCloseTo(anual.porMes[4].neto, 6);
  });

  test('desglose mensual · SS empleado y cuota solidaridad separados', () => {
    const { desglose } = calcularNetoMesNomina(nomina, 5, AÑO);
    expect(desglose.cuotaSolidaridad).toBeCloseTo(91.8 / 12, 4);
    expect(desglose.aportacionPPEmpleado).toBeCloseTo(122.76, 2);
    expect(desglose.aportacionPPEmpresa).toBeCloseTo(163.68, 2);
    expect(desglose.ssEmpleado).toBeGreaterThan(0);
  });
});

describe('nominaCalculoService · casos adicionales', () => {
  test('12 pagas · sin pagas extra · todos los meses iguales', () => {
    const nomina = buildJoseNomina({
      distribucion: { tipo: 'doce', meses: 12 },
      pagasExtra: undefined,
      variables: [],
      bonus: [],
      planPensiones: undefined,
    });
    const ene = calcularNetoMesNomina(nomina, 1, AÑO).netoMes;
    const jun = calcularNetoMesNomina(nomina, 6, AÑO).netoMes;
    const dic = calcularNetoMesNomina(nomina, 12, AÑO).netoMes;
    expect(jun).toBeCloseTo(ene, 6);
    expect(dic).toBeCloseTo(ene, 6);
    // Anual = 12 × mes normal.
    expect(calcularNetoAnualNomina(nomina, AÑO).netoAnual).toBeCloseTo(ene * 12, 4);
  });

  test('14 pagas con extras en otros meses (no jun/dic)', () => {
    const nomina = buildJoseNomina({
      variables: [],
      bonus: [],
      planPensiones: undefined,
      pagasExtra: { mesesExtra: [3, 9] },
    });
    expect(calcularNetoMesNomina(nomina, 3, AÑO).tipoMes).toBe('extra');
    expect(calcularNetoMesNomina(nomina, 9, AÑO).tipoMes).toBe('extra');
    expect(calcularNetoMesNomina(nomina, 6, AÑO).tipoMes).toBe('normal');
  });

  test('sin variables ni bonus · todos los meses normales', () => {
    const nomina = buildJoseNomina({
      variables: [],
      bonus: [],
      pagasExtra: undefined,
      distribucion: { tipo: 'doce', meses: 12 },
    });
    for (let mes = 1; mes <= 12; mes++) {
      expect(calcularNetoMesNomina(nomina, mes, AÑO).tipoMes).toBe('normal');
    }
  });

  test('PP empresa desactivado · no afecta al neto del empleado', () => {
    const conPP = buildJoseNomina();
    const sinPP = buildJoseNomina({ planPensiones: undefined });
    // PP empleado SÍ baja el neto · PP empresa NO. Comparamos sólo el efecto
    // de empresa manteniendo empleado constante.
    const soloEmpleado = buildJoseNomina({
      planPensiones: {
        aportacionEmpleado: { tipo: 'importe', valor: 122.76 },
        aportacionEmpresa: { tipo: 'importe', valor: 0 },
      },
    });
    expect(calcularNetoMesNomina(conPP, 5, AÑO).netoMes).toBeCloseTo(
      calcularNetoMesNomina(soloEmpleado, 5, AÑO).netoMes,
      6,
    );
    // Sin ningún PP, el neto es mayor (no se descuenta aportación empleado).
    expect(calcularNetoMesNomina(sinPP, 5, AÑO).netoMes).toBeGreaterThan(
      calcularNetoMesNomina(conPP, 5, AÑO).netoMes,
    );
  });

  test('mes fuera de rango → neto 0', () => {
    const nomina = buildJoseNomina();
    expect(calcularNetoMesNomina(nomina, 0, AÑO).netoMes).toBe(0);
    expect(calcularNetoMesNomina(nomina, 13, AÑO).netoMes).toBe(0);
  });
});
