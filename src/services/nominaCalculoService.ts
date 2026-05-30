// ============================================================================
// nominaCalculoService · ÚNICA FUENTE DE VERDAD para cifras de nómina
// ============================================================================
//
// FIX consolidar módulo Personal · función única de cálculo (decisión F6).
//
// Antes de esta tarea convivían DOS motores de cálculo de nómina:
//   1. `calcularNomina(input)` (nominaCalculatorService) · usado SOLO por el
//      preview del wizard · era el único que calculaba bien.
//   2. `nominaService.calculateSalary(nomina)` · usado por cards, panel,
//      Tesorería, Mi Plan y Proyección Mensual · producía cifras distintas
//      ("mentirosas") para la misma nómina.
//
// Este service unifica todo sobre el motor del wizard (`calcularNomina`),
// mapeando un `Nomina` persistido al input plano EXACTAMENTE como hace el
// wizard al editar (`hydrateFromNomina` + `calcInput` en NominaPage.tsx).
//
// REGLA ESTRICTA · toda vista que muestre el importe mensual/anual de una
// nómina DEBE llamar a estas funciones. NO duplicar lógica de cálculo en
// componentes ni en otros services.
//
// Funciones puras · sin side effects · sin acceso a IndexedDB/stores.
// ============================================================================

import type { Nomina } from '../types/personal';
import { getBaseMaxima } from '../constants/cotizacionSS';
import {
  calcularNomina,
  type CalcularNominaInput,
  type CalculadoraVariable,
} from './nominaCalculatorService';

export interface NetoMesNominaDesglose {
  pagaNormal: number;
  variablesAplicables: number;
  pagaExtra: number;
  bonusAplicable: number;
  aportacionPPEmpleado: number;
  aportacionPPEmpresa: number;
  irpfRetenido: number;
  ssEmpleado: number;
  cuotaSolidaridad: number;
}

export type TipoMesNomina =
  | 'normal'
  | 'variable'
  | 'extra'
  | 'extra+variable'
  | 'bonus';

export interface NetoMesNominaResult {
  netoMes: number;
  desglose: NetoMesNominaDesglose;
  tipoMes: TipoMesNomina;
}

export interface NetoAnualNominaResult {
  netoAnual: number;
  brutoAnual: number;
  totalRetenciones: number;
  totalSS: number;
  totalPP: number;
  porMes: Array<{ mes: number; neto: number }>;
}

const ZERO_DESGLOSE: NetoMesNominaDesglose = {
  pagaNormal: 0,
  variablesAplicables: 0,
  pagaExtra: 0,
  bonusAplicable: 0,
  aportacionPPEmpleado: 0,
  aportacionPPEmpresa: 0,
  irpfRetenido: 0,
  ssEmpleado: 0,
  cuotaSolidaridad: 0,
};

/**
 * Mapea un `Nomina` persistido al input plano de `calcularNomina`, replicando
 * fielmente lo que el wizard reconstruye al editar (NominaPage · hydrateFromNomina
 * + calcInput). Puntos clave:
 *  - `ssBaseCotizacionMensual` usa el TOPE LEGAL del año (`getBaseMaxima`), NO
 *    el `baseCotizacionMensual` persistido · así coincide con el wizard aunque
 *    la nómina se diera de alta en un año con otro tope.
 *  - Variables y bonus se unifican en `variables` (cada uno con su mes), igual
 *    que el formulario del wizard.
 *  - Plan de pensiones · sólo aportaciones de tipo `importe` afectan al neto
 *    (idéntico al wizard).
 */
function nominaToCalcInput(nomina: Nomina, año: number): CalcularNominaInput {
  const numeroPagas =
    nomina.distribucion?.tipo === 'doce'
      ? 12
      : nomina.distribucion?.tipo === 'catorce'
        ? 14
        : nomina.distribucion?.meses ?? 12;

  const mesesPagaExtra =
    nomina.pagasExtra?.mesesExtra && nomina.pagasExtra.mesesExtra.length > 0
      ? nomina.pagasExtra.mesesExtra
      : numeroPagas === 14
        ? [6, 12]
        : [];

  const variables: CalculadoraVariable[] = [
    ...(nomina.variables ?? []).map((v) => ({
      id: v.id ?? '',
      nombre: v.nombre,
      tipo: v.tipo,
      valor: v.valor,
      mes: v.distribucionMeses?.[0]?.mes ?? 1,
    })),
    ...(nomina.bonus ?? []).map((b) => ({
      id: b.id ?? '',
      nombre: b.descripcion,
      tipo: 'importe' as const,
      valor: b.importe,
      mes: b.mes,
    })),
  ];

  const ss = nomina.retencion.ss;
  const ssPorcentaje =
    ss.contingenciasComunes +
    ss.desempleo +
    ss.formacionProfesional +
    (ss.mei ?? 0);

  const plan = nomina.planPensiones;

  return {
    brutoAnual: nomina.salarioBrutoAnual,
    numeroPagas,
    mesesPagaExtra,
    variables,
    irpfPorcentaje: nomina.retencion.irpfPorcentaje,
    ssPorcentaje,
    ssBaseCotizacionMensual: getBaseMaxima(año),
    ssOverrideManual: false,
    cuotaSolidaridadAnual: (nomina.retencion.cuotaSolidaridadMensual ?? 0) * 12,
    planPensiones: plan
      ? {
          aportacionEmpleadoMes:
            plan.aportacionEmpleado.tipo === 'importe'
              ? plan.aportacionEmpleado.valor
              : 0,
          aportacionEmpresaMes:
            plan.aportacionEmpresa.tipo === 'importe'
              ? plan.aportacionEmpresa.valor
              : 0,
        }
      : undefined,
    beneficiosEspecie: (nomina.beneficiosSociales ?? []).map((b) => ({
      id: b.id ?? '',
      concepto: b.concepto,
      importeMensual: b.importeMensual,
      sumaIRPF: b.incrementaBaseIRPF,
    })),
  };
}

