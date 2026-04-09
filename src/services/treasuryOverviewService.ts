/**
 * treasuryOverviewService.ts
 *
 * Reads directly from source stores to build a multi-year treasury overview.
 * NO dependency on treasuryEvents or historicalTreasuryService.
 *
 * Cash-flow structure — 3 blocks:
 *  Bloque 1 — Operativo  (nómina, autónomo, alquiler, capital mobiliario, IRPF, gastos inmuebles)
 *  Bloque 2 — Inversión  (compra/venta inmuebles, CAPEX, inversiones)
 *  Bloque 3 — Financiación (hipotecas/préstamos recibidos, cuotas, cancelaciones)
 *
 *  Gastos personales = residuo del cuadre (NO es un input, nunca hardcodeado)
 */

import { initDB } from './db';
import type { EjercicioFiscalCoord } from './db';
import { prestamosService } from './prestamosService';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TreasuryYearSummary {
  año: number;
  fuente: 'xml_aeat' | 'atlas_nativo' | 'sin_datos';

  // Bloque 1 — Operativo
  nominaBruta: number;         // trabajo: totalIngresosIntegros (antes de retenciones y SS)
  autonomoBruto: number;       // actividadEconomica: totalIngresos (antes de retenciones)
  nominaNeta: number;          // trabajo: totalIngresosIntegros - retenciones - cotizacionesSS
  autonomoNeto: number;        // actividadEconomica: totalIngresos - retenciones
  rentasAlquiler: number;      // sum contracts.ejerciciosFiscales[año].importeDeclarado
  capitalMobiliario: number;   // capitalMobiliario: totalBruto - retenciones
  devolucionIrpf: number;      // resultado[año-1] if < 0 → ingreso en año
  pagoIrpf: number;            // resultado[año-1] if > 0 → gasto en año
  gastosInmuebles: number;     // sum gastosInmueble excl. amortización ('0117')
  subtotalOperativo: number;

  // Bloque 2 — Inversión
  compraInmuebles: number;         // salida: price + itp + iva + notary + ... por purchaseDate
  ventaInmuebles: number;          // entrada: grossProceeds de property_sales confirmed
  mejorasCapex: number;            // salida: mejorasInmueble por ejercicio
  aportacionesInversiones: number; // salida: inversiones aportaciones tipo='aportacion'
  recuperacionInversiones: number; // entrada: inversiones aportaciones tipo='reembolso'
  subtotalInversion: number;

  // Bloque 3 — Financiación
  hipotecasRecibidas: number;      // entrada: prestamos ambito=INMUEBLE por fechaFirma
  prestamosRecibidos: number;      // entrada: prestamos ambito=PERSONAL por fechaFirma
  cuotasPrestamos: number;         // salida: sum cuota de cuadroAmortizacion por año
  cancelacionesPrestamos: number;  // salida: loan_settlements.totalCashOut confirmed
  subtotalFinanciacion: number;

  // Residuo
  gastosPersonales: number;        // = subtotalOperativo + subtotalInversion + subtotalFinanciacion

  // Total
  cashflowNeto: number;            // variación de saldo (0 para históricos sin dato de saldo)
}

// ─── Casilla constants (snapshot fallback) ────────────────────────────────────

const CASILLA_NOMINA_BRUTA_V2  = '0012'; // totalIngresosIntegros
const CASILLA_NOMINA_BRUTA_V1  = '0003'; // retribucionesDinerarias (fallback)
const CASILLA_NOMINA_RET       = '0596';
const CASILLA_NOMINA_SS        = '0013';
const CASILLA_AUTONOMO_INGRESOS = 'VE1II1';
const CASILLA_AUTONOMO_RET     = 'RETENED';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Nómina bruta = totalIngresosIntegros (antes de retenciones y SS).
 */
function extractNominaBruta(dc: any, snapshot?: Record<string, number>): number {
  if (dc?.trabajo) {
    return Number(dc.trabajo.totalIngresosIntegros ?? dc.trabajo.retribucionesDinerarias ?? 0);
  }
  if (snapshot) {
    return Number(snapshot[CASILLA_NOMINA_BRUTA_V2] ?? snapshot[CASILLA_NOMINA_BRUTA_V1] ?? 0);
  }
  return 0;
}

