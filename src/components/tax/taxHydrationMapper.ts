import { DeclaracionIRPF } from '../../services/irpfCalculationService';
import { TaxState, Inmueble, ActividadEconomica, GananciaPatrimonial, SaldoNegativoBIA } from '../../store/taxSlice';
import { initDB, Property } from '../../services/db';
import { calculateFiscalSummary } from '../../services/fiscalSummaryService';

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

type PropertyFiscalHints = {
  refCatastral: string;
  fechaAdquisicion: string;
  importeAdquisicion: number;
  valorCatastral: number;
  valorCatastralConstruccion: number;
};

type PropertyVisibilityIndex = {
  activePropertyIds: number[];
  aliasById: Map<number, string>;
};

function getPropertyFiscalHintsById(properties: Property[]): Map<number, PropertyFiscalHints> {
  const hints = new Map<number, PropertyFiscalHints>();

  properties.forEach((property) => {
    if (!property.id) return;

    const aeat = property.aeatAmortization;
    const fiscalData = property.fiscalData;

    hints.set(property.id, {
      refCatastral: property.cadastralReference ?? '',
      fechaAdquisicion: aeat?.firstAcquisitionDate ?? property.purchaseDate ?? '',
      importeAdquisicion: aeat?.onerosoAcquisition?.acquisitionAmount
        ?? property.acquisitionCosts?.price
        ?? 0,
      valorCatastral: aeat?.cadastralValue
        ?? fiscalData?.cadastralValue
        ?? 0,
      valorCatastralConstruccion: aeat?.constructionCadastralValue
        ?? fiscalData?.constructionCadastralValue
        ?? 0,
    });
  });

  return hints;
}

function getVisiblePropertyIds(properties: Property[]): PropertyVisibilityIndex {
  const activeProperties = properties.filter((property) => property.state === 'activo' && property.id != null);
  const mainPropertyIds = new Set<number>(
    activeProperties
      .filter((property: any) => !property.fiscalData?.isAccessory)
      .map((property) => property.id as number)
  );

  const linkedAccessoryIds = new Set<number>(
    activeProperties
      .filter((property: any) => property.fiscalData?.isAccessory === true)
      .filter((property: any) => {
        const mainPropertyId = property.fiscalData?.mainPropertyId;
        return mainPropertyId != null && mainPropertyIds.has(mainPropertyId);
      })
      .map((property) => property.id as number)
  );

  const activePropertyIds = activeProperties
    .filter((property) => !linkedAccessoryIds.has(property.id as number))
    .map((property) => property.id as number);

  const aliasById = new Map<number, string>();
  activeProperties.forEach((property) => {
    aliasById.set(property.id as number, property.alias ?? 'Sin alias');
  });

  return { activePropertyIds, aliasById };
}

