import type { Contract, Property } from '../../../../services/db';
import type { Inmueble } from '../../../../types/inmueble';
import type { PlanPagos, Prestamo } from '../../../../types/prestamos';
import type { ValoracionHistorica } from '../../../../types/valoraciones';

export type ExtendedProperty = Property & {
  currentValue?: number;
  marketValue?: number;
  estimatedValue?: number;
  valuation?: number;
  valor_actual?: number;
};

export interface InmuebleRow {
  id: string;
  alias: string;
  direccion: string;
  municipio: string;
  ccaa: string;
  estado: string;
  regimen: string;
  fechaCompra: string;
  metrosCuadrados: number;
  habitaciones: number;
  precioCompra: number;
  gastosCompra: number;
  impuestosCompra: number;
  costeTotal: number;
  valorActual: number;
  plusvalia: number;
  plusvaliaPct: number;
  rentaMensual: number;
  yieldBruto: number;
  hipotecaMensual: number;
  cfNeto: number;
  deudaHipotecaria: number;
  ltv: number;
  referenciaCatastral: string;
  valorCatastral: number;
  valorCatastralConstruccion: number;
  porcentajeConstruccion: number;
  metodoAmortizacion: string;
  amortizacionAnualBase: number;
  porcentajeAmortizacion: number;
  regimenFiscal: string;
}

export interface PrestamoRow {
  id: string;
  nombre: string;
  ambito: string;
  finalidad: string;
  tipo: string;
  sistema: string;
  principalInicial: number;
  principalVivo: number;
  fechaFirma: string;
  fechaVencimiento: string;
  plazoTotalMeses: number;
  plazoRestanteMeses: number;
  cuotaMensual: number;
  tin: number;
  tae: number;
  totalInteresesPendientes: number;
  estado: string;
  esHipoteca: boolean;
  tipoInforme: string;
}

export interface InmuebleMapperArgs {
  inmueble: Inmueble;
  property?: ExtendedProperty | null;
  valuation?: ValoracionHistorica | null;
  contracts?: Contract[];
  prestamos?: PrestamoRow[];
}

export interface PrestamoMapperArgs {
  prestamo: Prestamo;
  plan?: PlanPagos | null;
  currentDate?: Date;
}

export const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toRatioPercentage = (numerator: number, denominator: number): number => (
  denominator > 0 ? (numerator / denominator) * 100 : 0
);

export const getDireccionCompleta = (inmueble: Inmueble, property?: ExtendedProperty | null): string => {
  const parts = [
    inmueble.direccion.calle,
    inmueble.direccion.numero,
    inmueble.direccion.piso,
    inmueble.direccion.puerta,
  ].filter((part): part is string => Boolean(part));

  return parts.join(' ').trim() || property?.address || '';
};

export const getLatestValuation = (
  propertyId: string | number,
  valuations: ValoracionHistorica[],
): ValoracionHistorica | null => {
  const candidates = valuations
    .filter((item) => item.tipo_activo === 'inmueble' && String(item.activo_id) === String(propertyId))
    .sort((a, b) => String(b.fecha_valoracion ?? '').localeCompare(String(a.fecha_valoracion ?? '')));

  return candidates[0] ?? null;
};

export const getOutstandingPrincipal = (prestamo: Prestamo, plan?: PlanPagos | null): number => {
  const unpaid = plan?.periodos.find((periodo) => !periodo.pagado);
  if (unpaid) {
    const previousIndex = Math.max(0, unpaid.periodo - 2);
    const previous = previousIndex >= 0 ? plan?.periodos[previousIndex] : null;
    return toNumber(previous?.principalFinal ?? unpaid.principalFinal ?? prestamo.principalVivo);
  }

  const lastPeriod = plan?.periodos[plan.periodos.length - 1];
  return toNumber(lastPeriod?.principalFinal ?? prestamo.principalVivo);
};

export const getLoanTin = (prestamo: Prestamo): number => {
  if (prestamo.tipo === 'FIJO') return toNumber(prestamo.tipoNominalAnualFijo);
  if (prestamo.tipo === 'VARIABLE') {
    return (toNumber(prestamo.valorIndiceActual) + toNumber(prestamo.diferencial)) * 100;
  }

  return toNumber(prestamo.tipoNominalAnualMixtoFijo || prestamo.tipoNominalAnualFijo);
};

export const getLoanMonthlyInstallment = (prestamo: Prestamo, plan?: PlanPagos | null): number => {
  const currentPeriod = plan?.periodos.find((periodo) => !periodo.pagado);
  return toNumber(currentPeriod?.cuota ?? plan?.periodos[0]?.cuota);
};

const getRemainingMonths = (plan?: PlanPagos | null): number => (
  plan?.periodos.filter((periodo) => !periodo.pagado).length ?? 0
);

const getOutstandingInterest = (plan?: PlanPagos | null): number => (
  plan?.periodos
    .filter((periodo) => !periodo.pagado)
    .reduce((sum, periodo) => sum + toNumber(periodo.interes), 0) ?? 0
);

const getApproximateTAE = (tinPct: number): number => {
  if (tinPct <= 0) return 0;
  return (Math.pow(1 + tinPct / 100 / 12, 12) - 1) * 100;
};

const getRegimenFiscal = (inmueble: Inmueble, property?: ExtendedProperty | null): string => {
  const explicitUse = property?.fiscalData?.contractUse;
  if (explicitUse === 'vivienda-habitual') return 'Vivienda habitual';
  if (explicitUse === 'turistico') return 'Turístico';
  if (explicitUse === 'otros') return 'Otros';
  return inmueble.fiscalidad.metodo_amortizacion === 'REGLA_GENERAL_3' ? 'Arrendamiento general' : 'Especial';
};