/**
 * Autónomo bruto = totalIngresos (antes de retenciones).
 */
function extractAutonomoBruto(dc: any, snapshot?: Record<string, number>): number {
  if (dc?.actividadEconomica) {
    return Number(dc.actividadEconomica.totalIngresos ?? 0);
  }
  if (snapshot) {
    return Number(snapshot[CASILLA_AUTONOMO_INGRESOS] ?? 0);
  }
  return 0;
}

/**
 * Nómina neta = totalIngresosIntegros - retenciones - cotizacionesSS
 * Falls back to casillas snapshot when declaracionCompleta is absent.
 */
function extractNominaNeta(dc: any, snapshot?: Record<string, number>): number {
  if (dc?.trabajo) {
    const bruto = Number(dc.trabajo.totalIngresosIntegros ?? dc.trabajo.retribucionesDinerarias ?? 0);
    const ret   = Number(dc.trabajo.retenciones ?? 0);
    const ss    = Number(dc.trabajo.cotizacionesSS ?? 0);
    return Math.max(0, bruto - ret - ss);
  }
  if (snapshot) {
    const bruto = Number(snapshot[CASILLA_NOMINA_BRUTA_V2] ?? snapshot[CASILLA_NOMINA_BRUTA_V1] ?? 0);
    const ret   = Number(snapshot[CASILLA_NOMINA_RET] ?? 0);
    const ss    = Number(snapshot[CASILLA_NOMINA_SS] ?? 0);
    return Math.max(0, bruto - ret - ss);
  }
  return 0;
}

/**
 * Autónomo neto = totalIngresos - retenciones
 */
function extractAutonomoNeto(dc: any, snapshot?: Record<string, number>): number {
  if (dc?.actividadEconomica) {
    const ingresos    = Number(dc.actividadEconomica.totalIngresos ?? 0);
    const retenciones = Number(dc.actividadEconomica.retenciones ?? 0);
    return Math.max(0, ingresos - retenciones);
  }
  if (snapshot) {
    const ingresos    = Number(snapshot[CASILLA_AUTONOMO_INGRESOS] ?? 0);
    const retenciones = Number(snapshot[CASILLA_AUTONOMO_RET] ?? 0);
    return Math.max(0, ingresos - retenciones);
  }
  return 0;
}

/**
 * Capital mobiliario neto = totalBruto - retenciones (lo que entra en cuenta)
 */
function extractCapitalMobiliario(dc: any): number {
  if (dc?.capitalMobiliario) {
    const bruto       = Number(dc.capitalMobiliario.totalBruto ?? 0);
    const retenciones = Number(dc.capitalMobiliario.retenciones ?? 0);
    return Math.max(0, bruto - retenciones);
  }
  return 0;
}

// ─── Main service ─────────────────────────────────────────────────────────────

