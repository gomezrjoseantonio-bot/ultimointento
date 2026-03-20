import { dashboardService } from './dashboardService';
import { inmuebleService } from './inmuebleService';
import { prestamosService } from './prestamosService';
import { personalDataService } from './personalDataService';
import { inversionesService } from './inversionesService';
import { initDB, type Contract } from './db';
import { calcularDeclaracionIRPF } from './irpfCalculationService';
import { generarEventosFiscales, type EventoFiscal } from './fiscalPaymentsService';
import { generateProyeccionMensual } from '../modules/horizon/proyeccion/mensual/services/proyeccionMensualService';
import type { ProyeccionAnual } from '../modules/horizon/proyeccion/mensual/types/proyeccionMensual';
import type { Inmueble } from '../types/inmueble';
import type { Prestamo, PlanPagos } from '../types/prestamos';
import type { PersonalData } from '../types/personal';
import type { ValoracionHistorica } from '../types/valoraciones';
import {
  getDireccionCompleta,
  getLatestValuation,
  getLoanMonthlyInstallment,
  getLoanTin,
  getOutstandingPrincipal,
  toNumber,
  type ExtendedProperty,
} from '../modules/horizon/herramientas/exporters/mappers';

export interface InformesData {
  generadoEn: string;
  año: number;
  proyeccion: {
    meses: Array<{
      mes: string;
      totalIngresos: number;
      totalGastos: number;
      totalFinanciacion: number;
      flujoCaja: number;
      cajaFinal: number;
      patrimonioNeto: number;
      deudaInmuebles: number;
      deudaPersonal: number;
      deudaTotal: number;
      inversionesPensiones: number;
    }>;
    totalesAnuales: {
      ingresosTotales: number;
      gastosTotales: number;
      financiacionTotal: number;
      flujoNeto: number;
      patrimonioNetoFinal: number;
      patrimonioNetoInicial: number;
    };
    desglose: {
      nominas: number;
      autonomos: number;
      rentasAlquiler: number;
      intereses: number;
      otrosIngresos: number;
    };
  };
  inmuebles: Array<{
    id: string | number;
    alias: string;
    direccion: string;
    ciudad: string;
    estado: string;
    costeTotal: number;
    valorActual: number;
    plusvalia: number;
    rentaMensual: number;
    yieldBruto: number;
    hipotecaMensual: number;
    deudaHipotecaria: number;
    cfNeto: number;
  }>;
  resumenCartera: {
    costeTotal: number;
    valorTotal: number;
    plusvaliaTotal: number;
    rentaMensualTotal: number;
    yieldBruta: number;
    cfMensualTotal: number;
    ltv: number;
    equity: number;
    deudaHipotecaria: number;
    ocupacion: number;
  };
  resumenPatrimonio: {
    inversionesPensiones: number;
  };
  prestamos: Array<{
    nombre: string;
    tipo: string;
    capitalVivo: number;
    cuotaMensual: number;
    tin: number;
    fechaFin: string;
  }>;
  resumenFinanciacion: {
    cuotaHipotecasMensual: number;
    cuotaPrestamosMensual: number;
    totalCuotasMensual: number;
    deudaTotal: number;
  };
  personal: {
    nombreCompleto: string;
    empresa?: string;
    antiguedad?: string;
    ingresoLaboralAnual: number;
  };
  // Datos fiscales (del módulo Impuestos)
  fiscal: {
    resumen: {
      rendimientosTrabajo: number;
      rentasCapitalInmobiliario: number;
      rendimientosAutonomo: number;
      rendimientosCapitalMobiliario: number;
      baseImponibleGeneral: number;
      baseImponibleAhorro: number;
      baseLiquidableGeneral: number;
      cuotaIntegra: number;
      retencionTrabajo: number;
      retencionCapital: number;
      retencionAutonomo: number;
      totalRetenciones: number;
      resultado: number;
    };
    inmuebles: Array<{
      alias: string;
      ingresosIntegros: number;
      gastosDeducibles: number;
      amortizacion: number;
      baseNeta: number;
      reduccion60: number;
      rendimientoNetoReducido: number;
    }>;
    calendario: Array<{
      concepto: string;
      fecha: string;
      importe: number;
      estado: string;
    }>;
  };

