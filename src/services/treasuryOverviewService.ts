/**
 * treasuryOverviewService.ts
 *
 * Reads directly from source stores to build a multi-year treasury overview.
 * NO dependency on treasuryEvents or historicalTreasuryService.
 *
 * Classification: Personal / Inmuebles / Inversiones
 *
 * Gasto personal = residuo acumulado distribuido como media mensual
 * (NO es un input, nunca hardcodeado)
 */

import { initDB } from './db';
import type { EjercicioFiscalCoord } from './db';
import { prestamosService } from './prestamosService';
import { getAllLoanSettlements } from './loanSettlementService';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TreasuryYearSummary {
  año: number;
  fuente: 'xml_aeat' | 'atlas_nativo' | 'sin_datos';

  // ── BLOQUE: PERSONAL ──────────────────────────────────────────────────────
  nominaNeta: number;                    // entrada: trabajo neto de retenciones y SS
  autonomoNeto: number;                  // entrada: actividadEconomica neta de retenciones
  devolucionIrpf: number;                // entrada: resultado[año-1] < 0 → cobrado en año
  pagoIrpf: number;                      // salida:  resultado[año-1] > 0 → pagado en año
  prestamosPersonalesRecibidos: number;  // entrada: principal de préstamos personales en año de firma
  cuotasPrestamosPersonales: number;     // salida:  cuotas + cancelaciones de préstamos personales del año
  subtotalPersonal: number;

  // ── BLOQUE: INMUEBLES ─────────────────────────────────────────────────────
  rentasAlquiler: number;                // entrada: importeDeclarado de contratos del año
  gastosInmuebles: number;              // salida:  gastosInmueble excl. amortización (0117)
  compraInmuebles: number;              // salida:  acquisitionCosts en año de purchaseDate
  ventaInmuebles: number;               // entrada: grossProceeds de ventas confirmed
  hipotecasRecibidas: number;           // entrada: principal de hipotecas en año de firma
  cuotasHipotecas: number;              // salida:  cuotas del cuadro de amortización del año
  mejorasCapex: number;                  // salida:  mejorasInmueble por ejercicio
  cancelacionesHipotecas: number;        // salida:  loan_settlements de hipotecas confirmed
  subtotalInmuebles: number;

  // ── BLOQUE: INVERSIONES ──────────────────────────────────────────────────
  capitalMobiliario: number;             // entrada: capitalMobiliario.totalBruto - retenciones
  aportacionesInversiones: number;       // salida:  inversiones aportaciones tipo='aportacion'
  recuperacionInversiones: number;       // entrada: inversiones aportaciones tipo='reembolso'
  subtotalInversiones: number;

  // ── GASTO PERSONAL ───────────────────────────────────────────────────────
  gastoPersonalEstimado: number;         // residuo acumulado distribuido como media mensual × meses
  gastoPersonalReal: number;             // confirmado desde Tesorería activa (0 si no disponible)

  // ── VARIACIÓN NETA ───────────────────────────────────────────────────────
  variacionNeta: number;                 // subtotalPersonal + subtotalInmuebles + subtotalInversiones - gastoPersonalEstimado
}

export interface SaldoActual {
  cuentas: number;
  inversiones: number;
  total: number;
}

// ─── Casilla constants (snapshot fallback) ────────────────────────────────────

const CASILLA_NOMINA_BRUTA_V2   = '0012';
const CASILLA_NOMINA_BRUTA_V1   = '0003';
const CASILLA_NOMINA_RET        = '0596';
const CASILLA_NOMINA_SS         = '0013';
const CASILLA_AUTONOMO_INGRESOS = 'VE1II1';
const CASILLA_AUTONOMO_RET      = 'RETENED';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function extractCapitalMobiliario(dc: any): number {
  if (dc?.capitalMobiliario) {
    const bruto       = Number(dc.capitalMobiliario.totalBruto ?? 0);
    const retenciones = Number(dc.capitalMobiliario.retenciones ?? 0);
    return Math.max(0, bruto - retenciones);
  }
  return 0;
}

function sumCuentas(accounts: any[]): number {
  return accounts
    .filter(
      (a) =>
        !a.deleted_at &&
        a.activa !== false &&
        a.isActive !== false &&
        (a.status == null || a.status === 'ACTIVE'),
    )
    .reduce((s, a) => s + (a.balance ?? a.openingBalance ?? 0), 0);
}

