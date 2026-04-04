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
import { patronGastosPersonalesService } from '../../../../services/patronGastosPersonalesService';
import { nominaService } from '../../../../services/nominaService';
import { getAllContracts } from '../../../../services/contractService';
import { prestamosService } from '../../../../services/prestamosService';
import { autonomoService } from '../../../../services/autonomoService';
import { inversionesService } from '../../../../services/inversionesService';
import { cuentasService } from '../../../../services/cuentasService';
import { otrosIngresosService } from '../../../../services/otrosIngresosService';
import { rollForwardAccountBalancesToMonth } from '../../../../services/accountBalanceService';
import {
  calculateOpexBreakdownForMonth,
  gastoRecurrenteAppliesToMonth,
  personalExpenseAppliesToMonth,
  getPersonalExpenseAmountForMonth,
} from '../../../horizon/proyeccion/mensual/services/forecastEngine';
import {
  ConfiguracionFiscal,
  TRAMOS_AHORRO_2026,
} from '../../../../types/inversiones-extended';
import {
  getBusinessDayForRule,
  getPropertyLiteral,
} from './treasurySyncHelpers';

// All months of the year – used as default when a source has no specific month filter
const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Result summary returned by generateMonthlyForecasts */
export interface SyncResult {
  created: number;
  skipped: number;
  updated: number;
}

/**
 * Builds a representative date string (YYYY-MM-DD) within the given month.
 * Supports configured payment days 1-31 and only adjusts when a specific month
 * does not contain that day (e.g. 31 → 30 in April, 29/30/31 → 28/29 in February).
 */