export function mapPrestamoToRow({ prestamo, plan = null, currentDate = new Date() }: PrestamoMapperArgs): PrestamoRow {
  const principalVivo = getOutstandingPrincipal(prestamo, plan);
  const cuotaMensual = getLoanMonthlyInstallment(prestamo, plan);
  const tin = getLoanTin(prestamo);
  const tae = getApproximateTAE(tin);
  const fechaVencimiento = plan?.resumen.fechaFinalizacion ?? prestamo.fechaCancelacion ?? '';
  const plazoRestanteMeses = getRemainingMonths(plan);
  const totalInteresesPendientes = getOutstandingInterest(plan);
  const fechaHoy = new Date(currentDate);
  const estaActivo = prestamo.activo !== false && prestamo.estado !== 'cancelado';
  const estado = !estaActivo
    ? 'Cancelado'
    : plazoRestanteMeses === 0 && fechaVencimiento && new Date(fechaVencimiento) < fechaHoy
      ? 'Vencido'
      : 'Activo';

  return {
    id: prestamo.id,
    nombre: prestamo.nombre,
    ambito: prestamo.ambito,
    finalidad: prestamo.finalidad ?? 'OTRA',
    tipo: prestamo.tipo,
    sistema: prestamo.sistema,
    principalInicial: toNumber(prestamo.principalInicial),
    principalVivo,
    fechaFirma: prestamo.fechaFirma,
    fechaVencimiento,
    plazoTotalMeses: toNumber(prestamo.plazoMesesTotal),
    plazoRestanteMeses,
    cuotaMensual,
    tin,
    tae,
    totalInteresesPendientes,
    estado,
    esHipoteca: prestamo.ambito === 'INMUEBLE' || Boolean(prestamo.inmuebleId),
    tipoInforme: prestamo.ambito === 'INMUEBLE' || Boolean(prestamo.inmuebleId) ? 'Hipoteca' : 'Préstamo personal',
  };
}

export function mapInmuebleToRow({
  inmueble,
  property = null,
  valuation = null,
  contracts = [],
  prestamos = [],
}: InmuebleMapperArgs): InmuebleRow {
  const precioCompra = toNumber(inmueble.compra.precio_compra);
  const gastosCompra = toNumber(inmueble.compra.total_gastos);
  const impuestosCompra = toNumber(inmueble.compra.total_impuestos);
  const costeTotal = toNumber(inmueble.compra.coste_total_compra || precioCompra + gastosCompra + impuestosCompra);
  const valorActual = toNumber(
    valuation?.valor
      ?? property?.currentValue
      ?? property?.marketValue
      ?? property?.estimatedValue
      ?? property?.valuation
      ?? property?.acquisitionCosts?.price
      ?? costeTotal,
  );
  const rentaMensual = contracts.reduce((sum, contract) => (
    contract.estadoContrato === 'activo' ? sum + toNumber(contract.rentaMensual) : sum
  ), 0);
  const hipotecaMensual = prestamos.reduce((sum, prestamo) => sum + toNumber(prestamo.cuotaMensual), 0);
  const deudaHipotecaria = prestamos.reduce((sum, prestamo) => sum + toNumber(prestamo.principalVivo), 0);
  const plusvalia = valorActual - costeTotal;
  const plusvaliaPct = toRatioPercentage(plusvalia, costeTotal);
  const yieldBruto = toRatioPercentage(rentaMensual * 12, costeTotal);
  const ltv = toRatioPercentage(deudaHipotecaria, valorActual);

  return {
    id: String(inmueble.id),
    alias: inmueble.alias,
    direccion: getDireccionCompleta(inmueble, property),
    municipio: inmueble.direccion.municipio || property?.municipality || '',
    ccaa: inmueble.direccion.ca || property?.ccaa || '',
    estado: inmueble.estado,
    regimen: inmueble.compra.regimen,
    fechaCompra: inmueble.compra.fecha_compra,
    metrosCuadrados: toNumber(inmueble.caracteristicas.m2),
    habitaciones: toNumber(inmueble.caracteristicas.habitaciones),
    precioCompra,
    gastosCompra,
    impuestosCompra,
    costeTotal,
    valorActual,
    plusvalia,
    plusvaliaPct,
    rentaMensual,
    yieldBruto,
    hipotecaMensual,
    cfNeto: rentaMensual - hipotecaMensual,
    deudaHipotecaria,
    ltv,
    referenciaCatastral: inmueble.ref_catastral || property?.cadastralReference || '',
    valorCatastral: toNumber(inmueble.fiscalidad.valor_catastral_total || property?.fiscalData?.cadastralValue),
    valorCatastralConstruccion: toNumber(inmueble.fiscalidad.valor_catastral_construccion || property?.fiscalData?.constructionCadastralValue),
    porcentajeConstruccion: toNumber(inmueble.fiscalidad.porcentaje_construccion || property?.fiscalData?.constructionPercentage),
    metodoAmortizacion: inmueble.fiscalidad.metodo_amortizacion,
    amortizacionAnualBase: toNumber(inmueble.fiscalidad.amortizacion_anual_base),
    porcentajeAmortizacion: toNumber(inmueble.fiscalidad.porcentaje_amortizacion_info),
    regimenFiscal: getRegimenFiscal(inmueble, property),
  };
}
