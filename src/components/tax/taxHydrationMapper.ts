import { DeclaracionIRPF } from '../../services/irpfCalculationService';
import { TaxState, Inmueble, ActividadEconomica, GananciaPatrimonial, SaldoNegativoBIA } from '../../store/taxSlice';
import { initDB, Property } from '../../services/db';
import { calculateFiscalSummary } from '../../services/fiscalSummaryService';
import { calculateAEATAmortization, getConstructionPercentageFromValues, getUnifiedFiscalData } from '../../services/aeatAmortizationService';

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
  gastosTributos: number;
  valorCatastral: number;
  valorCatastralConstruccion: number;
};

type PropertyVisibilityIndex = {
  activePropertyIds: number[];
  aliasById: Map<number, string>;
};

type PropertyAmortizationSnapshot = {
  pctConstruccion: number;
  baseAmortizacion: number;
  amortizacionInmueble: number;
};

function getPropertyFiscalHintsById(properties: Property[]): Map<number, PropertyFiscalHints> {
  const hints = new Map<number, PropertyFiscalHints>();

  properties.forEach((property) => {
    if (!property.id) return;

    const unified = getUnifiedFiscalData(property);

    hints.set(property.id, {
      refCatastral: property.cadastralReference ?? '',
      fechaAdquisicion: unified.acquisitionDate,
      importeAdquisicion: unified.acquisitionAmount,
      gastosTributos: unified.acquisitionExpenses || getAcquisitionExpenses(property),
      valorCatastral: unified.cadastralValue,
      valorCatastralConstruccion: unified.constructionCadastralValue,
    });
  });

  return hints;
}

function getAcquisitionExpenses(property: Property): number {
  const costs = property.acquisitionCosts;
  if (!costs) return 0;

  const others = Array.isArray(costs.other)
    ? costs.other.reduce((sum: number, item) => sum + (Number(item?.amount) || 0), 0)
    : 0;

  return (Number(costs.itp) || 0)
    + (Number(costs.iva) || 0)
    + (Number(costs.notary) || 0)
    + (Number(costs.registry) || 0)
    + (Number(costs.management) || 0)
    + (Number(costs.psi) || 0)
    + (Number(costs.realEstate) || 0)
    + others;
}

