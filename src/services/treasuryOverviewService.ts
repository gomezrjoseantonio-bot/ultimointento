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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractNominaNeta(declaracionCompleta: any): number {
  const t = declaracionCompleta?.trabajo;
  if (!t) return 0;
  const bruto = t.retribucionesDinerarias ?? 0;
  const ret   = t.retenciones ?? 0;
  const ss    = t.cotizacionesSS ?? 0;
  return Math.max(0, bruto - ret - ss);
}

function extractAutonomoNeto(declaracionCompleta: any): number {
  const a = declaracionCompleta?.actividadEconomica;
  if (!a) return 0;
  const ingresos   = a.totalIngresos ?? 0;
  const retenciones = a.retenciones ?? 0;
  return Math.max(0, ingresos - retenciones);
}

// ─── Main service ─────────────────────────────────────────────────────────────

export const treasuryOverviewService = {

  async getTreasuryOverview(): Promise<TreasuryYearSummary[]> {
    const db = await initDB();

    // ── 1. Load all ejerciciosFiscalesCoord ──────────────────────────────────
    const coords: EjercicioFiscalCoord[] = await db.getAll('ejerciciosFiscalesCoord');
    coords.sort((a, b) => a.año - b.año);

    if (coords.length === 0) return [];

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
        const dc = coord.aeat!.declaracionCompleta;
        nominaNeta   = extractNominaNeta(dc);
        autonomoNeto = extractAutonomoNeto(dc);

        // devolucionIrpf: resultado of year (año-1) if < 0 (you receive it this year)
        const resAnterior = resultadoPorAño[año - 1];
        if (resAnterior !== undefined && resAnterior < 0) {
          devolucionIrpf = Math.abs(resAnterior);
        }
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

      // gastosInmuebles: sum importe excluding amortización (casillaAEAT '0117')
      for (const g of gastosInmueble) {
        if (g.ejercicio === año && g.casillaAEAT !== '0117') {
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

      // pagoIrpf: resultado of year (año-1) if > 0 (paid in June of año)
      if (hasAeat) {
        const resAnterior = resultadoPorAño[año - 1];
        if (resAnterior !== undefined && resAnterior > 0) {
          pagoIrpf = resAnterior;
        }
      }

      const gastosPersonales = gastosPersonalesAnual;

      // — Totals —
      const totalIngresos = nominaNeta + autonomoNeto + rentasAlquiler + devolucionIrpf;
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
      .filter((a) => a.activa !== false && a.status !== 'DELETED')
      .reduce((sum, a) => sum + (a.balance ?? a.openingBalance ?? 0), 0);
  },
};