export async function mapDeclaracionToTaxState(declaracion: DeclaracionIRPF): Promise<TaxHydrationPayload> {
  const trabajo = declaracion.baseGeneral.rendimientosTrabajo;
  const autonomo = declaracion.baseGeneral.rendimientosAutonomo;
  const rcm = declaracion.baseAhorro.capitalMobiliario;
  const gyp = declaracion.baseAhorro.gananciasYPerdidas;

  let propertyHints = new Map<number, PropertyFiscalHints>();
  let visiblePropertyIds: number[] = [];
  let propertyAliasById = new Map<number, string>();
  try {
    const db = await initDB();
    const properties = await db.getAll('properties');
    propertyHints = getPropertyFiscalHintsById(properties);
    const visibilityIndex = getVisiblePropertyIds(properties);
    visiblePropertyIds = visibilityIndex.activePropertyIds;
    propertyAliasById = visibilityIndex.aliasById;
  } catch (error) {
    console.warn('[TAX_HYDRATION] No se pudieron cargar hints fiscales de inmuebles', error);
  }

  const rendimientos = declaracion.baseGeneral.rendimientosInmuebles;
  const imputaciones = declaracion.baseGeneral.imputacionRentas;

  const inmueblesById = new Map<string, Inmueble>();

  rendimientos.forEach((i) => {
    inmueblesById.set(String(i.inmuebleId), {
    ...(propertyHints.get(i.inmuebleId) ?? {
      refCatastral: '',
      fechaAdquisicion: '',
      importeAdquisicion: 0,
      valorCatastral: 0,
      valorCatastralConstruccion: 0,
    }),
    id: String(i.inmuebleId),
    direccion: i.alias,
    pctPropiedad: 100,
    tipo: i.diasAlquilado > 0 && i.diasVacio > 0 ? 'mixto' : i.diasAlquilado > 0 ? 'arrendado' : 'disposicion',
    gastosTributos: 0,
    mejoras: 0,
    diasArrendados: i.diasAlquilado,
    diasDisposicion: i.diasVacio,
    valorCatastralRevisado: false,
    ingresosIntegros: round2(i.ingresosIntegros),
    interesesFinanciacion: 0,
    gastosReparacion: 0,
    gastosComunidad: 0,
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
    });
  });

  imputaciones.forEach((i) => {
    const key = String(i.inmuebleId);
    if (inmueblesById.has(key)) return;

    inmueblesById.set(key, {
      ...(propertyHints.get(i.inmuebleId) ?? {
        refCatastral: '',
        fechaAdquisicion: '',
        importeAdquisicion: 0,
        valorCatastral: i.valorCatastral ?? 0,
        valorCatastralConstruccion: 0,
      }),
      id: key,
      direccion: i.alias,
      pctPropiedad: 100,
      tipo: 'disposicion',
      gastosTributos: 0,
      mejoras: 0,
      diasArrendados: 0,
      diasDisposicion: i.diasVacio,
      valorCatastralRevisado: i.porcentajeImputacion === 0.011,
      ingresosIntegros: 0,
      interesesFinanciacion: 0,
      gastosReparacion: 0,
      gastosComunidad: 0,
      serviciosPersonales: 0,
      suministros: 0,
      seguro: 0,
      tributosRecargos: 0,
      amortizacionMuebles: 0,
      arrastres: [],
      tieneReduccion: false,
      pctReduccion: 0,
      pctConstruccion: 0,
      baseAmortizacion: 0,
      amortizacionInmueble: 0,
      limiteInteresesReparacion: 0,
      excesoReparacion: 0,
      rentaImputada: round2(i.imputacion),
      rendimientoNeto: round2(i.imputacion),
      rendimientoNetoReducido: round2(i.imputacion),
    });
  });

  if (visiblePropertyIds.length > 0) {
    visiblePropertyIds.forEach((propertyId) => {
      const key = String(propertyId);
      if (inmueblesById.has(key)) return;

      inmueblesById.set(key, {
        ...(propertyHints.get(propertyId) ?? {
          refCatastral: '',
          fechaAdquisicion: '',
          importeAdquisicion: 0,
          valorCatastral: 0,
          valorCatastralConstruccion: 0,
        }),
        id: key,
        direccion: propertyAliasById.get(propertyId) ?? `Inmueble ${propertyId}`,
        pctPropiedad: 100,
        tipo: 'disposicion',
        gastosTributos: 0,
        mejoras: 0,
        diasArrendados: 0,
        diasDisposicion: 0,
        valorCatastralRevisado: false,
        ingresosIntegros: 0,
        interesesFinanciacion: 0,
        gastosReparacion: 0,
        gastosComunidad: 0,
        serviciosPersonales: 0,
        suministros: 0,
        seguro: 0,
        tributosRecargos: 0,
        amortizacionMuebles: 0,
        arrastres: [],
        tieneReduccion: false,
        pctReduccion: 0,
        pctConstruccion: 0,
        baseAmortizacion: 0,
        amortizacionInmueble: 0,
        limiteInteresesReparacion: 0,
        excesoReparacion: 0,
        rentaImputada: 0,
        rendimientoNeto: 0,
        rendimientoNetoReducido: 0,
      });
    });
  }

  const inmuebles: Inmueble[] = Array.from(inmueblesById.values());

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