function calculateRentalRatio(diasAlquilado: number, diasTotal?: number): number {
  const total = diasTotal && diasTotal > 0 ? diasTotal : 365;
  if (total <= 0 || diasAlquilado <= 0) return 0;
  return Math.max(0, Math.min(1, diasAlquilado / total));
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

  const summaryByPropertyId = new Map<number, Awaited<ReturnType<typeof calculateFiscalSummary>>>();
  const amortizationByPropertyId = new Map<number, PropertyAmortizationSnapshot>();
  const rentalDaysByPropertyId = new Map<number, number>();

  rendimientos.forEach((rendimiento) => {
    rentalDaysByPropertyId.set(
      rendimiento.inmuebleId,
      Math.max(rentalDaysByPropertyId.get(rendimiento.inmuebleId) ?? 0, rendimiento.diasAlquilado ?? 0),
    );
  });

  const propertyIdsToEnrich = new Set<number>([
    ...rendimientos.map((r) => r.inmuebleId),
    ...imputaciones.map((i) => i.inmuebleId),
    ...visiblePropertyIds,
  ]);

  await Promise.all(Array.from(propertyIdsToEnrich).map(async (propertyId) => {
    try {
      const [summary, aeatCalc] = await Promise.all([
        calculateFiscalSummary(propertyId, declaracion.ejercicio),
        calculateAEATAmortization(
          propertyId,
          declaracion.ejercicio,
          rentalDaysByPropertyId.get(propertyId) ?? 0,
        ),
      ]);

      summaryByPropertyId.set(propertyId, summary);
      amortizationByPropertyId.set(propertyId, {
        pctConstruccion: round2(aeatCalc.breakdown.cadastralConstructionValue > 0
          ? getConstructionPercentageFromValues(
              propertyHints.get(propertyId)?.valorCatastral ?? 0,
              aeatCalc.breakdown.cadastralConstructionValue,
            )
          : 0),
        baseAmortizacion: round2(aeatCalc.baseAmount),
        amortizacionInmueble: round2(aeatCalc.totalAmortization),
      });
    } catch {
      const hints = propertyHints.get(propertyId);
      if (hints) {
        amortizationByPropertyId.set(propertyId, {
          pctConstruccion: round2(getConstructionPercentageFromValues(
            hints.valorCatastral,
            hints.valorCatastralConstruccion,
          )),
          baseAmortizacion: 0,
          amortizacionInmueble: 0,
        });
      }
      // ignore enrichment errors and keep minimal hydration payload
    }
  }));

  const inmueblesById = new Map<string, Inmueble>();

  rendimientos.forEach((i) => {
    const summary = summaryByPropertyId.get(i.inmuebleId);
    const amortization = amortizationByPropertyId.get(i.inmuebleId);
    const ratio = calculateRentalRatio(i.diasAlquilado, i.diasTotal);

    inmueblesById.set(String(i.inmuebleId), {
      ...(propertyHints.get(i.inmuebleId) ?? {
        refCatastral: '',
        fechaAdquisicion: '',
        importeAdquisicion: 0,
        gastosTributos: 0,
        valorCatastral: 0,
        valorCatastralConstruccion: 0,
      }),
      id: String(i.inmuebleId),
      direccion: i.alias,
      pctPropiedad: 100,
      tipo: i.diasAlquilado > 0 && i.diasVacio > 0 ? 'mixto' : i.diasAlquilado > 0 ? 'arrendado' : 'disposicion',
      gastosTributos: propertyHints.get(i.inmuebleId)?.gastosTributos ?? 0,
      mejoras: round2(summary?.capexTotal ?? 0),
      diasArrendados: i.diasAlquilado,
      diasDisposicion: i.diasVacio,
      valorCatastralRevisado: false,
      ingresosIntegros: round2(i.ingresosIntegros),
      interesesFinanciacion: round2((summary?.box0105 ?? 0) * ratio),
      gastosReparacion: round2((summary?.box0106 ?? 0) * ratio),
      gastosComunidad: round2((summary?.box0109 ?? 0) * ratio),
      serviciosPersonales: round2((summary?.box0112 ?? 0) * ratio),
      suministros: round2((summary?.box0113 ?? 0) * ratio),
      seguro: round2((summary?.box0114 ?? 0) * ratio),
      tributosRecargos: round2((summary?.box0115 ?? 0) * ratio),
      amortizacionMuebles: round2((summary?.box0117 ?? 0) * ratio),
      arrastres: i.arrastresAplicados && i.arrastresAplicados > 0
        ? [{ ejercicio: declaracion.ejercicio - 1, pendienteInicio: i.arrastresAplicados, aplicado: i.arrastresAplicados, pendienteFuturo: 0 }]
        : [],
      tieneReduccion: (i.reduccionHabitual ?? 0) > 0 || i.esHabitual || (i.porcentajeReduccionHabitual ?? 0) > 0,
      pctReduccion: round2((i.porcentajeReduccionHabitual ?? 0) > 0
        ? (i.porcentajeReduccionHabitual ?? 0)
        : ((i.reduccionHabitual ?? 0) > 0 && (i.rendimientoNetoAlquiler ?? 0) > 0
          ? ((i.reduccionHabitual ?? 0) / (i.rendimientoNetoAlquiler ?? 1)) * 100
          : (i.esHabitual ? 60 : 0))),
      pctConstruccion: amortization?.pctConstruccion ?? 0,
      baseAmortizacion: amortization?.baseAmortizacion ?? 0,
      amortizacionInmueble: amortization?.amortizacionInmueble ?? round2(i.amortizacion),
      limiteInteresesReparacion: round2(i.limiteAplicado ?? 0),
      excesoReparacion: round2(i.excesoArrastrable ?? 0),
      rentaImputada: round2(i.imputacionRenta),
      rendimientoNeto: round2(i.rendimientoNetoAlquiler),
      rendimientoNetoReducido: round2(i.rendimientoNetoReducido ?? i.rendimientoNeto),
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
        gastosTributos: 0,
        valorCatastral: i.valorCatastral ?? 0,
        valorCatastralConstruccion: 0,
      }),
      id: key,
      direccion: i.alias,
      pctPropiedad: 100,
      tipo: 'disposicion',
      gastosTributos: propertyHints.get(i.inmuebleId)?.gastosTributos ?? 0,
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
      pctConstruccion: amortizationByPropertyId.get(i.inmuebleId)?.pctConstruccion
        ?? round2(getConstructionPercentageFromValues(
          propertyHints.get(i.inmuebleId)?.valorCatastral ?? 0,
          propertyHints.get(i.inmuebleId)?.valorCatastralConstruccion ?? 0,
        )),
      baseAmortizacion: amortizationByPropertyId.get(i.inmuebleId)?.baseAmortizacion ?? 0,
      amortizacionInmueble: amortizationByPropertyId.get(i.inmuebleId)?.amortizacionInmueble ?? 0,
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
          gastosTributos: 0,
          valorCatastral: 0,
          valorCatastralConstruccion: 0,
        }),
        id: key,
        direccion: propertyAliasById.get(propertyId) ?? `Inmueble ${propertyId}`,
        pctPropiedad: 100,
        tipo: 'disposicion',
        gastosTributos: propertyHints.get(propertyId)?.gastosTributos ?? 0,
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
        pctConstruccion: amortizationByPropertyId.get(propertyId)?.pctConstruccion
          ?? round2(getConstructionPercentageFromValues(
            propertyHints.get(propertyId)?.valorCatastral ?? 0,
            propertyHints.get(propertyId)?.valorCatastralConstruccion ?? 0,
          )),
        baseAmortizacion: amortizationByPropertyId.get(propertyId)?.baseAmortizacion ?? 0,
        amortizacionInmueble: amortizationByPropertyId.get(propertyId)?.amortizacionInmueble ?? 0,
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
    ? ((autonomo.actividades?.length
      ? autonomo.actividades.map((actividad, index) => ({
          id: `autonomo-${declaracion.ejercicio}-${index}`,
          codigoActividad: actividad.tipo || 'AUTO',
          epigafreIAE: actividad.epigrafe || '',
          ingresosExplotacion: round2(actividad.ingresos),
          seguridadSocialTitular: round2(actividad.cuotaSS),
          serviciosProfesionales: 0,
          otrosGastos: round2(actividad.gastos),
          retencion: index === 0 ? round2(declaracion.retenciones.autonomoM130) : 0,
          provisionSimplificada: index === 0 ? round2(autonomo.gastoDificilJustificacion ?? 0) : 0,
          rendimientoNeto: round2(
            actividad.ingresos
            - actividad.gastos
            - actividad.cuotaSS
            - (index === 0 ? (autonomo.gastoDificilJustificacion ?? 0) : 0)
          ),
        }))
      : [{
          id: `autonomo-${declaracion.ejercicio}`,
          codigoActividad: 'AUTO',
          epigafreIAE: '',
          ingresosExplotacion: round2(autonomo.ingresos),
          seguridadSocialTitular: round2(autonomo.cuotaSS),
          serviciosProfesionales: 0,
          otrosGastos: round2(autonomo.gastos),
          retencion: round2(declaracion.retenciones.autonomoM130),
          provisionSimplificada: round2(autonomo.gastoDificilJustificacion ?? 0),
          rendimientoNeto: round2(autonomo.rendimientoNeto),
        }]))
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
