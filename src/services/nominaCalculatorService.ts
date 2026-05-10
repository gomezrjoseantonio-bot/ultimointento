// ============================================================================
// S-WIZARD-NOMINA-V3 · sub-tarea 3
// ============================================================================
//
// Función pura `calcularNomina(input)` para el preview live del wizard de
// nómina ATLAS v8 · pantalla única. Reproduce la semántica de
// `nominaService.calculateSalary` pero acepta un input plano (lo que el
// formulario tiene en estado) y devuelve un desglose anual + 12 meses.
//
// Reglas:
//  - CERO consultas a IndexedDB · CERO efectos · pura.
//  - Los importes son números (€). Los porcentajes en input son números en
//    base 100 (ej. 14.28 = 14.28 %).
//  - SS empleado se calcula sobre `min(baseCotizacionMensual, totalDevengado)`
//    salvo que `ssOverrideManual` esté activo (entonces siempre usa la base).
//  - IRPF aplica sobre (totalDevengado + especieMensual_que_sume_IRPF).
//  - Plan pensiones (aportación empleado) se DESCUENTA del líquido.
//  - Beneficios en especie · suma a base IRPF si `sumaIRPF=true`, NO al neto
//    en cuenta (no llega a la cuenta).
// ============================================================================

export type CalculadoraVariableTipo = 'porcentaje' | 'importe';

export interface CalculadoraVariable {
  id: string;
  nombre: string;
  tipo: CalculadoraVariableTipo;
  /** % sobre bruto si tipo='porcentaje' · importe anual si tipo='importe'. */
  valor: number;
  /** Mes 1-12 en el que se cobra íntegro. */
  mes: number;
}

export interface CalculadoraEspecie {
  id: string;
  concepto: string;
  importeMensual: number;
  /** true si suma a la base IRPF · false si exento. */
  sumaIRPF: boolean;
}

export interface CalculadoraPlanPensiones {
  /** Aportación del empleado al mes (€). Se descuenta del neto. */
  aportacionEmpleadoMes: number;
  /** Aportación de la empresa al mes (€). NO afecta al neto. */
  aportacionEmpresaMes: number;
}

export interface CalcularNominaInput {
  brutoAnual: number;
  /** 12, 14, 15 o 16. */
  numeroPagas: number;
  /** Meses 1-12 en los que se cobra paga extra. Tantos como (numeroPagas-12). */
  mesesPagaExtra: number[];
  variables: CalculadoraVariable[];
  /** % IRPF (base 100). */
  irpfPorcentaje: number;
  /** % SS empleado total (base 100) · suma de contingencias+desempleo+FP+MEI. */
  ssPorcentaje: number;
  ssBaseCotizacionMensual: number;
  ssOverrideManual?: boolean;
  /** € anuales fijos. */
  cuotaSolidaridadAnual: number;
  planPensiones?: CalculadoraPlanPensiones;
  beneficiosEspecie: CalculadoraEspecie[];
}

export interface CalcularNominaMes {
  mes: number;
  salarioBase: number;
  pagaExtra: number;
  variables: number;
  totalDevengado: number;
  especie: number;
  ss: number;
  irpf: number;
  ppEmpleado: number;
  ppEmpresa: number;
  neto: number;
  /** True si en el mes hay alguna variable. */
  tieneVariable: boolean;
  /** True si en el mes hay paga extra (por número de pagas). */
  tienePagaExtra: boolean;
}

export interface CalcularNominaOutput {
  meses: CalcularNominaMes[];
  brutoFijoAnual: number;
  variablesAnual: number;
  brutoTotalAnual: number;
  especieAnual: number;
  irpfAnual: number;
  ssAnual: number;
  ppEmpleadoAnual: number;
  ppEmpresaAnual: number;
  ppTotalAnual: number;
  netoAnual: number;
  /** Neto promedio de un mes sin variables ni pagas extras. */
  netoMesNormal: number;
}

/**
 * Función pura · calcula la distribución mensual y los totales anuales de
 * una nómina a partir del input del wizard.
 */
