import { dashboardService } from './dashboardService';
import { inmuebleService } from './inmuebleService';
import { prestamosService } from './prestamosService';
import { personalDataService } from './personalDataService';
import { inversionesService } from './inversionesService';
import { initDB, type Contract } from './db';
import { generateProyeccionMensual } from '../modules/horizon/proyeccion/mensual/services/proyeccionMensualService';
import type { ProyeccionAnual } from '../modules/horizon/proyeccion/mensual/types/proyeccionMensual';
import type { Inmueble } from '../types/inmueble';
import type { Prestamo, PlanPagos } from '../types/prestamos';
import type { PersonalData } from '../types/personal';
import type { ValoracionHistorica } from '../types/valoraciones';
import {
  getLatestValuation,
  mapInmuebleToRow,
  mapPrestamoToRow,
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
      tesoreria,
      dbPayload,
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
      safe(dashboardService.getTesoreriaPanel(), {
        asOf: generatedAt,
        filas: [],
        totales: { inicioMes: 0, hoy: 0, porCobrar: 0, porPagar: 0, proyeccion: 0 },
      }),
      safe((async () => {
        const db = await initDB();
        const [properties, valuations, contracts] = await Promise.all([
          safe(db.getAll('properties'), [] as ExtendedProperty[]),
          safe(db.getAll('valoraciones_historicas'), [] as ValoracionHistorica[]),
          safe(db.getAll('contracts'), [] as Contract[]),
        ]);
        return { properties, valuations, contracts };
      })(), { properties: [] as ExtendedProperty[], valuations: [] as ValoracionHistorica[], contracts: [] as Contract[] }),
    ]);

    const projection = proyecciones.find((item) => item.year === año) ?? null;
    const projectionSummary = buildProjectionSummary(projection);
    const fallbackCajaFinal = projectionSummary.meses[projectionSummary.meses.length - 1]?.cajaFinal ?? toNumber(tesoreria.totales.proyeccion);
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

    const prestamosMapeados = prestamos.map((prestamo) => mapPrestamoToRow({
      prestamo,
      plan: loanPlans.get(prestamo.id) ?? null,
    }));

    const inmueblesMapeados = inmuebles.map((inmueble) => {
      const property = dbPayload.properties.find((item) => String(item.id) === String(inmueble.id)) ?? null;
      const valuation = getLatestValuation(inmueble.id, dbPayload.valuations);
      const contractsForProperty = dbPayload.contracts.filter((contract) => String(contract.inmuebleId) === String(inmueble.id));
      const prestamosForProperty = prestamosMapeados.filter((prestamo) => {
        const original = prestamos.find((item) => item.id === prestamo.id);
        return prestamo.esHipoteca && original?.inmuebleId === inmueble.id;
      });

      return mapInmuebleToRow({
        inmueble,
        property,
        valuation,
        contracts: contractsForProperty,
        prestamos: prestamosForProperty,
      });
    });

    const inmueblesActivos = inmueblesMapeados.filter((item) => item.estado !== 'VENDIDO');
    const valorTotal = inmueblesMapeados.reduce((sum, item) => sum + item.valorActual, 0);
    const costeTotal = inmueblesMapeados.reduce((sum, item) => sum + item.costeTotal, 0);
    const rentaMensualTotal = inmueblesActivos.reduce((sum, item) => sum + item.rentaMensual, 0);
    const cfMensualTotal = inmueblesActivos.reduce((sum, item) => sum + item.cfNeto, 0);
    const plusvaliaTotal = inmueblesMapeados.reduce((sum, item) => sum + item.plusvalia, 0);
    const deudaHipotecaria = inmueblesMapeados.reduce((sum, item) => sum + item.deudaHipotecaria, 0);
    const equity = valorTotal - deudaHipotecaria;
    const yieldBruta = costeTotal > 0 ? ((rentaMensualTotal * 12) / costeTotal) * 100 : 0;
    const ltv = valorTotal > 0 ? (deudaHipotecaria / valorTotal) * 100 : 0;

    const prestamosInformes = prestamosMapeados.map((prestamo) => ({
      nombre: prestamo.nombre,
      tipo: prestamo.tipoInforme,
      capitalVivo: prestamo.principalVivo,
      cuotaMensual: prestamo.cuotaMensual,
      tin: prestamo.tin,
      fechaFin: prestamo.fechaVencimiento,
    }));

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
      inmuebles: inmueblesMapeados.map((item) => ({
        id: item.id,
        alias: item.alias,
        direccion: item.direccion,
        ciudad: item.municipio,
        estado: item.estado,
        costeTotal: item.costeTotal,
        valorActual: item.valorActual,
        plusvalia: item.plusvalia,
        rentaMensual: item.rentaMensual,
        yieldBruto: item.yieldBruto,
        hipotecaMensual: item.hipotecaMensual,
        cfNeto: item.cfNeto,
      })),
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
      prestamos: prestamosInformes,
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
    };
  }
}

export const informesDataService = new InformesDataService();

export async function getInformesData(año: number): Promise<InformesData> {
  return informesDataService.getInformesData(año);
}