function sumInversionesActivas(inversiones: any[]): number {
  return inversiones
    .filter((inv) => inv.activo !== false)
    .reduce((s, inv) => s + (inv.valor_actual ?? 0), 0);
}

// ─── Main service ─────────────────────────────────────────────────────────────

export const treasuryOverviewService = {

  async getTreasuryOverview(): Promise<TreasuryYearSummary[]> {
    const db = await initDB();

    // ── 1. ejerciciosFiscalesCoord ───────────────────────────────────────────
    let coords: EjercicioFiscalCoord[] = await db.getAll('ejerciciosFiscalesCoord');
    coords.sort((a, b) => a.año - b.año);
    if (coords.length === 0) return [];

    const now       = new Date();
    const añoActual = now.getFullYear();
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
      accounts,
      gastosPersonalesReal,
    ] = await Promise.all([
      db.getAll('contracts'),
      db.getAll('gastosInmueble'),
      db.getAll('properties'),
      db.getAll('property_sales'),
      db.getAll('mejorasInmueble'),
      db.getAll('inversiones'),
      // V63 (sub-tarea 4): el store `loan_settlements` se eliminó; las
      // liquidaciones se leen ahora desde `prestamos.liquidacion[]` vía
      // helper.
      getAllLoanSettlements(),
      db.getAll('accounts'),
      db.getAll('gastosPersonalesReal').catch(() => [] as any[]),
    ]);

    // Build confirmed real personal expenses by year
    const gastosRealesPorAño: Record<number, number> = {};
    for (const g of gastosPersonalesReal as any[]) {
      if (g.ejercicio != null && g.importeReal > 0) {
        gastosRealesPorAño[g.ejercicio] = (gastosRealesPorAño[g.ejercicio] || 0) + g.importeReal;
      }
    }

    // ── 3. Préstamos y planes de amortización ────────────────────────────────
    const prestamos = await prestamosService.getAllPrestamos();
    const planesPorPrestamo: Map<string, any> = new Map();
    await Promise.all(
      prestamos.map(async (p) => {
        const plan = await prestamosService.getPaymentPlan(p.id);
        if (plan) planesPorPrestamo.set(p.id, plan);
      }),
    );

    // Clasificar préstamos: hipotecas (INMUEBLE) vs personales
    const hipotecaIds = new Set<string>(
      (prestamos as any[])
        .filter((p) => p.ambito === 'INMUEBLE' || (p.inmuebleId && p.inmuebleId !== 'standalone'))
        .map((p) => String(p.id)),
    );

    // ── 4. Build partials per year (sin gastoPersonal) ───────────────────────

    type PartialYear = Omit<TreasuryYearSummary, 'gastoPersonalEstimado' | 'gastoPersonalReal' | 'variacionNeta'>;
    const partials: PartialYear[] = [];

    for (const coord of coords) {
      const año     = coord.año;
      const hasAeat = !!coord.aeat?.resumen;
      const fuente: TreasuryYearSummary['fuente'] = hasAeat ? 'xml_aeat' : 'sin_datos';

      // ── BLOQUE: PERSONAL ─────────────────────────────────────────────────

      let nominaNeta    = 0;
      let autonomoNeto  = 0;

      if (hasAeat) {
        const dc       = coord.aeat!.declaracionCompleta;
        const snapshot = coord.aeat!.snapshot;
        nominaNeta   = extractNominaNeta(dc, snapshot);
        autonomoNeto = extractAutonomoNeto(dc, snapshot);
      }

      let devolucionIrpf = 0;
      let pagoIrpf       = 0;
      const resAnterior  = resultadoPorAño[año - 1];
      if (resAnterior !== undefined) {
        if (resAnterior < 0) devolucionIrpf = Math.abs(resAnterior);
        else if (resAnterior > 0) pagoIrpf  = resAnterior;
      }

      let prestamosPersonalesRecibidos = 0;
      for (const p of prestamos as any[]) {
        const fechaFirma = p.fechaFirma ?? p.fechaInicio;
        if (!fechaFirma) continue;
        if (new Date(fechaFirma).getFullYear() !== año) continue;
        if (!hipotecaIds.has(String(p.id))) {
          prestamosPersonalesRecibidos += p.principalInicial ?? 0;
        }
      }

      let cuotasPrestamosPersonales = 0;
      for (const [prestamoId, plan] of planesPorPrestamo) {
        if (hipotecaIds.has(prestamoId)) continue;
        for (const periodo of (plan as any).periodos ?? []) {
          if (!periodo.fechaCargo) continue;
          if (new Date(periodo.fechaCargo).getFullYear() === año) {
            cuotasPrestamosPersonales += periodo.cuota ?? 0;
          }
        }
      }
      // Cancelaciones de préstamos personales → sumadas como salida personal
      for (const ls of loanSettlements as any[]) {
        if (ls.status !== 'confirmed' || !ls.operationDate) continue;
        if (new Date(ls.operationDate).getFullYear() !== año) continue;
        if (!hipotecaIds.has(String(ls.loanId))) {
          cuotasPrestamosPersonales += ls.totalCashOut ?? ls.principalApplied ?? 0;
        }
      }

      const subtotalPersonal =
        (nominaNeta + autonomoNeto + devolucionIrpf + prestamosPersonalesRecibidos)
        - (pagoIrpf + cuotasPrestamosPersonales);

      // ── BLOQUE: INMUEBLES ────────────────────────────────────────────────

      let rentasAlquiler = 0;
      for (const contract of contracts as any[]) {
        const ejF = contract.ejerciciosFiscales?.[año];
        if (ejF?.importeDeclarado) rentasAlquiler += ejF.importeDeclarado;
      }

      let gastosInmuebles = 0;
      for (const g of gastosInmueble as any[]) {
        const gastoYear = g.año ?? g.ejercicio;
        if (gastoYear === año && g.casillaAEAT !== '0117') {
          gastosInmuebles += g.importe ?? 0;
        }
      }

      let compraInmuebles = 0;
      for (const prop of properties as any[]) {
        if (!prop.purchaseDate) continue;
        if (new Date(prop.purchaseDate).getFullYear() !== año) continue;
        const ac       = prop.acquisitionCosts ?? {};
        const otherSum = ((ac.other ?? []) as Array<{ amount?: number }>)
          .reduce((s, o) => s + (o.amount ?? 0), 0);
        compraInmuebles +=
          (ac.price ?? 0) + (ac.itp ?? 0) + (ac.iva ?? 0)
          + (ac.notary ?? 0) + (ac.registry ?? 0)
          + (ac.management ?? 0) + (ac.psi ?? 0)
          + (ac.realEstate ?? 0) + otherSum;
      }

      let ventaInmuebles = 0;
      for (const sale of propertySales as any[]) {
        if (sale.status !== 'confirmed' || !sale.saleDate) continue;
        if (new Date(sale.saleDate).getFullYear() === año) {
          ventaInmuebles += sale.grossProceeds ?? 0;
        }
      }

      let hipotecasRecibidas = 0;
      for (const p of prestamos as any[]) {
        const fechaFirma = p.fechaFirma ?? p.fechaInicio;
        if (!fechaFirma) continue;
        if (new Date(fechaFirma).getFullYear() !== año) continue;
        if (hipotecaIds.has(String(p.id))) {
          hipotecasRecibidas += p.principalInicial ?? 0;
        }
      }

      let cuotasHipotecas = 0;
      for (const [prestamoId, plan] of planesPorPrestamo) {
        if (!hipotecaIds.has(prestamoId)) continue;
        for (const periodo of (plan as any).periodos ?? []) {
          if (!periodo.fechaCargo) continue;
          if (new Date(periodo.fechaCargo).getFullYear() === año) {
            cuotasHipotecas += periodo.cuota ?? 0;
          }
        }
      }

      let mejorasCapex = 0;
      for (const mejora of mejorasInmueble as any[]) {
        if (mejora.ejercicio === año) mejorasCapex += mejora.importe ?? 0;
      }

      let cancelacionesHipotecas = 0;
      for (const ls of loanSettlements as any[]) {
        if (ls.status !== 'confirmed' || !ls.operationDate) continue;
        if (new Date(ls.operationDate).getFullYear() !== año) continue;
        if (hipotecaIds.has(String(ls.loanId))) {
          cancelacionesHipotecas += ls.totalCashOut ?? ls.principalApplied ?? 0;
        }
      }

      const subtotalInmuebles =
        (rentasAlquiler + ventaInmuebles + hipotecasRecibidas)
        - (gastosInmuebles + compraInmuebles + cuotasHipotecas + mejorasCapex + cancelacionesHipotecas);

      // ── BLOQUE: INVERSIONES ──────────────────────────────────────────────

      let capitalMobiliario       = 0;
      let aportacionesInversiones = 0;
      let recuperacionInversiones = 0;

      if (hasAeat) {
        capitalMobiliario = extractCapitalMobiliario(coord.aeat!.declaracionCompleta);
      }

      for (const inv of inversiones as any[]) {
        for (const ap of inv.aportaciones ?? []) {
          if (!ap.fecha) continue;
          if (new Date(ap.fecha).getFullYear() !== año) continue;
          if (ap.tipo === 'aportacion')   aportacionesInversiones += ap.importe ?? 0;
          else if (ap.tipo === 'reembolso') recuperacionInversiones += ap.importe ?? 0;
        }
      }

      const subtotalInversiones =
        (capitalMobiliario + recuperacionInversiones)
        - aportacionesInversiones;

      partials.push({
        año,
        fuente,
        nominaNeta,
        autonomoNeto,
        devolucionIrpf,
        pagoIrpf,
        prestamosPersonalesRecibidos,
        cuotasPrestamosPersonales,
        subtotalPersonal,
        rentasAlquiler,
        gastosInmuebles,
        compraInmuebles,
        ventaInmuebles,
        hipotecasRecibidas,
        cuotasHipotecas,
        mejorasCapex,
        cancelacionesHipotecas,
        subtotalInmuebles,
        capitalMobiliario,
        aportacionesInversiones,
        recuperacionInversiones,
        subtotalInversiones,
      });
    }

    // ── 5. Gasto personal acumulado → distribuido como media mensual ─────────

    const totalEntradas = partials.reduce(
      (s, y) =>
        s + y.nominaNeta + y.autonomoNeto + y.rentasAlquiler + y.capitalMobiliario
          + y.devolucionIrpf + y.ventaInmuebles + y.hipotecasRecibidas
          + y.prestamosPersonalesRecibidos + y.recuperacionInversiones,
      0,
    );

    const totalSalidas = partials.reduce(
      (s, y) =>
        s + y.gastosInmuebles + y.pagoIrpf + y.cuotasPrestamosPersonales + y.cuotasHipotecas
          + y.cancelacionesHipotecas + y.compraInmuebles + y.mejorasCapex + y.aportacionesInversiones,
      0,
    );

    const saldoCuentas    = sumCuentas(accounts as any[]);
    const saldoInversiones = sumInversionesActivas(inversiones as any[]);
    const saldoTotal       = saldoCuentas + saldoInversiones;

    const gastoPersonalTotal = Math.max(0, totalEntradas - totalSalidas - saldoTotal);

    // Meses realmente asignados a los años presentes en partials (al menos 1).
    // Usando la suma real en lugar de un span para evitar desajuste cuando faltan años.
    const getMesesAsignados = (año: number) => (año < añoActual ? 12 : now.getMonth() + 1);
    const mesesPeriodo = Math.max(
      1,
      partials.reduce((acc, p) => acc + getMesesAsignados(p.año), 0),
    );
    const gastoMensual = gastoPersonalTotal / mesesPeriodo;

    // ── 6. Distribuir gasto personal y calcular variación neta ──────────────

    const summaries: TreasuryYearSummary[] = partials.map((p) => {
      const meses = getMesesAsignados(p.año);
      const gastoPersonalEstimado = gastoMensual * meses;
      const gastoPersonalReal = gastosRealesPorAño[p.año] || 0;
      const gastoEfectivo = gastoPersonalReal > 0 ? gastoPersonalReal : gastoPersonalEstimado;
      const variacionNeta =
        p.subtotalPersonal + p.subtotalInmuebles + p.subtotalInversiones - gastoEfectivo;
      return {
        ...p,
        gastoPersonalEstimado,
        gastoPersonalReal,
        variacionNeta,
      };
    });

    return summaries;
  },

  async getSaldoActual(): Promise<SaldoActual> {
    const db = await initDB();
    const [accounts, inversiones] = await Promise.all([
      db.getAll('accounts'),
      db.getAll('inversiones'),
    ]);
    return {
      cuentas:    sumCuentas(accounts as any[]),
      inversiones: sumInversionesActivas(inversiones as any[]),
      total:      sumCuentas(accounts as any[]) + sumInversionesActivas(inversiones as any[]),
    };
  },
};
