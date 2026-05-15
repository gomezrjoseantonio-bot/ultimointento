/**
 * amortizacionAcumuladaService.ts · helper F3 tabla amortización acumulada.
 *
 * Genera la vista año a año desde compra (o 4 años atrás · lo que sea menor)
 * hasta `añoActual`. Para cada fila calcula:
 *   - días arrendados (vía `getRentalDaysForYear`)
 *   - amortización inmueble (base × 3% × días/365)
 *   - amortización mobiliario (vía `calcularAmortizacionMobiliarioAnual`)
 *   - acumulado total running
 *
 * NO toca motor · sólo compone vista. Diferente del método agregado de
 * `gananciaPatrimonialService.calcularAmortizacionAcumulada` que devuelve
 * totales pero no el desglose por año.
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 4 §6.6.
 */

import { initDB } from '../../../../services/db';
import type { Property, Contract } from '../../../../services/db';
import { getRentalDaysForYear } from '../../../../services/aeatAmortizationService';
import { calcularAmortizacionMobiliarioAnual } from '../../../../services/mobiliarioActivoService';
import { calcularDiasArrendadoAno } from '../../../../services/gananciaPatrimonialService';

export interface AmortRow {
  año: number;
  diasArrendado: number;
  baseAmortizacion: number;
  amortInmueble: number;
  amortMobiliario: number;
  acumuladoTotal: number;
  esFuturo: boolean;
}

export interface AmortizacionAcumuladaData {
  rows: AmortRow[];
  acumuladoCierreEjercicio: number;
  añoCorte: number;
}

const TASA_INMUEBLE = 0.03;

function yearFromIso(iso?: string): number | null {
  if (!iso || iso.length < 4) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function getPositiveNumber(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

function yearFromIsoStrict(iso?: string): number | null {
  if (!iso || iso.length < 4) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

export async function getAmortizacionAcumulada(
  propertyId: number,
  añoCorte: number,
  /**
   * Fecha de venta (ISO) opcional. Cuando se proporciona y cae dentro de
   * un año iterado, la fila de ese año prorratea los días arrendados
   * hasta esa fecha usando `calcularDiasArrendadoAno` del motor — la
   * misma lógica con la que `calcularAmortizacionAcumulada` construye el
   * total del snapshot. Garantiza que `Σ filas = total`.
   */
  sellDate?: string,
): Promise<AmortizacionAcumuladaData> {
  const db = await initDB();
  const property = (await db.get('properties', propertyId)) as Property | undefined;
  if (!property) {
    return { rows: [], acumuladoCierreEjercicio: 0, añoCorte };
  }

  // Contratos del inmueble · cargados sólo si necesitamos prorratear el
  // año de venta. Evita acoplar el helper a `contracts` cuando no hay venta.
  const añoVenta = yearFromIsoStrict(sellDate);
  let contratosDelInmueble: Contract[] = [];
  if (añoVenta !== null) {
    const allContracts = (await db.getAll('contracts')) as Contract[];
    contratosDelInmueble = allContracts.filter(
      (c) => c.inmuebleId === propertyId || c.propertyId === propertyId,
    );
  }

  // Base de amortización · usamos guarda > 0 para permitir fallback a
  // `fiscalData.baseAmortizacion` cuando `aeatAmortization.baseAmortizacion`
  // exista pero sea 0 (registros parcialmente poblados).
  const baseAmortizacion =
    getPositiveNumber(property.aeatAmortization?.baseAmortizacion)
    ?? getPositiveNumber((property as any).fiscalData?.baseAmortizacion);

  // Sin base válida · empty state (la tabla mostrará "sin datos" desde
  // `AmortizacionAcumuladaTable` cuando `rows.length === 0`). Evita
  // generar filas con 0,00 € que parezcan un cálculo válido.
  if (baseAmortizacion === null) {
    return { rows: [], acumuladoCierreEjercicio: 0, añoCorte };
  }

  const purchaseYear =
    yearFromIso(property.purchaseDate)
    ?? yearFromIso(property.aeatAmortization?.firstAcquisitionDate)
    ?? añoCorte;

  // Mostramos desde el año de compra hasta añoCorte + 1 (preview del año
  // siguiente · estilo mockup que muestra 2025 future cuando estamos en 2024).
  const desde = Math.min(purchaseYear, añoCorte);
  const hasta = añoCorte + 1;

  const rows: AmortRow[] = [];
  let acumulado = 0;

  for (let año = desde; año <= hasta; año++) {
    const diasAño = isLeapYear(año) ? 366 : 365;
    let dias = 0;
    // Año de venta: prorratear hasta `sellDate` con la lógica del motor
    // para que la fila coincida con la contribución de ese año al total
    // de `snapshot.amortizacionAcumulada*`. Resto de años: días completos
    // arrendados del año vía `getRentalDaysForYear` (que mira propertyDays
    // y, en su defecto, contratos activos sin recorte por sellDate).
    if (añoVenta !== null && año === añoVenta && sellDate) {
      dias = calcularDiasArrendadoAno(contratosDelInmueble, año, sellDate);
    } else {
      try {
        dias = await getRentalDaysForYear(propertyId, año);
      } catch { dias = 0; }
    }
    if (!Number.isFinite(dias) || dias < 0) dias = 0;

    let amortInmueble = 0;
    if (baseAmortizacion > 0 && dias > 0) {
      amortInmueble = Math.round((baseAmortizacion * TASA_INMUEBLE * dias / diasAño) * 100) / 100;
    }

    let amortMobiliario = 0;
    try {
      amortMobiliario = await calcularAmortizacionMobiliarioAnual(propertyId, año, dias, diasAño);
    } catch { amortMobiliario = 0; }
    if (!Number.isFinite(amortMobiliario) || amortMobiliario < 0) amortMobiliario = 0;

    const esFuturo = año > añoCorte;
    if (!esFuturo) {
      acumulado = Math.round((acumulado + amortInmueble + amortMobiliario) * 100) / 100;
    }

    rows.push({
      año,
      diasArrendado: dias,
      baseAmortizacion,
      amortInmueble,
      amortMobiliario,
      acumuladoTotal: esFuturo
        ? Math.round((acumulado + amortInmueble + amortMobiliario) * 100) / 100
        : acumulado,
      esFuturo,
    });
  }

  return {
    rows,
    acumuladoCierreEjercicio: acumulado,
    añoCorte,
  };
}