export const treasuryOverviewService = {

  async getTreasuryOverview(): Promise<TreasuryYearSummary[]> {
    const db = await initDB();

    // ── 1. ejerciciosFiscalesCoord ───────────────────────────────────────────
    let coords: EjercicioFiscalCoord[] = await db.getAll('ejerciciosFiscalesCoord');
    coords.sort((a, b) => a.año - b.año);
    if (coords.length === 0) return [];

    const añoActual = new Date().getFullYear();
    coords = coords.filter(
      (c) => c.año <= añoActual && (!!c.aeat?.resumen || c.año >= añoActual - 1),
    );

    // resultado por año para IRPF del año siguiente
    const resultadoPorAño: Record<number, number> = {};
    for (const c of coords) {
      if (c.aeat?.resumen?.resultado !== undefined) {
        resultadoPorAño[c.año] = c.aeat.resumen.resultado;
      }
    }

    // ── 2. Fuentes de datos ──────────────────────────────────────────────────
    const [
      contracts,
      gastosInmueble,
      properties,
      propertySales,
      mejorasInmueble,
      inversiones,
      loanSettlements,
    ] = await Promise.all([
      db.getAll('contracts'),
      db.getAll('gastosInmueble'),
      db.getAll('properties'),
      db.getAll('property_sales'),
      db.getAll('mejorasInmueble'),
      db.getAll('inversiones'),
      db.getAll('loan_settlements'),
    ]);

    // ── 3. Préstamos y planes de amortización ────────────────────────────────
    const prestamos = await prestamosService.getAllPrestamos();
    const planesPorPrestamo: Map<string, any> = new Map();
    await Promise.all(
      prestamos.map(async (p) => {
        const plan = await prestamosService.getPaymentPlan(p.id);
        if (plan) planesPorPrestamo.set(p.id, plan);
      }),
    );

    // ── 4. Build summary per year ────────────────────────────────────────────
    const summaries: TreasuryYearSummary[] = [];

    for (const coord of coords) {
      const año    = coord.año;
      const hasAeat = !!coord.aeat?.resumen;
      const fuente: TreasuryYearSummary['fuente'] = hasAeat ? 'xml_aeat' : 'sin_datos';

      // ── BLOQUE 1: OPERATIVO ───────────────────────────────────────────────

      let nominaBruta      = 0;
      let autonomoBruto    = 0;
      let nominaNeta       = 0;
      let autonomoNeto     = 0;
      let capitalMobiliario = 0;

      if (hasAeat) {
        const dc       = coord.aeat!.declaracionCompleta;
        const snapshot = coord.aeat!.snapshot;
        nominaBruta       = extractNominaBruta(dc, snapshot);
        autonomoBruto     = extractAutonomoBruto(dc, snapshot);
        nominaNeta        = extractNominaNeta(dc, snapshot);
        autonomoNeto      = extractAutonomoNeto(dc, snapshot);
        capitalMobiliario = extractCapitalMobiliario(dc);
      }

      // IRPF del año anterior: resultado[año-1]
      let devolucionIrpf = 0;
      let pagoIrpf       = 0;
      const resAnterior  = resultadoPorAño[año - 1];
      if (resAnterior !== undefined) {
        if (resAnterior < 0) devolucionIrpf = Math.abs(resAnterior);
        else if (resAnterior > 0) pagoIrpf  = resAnterior;
      }

      // Rentas alquiler: suma importeDeclarado de todos los contratos del año
      let rentasAlquiler = 0;
      for (const contract of contracts) {
        const ejF = (contract as any).ejerciciosFiscales?.[año];
        if (ejF?.importeDeclarado) rentasAlquiler += ejF.importeDeclarado;
      }

      // Gastos inmuebles: sum excl. amortización ('0117')
      let gastosInmuebles = 0;
      for (const g of gastosInmueble) {
        const gastoYear = (g as any).año ?? (g as any).ejercicio;
        if (gastoYear === año && (g as any).casillaAEAT !== '0117') {
          gastosInmuebles += (g as any).importe ?? 0;
        }
      }

      const subtotalOperativo =
        (nominaNeta + autonomoNeto + rentasAlquiler + capitalMobiliario + devolucionIrpf)
        - (gastosInmuebles + pagoIrpf);

      // ── BLOQUE 2: INVERSIÓN ──────────────────────────────────────────────

      // Compra inmuebles: price + todos los costes de adquisición
      let compraInmuebles = 0;
      for (const prop of properties) {
        if (!(prop as any).purchaseDate) continue;
        const propYear = new Date((prop as any).purchaseDate).getFullYear();
        if (propYear !== año) continue;
        const ac       = (prop as any).acquisitionCosts ?? {};
        const otherSum = ((ac.other ?? []) as Array<{ amount?: number }>)
          .reduce((s, o) => s + (o.amount ?? 0), 0);
        compraInmuebles +=
          (ac.price ?? 0) + (ac.itp ?? 0) + (ac.iva ?? 0)
          + (ac.notary ?? 0) + (ac.registry ?? 0)
          + (ac.management ?? 0) + (ac.psi ?? 0)
          + (ac.realEstate ?? 0) + otherSum;
      }

      // Venta inmuebles: grossProceeds de ventas confirmed
      let ventaInmuebles = 0;
      for (const sale of propertySales) {
        if ((sale as any).status !== 'confirmed' || !(sale as any).saleDate) continue;
        if (new Date((sale as any).saleDate).getFullYear() === año) {
          ventaInmuebles += (sale as any).grossProceeds ?? 0;
        }
      }

      // Mejoras / CAPEX
      let mejorasCapex = 0;
      for (const mejora of mejorasInmueble) {
        if ((mejora as any).ejercicio === año) mejorasCapex += (mejora as any).importe ?? 0;
      }

      // Inversiones: aportaciones y reembolsos del año
      let aportacionesInversiones = 0;
      let recuperacionInversiones = 0;
      for (const inv of inversiones) {
        for (const ap of (inv as any).aportaciones ?? []) {
          if (!ap.fecha) continue;
          if (new Date(ap.fecha).getFullYear() !== año) continue;
          if (ap.tipo === 'aportacion')  aportacionesInversiones += ap.importe ?? 0;
          else if (ap.tipo === 'reembolso') recuperacionInversiones += ap.importe ?? 0;
        }
      }

      const subtotalInversion =
        (ventaInmuebles + recuperacionInversiones)
        - (compraInmuebles + mejorasCapex + aportacionesInversiones);

      // ── BLOQUE 3: FINANCIACIÓN ───────────────────────────────────────────

      let hipotecasRecibidas = 0;
      let prestamosRecibidos = 0;
      for (const p of prestamos) {
        const fechaFirma = (p as any).fechaFirma ?? (p as any).fechaInicio;
        if (!fechaFirma) continue;
        if (new Date(fechaFirma).getFullYear() !== año) continue;
        const principal = (p as any).principalInicial ?? 0;
        // Hipotecas: ambito === 'INMUEBLE' o con inmuebleId
        if ((p as any).ambito === 'INMUEBLE' || (p as any).inmuebleId) {
          hipotecasRecibidas += principal;
        } else {
          prestamosRecibidos += principal;
        }
      }

      // Cuotas: sum cuota de todos los períodos del año
      let cuotasPrestamos = 0;
      for (const [, plan] of planesPorPrestamo) {
        for (const periodo of (plan as any).periodos ?? []) {
          if (!periodo.fechaCargo) continue;
          if (new Date(periodo.fechaCargo).getFullYear() === año) {
            cuotasPrestamos += periodo.cuota ?? 0;
          }
        }
      }

      // Cancelaciones anticipadas
      let cancelacionesPrestamos = 0;
      for (const ls of loanSettlements) {
        if ((ls as any).status !== 'confirmed' || !(ls as any).operationDate) continue;
        if (new Date((ls as any).operationDate).getFullYear() === año) {
          cancelacionesPrestamos += (ls as any).totalCashOut ?? (ls as any).principalApplied ?? 0;
        }
      }

      const subtotalFinanciacion =
        (hipotecasRecibidas + prestamosRecibidos)
        - (cuotasPrestamos + cancelacionesPrestamos);

      // ── RESIDUO: GASTOS PERSONALES ───────────────────────────────────────
      // Todo lo disponible (operativo + inversión + financiación) que no está
      // en otro bloque conocido = gasto personal implícito del año.
      const gastosPersonales =
        subtotalOperativo + subtotalInversion + subtotalFinanciacion;

      // cashflowNeto = variación de saldo de cuentas.
      // Para años históricos sin dato de saldo inicial: 0 (aproximación).
      const cashflowNeto = 0;

      summaries.push({
        año,
        fuente,
        nominaBruta,
        autonomoBruto,
        nominaNeta,
        autonomoNeto,
        rentasAlquiler,
        capitalMobiliario,
        devolucionIrpf,
        pagoIrpf,
        gastosInmuebles,
        subtotalOperativo,
        compraInmuebles,
        ventaInmuebles,
        mejorasCapex,
        aportacionesInversiones,
        recuperacionInversiones,
        subtotalInversion,
        hipotecasRecibidas,
        prestamosRecibidos,
        cuotasPrestamos,
        cancelacionesPrestamos,
        subtotalFinanciacion,
        gastosPersonales,
        cashflowNeto,
      });
    }

    return summaries;
  },

  async getSaldoActual(): Promise<number> {
    const db = await initDB();
    const accounts: any[] = await db.getAll('accounts');
    return accounts
      .filter(
        (a) =>
          !a.deleted_at &&
          a.activa !== false &&
          a.isActive !== false &&
          (a.status == null || a.status === 'ACTIVE'),
      )
      .reduce((sum, a) => sum + (a.balance ?? a.openingBalance ?? 0), 0);
  },
};