  // Datos fiscales/catastrales de la cartera
  cartera: {
    detalleFiscal: Array<{
      alias: string;
      valorCatastral: number;
      vcConstruccion: number;
      pctConstruccion: number;
      metodoAmortizacion: string;
      pctAmortizacion: number;
      regimenFiscal: string;
    }>;
  };
  tesoreria: {
    totales: {
      inicioMes: number;
      hoy: number;
      porCobrar: number;
      porPagar: number;
      proyeccion: number;
    };
    filas: Array<{
      banco: string;
      inicioMes: number;
      hoy: number;
      porCobrar: number;
      porPagar: number;
      proyeccion: number;
    }>;
  };
}


const DEFAULT_DATA: InformesData = {
  generadoEn: new Date().toISOString(),
  año: new Date().getFullYear(),
  proyeccion: {
    meses: [],
    totalesAnuales: {
      ingresosTotales: 0,
      gastosTotales: 0,
      financiacionTotal: 0,
      flujoNeto: 0,
      patrimonioNetoFinal: 0,
      patrimonioNetoInicial: 0,
    },
    desglose: {
      nominas: 0,
      autonomos: 0,
      rentasAlquiler: 0,
      intereses: 0,
      otrosIngresos: 0,
    },
  },
  inmuebles: [],
  resumenCartera: {
    costeTotal: 0,
    valorTotal: 0,
    plusvaliaTotal: 0,
    rentaMensualTotal: 0,
    yieldBruta: 0,
    cfMensualTotal: 0,
    ltv: 0,
    equity: 0,
    deudaHipotecaria: 0,
    ocupacion: 0,
  },
  resumenPatrimonio: {
    inversionesPensiones: 0,
  },
  prestamos: [],
  resumenFinanciacion: {
    cuotaHipotecasMensual: 0,
    cuotaPrestamosMensual: 0,
    totalCuotasMensual: 0,
    deudaTotal: 0,
  },
  personal: {
    nombreCompleto: '',
    ingresoLaboralAnual: 0,
  },
  fiscal: {
    resumen: {
      rendimientosTrabajo: 0,
      rentasCapitalInmobiliario: 0,
      rendimientosAutonomo: 0,
      rendimientosCapitalMobiliario: 0,
      baseImponibleGeneral: 0,
      baseImponibleAhorro: 0,
      baseLiquidableGeneral: 0,
      cuotaIntegra: 0,
      retencionTrabajo: 0,
      retencionCapital: 0,
      retencionAutonomo: 0,
      totalRetenciones: 0,
      resultado: 0,
    },
    inmuebles: [],
    calendario: [],
  },
  cartera: { detalleFiscal: [] },
  tesoreria: {
    totales: { inicioMes: 0, hoy: 0, porCobrar: 0, porPagar: 0, proyeccion: 0 },
    filas: [],
  },
};

const safe = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await promise;
  } catch {
    return fallback;
  }
};

const getStringField = (source: PersonalData | null, key: string): string | undefined => {
  if (!source) return undefined;
  const raw = (source as unknown as Record<string, unknown>)[key];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
};

const getEmploymentLabel = (personalData: PersonalData | null): string | undefined => {
  const explicit = getStringField(personalData, 'empresa') ?? getStringField(personalData, 'actividad');
  if (explicit) return explicit;

  if (personalData?.situacionLaboral.includes('asalariado')) return 'Actividad por cuenta ajena';
  if (personalData?.situacionLaboral.includes('autonomo')) return 'Actividad por cuenta propia';
  return undefined;
};

const getInversionesPensionesValue = (posiciones: Array<{ tipo: string; valor_actual: number }>): number => {
  return posiciones.reduce((sum, posicion) => sum + toNumber(posicion.valor_actual), 0);
};

const getLoanEndDate = (plan: PlanPagos | null, prestamo: Prestamo): string => (
  plan?.resumen.fechaFinalizacion ?? prestamo.fechaCancelacion ?? ''
);

const getLegacyProperty = (
  properties: ExtendedProperty[],
  inmuebleId: string | number,
): ExtendedProperty | undefined => properties.find((property) => String(property.id) === String(inmuebleId));

