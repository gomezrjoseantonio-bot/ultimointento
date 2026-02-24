// src/modules/horizon/tesoreria/services/treasurySyncService.ts
// ATLAS HORIZON – Treasury Sync Service
// Bridges the forecastEngine with the day-to-day treasury (TreasuryReconciliationView).
// Generates monthly forecast TreasuryEvents from projection rules so that the
// "Previsiones" column is populated automatically.
//
// IMPORTANT: This service DOES NOT calculate any amounts itself.
// It consumes the projection engine (proyeccionMensualService) as the single source
// of truth for all amounts, ensuring the treasury events match the P&L at the cent.

import { initDB } from '../../../../services/db';
import { personalDataService } from '../../../../services/personalDataService';
import { gastosPersonalesService } from '../../../../services/gastosPersonalesService';
import { nominaService } from '../../../../services/nominaService';
import { getAllContracts } from '../../../../services/contractService';
import { prestamosService } from '../../../../services/prestamosService';
import {
  calculateOpexBreakdownForMonth,
  gastoRecurrenteAppliesToMonth,
} from '../../../horizon/proyeccion/mensual/services/forecastEngine';
import {
  calculateLoanPayment,
  PROJECTION_START_YEAR,
} from '../../../horizon/proyeccion/mensual/services/proyeccionMensualService';

/** Result summary returned by generateMonthlyForecasts */
export interface SyncResult {
  created: number;
  skipped: number;
}

/**
 * Pads a day number to a two-digit string.
 * Days are clamped to 28 to ensure validity across all months,
 * including February (the shortest month).
 */
function padDay(day: number): string {
  return String(Math.min(Math.max(day, 1), 28)).padStart(2, '0');
}

/**
 * Builds a representative date string (YYYY-MM-DD) within the given month.
 * Clamps day to 28 to avoid invalid dates in short months.
 */
function buildDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  return `${year}-${mm}-${padDay(day)}`;
}

/**
 * Checks whether a contract is active during the specified calendar month.
 */
function isContractActiveInMonth(
  contract: { fechaInicio: string; fechaFin: string; estadoContrato: string },
  year: number,
  month: number,
): boolean {
  if (contract.estadoContrato === 'rescindido' || contract.estadoContrato === 'finalizado') {
    return false;
  }
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const inicio = new Date(contract.fechaInicio);
  const fin = new Date(contract.fechaFin);
  return monthStart <= fin && monthEnd >= inicio;
}

/**
 * Generates TreasuryEvent forecast records for the given year/month using the
 * forecastEngine rules stored in IndexedDB.
 *
 * Sources covered:
 *  - OpexRules (property operating expenses) → type 'expense', sourceType 'opex_rule'
 *  - GastoRecurrente (personal recurring expenses) → type 'expense', sourceType 'gasto_recurrente'
 *  - Active rental contracts for the month → type 'income', sourceType 'contrato'
 *  - Active nóminas for the month → type 'income', sourceType 'nomina'
 *  - Prestamos (loan quotas) → type 'expense', sourceType 'prestamo'
 *
 * Duplicate prevention: before inserting, we check whether an event with the
 * same sourceType + sourceId already has a predictedDate in the same year-month.
 */
