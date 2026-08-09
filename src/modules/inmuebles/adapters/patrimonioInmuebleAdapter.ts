// Adaptador patrimonial del inmueble · Fase 9 (Patrimonio completo).
//
// Calcula, de forma PURA (sin IndexedDB), la foto patrimonial de un inmueble a
// partir de datos ya cargados por el llamador:
//   - coste de adquisición (desde `acquisitionCosts`)
//   - valor actual e histórico (desde `valoracionesActivos`)
//   - deuda pendiente y financiación vinculada (desde `prestamos`, ya imputada)
//   - mejoras acumuladas (CAPEX) y mobiliario acumulado
//
// No modifica categoryKey, fiscalidad, stores ni DB_VERSION. No añade el campo
// `naturaleza`. Es solo lectura/derivación para la pestaña Patrimonio.

import type { Property, MejoraInmueble, MuebleInmueble } from '../../../services/db';

/** Una línea de financiación ya imputada al inmueble (allocation aplicada). */
export interface FinanciacionLineaInmueble {
  id: string;
  nombre: string;
  /** Capital vivo imputado al inmueble (principal pendiente × factor de afectación). */
  deudaPendiente: number;
  /** Principal inicial imputado al inmueble. */
  principalInicial: number;
  /** Cuota mensual imputada al inmueble. */
  cuotaMensual: number;
  /** Porcentaje de afectación del préstamo a este inmueble · 0..100. */
  porcentajeAfectacion: number;
}

/** Un punto de la serie de valoraciones · `fecha` ISO (YYYY-MM o YYYY-MM-DD). */
export interface ValoracionPunto {
  fecha: string;
  valor: number;
}

export interface PatrimonioInmuebleInput {
  acquisitionCosts: Property['acquisitionCosts'] | undefined;
  /** Serie de valoraciones ordenada ascendente por fecha. */
  valoraciones: ValoracionPunto[];
  /** Financiación vinculada, ya imputada al inmueble. */
  financiacion: FinanciacionLineaInmueble[];
  mejoras: MejoraInmueble[];
  mobiliario: MuebleInmueble[];
}

export interface PatrimonioInmuebleResumen {
  /** Coste total de adquisición · precio + gastos + impuestos. */
  costeAdquisicion: number;
  /** Valor actual · última valoración registrada · `null` si no hay ninguna. */
  valorActual: number | null;
  /** Fecha de la última valoración · `null` si no hay ninguna. */
  fechaValorActual: string | null;
  /** Deuda pendiente total imputada al inmueble. */
  deudaPendiente: number;
  tieneFinanciacion: boolean;
  /** Patrimonio neto · (valorActual ?? costeAdquisicion) − deudaPendiente. */
  patrimonioNeto: number;
  /** `true` cuando el neto usa el coste como proxy al faltar valoración. */
  patrimonioNetoEsEstimado: boolean;
  /** Revalorización · valorActual − costeAdquisicion · `null` sin valoración. */
  revalorizacion: number | null;
  revalorizacionPct: number | null;
  /** Mejoras acumuladas (CAPEX · excluye reparaciones). */
  mejorasAcumuladas: number;
  /** Mobiliario acumulado · inversión en mobiliario vigente. */
  mobiliarioAcumulado: number;
  /** Loan-to-value · deuda / valorActual · `null` sin valoración. */
  ltv: number | null;
  financiacion: FinanciacionLineaInmueble[];
  /** Histórico de valoraciones ordenado descendente (recientes primero). */
  historicoValoraciones: ValoracionPunto[];
}

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Coste total de adquisición · misma fórmula que `informesDataService`
 * (`costeLegacy`): precio + ITP + IVA + notaría + registro + gestoría + PSI +
 * inmobiliaria + otros. No usa el coste persistido para no divergir de lo que
 * el usuario ve al editar la ficha.
 */
export function calcularCosteAdquisicion(
  costes: Property['acquisitionCosts'] | undefined,
): number {
  if (!costes) return 0;
  const otros = Array.isArray(costes.other)
    ? costes.other.reduce((sum, item) => sum + num(item?.amount), 0)
    : 0;
  return round2(
    num(costes.price) +
      num(costes.itp) +
      num(costes.iva) +
      num(costes.notary) +
      num(costes.registry) +
      num(costes.management) +
      num(costes.psi) +
      num(costes.realEstate) +
      otros,
  );
}

/** Mejoras acumuladas · solo CAPEX (mejora + ampliación), nunca reparaciones. */
export function calcularMejorasAcumuladas(mejoras: MejoraInmueble[]): number {
  return round2(
    mejoras
      .filter((m) => m.tipo !== 'reparacion')
      .reduce((sum, m) => sum + num(m.importe), 0),
  );
}

/** Mobiliario acumulado · inversión en enseres vigentes (excluye dados de baja). */
export function calcularMobiliarioAcumulado(mobiliario: MuebleInmueble[]): number {
  return round2(
    mobiliario
      .filter((m) => m.activo !== false)
      .reduce((sum, m) => sum + num(m.importe), 0),
  );
}

/**
 * Deriva la foto patrimonial completa a partir de datos ya cargados.
 *
 * Reglas:
 * - Mejoras y mobiliario NO se suman al patrimonio neto (ya se reflejan, en su
 *   caso, en la valoración); se exponen como magnitudes informativas.
 * - Sin valoración registrada, el neto usa el coste de adquisición como proxy y
 *   se marca `patrimonioNetoEsEstimado`; la revalorización queda `null` (no se
 *   inventa una plusvalía de 0 sobre datos que no existen).
 */
export function calcularPatrimonioInmueble(
  input: PatrimonioInmuebleInput,
): PatrimonioInmuebleResumen {
  const costeAdquisicion = calcularCosteAdquisicion(input.acquisitionCosts);

  const serie = [...input.valoraciones].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultima = serie.length > 0 ? serie[serie.length - 1] : null;
  const valorActual = ultima ? round2(num(ultima.valor)) : null;
  const fechaValorActual = ultima ? ultima.fecha : null;

  const deudaPendiente = round2(
    input.financiacion.reduce((sum, l) => sum + num(l.deudaPendiente), 0),
  );

  const base = valorActual ?? costeAdquisicion;
  const patrimonioNeto = round2(base - deudaPendiente);
  const patrimonioNetoEsEstimado = valorActual === null;

  const revalorizacion = valorActual === null ? null : round2(valorActual - costeAdquisicion);
  const revalorizacionPct =
    valorActual === null || costeAdquisicion <= 0
      ? null
      : round2(((valorActual - costeAdquisicion) / costeAdquisicion) * 100);

  const ltv =
    valorActual === null || valorActual <= 0
      ? null
      : round2((deudaPendiente / valorActual) * 100);

  return {
    costeAdquisicion,
    valorActual,
    fechaValorActual,
    deudaPendiente,
    tieneFinanciacion: input.financiacion.length > 0,
    patrimonioNeto,
    patrimonioNetoEsEstimado,
    revalorizacion,
    revalorizacionPct,
    mejorasAcumuladas: calcularMejorasAcumuladas(input.mejoras),
    mobiliarioAcumulado: calcularMobiliarioAcumulado(input.mobiliario),
    ltv,
    financiacion: input.financiacion,
    historicoValoraciones: [...serie].reverse(),
  };
}
