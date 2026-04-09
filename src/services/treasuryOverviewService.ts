/**
 * treasuryOverviewService.ts
 *
 * Reads directly from source stores to build a multi-year treasury overview.
 * NO dependency on treasuryEvents or historicalTreasuryService.
 *
 * Sources per year:
 *  - xml_aeat  → ejerciciosFiscalesCoord[año].aeat
 *  - sin_datos → no aeat, no atlas data
 */

import { initDB } from './db';
import type { EjercicioFiscalCoord } from './db';
import { prestamosService } from './prestamosService';
import { patronGastosPersonalesService } from './patronGastosPersonalesService';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TreasuryYearSummary {
  año: number;
  fuente: 'xml_aeat' | 'sin_datos';

  // Ingresos
  nominaNeta: number;       // trabajo: retribucionesDinerarias - retenciones - cotizacionesSS
  autonomoNeto: number;     // actividadEconomica: totalIngresos - retenciones
  rentasAlquiler: number;   // sum contracts.ejerciciosFiscales[año].importeDeclarado
  devolucionIrpf: number;   // abs(resultado[año-1]) if resultado[año-1] < 0

  // Gastos
  gastosInmuebles: number;  // sum gastosInmueble (excl. casillaAEAT '0117') filtered by año
  cuotasPrestamos: number;  // sum PeriodoPago.cuota where fechaCargo.year === año
  pagoIrpf: number;         // resultado[año-1] if > 0 (paid in June of año)
  gastosPersonales: number; // patronGastosPersonales monthly * 12, or default

  // Totals
  totalIngresos: number;
  totalGastos: number;
  cashflowNeto: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GASTOS_PERSONALES_DEFAULT_MES = 4120; // €/mes (documented default)

// Casilla numbers for snapshot fallback (matches historicalCashflowCalculator.ts)
const CASILLA_NOMINA_BRUTA     = '0003';
const CASILLA_NOMINA_RET       = '0596';
const CASILLA_NOMINA_SS        = '0013';
const CASILLA_AUTONOMO_INGRESOS = 'VE1II1';
const CASILLA_AUTONOMO_RET     = 'RETENED';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract nómina neta from declaracionCompleta.
 * Falls back to casillas snapshot when declaracionCompleta is absent.
 */
function extractNominaNeta(dc: any, snapshot?: Record<string, number>): number {
  if (dc?.trabajo) {
    const bruto = Number(dc.trabajo.retribucionesDinerarias ?? 0);
    const ret   = Number(dc.trabajo.retenciones ?? 0);
    const ss    = Number(dc.trabajo.cotizacionesSS ?? 0);
    return Math.max(0, bruto - ret - ss);
  }
  if (snapshot) {
    const bruto = Number(snapshot[CASILLA_NOMINA_BRUTA] ?? 0);
    const ret   = Number(snapshot[CASILLA_NOMINA_RET] ?? 0);
    const ss    = Number(snapshot[CASILLA_NOMINA_SS] ?? 0);
    return Math.max(0, bruto - ret - ss);
  }
  return 0;
}

/**
 * Extract autónomo neto from declaracionCompleta.
 * Falls back to casillas snapshot when declaracionCompleta is absent.
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

// ─── Main service ─────────────────────────────────────────────────────────────

export const treasuryOverviewService = {

  async getTreasuryOverview(): Promise<TreasuryYearSummary[]> {
    const db = await initDB();

    // ── 1. Load all ejerciciosFiscalesCoord ──────────────────────────────────
    let coords: EjercicioFiscalCoord[] = await db.getAll('ejerciciosFiscalesCoord');
    coords.sort((a, b) => a.año - b.año);

    if (coords.length === 0) return [];

    // Fix 2: only include relevant years
    // Include a year if: it's not in the future AND (it has AEAT data OR it's the current/previous year)
    const añoActual = new Date().getFullYear();
    coords = coords.filter(
      (c) => c.año <= añoActual && (!!c.aeat?.resumen || c.año >= añoActual - 1),
    );

    // Build a lookup: año → resultado (for IRPF assignment to next year)
    const resultadoPorAño: Record<number, number> = {};
    for (const c of coords) {
      if (c.aeat?.resumen?.resultado !== undefined) {
        resultadoPorAño[c.año] = c.aeat.resumen.resultado;
      }
    }

    // ── 2. Load all contracts ────────────────────────────────────────────────
    const contracts: any[] = await db.getAll('contracts');

    // ── 3. Load all gastosInmueble ───────────────────────────────────────────
    const gastosInmueble: any[] = await db.getAll('gastosInmueble');

    // ── 4. Load all prestamos and their payment plans ────────────────────────
    const prestamos = await prestamosService.getAllPrestamos();
    const planesPorPrestamo: Map<string, any> = new Map();
    await Promise.all(
      prestamos.map(async (p) => {
        const plan = await prestamosService.getPaymentPlan(p.id);
        if (plan) planesPorPrestamo.set(p.id, plan);
      })
    );

    // ── 5. Gastos personales estimate ────────────────────────────────────────
    let gastosPersonalesMensuales = GASTOS_PERSONALES_DEFAULT_MES;
    try {
      const perfiles: any[] = await db.getAll('personalData');
      if (perfiles.length > 0) {
        const total = await patronGastosPersonalesService.calcularTotalMensual(perfiles[0].id);
        if (total > 0) gastosPersonalesMensuales = total;
      }
    } catch {
      // fallback to default
    }
    const gastosPersonalesAnual = Math.round(gastosPersonalesMensuales * 12);

    // ── 6. Build summary per year ────────────────────────────────────────────
    const summaries: TreasuryYearSummary[] = [];

    for (const coord of coords) {
      const año = coord.año;
      const hasAeat = !!coord.aeat?.resumen;
      const fuente: TreasuryYearSummary['fuente'] = hasAeat ? 'xml_aeat' : 'sin_datos';

      // — Ingresos —
      let nominaNeta     = 0;
      let autonomoNeto   = 0;
      let rentasAlquiler = 0;
      let devolucionIrpf = 0;

      if (hasAeat) {
        const dc       = coord.aeat!.declaracionCompleta;
        const snapshot = coord.aeat!.snapshot;
        // Use declaracionCompleta when available; fall back to raw casillas snapshot
        nominaNeta   = extractNominaNeta(dc, snapshot);
        autonomoNeto = extractAutonomoNeto(dc, snapshot);
      }

      // devolucionIrpf: resultado of year (año-1) if < 0 (money received this year).
      // Computed regardless of current year's AEAT status.
      const resAnterior = resultadoPorAño[año - 1];
      if (resAnterior !== undefined && resAnterior < 0) {
        devolucionIrpf = Math.abs(resAnterior);
      }

      // rentasAlquiler: sum importeDeclarado from all contracts for this año
      for (const contract of contracts) {
        const ejF = contract.ejerciciosFiscales?.[año];
        if (ejF?.importeDeclarado) {
          rentasAlquiler += ejF.importeDeclarado;
        }
      }

      // — Gastos —
      let gastosInmuebles = 0;
      let cuotasPrestamos = 0;
      let pagoIrpf        = 0;

      // gastosInmuebles: sum importe excluding amortización (casillaAEAT '0117').
      // Legacy records may use `año` instead of `ejercicio` — check both.
      for (const g of gastosInmueble) {
        const gastoYear = (g as any).año ?? g.ejercicio;
        if (gastoYear === año && g.casillaAEAT !== '0117') {
          gastosInmuebles += g.importe ?? 0;
        }
      }

      // cuotasPrestamos: sum cuota total from payment plan periodos in this año
      for (const [, plan] of planesPorPrestamo) {
        for (const periodo of plan.periodos ?? []) {
          if (!periodo.fechaCargo) continue;
          const periodoYear = new Date(periodo.fechaCargo).getFullYear();
          if (periodoYear === año) {
            cuotasPrestamos += periodo.cuota ?? 0;
          }
        }
      }

      // pagoIrpf: resultado of year (año-1) if > 0 (paid in June of año).
      // Computed regardless of current year's AEAT status so current year
      // correctly shows the payment for the prior declared year.
      if (resAnterior !== undefined && resAnterior > 0) {
        pagoIrpf = resAnterior;
      }

      // — Totals —
      const totalIngresos = nominaNeta + autonomoNeto + rentasAlquiler + devolucionIrpf;

      // Fix 3: only include estimated personal expenses for years that have at least one income entry
      const gastosPersonales = totalIngresos > 0 ? gastosPersonalesAnual : 0;

      const totalGastos   = gastosInmuebles + cuotasPrestamos + pagoIrpf + gastosPersonales;
      const cashflowNeto  = totalIngresos - totalGastos;

      summaries.push({
        año,
        fuente,
        nominaNeta,
        autonomoNeto,
        rentasAlquiler,
        devolucionIrpf,
        gastosInmuebles,
        cuotasPrestamos,
        pagoIrpf,
        gastosPersonales,
        totalIngresos,
        totalGastos,
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
