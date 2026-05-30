// ============================================================================
// Tests cross-view · módulo Personal (FIX consolidar · F6/F7)
// ============================================================================
//
// Garantiza que los helpers de vista (los que usan card de Ingresos, panel y
// presupuesto) devuelven EXACTAMENTE lo mismo que la función única del service.
// Si alguno divergiera, una vista mostraría un número distinto = BUG.
// ============================================================================

import type { Autonomo, Nomina } from '../../../types/personal';
import {
  computeNominaNetoEnMes,
  computeNominaNetoPorMes,
  computeAutonomoNetoEnMes,
  computeAutonomoNetoPorMes,
} from '../helpers';
import {
  calcularNetoMesNomina,
  calcularNetoAnualNomina,
} from '../../../services/nominaCalculoService';
import {
  calcularNetoMesAutonomo,
  calcularNetoAnualAutonomo,
} from '../../../services/autonomoCalculoService';

const AÑO = new Date().getFullYear();

function joseNomina(activa = true): Nomina {
  return {
    id: 1,
    personalDataId: 1,
    titular: 'yo',
    nombre: 'ORANGE ESPAGNE SA',
    fechaAntiguedad: '2020-01-01',
    salarioBrutoAnual: 95178.16,
    distribucion: { tipo: 'catorce', meses: 14 },
    variables: [
      { id: 'v1', nombre: 'Var marzo', tipo: 'importe', valor: 13600.96, distribucionMeses: [{ mes: 3, porcentaje: 100 }] },
    ],
    bonus: [{ id: 'b1', descripcion: 'Bonus abril', importe: 4530.48, mes: 4 }],
    beneficiosSociales: [],
    retencion: {
      irpfPorcentaje: 34.25,
      ss: { baseCotizacionMensual: 5101.2, contingenciasComunes: 4.7, desempleo: 1.55, formacionProfesional: 0.1, mei: 0.15, overrideManual: false },
      cuotaSolidaridadMensual: 91.8 / 12,
    },
    planPensiones: {
      aportacionEmpleado: { tipo: 'importe', valor: 122.76 },
      aportacionEmpresa: { tipo: 'importe', valor: 163.68 },
    },
    deduccionesAdicionales: [],
    cuentaAbono: 1,
    reglaCobroDia: { tipo: 'fijo', dia: 28 },
    pagasExtra: { mesesExtra: [6, 12] },
    activa,
    fechaCreacion: '2020-01-01T00:00:00.000Z',
    fechaActualizacion: '2020-01-01T00:00:00.000Z',
  };
}

function joseAutonomo(activo = true): Autonomo {
  return {
    id: 2,
    personalDataId: 1,
    nombre: 'Actividad',
    titular: 'yo',
    ingresosFacturados: [],
    gastosDeducibles: [],
    fuentesIngreso: [{ id: 'f1', nombre: 'Proyecto', importeEstimado: 4000, meses: [2, 3], aplIrpf: true }],
    gastosRecurrentesActividad: [],
    cuotaAutonomos: 315,
    irpfRetencionPorcentaje: 15,
    cuentaCobro: 1,
    cuentaPago: 1,
    reglaCobroDia: { tipo: 'fijo', dia: 1 },
    reglaPagoDia: { tipo: 'fijo', dia: 1 },
    activo,
    fechaCreacion: '2020-01-01T00:00:00.000Z',
    fechaActualizacion: '2020-01-01T00:00:00.000Z',
  };
}

describe('cross-view · nómina · todas las vistas = mismo importe', () => {
  const nomina = joseNomina();

  test('helper mes (card/presupuesto) == service · todos los meses', () => {
    for (let mes = 1; mes <= 12; mes++) {
      expect(computeNominaNetoEnMes(nomina, mes)).toBeCloseTo(
        calcularNetoMesNomina(nomina, mes, AÑO).netoMes,
        6,
      );
    }
  });

  test('helper porMes (panel/card anual) == service.porMes', () => {
    const porMesHelper = computeNominaNetoPorMes(nomina);
    const { porMes, netoAnual } = calcularNetoAnualNomina(nomina, AÑO);
    porMes.forEach((m, i) => expect(porMesHelper[i]).toBeCloseTo(m.neto, 6));
    // El "Neto anual" de la card (suma del array) == netoAnual del service.
    expect(porMesHelper.reduce((s, v) => s + v, 0)).toBeCloseTo(netoAnual, 4);
  });

  test('nómina inactiva → 0 en todas las vistas', () => {
    const inactiva = joseNomina(false);
    expect(computeNominaNetoEnMes(inactiva, 5)).toBe(0);
    expect(computeNominaNetoPorMes(inactiva).every((v) => v === 0)).toBe(true);
  });
});

describe('cross-view · autónomo · todas las vistas = mismo importe', () => {
  const autonomo = joseAutonomo();

  test('helper mes == service · todos los meses', () => {
    for (let mes = 1; mes <= 12; mes++) {
      expect(computeAutonomoNetoEnMes(autonomo, mes)).toBeCloseTo(
        calcularNetoMesAutonomo(autonomo, mes, AÑO).netoMes,
        6,
      );
    }
  });

  test('helper porMes == service.porMes', () => {
    const porMesHelper = computeAutonomoNetoPorMes(autonomo);
    const { porMes } = calcularNetoAnualAutonomo(autonomo, AÑO);
    porMes.forEach((m, i) => expect(porMesHelper[i]).toBeCloseTo(m.neto, 6));
  });

  test('mes sin ingreso → neto = −cuota (panel resta a la nómina)', () => {
    // Mayo no está en meses [2,3] → sólo cuota RETA.
    expect(computeAutonomoNetoEnMes(autonomo, 5)).toBeCloseTo(-315, 2);
  });

  test('autónomo inactivo → 0 en todas las vistas', () => {
    const inactivo = joseAutonomo(false);
    expect(computeAutonomoNetoEnMes(inactivo, 5)).toBe(0);
    expect(computeAutonomoNetoPorMes(inactivo).every((v) => v === 0)).toBe(true);
  });
});