export async function generateMonthlyForecasts(
  year: number,
  month: number,
): Promise<SyncResult> {
  const db = await initDB();
  const now = new Date().toISOString();
  const mm = String(month).padStart(2, '0');
  const monthPrefix = `${year}-${mm}`;

  let created = 0;
  let skipped = 0;

  // Helper: check if a forecast already exists for this sourceType + sourceId in this month
  async function isDuplicate(sourceType: string, sourceId: number | string): Promise<boolean> {
    const existing = await db.getAllFromIndex('treasuryEvents', 'sourceId', sourceId);
    return existing.some(
      e => e.sourceType === sourceType && e.predictedDate.startsWith(monthPrefix),
    );
  }

  // Helper: insert an event and count
  async function insertEvent(event: Parameters<typeof db.add>[1]): Promise<void> {
    await db.add('treasuryEvents', event);
    created++;
  }

  // ── 1. OPEX RULES (property expenses) ─────────────────────────────────────
  try {
    const opexRules = await db.getAll('opexRules');
    const propertyAliasMap = new Map<number, string>();

    // Build alias map from inmuebles (best-effort)
    try {
      const inmuebles = await db.getAll('properties');
      for (const inm of inmuebles) {
        if (inm.id != null) {
          propertyAliasMap.set(inm.id, inm.alias ?? `Inmueble #${inm.id}`);
        }
      }
    } catch {
      // alias map stays empty; forecastEngine falls back to "Inmueble #id"
    }

    const breakdown = calculateOpexBreakdownForMonth(opexRules, month, propertyAliasMap);
    for (const item of breakdown) {
      const rule = opexRules.find(
        r => r.propertyId === item.propertyId && r.concepto === item.concepto,
      );
      if (!rule || rule.id == null) continue;

      if (await isDuplicate('opex_rule', rule.id)) {
        skipped++;
        continue;
      }

      const day = rule.diaCobro ?? 1;
      await insertEvent({
        type: 'expense' as const,
        amount: item.importe,
        predictedDate: buildDate(year, month, day),
        description: `${item.concepto} – ${item.propertyAlias}`,
        sourceType: 'opex_rule' as const,
        sourceId: rule.id,
        accountId: rule.accountId,
        status: 'predicted' as const,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.error('[TreasurySyncService] Error processing opex rules:', err);
  }

  // ── 2. GASTOS RECURRENTES (personal recurring expenses) ───────────────────
  try {
    const personalData = await personalDataService.getPersonalData();
    const personalDataId = personalData?.id ?? 1;
    const gastos = await gastosPersonalesService.getGastosRecurrentesActivos(personalDataId);

    for (const gasto of gastos) {
      if (!gastoRecurrenteAppliesToMonth(gasto, month)) continue;
      if (gasto.id == null) continue;

      if (await isDuplicate('gasto_recurrente', gasto.id)) {
        skipped++;
        continue;
      }

      await insertEvent({
        type: 'expense' as const,
        amount: gasto.importe,
        predictedDate: buildDate(year, month, gasto.diaCobro),
        description: gasto.nombre,
        sourceType: 'gasto_recurrente' as const,
        sourceId: gasto.id,
        accountId: gasto.cuentaPago,
        status: 'predicted' as const,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.error('[TreasurySyncService] Error processing gastos recurrentes:', err);
  }

  // ── 3. CONTRATOS ACTIVOS (rental income) ──────────────────────────────────
  try {
    const contracts = await getAllContracts();
    for (const contract of contracts) {
      if (!isContractActiveInMonth(contract, year, month)) continue;
      if (contract.id == null) continue;

      if (await isDuplicate('contrato', contract.id)) {
        skipped++;
        continue;
      }

      const inquilino =
        `${contract.inquilino?.nombre ?? ''} ${contract.inquilino?.apellidos ?? ''}`.trim() ||
        'Inquilino';
      const day = contract.diaPago ?? 1;

      await insertEvent({
        type: 'income' as const,
        amount: contract.rentaMensual ?? 0,
        predictedDate: buildDate(year, month, day),
        description: `Renta – ${inquilino}`,
        sourceType: 'contrato' as const,
        sourceId: contract.id,
        accountId: contract.cuentaCobroId,
        status: 'predicted' as const,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.error('[TreasurySyncService] Error processing contracts:', err);
  }

  // ── 4. NÓMINAS (salary income) ────────────────────────────────────────────
  try {
    const personalData = await personalDataService.getPersonalData();
    const personalDataId = personalData?.id ?? 1;
    const nominas = await nominaService.getNominas(personalDataId);
    const nominasActivas = nominas.filter(n => n.activa);

    for (const nomina of nominasActivas) {
      if (nomina.id == null) continue;

      if (await isDuplicate('nomina', nomina.id)) {
        skipped++;
        continue;
      }

      const calculo = nominaService.calculateSalary(nomina);
      const mesData = calculo.distribuccionMensual.find(d => d.mes === month);
      if (!mesData || mesData.netoTotal <= 0) continue;

      await insertEvent({
        type: 'income' as const,
        amount: mesData.netoTotal,
        predictedDate: buildDate(year, month, 25),
        description: `Nómina – ${nomina.nombre ?? 'Empresa'}`,
        sourceType: 'nomina' as const,
        sourceId: nomina.id,
        accountId: nomina.cuentaAbono,
        status: 'predicted' as const,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.error('[TreasurySyncService] Error processing nominas:', err);
  }

  // ── 5. FINANCIACIÓN (Cuotas de Préstamos) ───────────────────────────────
  // Consumes the same data source and formula as the projection engine
  // (prestamosService + calculateLoanPayment) to guarantee amounts match
  // the P&L at the cent.
  try {
    const prestamos = await prestamosService.getAllPrestamos();
    // absoluteMonthIndex mirrors the index used by buildMonthRow in the projection engine
    const absoluteMonthIndex = (year - PROJECTION_START_YEAR) * 12 + (month - 1);

    // Prestamos use string UUIDs as IDs, which can't be indexed as numeric sourceId.
    // Build a set of loan descriptions already forecast for this month to avoid duplicates.
    const existingPrestamoDescriptions = new Set<string>(
      (await db.getAll('treasuryEvents'))
        .filter(e => e.sourceType === 'prestamo' && e.predictedDate.startsWith(monthPrefix))
        .map(e => e.description),
    );

    for (const prestamo of prestamos) {
      if (!prestamo.id) continue;

      // Determine the effective annual rate using the same logic as loadDeudaState()
      const annualRatePct =
        prestamo.tipo === 'FIJO'
          ? (prestamo.tipoNominalAnualFijo ?? 0)
          : prestamo.tipo === 'VARIABLE'
            ? (prestamo.valorIndiceActual ?? 0) + (prestamo.diferencial ?? 0)
            : (prestamo.tipoNominalAnualMixtoFijo ?? prestamo.tipoNominalAnualFijo ?? 0);

      const { cuota } = calculateLoanPayment(
        prestamo.principalInicial,
        annualRatePct / 100,
        prestamo.plazoMesesTotal,
        absoluteMonthIndex,
      );

      if (cuota <= 0) continue;

      const description = `Cuota Préstamo – ${prestamo.nombre ?? 'Financiación'}`;

      if (existingPrestamoDescriptions.has(description)) {
        skipped++;
        continue;
      }

      // cuentaCargoId stores the treasury account's numeric ID as a string
      const accountId = prestamo.cuentaCargoId
        ? parseInt(prestamo.cuentaCargoId, 10) || undefined
        : undefined;

      await insertEvent({
        type: 'expense' as const,
        amount: cuota,
        predictedDate: buildDate(year, month, prestamo.diaCargoMes ?? 1),
        description,
        sourceType: 'prestamo' as const,
        sourceId: undefined, // string UUID – incompatible with numeric sourceId field
        accountId,
        status: 'predicted' as const,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.error('[TreasurySyncService] Error processing prestamos:', err);
  }

  return { created, skipped };
}