export function calcularNomina(input: CalcularNominaInput): CalcularNominaOutput {
  const {
    brutoAnual,
    numeroPagas,
    mesesPagaExtra,
    variables,
    irpfPorcentaje,
    ssPorcentaje,
    ssBaseCotizacionMensual,
    ssOverrideManual = false,
    cuotaSolidaridadAnual,
    planPensiones,
    beneficiosEspecie,
  } = input;

  const safeNumeroPagas = Math.max(12, Math.min(16, Math.round(numeroPagas) || 12));
  const safeBruto = Math.max(0, brutoAnual);
  const salarioBaseMensual = safeBruto / safeNumeroPagas;

  const irpfPct = irpfPorcentaje / 100;
  const ssPct = ssPorcentaje / 100;
  const cuotaSolidaridadMes = cuotaSolidaridadAnual / 12;

  const especieMensualSumaIRPF = beneficiosEspecie
    .filter((b) => b.sumaIRPF)
    .reduce((acc, b) => acc + (b.importeMensual || 0), 0);
  const especieMensualTotal = beneficiosEspecie.reduce(
    (acc, b) => acc + (b.importeMensual || 0),
    0,
  );

  const pagaExtraSet = new Set(mesesPagaExtra);

  const ppEmpleadoMes = planPensiones?.aportacionEmpleadoMes ?? 0;
  const ppEmpresaMes = planPensiones?.aportacionEmpresaMes ?? 0;

  const meses: CalcularNominaMes[] = [];
  let brutoFijoAnual = 0;
  let variablesAnual = 0;
  let irpfAnual = 0;
  let ssAnual = 0;

  for (let mes = 1; mes <= 12; mes++) {
    const tienePagaExtra = pagaExtraSet.has(mes);
    const pagaExtra = tienePagaExtra ? salarioBaseMensual : 0;

    const variablesDelMes = variables
      .filter((v) => v.mes === mes)
      .reduce((acc, v) => {
        const importe = v.tipo === 'porcentaje' ? (safeBruto * v.valor) / 100 : v.valor;
        return acc + importe;
      }, 0);
    const tieneVariable = variables.some((v) => v.mes === mes);

    const totalDevengado = salarioBaseMensual + pagaExtra + variablesDelMes;

    const baseCotizacion = ssOverrideManual
      ? ssBaseCotizacionMensual
      : Math.min(ssBaseCotizacionMensual, totalDevengado);
    const ssMes = baseCotizacion * ssPct + cuotaSolidaridadMes;

    const irpfMes = (totalDevengado + especieMensualSumaIRPF) * irpfPct;

    const neto = totalDevengado - ssMes - irpfMes - ppEmpleadoMes;

    meses.push({
      mes,
      salarioBase: salarioBaseMensual,
      pagaExtra,
      variables: variablesDelMes,
      totalDevengado,
      especie: especieMensualTotal,
      ss: ssMes,
      irpf: irpfMes,
      ppEmpleado: ppEmpleadoMes,
      ppEmpresa: ppEmpresaMes,
      neto,
      tieneVariable,
      tienePagaExtra,
    });

    brutoFijoAnual += salarioBaseMensual + pagaExtra;
    variablesAnual += variablesDelMes;
    irpfAnual += irpfMes;
    ssAnual += ssMes;
  }

  const brutoTotalAnual = brutoFijoAnual + variablesAnual;
  const especieAnual = especieMensualTotal * 12;
  const ppEmpleadoAnual = ppEmpleadoMes * 12;
  const ppEmpresaAnual = ppEmpresaMes * 12;
  const ppTotalAnual = ppEmpleadoAnual + ppEmpresaAnual;
  const netoAnual = meses.reduce((acc, m) => acc + m.neto, 0);

  // Mes "normal" · sin variables, sin paga extra, con PP empleado descontado.
  const baseNormal = ssOverrideManual
    ? ssBaseCotizacionMensual
    : Math.min(ssBaseCotizacionMensual, salarioBaseMensual);
  const ssNormal = baseNormal * ssPct + cuotaSolidaridadMes;
  const irpfNormal = (salarioBaseMensual + especieMensualSumaIRPF) * irpfPct;
  const netoMesNormal = salarioBaseMensual - ssNormal - irpfNormal - ppEmpleadoMes;

  return {
    meses,
    brutoFijoAnual,
    variablesAnual,
    brutoTotalAnual,
    especieAnual,
    irpfAnual,
    ssAnual,
    ppEmpleadoAnual,
    ppEmpresaAnual,
    ppTotalAnual,
    netoAnual,
    netoMesNormal,
  };
}