function bonusEnMes(nomina: Nomina, mes: number): number {
  return (nomina.bonus ?? [])
    .filter((b) => b.mes === mes)
    .reduce((acc, b) => acc + (b.importe || 0), 0);
}

function clasificarMes(
  tienePagaExtra: boolean,
  variablesAplicables: number,
  bonusAplicable: number,
): TipoMesNomina {
  const hayVariable = variablesAplicables > 0;
  const hayBonus = bonusAplicable > 0;
  if (tienePagaExtra && (hayVariable || hayBonus)) return 'extra+variable';
  if (tienePagaExtra) return 'extra';
  if (hayBonus && !hayVariable) return 'bonus';
  if (hayVariable) return 'variable';
  return 'normal';
}

/**
 * Devuelve el importe NETO que llega a la cuenta del titular en un mes concreto.
 *
 * ESTA FUNCIÓN ES LA ÚNICA FUENTE DE VERDAD para el importe mensual de nómina.
 * Considera bruto/nº pagas, variables del mes, paga extra del mes, bonus, PP
 * empleado/empresa, IRPF retenido, SS empleado y cuota de solidaridad.
 *
 * @param mes 1-12
 */
export function calcularNetoMesNomina(
  nomina: Nomina,
  mes: number,
  año: number,
): NetoMesNominaResult {
  if (mes < 1 || mes > 12) {
    return { netoMes: 0, desglose: { ...ZERO_DESGLOSE }, tipoMes: 'normal' };
  }

  const input = nominaToCalcInput(nomina, año);
  const out = calcularNomina(input);
  const m = out.meses[mes - 1];
  if (!m) {
    return { netoMes: 0, desglose: { ...ZERO_DESGLOSE }, tipoMes: 'normal' };
  }

  const cuotaSolidaridad = input.cuotaSolidaridadAnual / 12;
  const ssEmpleado = m.ss - cuotaSolidaridad;
  const bonusAplicable = bonusEnMes(nomina, mes);
  const variablesAplicables = Math.max(0, m.variables - bonusAplicable);

  return {
    netoMes: m.neto,
    desglose: {
      pagaNormal: m.salarioBase,
      variablesAplicables,
      pagaExtra: m.pagaExtra,
      bonusAplicable,
      aportacionPPEmpleado: m.ppEmpleado,
      aportacionPPEmpresa: m.ppEmpresa,
      irpfRetenido: m.irpf,
      ssEmpleado,
      cuotaSolidaridad,
    },
    tipoMes: clasificarMes(m.tienePagaExtra, variablesAplicables, bonusAplicable),
  };
}

/**
 * Devuelve el neto anual sumando los 12 meses reales (NO divide bruto por 12).
 *
 * Única fuente de verdad para el "Neto anual" de una nómina.
 */
export function calcularNetoAnualNomina(
  nomina: Nomina,
  año: number,
): NetoAnualNominaResult {
  const input = nominaToCalcInput(nomina, año);
  const out = calcularNomina(input);

  return {
    netoAnual: out.netoAnual,
    brutoAnual: out.brutoTotalAnual,
    totalRetenciones: out.irpfAnual,
    totalSS: out.ssAnual,
    totalPP: out.ppTotalAnual,
    porMes: out.meses.map((m) => ({ mes: m.mes, neto: m.neto })),
  };
}

/**
 * Devuelve el bruto fijo + variables del año (sin descontar nada).
 * Útil para vistas que muestran "Bruto anual" como dato fiscal.
 */
export function calcularBrutoAnualNomina(nomina: Nomina, año: number): number {
  const input = nominaToCalcInput(nomina, año);
  return calcularNomina(input).brutoTotalAnual;
}