const getFiscalDetalle = (inmueble: Inmueble, rawProperty?: ExtendedProperty) => ({
  valorCatastral: toNumber(inmueble.fiscalidad?.valor_catastral_total)
    || toNumber(rawProperty?.fiscalData?.cadastralValue)
    || toNumber(rawProperty?.aeatAmortization?.cadastralValue)
    || 0,
  vcConstruccion: toNumber(inmueble.fiscalidad?.valor_catastral_construccion)
    || toNumber(rawProperty?.fiscalData?.constructionCadastralValue)
    || toNumber(rawProperty?.aeatAmortization?.constructionCadastralValue)
    || 0,
  pctConstruccion: toNumber(inmueble.fiscalidad?.porcentaje_construccion)
    || toNumber(rawProperty?.fiscalData?.constructionPercentage)
    || toNumber(rawProperty?.aeatAmortization?.constructionPercentage)
    || 0,
});

const buildEventosFiscalesFallback = (
  año: number,
  declaracionIRPF: NonNullable<Awaited<ReturnType<typeof calcularDeclaracionIRPF>>>,
): Array<InformesData['fiscal']['calendario'][number]> => {
  const calendario: Array<InformesData['fiscal']['calendario'][number]> = [];

  const rendimientoAutonomo = Math.max(
    toNumber(declaracionIRPF.baseGeneral?.rendimientosAutonomo?.rendimientoNeto),
    toNumber((declaracionIRPF.baseGeneral as { autonomo?: { rendimientoNeto?: number | null } } | null | undefined)?.autonomo?.rendimientoNeto),
    toNumber((declaracionIRPF as { rendimientosAutonomo?: { rendimientoNeto?: number | null } } | null | undefined)?.rendimientosAutonomo?.rendimientoNeto),
    0,
  );
  const resultado = toNumber(declaracionIRPF.resultado);

  if (rendimientoAutonomo > 0) {
    const cuotaM130 = Math.round((((rendimientoAutonomo * 0.20) / 4) * 100)) / 100;

    [
      { fecha: `${año}-04-20`, concepto: `Modelo 130 — T1 ${año} (pago fraccionado)` },
      { fecha: `${año}-07-20`, concepto: `Modelo 130 — T2 ${año} (pago fraccionado)` },
      { fecha: `${año}-10-20`, concepto: `Modelo 130 — T3 ${año} (pago fraccionado)` },
      { fecha: `${año + 1}-01-30`, concepto: `Modelo 130 — T4 ${año} (pago fraccionado)` },
    ].forEach((evento) => {
      calendario.push({
        concepto: evento.concepto,
        fecha: evento.fecha,
        importe: cuotaM130,
        estado: new Date(evento.fecha) < new Date() ? 'Pagado' : 'Pendiente',
      });
    });
  }

  if (resultado > 0) {
    calendario.push(
      {
        concepto: `IRPF ${año} — Primera fracción (60%)`,
        fecha: `${año + 1}-06-30`,
        importe: Math.round((resultado * 0.6) * 100) / 100,
        estado: 'Pendiente',
      },
      {
        concepto: `IRPF ${año} — Segunda fracción (40%)`,
        fecha: `${año + 1}-11-05`,
        importe: Math.round((resultado * 0.4) * 100) / 100,
        estado: 'Pendiente',
      },
    );
  }

  if (calendario.length === 0 && resultado > 0) {
    calendario.push({
      concepto: `IRPF ${año} — Pago declaración`,
      fecha: `${año + 1}-06-30`,
      importe: resultado,
      estado: 'Pendiente',
    });
  }

  return calendario;
};

