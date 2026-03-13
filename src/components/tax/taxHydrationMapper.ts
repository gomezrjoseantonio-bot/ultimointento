import { DeclaracionIRPF } from '../../services/irpfCalculationService';
import { TaxState, Inmueble, ActividadEconomica, GananciaPatrimonial, SaldoNegativoBIA } from '../../store/taxSlice';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface TaxHydrationPayload {
  workIncome: TaxState['workIncome'];
  capitalMobiliario: TaxState['capitalMobiliario'];
  inmuebles: Inmueble[];
  actividades: ActividadEconomica[];
  ganancias: GananciaPatrimonial[];
  saldosNegativosBIA: SaldoNegativoBIA[];
  previsionSocial: TaxState['previsionSocial'];
  baseImponibleGeneral: number;
  baseImponibleAhorro: number;
  baseLiquidableGeneral: number;
  baseLiquidableAhorro: number;
  cuotaIntegra: number;
  cuotaLiquida: number;
  totalRetenciones: number;
  cuotaDiferencial: number;
}

export function mapDeclaracionToTaxState(declaracion: DeclaracionIRPF): TaxHydrationPayload {
  const trabajo = declaracion.baseGeneral.rendimientosTrabajo;
  const autonomo = declaracion.baseGeneral.rendimientosAutonomo;
  const rcm = declaracion.baseAhorro.capitalMobiliario;
  const gyp = declaracion.baseAhorro.gananciasYPerdidas;

  const inmuebles: Inmueble[] = declaracion.baseGeneral.rendimientosInmuebles.map((i) => ({
    id: String(i.inmuebleId),
    refCatastral: '',
    direccion: i.alias,
    pctPropiedad: 100,
    tipo: i.diasAlquilado > 0 && i.diasVacio > 0 ? 'mixto' : i.diasAlquilado > 0 ? 'arrendado' : 'disposicion',
    fechaAdquisicion: '',
    importeAdquisicion: 0,
    gastosTributos: 0,
    mejoras: 0,
    valorCatastral: 0,
    valorCatastralConstruccion: 0,
    diasArrendados: i.diasAlquilado,
    diasDisposicion: i.diasVacio,
    valorCatastralRevisado: false,
    ingresosIntegros: round2(i.ingresosIntegros),
    interesesFinanciacion: round2(i.gastosFinanciacionYReparacion ?? 0),
    gastosReparacion: 0,
    gastosComunidad: round2(i.gastosDeducibles),
    serviciosPersonales: 0,
    suministros: 0,
    seguro: 0,
    tributosRecargos: 0,
    amortizacionMuebles: 0,
    arrastres: i.arrastresAplicados && i.arrastresAplicados > 0
      ? [{ ejercicio: declaracion.ejercicio - 1, pendienteInicio: i.arrastresAplicados, aplicado: i.arrastresAplicados, pendienteFuturo: 0 }]
      : [],
    tieneReduccion: i.esHabitual,
    pctReduccion: i.esHabitual ? 60 : 0,
    pctConstruccion: 0,
    baseAmortizacion: 0,
    amortizacionInmueble: round2(i.amortizacion),
    limiteInteresesReparacion: round2(i.limiteAplicado ?? 0),
    excesoReparacion: round2(i.excesoArrastrable ?? 0),
    rentaImputada: round2(i.imputacionRenta),
    rendimientoNeto: round2(i.rendimientoNeto),
    rendimientoNetoReducido: round2(i.rendimientoNeto),
  }));

  const actividades: ActividadEconomica[] = autonomo
    ? [{
        id: `autonomo-${declaracion.ejercicio}`,
        codigoActividad: 'AUTO',
        epigafreIAE: '',
        ingresosExplotacion: round2(autonomo.ingresos),
        seguridadSocialTitular: round2(autonomo.cuotaSS),
        serviciosProfesionales: 0,
        otrosGastos: round2(autonomo.gastos),
        retencion: round2(declaracion.retenciones.autonomoM130),
        provisionSimplificada: 0,
        rendimientoNeto: round2(autonomo.rendimientoNeto),
      }]
    : [];

  const ahorroResultado = round2(gyp.plusvalias - gyp.minusvalias);
  const ganancias: GananciaPatrimonial[] = (gyp.plusvalias !== 0 || gyp.minusvalias !== 0)
    ? [{
        id: `gyp-${declaracion.ejercicio}`,
        tipo: 'fondos',
        base: 'ahorro',
        descripcion: 'Ganancias/pérdidas agregadas inversiones',
        valorTransmision: round2(gyp.plusvalias),
        valorAdquisicion: round2(gyp.minusvalias),
        resultado: ahorroResultado,
      }]
    : [];

  const saldosNegativosBIA: SaldoNegativoBIA[] = gyp.minusvaliasPendientes > 0
    ? [{
        ejercicio: declaracion.ejercicio - 1,
        pendienteInicio: round2(gyp.minusvaliasPendientes),
        aplicado: 0,
        pendienteFuturo: round2(gyp.minusvaliasPendientes),
      }]
    : [];

  return {
    workIncome: {
      dinerarias: round2(trabajo?.salarioBrutoAnual ?? 0),
      especieValoracion: round2(trabajo?.especieAnual ?? 0),
      especieIngresoACuenta: 0,
      contribucionEmpresarialPP: round2(trabajo?.ppEmpresa ?? 0),
      cotizacionSS: round2(trabajo?.cotizacionSS ?? 0),
      otrosGastosDeducibles: 2000,
      retencion: round2(declaracion.retenciones.trabajo),
    },
    capitalMobiliario: {
      interesesCuentasDepositos: round2(rcm.intereses),
      otrosRendimientos: round2(rcm.dividendos),
      retencion: round2(declaracion.retenciones.capitalMobiliario),
    },
    inmuebles,
    actividades,
    ganancias,
    saldosNegativosBIA,
    previsionSocial: {
      aportacionTrabajador: round2(declaracion.reducciones.ppEmpleado + declaracion.reducciones.ppIndividual),
      contribucionEmpresarial: round2(declaracion.reducciones.ppEmpresa),
      importeAplicado: round2(declaracion.reducciones.total),
    },
    baseImponibleGeneral: round2(declaracion.liquidacion.baseImponibleGeneral),
    baseImponibleAhorro: round2(declaracion.liquidacion.baseImponibleAhorro),
    baseLiquidableGeneral: round2(declaracion.liquidacion.baseImponibleGeneral),
    baseLiquidableAhorro: round2(declaracion.liquidacion.baseImponibleAhorro),
    cuotaIntegra: round2(declaracion.liquidacion.cuotaIntegra),
    cuotaLiquida: round2(declaracion.liquidacion.cuotaLiquida),
    totalRetenciones: round2(declaracion.retenciones.total),
    cuotaDiferencial: round2(declaracion.resultado),
  };
}