function buildDate(year: number, month: number, day: number): string {
  const safeMonth = Math.min(Math.max(month, 1), 12);
  const normalizedDay = Math.min(Math.max(day, 1), 31);
  const lastDayOfMonth = new Date(year, safeMonth, 0).getDate();
  const effectiveDay = Math.min(normalizedDay, lastDayOfMonth);

  const mm = String(safeMonth).padStart(2, '0');
  const dd = String(effectiveDay).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function otrosIngresosAppliesToMonth(
  ingreso: { frecuencia: string; fechaInicio?: string; fechaFin?: string },
  year: number,
  month: number,
): boolean {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  if (ingreso.fechaInicio && monthKey < ingreso.fechaInicio) return false;
  if (ingreso.fechaFin && monthKey > ingreso.fechaFin) return false;

  switch (ingreso.frecuencia) {
    case 'mensual':
      return true;
    case 'trimestral':
      return month % 3 === 0;
    case 'semestral':
      return month % 6 === 0;
    case 'anual':
      return month === 12;
    default:
      return false;
  }
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
 *  - Hipotecas (mortgage quotas) → type 'financing', sourceType 'hipoteca'
 *  - Préstamos (personal loan quotas) → type 'financing', sourceType 'prestamo'
 *  - Autónomo income (fuentesIngreso) → type 'income', sourceType 'autonomo_ingreso'
 *  - Autónomo expenses (gastosRecurrentesActividad + cuotaAutonomos) → type 'expense', sourceType 'autonomo'
 *  - Investment interest/dividends → type 'income', sourceType 'inversion'
 *  - Otros ingresos recurrentes → type 'income', sourceType 'otros_ingresos'
 *
 * Duplicate prevention: before inserting, we check whether an event with the
 * same sourceType + sourceId already has a predictedDate in the same year-month.
 */

/**
 * Returns the liquidation amount for a position based on the plan.
 * If liquidacion_total is true, returns the current position value; otherwise
 * returns the explicitly set importe_estimado (falling back to valor_actual).
 */
function getLiquidationAmount(
  plan: { liquidacion_total: boolean; importe_estimado?: number },
  valorActual: number,
): number {
  return plan.liquidacion_total ? valorActual : (plan.importe_estimado ?? valorActual);
}

export async function generateMonthlyForecasts(
  year: number,
  month: number,
): Promise<SyncResult> {
  const db = await initDB();
  const now = new Date().toISOString();
  const mm = String(month).padStart(2, '0');
  const monthPrefix = `${year}-${mm}`;

  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Ensure each month's opening balance starts from prior months' net available balance.
  await rollForwardAccountBalancesToMonth(year, month);

  // Helper: check if a forecast already exists for this sourceType + sourceId in this month
  async function isDuplicate(sourceType: string, sourceId: number | string): Promise<boolean> {
    const existing = await db.getAllFromIndex('treasuryEvents', 'sourceId', sourceId);
    return existing.some(e =>
      e.sourceType === sourceType &&
      e.predictedDate.startsWith(monthPrefix) &&
      e.status === 'confirmed',
    );
  }

  // Helper: upsert an event by sourceType/sourceId for the month
  async function insertEvent(event: Parameters<typeof db.add>[1]): Promise<void> {
    const sourceId = (event as { sourceId?: number | string }).sourceId;
    const sourceType = (event as { sourceType?: string }).sourceType;
    if (sourceId != null && sourceType) {
      const existing = await db.getAllFromIndex('treasuryEvents', 'sourceId', sourceId);
      const currentMonthEvent = existing.find(
        e => e.sourceType === sourceType && e.predictedDate.startsWith(monthPrefix),
      );
      if (currentMonthEvent) {
        if (currentMonthEvent.status === 'confirmed') {
          skipped++;
          return;
        }
        await db.put('treasuryEvents', {
          ...currentMonthEvent,
          ...event,
          id: currentMonthEvent.id,
          updatedAt: now,
        });
        updated++;
        return;
      }
    }

    await db.add('treasuryEvents', { ...event, updatedAt: now });
    created++;
  }

  // ── ACCOUNT ID RESOLUTION ─────────────────────────────────────────────────
  // NominaForm and ContractsNuevo use cuentasService (localStorage) which assigns
  // timestamp-based IDs (e.g., 1708726312345), while TreasuryReconciliationView
  // displays accounts by their IndexedDB autoincrement IDs (1, 2, 3, …).
  // Build an IBAN-keyed lookup so that localStorage account IDs are resolved to
  // the correct IndexedDB account ID before being injected into TreasuryEvents.
  const dbAccounts = await db.getAll('accounts');
  const localToDbAccountId = new Map<number, number>();
  try {
    const localAccounts = await cuentasService.list();
    for (const localAcc of localAccounts) {
      if (localAcc.id == null || !localAcc.iban) continue;
      const dbAcc = dbAccounts.find(a => a.iban === localAcc.iban);
      if (dbAcc?.id != null) {
        localToDbAccountId.set(localAcc.id, dbAcc.id);
      }
    }
  } catch {
    // If cuentasService is unavailable the map stays empty; accounts may not
    // resolve but events are still created (orphaned rather than erroring out).
  }

  /**
   * Translates a raw account ID (which may be a localStorage timestamp ID or an
   * IndexedDB autoincrement ID) to the canonical IndexedDB account ID used by
   * TreasuryReconciliationView.
   *
   * Resolution order:
   *  1. localStorage ID → IndexedDB ID (via IBAN lookup map)
   *  2. Already a valid IndexedDB ID (identity, for forms that load from IndexedDB)
   *  3. undefined (no match – event is created without account linkage)
   */
  function resolveAccountId(rawId: number | undefined): number | undefined {
    if (rawId == null || rawId === 0) return undefined;
    // Step 1: check localStorage → IndexedDB map
    const mapped = localToDbAccountId.get(rawId);
    if (mapped != null) return mapped;
    // Step 2: rawId might already be a valid IndexedDB account ID
    const directMatch = dbAccounts.find(acc => acc.id === rawId);
    return directMatch?.id;
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
          propertyAliasMap.set(inm.id, getPropertyLiteral(inm));
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

  // ── 2. PATRON GASTOS PERSONALES (spending patterns → forecast events) ─────
  // NOTE: gastosRecurrentes (legacy store) is deprecated. All personal spending
  // patterns now come from patronGastosPersonales (was personalExpenses).
  try {
    const personalData = await personalDataService.getPersonalData();
    const personalDataId = personalData?.id ?? 1;
    const personalHousingAddress = personalData?.direccion?.trim() || '';
    const allPersonalExpenses = await patronGastosPersonalesService.getPatrones(personalDataId);
    const activePersonalExpenses = allPersonalExpenses.filter(e => e.activo);
    const accounts = await db.getAll('accounts');
    const accountsById = new Map(accounts.map((acc) => [acc.id, acc]));
    const cardReceipts = new Map<string, {
      accountId: number;
      sourceId: number;
      amount: number;
      description: string;
      predictedDate: string;
      hasHousingExpense: boolean;
    }>();

    for (const expense of activePersonalExpenses) {
      if (!personalExpenseAppliesToMonth(expense, month)) continue;
      if (expense.id == null) continue;

      if (await isDuplicate('personal_expense', expense.id)) {
        skipped++;
        continue;
      }

      const amount = getPersonalExpenseAmountForMonth(expense, month);
      if (amount <= 0) continue;
      const isHousingCategory = expense.categoria === 'vivienda';
      const personalExpenseDescription =
        isHousingCategory && personalHousingAddress
          ? `${expense.concepto} – ${personalHousingAddress}`
          : expense.concepto;

      const account = expense.accountId ? accountsById.get(expense.accountId) : undefined;
      const isCreditCard = account?.tipo === 'TARJETA_CREDITO' && account.cardConfig;

      if (isCreditCard && account?.id != null && account.cardConfig) {
        const chargeAccountId = account.cardConfig.chargeAccountId;
        const settlementDay = Math.min(31, Math.max(1, account.cardConfig.settlementDay || 1));
        const resolvedAccountId = resolveAccountId(chargeAccountId) ?? account.id;
        const receiptDate = buildDate(year, month, settlementDay);
        const key = `${account.id}-${year}-${month}`;
        const existing = cardReceipts.get(key);

        if (existing) {
          existing.amount += amount;
          existing.hasHousingExpense = existing.hasHousingExpense || isHousingCategory;
        } else {
          cardReceipts.set(key, {
            accountId: resolvedAccountId,
            sourceId: account.id,
            amount,
            description: `Recibo tarjeta ${account.alias || `#${account.id}`}`,
            predictedDate: receiptDate,
            hasHousingExpense: isHousingCategory,
          });
        }
        continue;
      }

      await insertEvent({
        type: 'expense' as const,
        amount,
        predictedDate: buildDate(year, month, expense.diaPago ?? 1),
        description: personalExpenseDescription,
        sourceType: 'personal_expense' as const,
        sourceId: expense.id,
        accountId: expense.accountId,
        status: 'predicted' as const,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const receipt of Array.from(cardReceipts.values())) {
      const receiptDescription =
        receipt.hasHousingExpense && personalHousingAddress
          ? `${receipt.description} – ${personalHousingAddress}`
          : receipt.description;
      await insertEvent({
        type: 'expense' as const,
        amount: receipt.amount,
        predictedDate: receipt.predictedDate,
        description: receiptDescription,
        sourceType: 'personal_expense' as const,
        sourceId: receipt.sourceId,
        accountId: receipt.accountId,
        status: 'predicted' as const,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.error('[TreasurySyncService] Error processing personal expenses:', err);
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

      const periodKey = `${year}-${String(month).padStart(2, '0')}`;
      const rentEntries = await db.getAllFromIndex('rentaMensual', 'contratoId', contract.id);
      const rentEntryForMonth = rentEntries.find(entry => entry.periodo === periodKey);
      const amount = rentEntryForMonth?.importePrevisto ?? contract.rentaMensual ?? 0;

      await insertEvent({
        type: 'income' as const,
        amount,
        predictedDate: buildDate(year, month, day),
        description: `Renta – ${inquilino}`,
        sourceType: 'contrato' as const,
        sourceId: contract.id,
        accountId: resolveAccountId(contract.cuentaCobroId),
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
      const mesData = calculo.distribucionMensual.find(d => d.mes === month);
      if (!mesData || mesData.netoTotal <= 0) continue;

      await insertEvent({
        type: 'income' as const,
        amount: mesData.netoTotal,
        predictedDate: buildDate(year, month, 25),
        description: `Nómina – ${nomina.nombre ?? 'Empresa'}`,
        sourceType: 'nomina' as const,
        sourceId: nomina.id,
        accountId: resolveAccountId(nomina.cuentaAbono),
        status: 'predicted' as const,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.error('[TreasurySyncService] Error processing nominas:', err);
  }

  // ── 4b. OTROS INGRESOS (recurrent income) ─────────────────────────────────
  try {
    const personalData = await personalDataService.getPersonalData();
    const personalDataId = personalData?.id ?? 1;
    const otrosIngresos = await otrosIngresosService.getOtrosIngresos(personalDataId);

    for (const ingreso of otrosIngresos) {
      if (!ingreso.activo || ingreso.frecuencia === 'unico') continue;
      if (ingreso.id == null) continue;
      if (!otrosIngresosAppliesToMonth(ingreso, year, month)) continue;

      if (await isDuplicate('otros_ingresos', ingreso.id)) {
        skipped++;
        continue;
      }

      await insertEvent({
        type: 'income' as const,
        amount: ingreso.importe,
        predictedDate: buildDate(year, month, ingreso.reglasDia?.dia ?? 1),
        description: `Otros ingresos – ${ingreso.nombre ?? ingreso.tipo}`,
        sourceType: 'otros_ingresos' as const,
        sourceId: ingreso.id,
        accountId: resolveAccountId(ingreso.cuentaCobro),
        status: 'predicted' as const,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.error('[TreasurySyncService] Error processing otros ingresos:', err);
  }

  // ── 5. FINANCIACIÓN (Cuotas de Hipotecas y Préstamos) ────────────────────
  // Uses the same amortization schedules persisted by prestamosService so treasury
  // and projection consume exactly the same per-month installment source.
  try {
    const prestamos = await prestamosService.getAllPrestamos();

    const existingFinancingEvents = (await db.getAll('treasuryEvents')).filter(
      e =>
        (e.sourceType === 'hipoteca' || e.sourceType === 'prestamo') &&
        e.predictedDate.startsWith(monthPrefix),
    );

    for (const prestamo of prestamos) {
      if (!prestamo.id) continue;
      const legacyState = (prestamo as any).estado;
      if (prestamo.activo === false || legacyState === 'cancelado') {
        continue;
      }

      const plan = await prestamosService.getPaymentPlan(prestamo.id);
      const currentPeriodo = plan?.periodos.find(
        p => p.fechaCargo.startsWith(monthPrefix) && !p.pagado,
      );
      const cuota = currentPeriodo?.cuota ?? 0;
      if (cuota <= 0) continue;

      // Differentiate hipotecas (linked to a property) from personal loans.
      // Prefer `ambito` as source of truth, fallback to legacy `inmuebleId` sentinel.
      const isHipoteca = prestamo.ambito
        ? prestamo.ambito === 'INMUEBLE'
        : Boolean(prestamo.inmuebleId && prestamo.inmuebleId !== 'standalone');
      const sourceType = isHipoteca ? 'hipoteca' as const : 'prestamo' as const;
      const label = isHipoteca ? 'Hipoteca' : 'Préstamo';
      const description = `Cuota ${label} – ${prestamo.nombre ?? 'Financiación'}`;

      const existingByDescription = existingFinancingEvents.find(e => e.description === description);
      if (existingByDescription?.status === 'confirmed') {
        skipped++;
        continue;
      }

      // cuentaCargoId stores the account ID either as an IndexedDB autoincrement ID
      // (when set via PrestamoForm which loads from IndexedDB) or as a string of a
      // localStorage timestamp ID (when set via IdentificacionBlock which uses cuentasService).
      // resolveAccountId handles both cases via the IBAN-keyed lookup map.
      const rawAccountId = prestamo.cuentaCargoId
        ? parseInt(prestamo.cuentaCargoId, 10) || undefined
        : undefined;
      const accountId = resolveAccountId(rawAccountId);

      if (existingByDescription) {
        await db.put('treasuryEvents', {
          ...existingByDescription,
          type: 'financing' as const,
          amount: cuota,
          predictedDate: currentPeriodo?.fechaCargo ?? buildDate(year, month, prestamo.diaCargoMes ?? 1),
          description,
          sourceType,
          accountId,
          prestamoId: prestamo.id,
          numeroCuota: currentPeriodo?.periodo,
          updatedAt: now,
        });
        updated++;
      } else {
        await insertEvent({
          type: 'financing' as const,
          amount: cuota,
          predictedDate: currentPeriodo?.fechaCargo ?? buildDate(year, month, prestamo.diaCargoMes ?? 1),
          description,
          sourceType,
          sourceId: undefined, // string UUID – incompatible with numeric sourceId field
          accountId,
          status: 'predicted' as const,
          prestamoId: prestamo.id,
          numeroCuota: currentPeriodo?.periodo,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  } catch (err) {
    console.error('[TreasurySyncService] Error processing prestamos:', err);
  }

  // ── 6a. AUTÓNOMO – Ingresos facturados (freelance income) ────────────────
  try {
    const personalData = await personalDataService.getPersonalData();
    const personalDataId = personalData?.id ?? 1;
    const autonomos = await autonomoService.getAutonomos(personalDataId);
    const autonomoActivo = autonomos.find(a => a.activo);

    if (autonomoActivo) {
      const accountId = resolveAccountId(autonomoActivo.cuentaPago ?? autonomoActivo.cuentaCobro);
      const fuentes = autonomoActivo.fuentesIngreso ?? [];

      for (let index = 0; index < fuentes.length; index++) {
        const fuente = fuentes[index];
        const activeMeses = fuente.meses?.length ? fuente.meses : ALL_MONTHS;
        if (!activeMeses.includes(month) || (fuente.importeEstimado ?? 0) <= 0) continue;

        const sourceId = `${autonomoActivo.id}-fuente-${fuente.id ?? index}`;
        if (await isDuplicate('autonomo_ingreso', sourceId)) {
          skipped++;
          continue;
        }

        await insertEvent({
          type: 'income' as const,
          amount: fuente.importeEstimado,
          predictedDate: buildDate(year, month, fuente.diaCobro ?? 1),
          description: `${fuente.nombre || 'Ingreso autónomo'} – ${autonomoActivo.nombre}`,
          sourceType: 'autonomo_ingreso' as const,
          sourceId,
          accountId,
          status: 'predicted' as const,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  } catch (err) {
    console.error('[TreasurySyncService] Error processing autonomo ingresos:', err);
  }

  // ── 6b. AUTÓNOMO – Gastos actividad + Cuota SS (freelance expenses) ───────
  // Create one treasury event per item so the movement list shows full detail.
  try {
    const personalData = await personalDataService.getPersonalData();
    const personalDataId = personalData?.id ?? 1;
    const autonomos = await autonomoService.getAutonomos(personalDataId);
    const autonomoActivo = autonomos.find(a => a.activo);

    if (autonomoActivo) {
      const cuotaPredictedDate = getBusinessDayForRule(year, month, autonomoActivo.reglaPagoDia, 5);
      const paymentAccountId = resolveAccountId(autonomoActivo.cuentaPago);

      const recurrentes = autonomoActivo.gastosRecurrentesActividad ?? [];
      for (let index = 0; index < recurrentes.length; index++) {
        const gasto = recurrentes[index];
        if (gasto.importe <= 0) continue;
        const activeMeses = gasto.meses?.length ? gasto.meses : ALL_MONTHS;
        if (!activeMeses.includes(month)) continue;

        const sourceId = `${autonomoActivo.id}-gasto-${gasto.id ?? index}`;
        if (await isDuplicate('autonomo_gasto', sourceId)) {
          skipped++;
          continue;
        }

        await insertEvent({
          type: 'expense' as const,
          amount: gasto.importe,
          predictedDate: buildDate(year, month, gasto.diaPago ?? 1),
          description: `${gasto.descripcion || 'Gasto actividad'} – ${autonomoActivo.nombre}`,
          sourceType: 'autonomo_gasto' as const,
          sourceId,
          accountId: paymentAccountId,
          status: 'predicted' as const,
          createdAt: now,
          updatedAt: now,
        });
      }

      if ((autonomoActivo.cuotaAutonomos ?? 0) > 0) {
        const sourceId = `${autonomoActivo.id}-cuota`;
        if (await isDuplicate('autonomo_cuota', sourceId)) {
          skipped++;
        } else {
          await insertEvent({
            type: 'expense' as const,
            amount: autonomoActivo.cuotaAutonomos,
            predictedDate: cuotaPredictedDate,
            description: `Cuota autónomos – ${autonomoActivo.nombre}`,
            sourceType: 'autonomo_cuota' as const,
            sourceId,
            accountId: paymentAccountId,
            status: 'predicted' as const,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // FALLBACK: if new model arrays are empty, emit legacy monthly split per concept
      const hasNewModel = recurrentes.length > 0 || (autonomoActivo.cuotaAutonomos ?? 0) > 0;
      if (!hasNewModel) {
        const legacyGastos = autonomoActivo.gastosDeducibles ?? [];
        for (let index = 0; index < legacyGastos.length; index++) {
          const gasto = legacyGastos[index];
          const monthlyAmount = gasto.importe / 12;
          if (monthlyAmount <= 0) continue;

          const sourceId = `${autonomoActivo.id}-legacy-${gasto.id ?? index}`;
          if (await isDuplicate('autonomo_gasto_legacy', sourceId)) {
            skipped++;
            continue;
          }

          await insertEvent({
            type: 'expense' as const,
            amount: monthlyAmount,
            predictedDate: cuotaPredictedDate,
            description: `${gasto.descripcion || 'Gasto deducible'} – ${autonomoActivo.nombre}`,
            sourceType: 'autonomo_gasto_legacy' as const,
            sourceId,
            accountId: paymentAccountId,
            status: 'predicted' as const,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }
  } catch (err) {
    console.error('[TreasurySyncService] Error processing autonomo gastos:', err);
  }

  // ── 7. INVERSIONES – Ciclo de vida completo (①②③④) ───────────────────────
  //
  // Logic: only generate TreasuryEvents for dates >= today.
  // "Pleistoceno" profile: past dates → no events.
  // "Previsor" profile: future dates → events are generated.
  //
  // Bloque ① CREACIÓN (expense events)
  // Bloque ② VIDA – rendimientos/dividendos (income events)
  // Bloque ③ LIQUIDACIÓN (income events)
  // Bloque ④ FISCALIDAD IRPF (expense/income event, once per fiscal year)
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const posiciones = await inversionesService.getPosiciones();

    for (const pos of posiciones) {
      const posAny = pos as any;

      // ── Bloque ① CREACIÓN ──────────────────────────────────────────────────

      // 1a. Compra inicial: if fecha_compra is in this year/month and >= today → expense
      const fechaCompra: string | undefined = posAny.fecha_compra;
      if (fechaCompra) {
        const fechaCompraDateOnly = fechaCompra.split('T')[0]; // normalize to YYYY-MM-DD
        if (
          fechaCompraDateOnly >= today &&
          fechaCompraDateOnly.startsWith(monthPrefix) &&
          pos.id != null
        ) {
          if (await isDuplicate('inversion_compra', pos.id)) {
            skipped++;
          } else {
            await insertEvent({
              type: 'expense' as const,
              amount: pos.total_aportado,
              predictedDate: fechaCompraDateOnly,
              description: `Compra – ${pos.nombre}`,
              sourceType: 'inversion_compra' as const,
              sourceId: pos.id,
              accountId: resolveAccountId(posAny.cuenta_cargo_id),
              status: 'predicted' as const,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }

      // 1b. Aportaciones puntuales futuras in this year/month
      for (const aportacion of pos.aportaciones) {
        const fechaAp = aportacion.fecha?.split('T')[0] ?? '';
        if (
          aportacion.tipo === 'aportacion' &&
          fechaAp >= today &&
          fechaAp.startsWith(monthPrefix) &&
          aportacion.id != null
        ) {
          if (await isDuplicate('inversion_aportacion', aportacion.id)) {
            skipped++;
          } else {
            await insertEvent({
              type: 'expense' as const,
              amount: aportacion.importe,
              predictedDate: fechaAp,
              description: `Aportación – ${pos.nombre} (${fechaAp})`,
              sourceType: 'inversion_aportacion' as const,
              sourceId: aportacion.id,
              accountId: resolveAccountId(
                (aportacion as any).cuenta_cargo_id ?? posAny.cuenta_cargo_id,
              ),
              status: 'predicted' as const,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }

      // 1c. Plan de aportaciones periódicas
      const planAp = posAny.plan_aportaciones;
      if (planAp?.activo && pos.id != null) {
        const mesesAp: number[] =
          planAp.frecuencia === 'mensual'
            ? ALL_MONTHS
            : Array.isArray(planAp.meses) && planAp.meses.length > 0
              ? planAp.meses
              : [];

        if (mesesAp.includes(month)) {
          const diaAp = planAp.dia_cargo ?? 1;
          const fechaPlanAp = buildDate(year, month, diaAp);
          const fechaInicio: string = planAp.fecha_inicio?.split('T')[0] ?? '';
          const fechaFin: string | undefined = planAp.fecha_fin?.split('T')[0];

          if (
            fechaPlanAp >= today &&
            (!fechaInicio || fechaPlanAp >= fechaInicio) &&
            (!fechaFin || fechaPlanAp <= fechaFin)
          ) {
            const descPlanAp = `Plan aportación – ${pos.nombre} ${year}-${String(month).padStart(2, '0')}`;
            const alreadyExists = (await db.getAll('treasuryEvents')).some(
              e =>
                e.sourceType === 'inversion_aportacion' &&
                e.description === descPlanAp &&
                e.predictedDate.startsWith(monthPrefix),
            );
            if (alreadyExists) {
              skipped++;
            } else {
              await insertEvent({
                type: 'expense' as const,
                amount: planAp.importe,
                predictedDate: fechaPlanAp,
                description: descPlanAp,
                sourceType: 'inversion_aportacion' as const,
                sourceId: pos.id,
                accountId: resolveAccountId(planAp.cuenta_cargo_id),
                status: 'predicted' as const,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        }
      }

      // ── Bloque ② VIDA – Rendimientos e intereses ───────────────────────────

      const rendimiento = posAny.rendimiento;
      if (
        rendimiento &&
        !rendimiento.reinvertir &&
        ['cuenta_remunerada', 'prestamo_p2p', 'deposito_plazo'].includes(pos.tipo) &&
        pos.id != null
      ) {
        const mesesCobro: number[] =
          rendimiento.frecuencia_pago === 'mensual'
            ? ALL_MONTHS
            : Array.isArray(rendimiento.meses_cobro) && rendimiento.meses_cobro.length > 0
              ? rendimiento.meses_cobro
              : [];

        if (mesesCobro.includes(month)) {
          const diaCobro = rendimiento.dia_cobro ?? 1;
          const fechaRend = buildDate(year, month, diaCobro);
          const fechaInicioRend: string = rendimiento.fecha_inicio_rendimiento?.split('T')[0] ?? '';
          const fechaFinRend: string | undefined = rendimiento.fecha_fin_rendimiento?.split('T')[0];
          const retencion = rendimiento.retencion_porcentaje ?? 19;

          if (
            fechaRend >= today &&
            (!fechaInicioRend || fechaRend >= fechaInicioRend) &&
            (!fechaFinRend || fechaRend <= fechaFinRend)
          ) {
            const numPagosAnuales = mesesCobro.length > 0 ? mesesCobro.length : 12;
            const brutoPorPago =
              (pos.valor_actual * (rendimiento.tasa_interes_anual / 100)) / numPagosAnuales;
            const netoPorPago = brutoPorPago * (1 - retencion / 100);

            if (netoPorPago > 0) {
              if (await isDuplicate('inversion_rendimiento', pos.id)) {
                skipped++;
              } else {
                await insertEvent({
                  type: 'income' as const,
                  amount: Math.round(netoPorPago * 100) / 100,
                  predictedDate: fechaRend,
                  description: `Intereses netos – ${pos.nombre}`,
                  sourceType: 'inversion_rendimiento' as const,
                  sourceId: pos.id,
                  accountId: resolveAccountId(rendimiento.cuenta_destino_id),
                  status: 'predicted' as const,
                  createdAt: now,
                  updatedAt: now,
                });
              }
            }
          }
        }
      }

      // ── Bloque ② VIDA – Dividendos ─────────────────────────────────────────

      const dividendos = posAny.dividendos;
      if (
        dividendos?.paga_dividendos &&
        ['accion', 'etf', 'reit'].includes(pos.tipo) &&
        pos.id != null
      ) {
        const mesesDiv: number[] =
          dividendos.frecuencia_dividendos === 'mensual'
            ? ALL_MONTHS
            : Array.isArray(dividendos.meses_cobro) && dividendos.meses_cobro.length > 0
              ? dividendos.meses_cobro
              : [];

        if (mesesDiv.includes(month)) {
          const diaDiv = dividendos.dia_cobro ?? 1;
          const fechaDiv = buildDate(year, month, diaDiv);

          if (fechaDiv >= today) {
            const numParticipaciones = posAny.numero_participaciones ?? 0;
            const dividendoPorAccion = dividendos.dividendo_por_accion ?? 0;
            const retencionOrigen = dividendos.retencion_origen_porcentaje ?? 0;
            const retencionEsp = dividendos.retencion_porcentaje ?? 19;

            const brutoPorPago = numParticipaciones * dividendoPorAccion;
            const trasOrigen = brutoPorPago * (1 - retencionOrigen / 100);
            const netoPorPago = trasOrigen * (1 - retencionEsp / 100);

            if (netoPorPago > 0) {
              if (await isDuplicate('inversion_dividendo', pos.id)) {
                skipped++;
              } else {
                await insertEvent({
                  type: 'income' as const,
                  amount: Math.round(netoPorPago * 100) / 100,
                  predictedDate: fechaDiv,
                  description: `Dividendos netos – ${pos.nombre}`,
                  sourceType: 'inversion_dividendo' as const,
                  sourceId: pos.id,
                  accountId: resolveAccountId(dividendos.cuenta_destino_dividendos_id),
                  status: 'predicted' as const,
                  createdAt: now,
                  updatedAt: now,
                });
              }
            }
          }
        }
      }

      // ── Bloque ③ LIQUIDACIÓN ────────────────────────────────────────────────

      const planLiq = posAny.plan_liquidacion;
      // If an active plan_liquidacion of tipo 'vencimiento' exists, block 3b covers the capital
      // return, so block 3a is skipped to avoid double-counting.
      const hasVencimientoPlan = planLiq?.activo && planLiq?.tipo_liquidacion === 'vencimiento';

      // 3a. depósito a plazo: capital returned at maturity (skipped when 3b covers it)
      if (
        pos.tipo === 'deposito_plazo' &&
        rendimiento?.fecha_fin_rendimiento &&
        pos.id != null &&
        !hasVencimientoPlan
      ) {
        const fechaVenc = rendimiento.fecha_fin_rendimiento.split('T')[0];
        if (fechaVenc >= today && fechaVenc.startsWith(monthPrefix)) {
          if (await isDuplicate('inversion_liquidacion', pos.id)) {
            skipped++;
          } else {
            await insertEvent({
              type: 'income' as const,
              amount: pos.valor_actual,
              predictedDate: fechaVenc,
              description: `Vencimiento depósito – ${pos.nombre}`,
              sourceType: 'inversion_liquidacion' as const,
              sourceId: pos.id,
              accountId: resolveAccountId(rendimiento.cuenta_destino_id),
              status: 'predicted' as const,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }

      // 3b. Plan de liquidación (handles all positions including deposito_plazo vencimiento)
      if (planLiq?.activo && pos.id != null) {
        const fechaLiq = planLiq.fecha_estimada?.split('T')[0] ?? '';
        if (fechaLiq >= today && fechaLiq.startsWith(monthPrefix)) {
          const importeLiq = getLiquidationAmount(planLiq, pos.valor_actual);
          if (await isDuplicate('inversion_liquidacion', pos.id)) {
            skipped++;
          } else {
            await insertEvent({
              type: 'income' as const,
              amount: importeLiq,
              predictedDate: fechaLiq,
              description: `Liquidación – ${pos.nombre}`,
              sourceType: 'inversion_liquidacion' as const,
              sourceId: pos.id,
              accountId: resolveAccountId(planLiq.cuenta_destino_id),
              status: 'predicted' as const,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }
    }

    // ── Bloque ④ FISCALIDAD IRPF anual ────────────────────────────────────────
    // Generates a forecast expense/income event for the annual income tax declaration.
    // Only generated once per fiscal year, in the month of the tax filing.
    try {
      const configFiscalRecord = await db.get('configuracion_fiscal', 'default');
      const configFiscal: ConfiguracionFiscal | undefined = configFiscalRecord;

      if (configFiscal?.incluir_prevision_irpf) {
        const mesDeclaracion = configFiscal.mes_declaracion ?? 6;
        const diaDeclaracion = configFiscal.dia_declaracion ?? 25;

        if (month === mesDeclaracion) {
          // The fiscal year being declared is the previous calendar year
          const añoFiscal = year - 1;
          const irpfDescripcion = `Previsión IRPF ${añoFiscal}`;

          const alreadyExistsIrpf = (await db.getAll('treasuryEvents')).some(
            e =>
              e.sourceType === 'irpf_prevision' &&
              e.description === irpfDescripcion &&
              e.predictedDate.startsWith(monthPrefix),
          );

          if (alreadyExistsIrpf) {
            skipped++;
          } else {
            // Aggregate bruto incomes for añoFiscal from all active positions
            const allPosiciones = await inversionesService.getPosiciones();
            let interesesBrutos = 0;
            let dividendosBrutos = 0;
            let plusvalias = 0;
            let retencionesYaPagadas = 0;

            for (const pos of allPosiciones) {
              const posAny = pos as any;
              const rend = posAny.rendimiento;
              const divs = posAny.dividendos;

              // Interests
              if (rend && ['cuenta_remunerada', 'prestamo_p2p', 'deposito_plazo'].includes(pos.tipo)) {
                const brutoAnual = pos.valor_actual * (rend.tasa_interes_anual / 100);
                const brutoTotal = brutoAnual;
                interesesBrutos += brutoTotal;
                const retencionAnual = brutoTotal * ((rend.retencion_porcentaje ?? 19) / 100);
                // Only count retenciones that actually applied (within rendimiento dates)
                const fInicioR = rend.fecha_inicio_rendimiento?.split('T')[0] ?? '';
                const fFinR = rend.fecha_fin_rendimiento?.split('T')[0] ?? '';
                const añoFiscalStr = String(añoFiscal);
                const activeInFiscalYear =
                  (!fInicioR || fInicioR.startsWith(añoFiscalStr) || fInicioR < añoFiscalStr + '-01-01') &&
                  (!fFinR || fFinR >= añoFiscalStr + '-01-01');
                if (activeInFiscalYear) {
                  retencionesYaPagadas += retencionAnual;
                }
              }

              // Dividends
              if (divs?.paga_dividendos && ['accion', 'etf', 'reit'].includes(pos.tipo)) {
                const mesesD: number[] =
                  divs.frecuencia_dividendos === 'mensual'
                    ? ALL_MONTHS
                    : Array.isArray(divs.meses_cobro) && divs.meses_cobro.length > 0
                      ? divs.meses_cobro
                      : ALL_MONTHS;
                const numParticipaciones = posAny.numero_participaciones ?? 0;
                const divPorAccion = divs.dividendo_por_accion ?? 0;
                const brutoAnualDiv = numParticipaciones * divPorAccion * mesesD.length;
                dividendosBrutos += brutoAnualDiv;
                const retencionOrigenPct = divs.retencion_origen_porcentaje ?? 0;
                const retencionEspPct = divs.retencion_porcentaje ?? 19;
                const trasOrigen = brutoAnualDiv * (1 - retencionOrigenPct / 100);
                // Recoverable source-country withholding capped at 15%
                const recoverableOrigen = brutoAnualDiv * (Math.min(retencionOrigenPct, 15) / 100);
                const retencionEsp = trasOrigen * (retencionEspPct / 100);
                retencionesYaPagadas += retencionEsp + recoverableOrigen;
              }

              // Plusvalías from liquidations in añoFiscal
              const planLiq = posAny.plan_liquidacion;
              if (planLiq?.activo) {
                const fLiq = planLiq.fecha_estimada?.split('T')[0] ?? '';
                if (fLiq.startsWith(String(añoFiscal))) {
                  const importeVenta = getLiquidationAmount(planLiq, pos.valor_actual);
                  const costeAdquisicion = pos.total_aportado;
                  plusvalias += importeVenta - costeAdquisicion;
                }
              }
            }

            // Subtract pending minusvalías (up to 4 years back)
            const minusvalias = (configFiscal.minusvalias_pendientes ?? [])
              .filter(m => m.año >= añoFiscal - 4 && m.año < añoFiscal)
              .reduce((sum, m) => sum + m.importe, 0);

            const baseAhorro = interesesBrutos + dividendosBrutos + plusvalias - minusvalias;

            // Apply tax brackets
            let impuestoCalculado = 0;
            let baseRestante = Math.max(baseAhorro, 0);
            let baseAcumulada = 0;
            for (const tramo of TRAMOS_AHORRO_2026) {
              if (baseRestante <= 0) break;
              const limiteTramo = tramo.hasta - baseAcumulada;
              const baseEnTramo = Math.min(baseRestante, limiteTramo);
              impuestoCalculado += baseEnTramo * tramo.tipo;
              baseAcumulada += baseEnTramo;
              baseRestante -= baseEnTramo;
            }

            const resultado = impuestoCalculado - retencionesYaPagadas;

            if (Math.abs(resultado) > 1) {
              const fechaDeclaracion = buildDate(year, mesDeclaracion, diaDeclaracion);
              await insertEvent({
                type: resultado > 0 ? ('expense' as const) : ('income' as const),
                amount: Math.round(Math.abs(resultado) * 100) / 100,
                predictedDate: fechaDeclaracion,
                description: irpfDescripcion,
                sourceType: 'irpf_prevision' as const,
                sourceId: undefined,
                accountId: resolveAccountId(configFiscal.cuenta_irpf_id),
                status: 'predicted' as const,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        }
      }
    } catch (irpfErr) {
      console.error('[TreasurySyncService] Error processing IRPF forecast:', irpfErr);
    }
  } catch (err) {
    console.error('[TreasurySyncService] Error processing inversiones:', err);
  }

  return { created, skipped, updated };
}