const buildFiscalCalendar = (
  año: number,
  declaracionIRPF: NonNullable<Awaited<ReturnType<typeof calcularDeclaracionIRPF>>>,
  eventosFiscales: EventoFiscal[],
): Array<InformesData['fiscal']['calendario'][number]> => {
  const fallback = buildEventosFiscalesFallback(año, declaracionIRPF);

  const desServicio = eventosFiscales.map((item) => ({
    concepto: item.descripcion,
    fecha: item.fechaLimite,
    importe: toNumber(item.importe),
    estado: item.pagado ? 'Pagado' : 'Pendiente',
  }));

  if (desServicio.length === 0) return fallback;

  const tieneM130 = desServicio.some((item) => item.concepto.includes('Modelo 130') || item.concepto.includes('M130'));
  const tieneFracciones = desServicio.some((item) => (
    item.concepto.includes(`IRPF ${año}`)
    && (item.concepto.includes('Primera fracción')
      || item.concepto.includes('Segunda fracción')
      || item.concepto.toLowerCase().includes('fraccion'))
  ));

  const combinado = !tieneFracciones
    ? desServicio.filter((item) => !item.concepto.startsWith(`IRPF ${año} — A pagar`))
    : [...desServicio];

  if (!tieneM130) {
    combinado.unshift(...fallback.filter((item) => item.concepto.includes('Modelo 130')));
  }

  if (!tieneFracciones) {
    combinado.push(...fallback.filter((item) => item.concepto.includes(`IRPF ${año}`)));
  }

  return combinado.length > 0 ? combinado : fallback;
};

const buildProjectionSummary = (projection: ProyeccionAnual | null): InformesData['proyeccion'] => {
  if (!projection) {
    return DEFAULT_DATA.proyeccion;
  }

  const meses = projection.months.map((month) => ({
    mes: month.month,
    totalIngresos: toNumber(month.ingresos.total),
    totalGastos: toNumber(month.gastos.total),
    totalFinanciacion: toNumber(month.financiacion.total),
    flujoCaja: toNumber(month.tesoreria.flujoCajaMes),
    cajaFinal: toNumber(month.tesoreria.cajaFinal),
    patrimonioNeto: toNumber(month.patrimonio.patrimonioNeto),
    deudaInmuebles: toNumber(month.patrimonio.deudaInmuebles),
    deudaPersonal: toNumber(month.patrimonio.deudaPersonal),
    deudaTotal: toNumber(month.patrimonio.deudaTotal),
    inversionesPensiones: toNumber(month.patrimonio.planesPension) + toNumber(month.patrimonio.otrasInversiones),
  }));

  const patrimonioNetoInicial = toNumber(projection.months[0]?.patrimonio.patrimonioNeto);
  const nominas = projection.months.reduce((sum, month) => sum + toNumber(month.ingresos.nomina), 0);
  const autonomos = projection.months.reduce((sum, month) => sum + toNumber(month.ingresos.serviciosFreelance), 0);
  const rentasAlquiler = projection.months.reduce((sum, month) => sum + toNumber(month.ingresos.rentasAlquiler), 0);
  const intereses = projection.months.reduce((sum, month) => sum + toNumber(month.ingresos.dividendosInversiones) + toNumber(month.ingresos.pensiones), 0);
  const otrosIngresos = projection.months.reduce((sum, month) => sum + toNumber(month.ingresos.otrosIngresos), 0);

  return {
    meses,
    totalesAnuales: {
      ingresosTotales: toNumber(projection.totalesAnuales.ingresosTotales),
      gastosTotales: toNumber(projection.totalesAnuales.gastosTotales),
      financiacionTotal: toNumber(projection.totalesAnuales.financiacionTotal),
      flujoNeto: toNumber(projection.totalesAnuales.flujoNetoAnual),
      patrimonioNetoFinal: toNumber(projection.totalesAnuales.patrimonioNetoFinal),
      patrimonioNetoInicial,
    },
    desglose: {
      nominas,
      autonomos,
      rentasAlquiler,
      intereses,
      otrosIngresos,
    },
  };
};

class InformesDataService {
  async getInformesData(año: number): Promise<InformesData> {
    const generatedAt = new Date().toISOString();

    const [
      proyecciones,
      inmuebles,
      prestamos,
      personal,
      patrimonio,
      flujos,
      inversiones,
      tesoreriaPanel,
      dbPayload,
      declaracionIRPF,
    ] = await Promise.all([
      safe(generateProyeccionMensual(), [] as ProyeccionAnual[]),
      safe(inmuebleService.getAll(), [] as Inmueble[]),
      safe(prestamosService.getAllPrestamos(), [] as Prestamo[]),
      safe(personalDataService.getPersonalData(), null as PersonalData | null),
      safe(dashboardService.getPatrimonioNeto(), {
        total: 0,
        variacionMes: 0,
        variacionPorcentaje: 0,
        fechaCalculo: generatedAt,
        desglose: { inmuebles: 0, inversiones: 0, cuentas: 0, deuda: 0 },
      }),
      safe(dashboardService.getFlujosCaja(), {
        trabajo: { netoMensual: 0, netoHoy: 0, pendienteMes: 0, tendencia: 'stable' as const, variacionPorcentaje: 0 },
        inmuebles: { cashflow: 0, cashflowHoy: 0, pendienteMes: 0, ocupacion: 0, vacantes: [], tendencia: 'stable' as const },
        inversiones: { rendimientoMes: 0, dividendosMes: 0, totalHoy: 0, pendienteMes: 0, tendencia: 'stable' as const },
      }),
      safe(inversionesService.getPosiciones(), []),
      safe(dashboardService.getTesoreriaPanel(), null),
      safe((async () => {
        const db = await initDB();
        const [properties, valuations, contracts] = await Promise.all([
          safe(db.getAll('properties'), [] as ExtendedProperty[]),
          safe(db.getAll('valoraciones_historicas'), [] as ValoracionHistorica[]),
          safe(db.getAll('contracts'), [] as Contract[]),
        ]);
        return { properties, valuations, contracts };
      })(), { properties: [] as ExtendedProperty[], valuations: [] as ValoracionHistorica[], contracts: [] as Contract[] }),
      safe(calcularDeclaracionIRPF(año), null as Awaited<ReturnType<typeof calcularDeclaracionIRPF>> | null),
    ]);

    const eventosFiscales = declaracionIRPF
      ? await safe(generarEventosFiscales(año, declaracionIRPF), [] as EventoFiscal[])
      : [];

    const projection = proyecciones.find((item) => item.year === año) ?? null;
    const projectionSummary = buildProjectionSummary(projection);
    const fallbackCajaFinal = projectionSummary.meses[projectionSummary.meses.length - 1]?.cajaFinal ?? toNumber(tesoreriaPanel?.totales.proyeccion);
    const fallbackPatrimonioFinal = projectionSummary.meses[11]?.patrimonioNeto
      ?? projectionSummary.totalesAnuales.patrimonioNetoFinal
      ?? toNumber(patrimonio.total);
    const fallbackDebt = toNumber(patrimonio.desglose.deuda);
    const fallbackInversiones = getInversionesPensionesValue(inversiones as Array<{ tipo: string; valor_actual: number }>) || toNumber(patrimonio.desglose.inversiones);

    const fallbackMonths = Array.from({ length: 12 }, (_, index) => ({
      mes: `${año}-${String(index + 1).padStart(2, '0')}`,
      totalIngresos: 0,
      totalGastos: 0,
      totalFinanciacion: 0,
      flujoCaja: 0,
      cajaFinal: fallbackCajaFinal,
      patrimonioNeto: fallbackPatrimonioFinal,
      deudaInmuebles: 0,
      deudaPersonal: 0,
      deudaTotal: fallbackDebt,
      inversionesPensiones: fallbackInversiones,
    }));

    const loanPlans = new Map<string, PlanPagos | null>(
      await Promise.all(
        prestamos.map(async (prestamo) => [
          prestamo.id,
          await safe(prestamosService.getPaymentPlan(prestamo.id), null as PlanPagos | null),
        ] as const),
      ),
    );

    const inmuebleIdsActivos = new Set(
      inmuebles
        .filter((inmueble) => inmueble.estado !== 'VENDIDO')
        .map((inmueble) => String(inmueble.id)),
    );

    const hipotecas = prestamos.filter(
      (prestamo) =>
        (prestamo.ambito === 'INMUEBLE' || Boolean(prestamo.inmuebleId))
        && prestamo.activo !== false
        && prestamo.estado !== 'cancelado'
        && prestamo.estado !== 'pendiente_cancelacion_venta'
        && (prestamo.inmuebleId ? inmuebleIdsActivos.has(String(prestamo.inmuebleId)) : true),
    );
    const rentasPorInmueble = new Map<string, number>();
    for (const contract of dbPayload.contracts) {
      if (contract?.estadoContrato !== 'activo') continue;
      rentasPorInmueble.set(
        String(contract.inmuebleId),
        (rentasPorInmueble.get(String(contract.inmuebleId)) ?? 0) + toNumber(contract.rentaMensual),
      );
    }

    const inmueblesMapeados = inmuebles.map((inmueble) => {
      const rawProperty = getLegacyProperty(dbPayload.properties, inmueble.id);
      const latestValuation = getLatestValuation(inmueble.id, dbPayload.valuations);
      const precioCompra = toNumber(inmueble.compra?.precio_compra);
      const totalGastos = toNumber(inmueble.compra?.total_gastos);
      const totalImpuestos = toNumber(inmueble.compra?.total_impuestos);

      const costePersistido = toNumber(inmueble.compra?.coste_total_compra);
      const costeSumado = precioCompra + totalGastos + totalImpuestos;

      const costes = rawProperty?.acquisitionCosts;
      const otherCosts = Array.isArray(costes?.other)
        ? (costes?.other ?? []).reduce((sum: number, item: { concept: string; amount: number }) => sum + toNumber(item?.amount), 0)
        : 0;
      const costeLegacy = costes
        ? toNumber(costes.price ?? 0)
          + toNumber(costes.itp ?? 0)
          + toNumber(costes.iva ?? 0)
          + toNumber(costes.notary ?? 0)
          + toNumber(costes.registry ?? 0)
          + toNumber(costes.management ?? 0)
          + toNumber(costes.psi ?? 0)
          + toNumber(costes.realEstate ?? 0)
          + otherCosts
        : 0;

      const costeTotal =
        costePersistido > precioCompra
          ? costePersistido
          : costeSumado > precioCompra
            ? costeSumado
            : costeLegacy > precioCompra
              ? costeLegacy
              : precioCompra;
      const valorActual = toNumber(
        latestValuation?.valor
          ?? rawProperty?.currentValue
          ?? rawProperty?.marketValue
          ?? rawProperty?.estimatedValue
          ?? rawProperty?.valuation
          ?? rawProperty?.valor_actual
          ?? costeTotal,
      );

      const loanForProperty = hipotecas.filter((prestamo) => String(prestamo.inmuebleId) === String(inmueble.id));
      const hipotecaMensual = loanForProperty.reduce((sum, prestamo) => sum + getLoanMonthlyInstallment(prestamo, loanPlans.get(prestamo.id) ?? null), 0);
      const deudaHipotecaria = loanForProperty.reduce(
        (sum, prestamo) => sum + getOutstandingPrincipal(prestamo, loanPlans.get(prestamo.id) ?? null),
        0,
      );
      const rentaMensual = inmueble.estado !== 'VENDIDO' ? (rentasPorInmueble.get(String(inmueble.id)) ?? 0) : 0;
      const cfNeto = rentaMensual - hipotecaMensual;
      const plusvalia = valorActual - costeTotal;
      const yieldBruto = costeTotal > 0 ? ((rentaMensual * 12) / costeTotal) * 100 : 0;

      return {
        id: inmueble.id,
        alias: inmueble.alias,
        direccion: getDireccionCompleta(inmueble) || rawProperty?.address || '',
        ciudad: inmueble.direccion.municipio || rawProperty?.municipality || '',
        estado: inmueble.estado,
        costeTotal,
        valorActual,
        plusvalia,
        rentaMensual,
        yieldBruto,
        hipotecaMensual,
        deudaHipotecaria,
        cfNeto,
      };
    });

    const inmueblesActivos = inmueblesMapeados.filter((item) => item.estado !== 'VENDIDO');
    const valorTotal = inmueblesActivos.reduce((sum, item) => sum + item.valorActual, 0);
    const costeTotal = inmueblesActivos.reduce((sum, item) => sum + item.costeTotal, 0);
    const rentaMensualTotal = inmueblesActivos.reduce((sum, item) => sum + item.rentaMensual, 0);
    const cfMensualTotal = inmueblesActivos.reduce((sum, item) => sum + item.cfNeto, 0);
    const plusvaliaTotal = inmueblesMapeados.reduce((sum, item) => sum + item.plusvalia, 0);
    const deudaHipotecaria = inmueblesMapeados.reduce((sum, item) => sum + item.deudaHipotecaria, 0);
    const equity = valorTotal - deudaHipotecaria;
    const yieldBruta = costeTotal > 0 ? ((rentaMensualTotal * 12) / costeTotal) * 100 : 0;
    const ltv = valorTotal > 0 ? (deudaHipotecaria / valorTotal) * 100 : 0;

    const prestamosActivos = prestamos.filter(
      (prestamo) =>
        prestamo.activo !== false
        && prestamo.estado !== 'cancelado'
        && prestamo.estado !== 'pendiente_cancelacion_venta',
    );

    const prestamosMapeados = prestamosActivos.map((prestamo) => {
      const plan = loanPlans.get(prestamo.id) ?? null;
      return {
        nombre: prestamo.nombre,
        tipo: prestamo.ambito === 'INMUEBLE' ? 'Hipoteca' : 'Préstamo personal',
        tipoInforme: prestamo.ambito === 'INMUEBLE' ? 'Hipoteca' : 'Préstamo personal',
        principalVivo: getOutstandingPrincipal(prestamo, plan),
        capitalVivo: getOutstandingPrincipal(prestamo, plan),
        cuotaMensual: getLoanMonthlyInstallment(prestamo, plan),
        tin: getLoanTin(prestamo),
        fechaFin: getLoanEndDate(plan, prestamo),
      };
    });

    const cuotaHipotecasMensual = prestamosMapeados
      .filter((prestamo) => prestamo.tipoInforme === 'Hipoteca')
      .reduce((sum, prestamo) => sum + prestamo.cuotaMensual, 0);
    const cuotaPrestamosMensual = prestamosMapeados
      .filter((prestamo) => prestamo.tipoInforme !== 'Hipoteca')
      .reduce((sum, prestamo) => sum + prestamo.cuotaMensual, 0);
    const totalCuotasMensual = cuotaHipotecasMensual + cuotaPrestamosMensual;
    const deudaTotal = prestamosMapeados.reduce((sum, prestamo) => sum + prestamo.principalVivo, 0);

    const nombreCompleto = [personal?.nombre, personal?.apellidos].filter(Boolean).join(' ').trim();
    const ingresoLaboralAnual = projectionSummary.desglose.nominas + projectionSummary.desglose.autonomos;
    const inversionesPensiones = getInversionesPensionesValue(inversiones as Array<{ tipo: string; valor_actual: number }>) || projectionSummary.meses[11]?.inversionesPensiones || toNumber(patrimonio.desglose.inversiones);

    return {
      generadoEn: generatedAt,
      año,
      proyeccion: {
        ...projectionSummary,
        totalesAnuales: {
          ...projectionSummary.totalesAnuales,
          patrimonioNetoFinal: fallbackPatrimonioFinal,
        },
        meses: projectionSummary.meses.length > 0 ? projectionSummary.meses : fallbackMonths,
      },
      inmuebles: inmueblesActivos,
      resumenCartera: {
        costeTotal,
        valorTotal,
        plusvaliaTotal,
        rentaMensualTotal,
        yieldBruta,
        cfMensualTotal,
        ltv,
        equity,
        deudaHipotecaria,
        ocupacion: toNumber(flujos.inmuebles.ocupacion),
      },
      resumenPatrimonio: {
        inversionesPensiones,
      },
      prestamos: prestamosMapeados,
      resumenFinanciacion: {
        cuotaHipotecasMensual,
        cuotaPrestamosMensual,
        totalCuotasMensual,
        deudaTotal,
      },
      personal: {
        nombreCompleto,
        empresa: getEmploymentLabel(personal),
        antiguedad: getStringField(personal, 'antiguedad') ?? getStringField(personal, 'fechaAntiguedadEmpresa'),
        ingresoLaboralAnual,
      },
      fiscal: declaracionIRPF ? {
        resumen: {
          rendimientosTrabajo: toNumber(declaracionIRPF.baseGeneral.rendimientosTrabajo?.rendimientoNeto),
          rentasCapitalInmobiliario: toNumber(declaracionIRPF.baseGeneral.rendimientosInmuebles?.reduce((sum, item) => sum + item.rendimientoNetoAlquiler, 0)),
          rendimientosAutonomo: toNumber(declaracionIRPF.baseGeneral.rendimientosAutonomo?.rendimientoNeto),
          rendimientosCapitalMobiliario: toNumber(declaracionIRPF.baseAhorro?.capitalMobiliario?.total),
          baseImponibleGeneral: toNumber(declaracionIRPF.liquidacion?.baseImponibleGeneral),
          baseImponibleAhorro: toNumber(declaracionIRPF.liquidacion?.baseImponibleAhorro),
          baseLiquidableGeneral: toNumber(declaracionIRPF.liquidacion?.baseImponibleGeneral) - toNumber(declaracionIRPF.reducciones?.total),
          cuotaIntegra: toNumber(declaracionIRPF.liquidacion?.cuotaIntegra),
          retencionTrabajo: toNumber(declaracionIRPF.retenciones?.trabajo),
          retencionCapital: toNumber(declaracionIRPF.retenciones?.capitalMobiliario),
          retencionAutonomo: toNumber(declaracionIRPF.retenciones?.autonomoM130),
          totalRetenciones: toNumber(declaracionIRPF.retenciones?.total),
          resultado: toNumber(declaracionIRPF.resultado),
        },
        inmuebles: declaracionIRPF.baseGeneral?.rendimientosInmuebles?.map((item) => ({
          alias: item.alias ?? String(item.inmuebleId),
          ingresosIntegros: toNumber(item.ingresosIntegros),
          gastosDeducibles: toNumber(item.gastosDeducibles),
          amortizacion: toNumber(item.amortizacion),
          baseNeta: toNumber(item.rendimientoNeto),
          reduccion60: toNumber(
            item.reduccionHabitual
              ?? (item.ingresosIntegros - item.gastosDeducibles - item.amortizacion > 0
                ? item.rendimientoNeto - item.rendimientoNetoAlquiler
                : 0),
          ),
          rendimientoNetoReducido: toNumber(item.rendimientoNetoAlquiler),
        })) ?? [],
        calendario: buildFiscalCalendar(año, declaracionIRPF, eventosFiscales),
      } : DEFAULT_DATA.fiscal,
      cartera: {
        detalleFiscal: inmuebles
          .filter((inm) => inm.estado !== 'VENDIDO')
          .map((inm) => {
            const rawProperty = getLegacyProperty(dbPayload.properties, inm.id);
            const detalleFiscal = getFiscalDetalle(inm, rawProperty);

            return {
              alias: inm.alias,
              valorCatastral: detalleFiscal.valorCatastral,
              vcConstruccion: detalleFiscal.vcConstruccion,
              pctConstruccion: detalleFiscal.pctConstruccion,
              metodoAmortizacion: inm.fiscalidad?.metodo_amortizacion ?? 'REGLA_GENERAL_3',
              pctAmortizacion: toNumber(inm.fiscalidad?.porcentaje_amortizacion_info ?? 3),
              regimenFiscal: 'Arrendamiento general',
            };
          }),
      },
      tesoreria: tesoreriaPanel ? {
        totales: {
          inicioMes: toNumber(tesoreriaPanel.totales.inicioMes),
          hoy: toNumber(tesoreriaPanel.totales.hoy),
          porCobrar: toNumber(tesoreriaPanel.totales.porCobrar),
          porPagar: toNumber(tesoreriaPanel.totales.porPagar),
          proyeccion: toNumber(tesoreriaPanel.totales.proyeccion),
        },
        filas: tesoreriaPanel.filas.map((f) => ({
          banco: f.banco,
          inicioMes: toNumber(f.inicioMes),
          hoy: toNumber(f.hoy),
          porCobrar: toNumber(f.porCobrar),
          porPagar: toNumber(f.porPagar),
          proyeccion: toNumber(f.proyeccion),
        })),
      } : DEFAULT_DATA.tesoreria,
    };
  }
}

export const informesDataService = new InformesDataService();

export async function getInformesData(año: number): Promise<InformesData> {
  return informesDataService.getInformesData(año);
}
