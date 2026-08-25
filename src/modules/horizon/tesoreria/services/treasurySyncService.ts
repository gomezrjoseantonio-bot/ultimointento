// src/modules/horizon/tesoreria/services/treasurySyncService.ts
// ATLAS HORIZON – Treasury Sync Service
// Bridges the projection rules with the day-to-day treasury (la vista de conciliación de tesorería).
// Generates monthly forecast TreasuryEvents from projection rules so that the
// "Previsiones" column is populated automatically.
//
// IMPORTANT: This service DOES NOT calculate any amounts itself.
// It consumes the projection engine (proyeccionMensualService) as the single source
// of truth for all amounts, ensuring the treasury events match the P&L at the cent.

import { initDB } from '../../../../services/db';
import type { TreasuryEvent } from '../../../../services/db';
import { getFiscalContextSafe } from '../../../../services/fiscalContextService';
import { nominaService } from '../../../../services/nominaService';
import { calcularNetoMesNomina } from '../../../../services/nominaCalculoService';
import { getAllContracts } from '../../../../services/contractService';
import { prestamosService } from '../../../../services/prestamosService';
import { autonomoService } from '../../../../services/autonomoService';
import { inversionesService } from '../../../../services/inversionesService';
import { cuentasService } from '../../../../services/cuentasService';
import { otrosIngresosService } from '../../../../services/otrosIngresosService';
import { rollForwardAccountBalancesToMonth } from '../../../../services/accountBalanceService';
import { getBusinessDayForRule } from './treasurySyncHelpers';
import { TRAMOS_AHORRO_2026 } from '../../../../types/inversiones-extended';
import type { ReglaDia } from '../../../../types/personal';
import { inmuebleDelPrestamo, idDeInmueble } from '../../../../services/inmuebleDelPrestamo';
import { planificarGestionMes } from './gestionTesoreria';
import { RENT_SOURCE_TYPES } from '../../../inmuebles/utils/estadoCobroContratoService';
import {
  cobroPrevistoDelMes,
  cuadroDePosicion,
} from '../../../../services/prestamoInversionCuadro';

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

/**
 * Resuelve la regla del DÍA DE COBRO de una nómina para proyectar su evento.
 * Preferimos `reglaCobroDia` (fuente canónica que escribe el wizard). Si una
 * nómina legacy no la tiene (registros creados antes de que existiera el campo),
 * caemos a `cuentaCobroIBAN.diaAbono`. Solo si NO hay nada configurado se usa el
 * día por defecto del llamante. Antes se fijaba el día 25 a ciegas → el usuario
 * marcaba 28 y la Tesorería mostraba 25.
 */
export function resolveReglaCobroNomina(nomina: {
  reglaCobroDia?: ReglaDia;
  cuentaCobroIBAN?: { diaAbono?: number | 'ultimoHabil' };
}): ReglaDia | undefined {
  if (nomina.reglaCobroDia) return nomina.reglaCobroDia;
  const diaAbono = nomina.cuentaCobroIBAN?.diaAbono;
  if (diaAbono === 'ultimoHabil') return { tipo: 'ultimo-habil' };
  if (typeof diaAbono === 'number' && diaAbono >= 1 && diaAbono <= 31) {
    return { tipo: 'fijo', dia: diaAbono };
  }
  return undefined;
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
 * Generates TreasuryEvent forecast records for the given year/month.
 *
 * Sources covered:
 *  - Active rental contracts for the month → type 'income', sourceType 'contrato'
 *  - Active nóminas for the month → type 'income', sourceType 'nomina'
 *  - Hipotecas (mortgage quotas) → type 'financing', sourceType 'hipoteca'
 *  - Préstamos (personal loan quotas) → type 'financing', sourceType 'prestamo'
 *  - Autónomo income (fuentesIngreso) → type 'income', sourceType 'autonomo_ingreso'
 *  - Autónomo expenses (gastosRecurrentesActividad + cuotaAutonomos) → type 'expense', sourceType 'autonomo'
 *  - Investment interest/dividends → type 'income', sourceType 'inversion'
 *  - Otros ingresos recurrentes → type 'income', sourceType 'otros_ingresos'
 *
 * Los gastos recurrentes NO están en esta lista y no es un olvido: los prevé
 * `compromisosRecurrentesService` desde `compromisosRecurrentes`, y los de
 * inmueble `treasuryForecastService`. Lo que había aquí eran dos ramas que
 * desde V62 recorrían listas vacías (ver más abajo).
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

  // Un evento CONCILIADO es intocable: representa un movimiento bancario real.
  // Antes solo se protegía `status==='confirmed'`, pero las conciliaciones reales
  // (punteo manual, conciliación v2, match de extracto) escriben `'executed'` +
  // `executedMovementId`. Sin esto, la regeneración revertía el evento a
  // `predicted` y el barrido posterior lo BORRABA → «acepté y desapareció».
  const isReconciled = (e: TreasuryEvent): boolean =>
    e.status === 'confirmed' ||
    e.status === 'executed' ||
    (e as { executedMovementId?: number | string | null }).executedMovementId != null;

  // Helper: check if a forecast already exists for this sourceType + sourceId in this month
  //
  // `sourceType` admite un conjunto porque un mismo concepto puede haber llegado
  // con más de un nombre: la renta de alquiler es `'contrato'` cuando la emite
  // este generador y `'contract'` cuando la asigna el extracto contra un
  // contrato. Preguntando por uno solo, el cobro ya conciliado no contaba como
  // «ya hay renta este mes» y se emitía otra previsión encima.
  async function isDuplicate(
    sourceType: string | ReadonlySet<string>,
    sourceId: number | string,
  ): Promise<boolean> {
    const esDelMismoOrigen = (t: string | undefined): boolean =>
      typeof sourceType === 'string' ? t === sourceType : t != null && sourceType.has(t);
    const existing = await db.getAllFromIndex('treasuryEvents', 'sourceId', sourceId);
    return existing.some(e =>
      esDelMismoOrigen(e.sourceType) &&
      e.predictedDate.startsWith(monthPrefix) &&
      isReconciled(e),
    );
  }

  // Helper: upsert an event by sourceType/sourceId for the month
  async function insertEvent(event: TreasuryEvent): Promise<void> {
    const sourceId = (event as { sourceId?: number | string }).sourceId;
    const sourceType = (event as { sourceType?: string }).sourceType;
    if (sourceId != null && sourceType) {
      const existing = await db.getAllFromIndex('treasuryEvents', 'sourceId', sourceId);
      const currentMonthEvent = existing.find(
        e => e.sourceType === sourceType && e.predictedDate.startsWith(monthPrefix),
      );
      if (currentMonthEvent) {
        if (isReconciled(currentMonthEvent) || currentMonthEvent.descartado === true) {
          // NO revertir un evento conciliado a `predicted` · se respeta la realidad.
          // Un DESCARTADO tampoco se reescribe: el usuario ya dijo que no ocurre
          // y no se le vuelve a proponer (V84 · D1).
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
  // NominaWizard and ContractsNuevo use cuentasService (localStorage) which assigns
  // timestamp-based IDs (e.g., 1708726312345), while la vista de conciliación de tesorería
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
   * la vista de conciliación de tesorería.
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
    if (directMatch) return directMatch.id;
    // Step 3: no se pudo mapear (p.ej. el mapa de cuentas está vacío porque
    // cuentasService no estaba listo en el arranque). Antes se devolvía
    // `undefined` y la previsión nacía HUÉRFANA de cuenta —y la cuota de hipoteca
    // no aparecía al conciliar ("ni rastro")—. El asistente de préstamos usa
    // `parseInt(cuentaCargoId)` DIRECTO como accountId y funciona, así que se hace
    // lo mismo aquí: se conserva `rawId`. Si resulta no ser una cuenta real, no
    // casa con ninguna (igual que antes); si lo es, la cuota ya cuadra.
    return rawId;
  }

  // ── 1 y 2 · RETIRADAS · los gastos recurrentes ya los prevé otro ──────────
  //
  // Aquí vivían los gastos de inmueble (`opexRules`) y los gastos personales
  // (`patronGastosPersonales`). Los dos almacenes se eliminaron en V62 y lo que
  // quedó fueron dos sombras: la primera empezaba con un `const opexRules = []`
  // literal, y la segunda le pedía los patrones a un servicio que devolvía
  // siempre una lista vacía. Ninguna de las dos podía recibir un dato nunca —la
  // pantalla que los crea vive desde entonces en `compromisosRecurrentes`—, así
  // que el bucle recorría el vacío y el fichero seguía anunciando que cubría
  // esas dos fuentes.
  //
  // Quien las cubre de verdad:
  //   · Los gastos personales, `compromisosRecurrentesService` vía
  //     `regenerarEventosCompromiso` —incluida la conversión de compras con
  //     tarjeta en el recibo de su periodo (§3.4), que comparte el mismo
  //     `previsionDeTarjetas` que se usaba aquí—.
  //   · Los de inmueble, `treasuryForecastService`, que sigue escribiendo
  //     `opex_rule`.
  //
  // Los dos `sourceType` siguen vivos, así que esto no deja huérfano ningún
  // evento guardado. Conectar estas ramas en vez de retirarlas habría sido lo
  // peligroso: cada gasto habría quedado previsto dos veces.

  // ── 3. CONTRATOS ACTIVOS (rental income) ──────────────────────────────────
  try {
    const contracts = await getAllContracts();

    // Gestión delegada · el plan del mes decide qué contratos NO emiten renta
    // (los subcontratos que cobra la agencia en flujo A, o el padre en flujo B),
    // qué importe forzar (padre neto en flujo A · %/fees) y de qué cuenta cobran
    // los subcontratos (heredan la del padre). La vista fiscal no cambia: solo
    // el flujo de caja. Ver docs/DISENO-gestion-delegada-agencias-V1.md §5.
    const planGestion = planificarGestionMes(
      contracts,
      (c) => isContractActiveInMonth(c, year, month),
      // Subcontrato que EMPIEZA este mes exacto → imputa captación (inquilino nuevo).
      (c) => {
        if (!c.fechaInicio) return false;
        const ini = new Date(c.fechaInicio);
        return ini.getFullYear() === year && ini.getMonth() + 1 === month;
      },
    );

    for (const contract of contracts) {
      if (!isContractActiveInMonth(contract, year, month)) continue;
      if (contract.id == null) continue;
      if (planGestion.suprimir.has(contract.id)) continue;

      // Los dos nombres de la renta · si el cobro ya entró por el extracto
      // (`'contract'`), no se emite además la previsión (`'contrato'`).
      if (await isDuplicate(RENT_SOURCE_TYPES, contract.id)) {
        skipped++;
        continue;
      }

      const nombreInquilino =
        `${contract.inquilino?.nombre ?? ''} ${contract.inquilino?.apellidos ?? ''}`.trim();
      const inquilino = nombreInquilino || 'Inquilino';
      const day = contract.diaPago ?? 1;

      // rentaMensual store eliminado en V62 — usar contract.rentaMensual directamente.
      // El plan puede forzar el importe (padre neto en flujo A · %/fees).
      const amount = planGestion.importePorContrato.get(contract.id) ?? contract.rentaMensual ?? 0;
      // Los subcontratos llevan cuentaCobroId=0 y heredan la del padre (flujo B).
      const cuentaCobro = planGestion.cuentaPorContrato.get(contract.id) ?? contract.cuentaCobroId;

      await insertEvent({
        type: 'income' as const,
        amount,
        predictedDate: buildDate(year, month, day),
        description: `Renta – ${inquilino}`,
        // P5 · el nombre del inquilino en el campo que MIRA el emparejador
        // (`counterparty`), no solo en la descripción: es lo que desempata seis
        // habitaciones de 395 € que solo se distinguen por quién paga.
        counterparty: nombreInquilino || undefined,
        sourceType: 'contrato' as const,
        sourceId: contract.id,
        accountId: resolveAccountId(cuentaCobro),
        // De qué piso es la renta · el mismo hueco que tenían las cuotas de
        // préstamo. Sin esto la fila no dice de qué inmueble cobra, y sobre
        // todo las rentas de un piso por habitaciones no pueden colgar de él:
        // `punteoAdapter` arma el grupo con `inmueble-${inmuebleId}`, así que
        // sin el id cada habitación salía suelta, una detrás de otra, sin que
        // se viera que son el mismo piso.
        // Por `idDeInmueble` y no a pelo: hay flujos que escriben `inmuebleId: 0`
        // como marcador de "aún sin vincular", y `properties` es autoIncrement
        // —sus ids empiezan en 1—. Un 0 colado agruparía rentas bajo una madre
        // que no existe.
        inmuebleId: idDeInmueble(contract.inmuebleId),
        // Qué habitación · solo cuando el contrato es de una, no del piso
        // entero. Bajo la madre del piso, "Hab 2" es lo que distingue una fila
        // de otra; sin él, cuatro rentas del mismo piso se diferencian solo por
        // el nombre del inquilino, que es el dato que menos dice de la unidad.
        // El id TAL CUAL ("hab-2"), sin prefijo: quien lo pinta lo formatea
        // (`etiquetaHabitacion`). Guardando ya "Hab hab-2" el campo solo era
        // legible pasándolo otra vez por el formateador, y cualquier consumidor
        // que lo leyera crudo —un export, un informe— se llevaba el prefijo
        // duplicado.
        //
        // Manda tener `habitacionId`: eso ES ser de una habitación. Exigir
        // además `unidadTipo === 'habitacion'` dejaba sin unidad a cualquier
        // contrato antiguo o importado al que no se le fijara ese campo.
        unidadInmueble: contract.habitacionId || undefined,
        status: 'predicted' as const,
        createdAt: now,
        updatedAt: now,
      });
    }

    // ── 3b. COMISIÓN DE LA AGENCIA (gestión delegada · flujo B) ──────────────
    // En propietario_bruto tú cobras las rentas íntegras (arriba) y pagas la
    // comisión a la agencia: un apunte de GASTO por piso. En agencia_neto la
    // comisión va neteada en el ingreso, así que el plan no la lista.
    for (const com of planGestion.comisiones) {
      const padre = contracts.find((c) => c.id === com.padreId);
      const day = padre?.diaPago ?? 1;
      await insertEvent({
        type: 'expense' as const,
        amount: com.importe,
        predictedDate: buildDate(year, month, day),
        description: `Comisión gestión – ${padre?.inquilino?.nombre ?? 'Agencia'}`,
        sourceType: 'comision_gestion' as const,
        sourceId: com.padreId,
        accountId: resolveAccountId(padre?.cuentaCobroId),
        inmuebleId: idDeInmueble(com.inmuebleId),
        proveedor: padre?.inquilino?.nombre || undefined,
        tipoFamilia: 'gestion',
        ambito: 'INMUEBLE' as const,
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
    // T14.4 · migrado a fiscalContextService gateway (solo personalDataId)
    const ctx = await getFiscalContextSafe();
    const personalDataId = ctx?.personalDataId ?? 1;
    const nominas = await nominaService.getNominas(personalDataId);
    const nominasActivas = nominas.filter(n => n.activa);

    for (const nomina of nominasActivas) {
      if (nomina.id == null) continue;

      if (await isDuplicate('nomina', nomina.id)) {
        skipped++;
        continue;
      }

      // FIX consolidar módulo Personal (F6) · ÚNICA FUENTE DE VERDAD.
      // El cobro previsto debe coincidir con la card/panel/wizard.
      const netoMes = calcularNetoMesNomina(nomina, month, year).netoMes;
      if (netoMes <= 0) continue;

      await insertEvent({
        type: 'income' as const,
        amount: netoMes,
        predictedDate: getBusinessDayForRule(year, month, resolveReglaCobroNomina(nomina), 25),
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
    // T14.4 · migrado a fiscalContextService gateway (solo personalDataId)
    const ctx = await getFiscalContextSafe();
    const personalDataId = ctx?.personalDataId ?? 1;
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

      // De qué piso es la cuota.
      //
      // El evento nunca lo llevaba, así que la fila de una hipoteca no podía
      // decir de qué inmueble era por más que se le pasara el resolvedor de
      // alias: no había id que resolver.
      //
      // El dato sale de `destinos[]`, no del campo raíz: ese está
      // `@deprecated` y en los préstamos creados con la ficha actual viene
      // vacío. Mirando solo el campo raíz, una hipoteca con su piso
      // perfectamente puesto en "Destino del capital" seguía sin decir de cuál
      // era.
      //
      // No se condiciona a `isHipoteca`: un préstamo personal puede financiar
      // una reforma y tener destino con inmueble, y esa cuota también quiere
      // decir de qué piso es.
      const inmuebleId = inmuebleDelPrestamo(prestamo);

      if (existingByDescription) {
        await db.put('treasuryEvents', {
          ...existingByDescription,
          type: 'financing' as const,
          amount: cuota,
          predictedDate: currentPeriodo?.fechaCargo ?? buildDate(year, month, prestamo.diaCargoMes ?? 1),
          description,
          sourceType,
          accountId,
          inmuebleId,
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
          inmuebleId,
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
    // T14.4 · migrado a fiscalContextService gateway (solo personalDataId)
    const ctx = await getFiscalContextSafe();
    const personalDataId = ctx?.personalDataId ?? 1;
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
    // T14.4 · migrado a fiscalContextService gateway (solo personalDataId)
    const ctx = await getFiscalContextSafe();
    const personalDataId = ctx?.personalDataId ?? 1;
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
        // `inversionesService.createPosicion` sintetiza una "Aportación inicial"
        // datada en `fecha_compra` con el mismo importe que `total_aportado`, y el
        // bloque 1b ya la proyecta como evento "Aportación". Si esa aportación
        // existe, la "Compra inicial" sería EL MISMO desembolso por partida doble
        // → no la emitimos (era el duplicado que aparecía en Tesorería al crear un
        // fondo/acción/préstamo con aportación inicial). La aportación es el
        // registro canónico (es lo que muestra la ficha).
        const tieneAportacionInicial = pos.aportaciones.some(
          (a) =>
            a.tipo === 'aportacion' &&
            (a.fecha?.split('T')[0] ?? '') === fechaCompraDateOnly,
        );
        if (
          !tieneAportacionInicial &&
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

        const retencion = rendimiento.retencion_porcentaje ?? 19;

        // Préstamos · el cobro sale del cuadro de amortización: fecha exacta de
        // la cuota, intereses sobre el CAPITAL VIVO y, en cuota francesa, el
        // capital devuelto (que también entra en la cuenta). El cálculo genérico
        // de abajo —`capital × TIN / periodos`— sobreestima los intereses de un
        // préstamo que amortiza y se deja fuera toda la devolución de capital.
        //
        // Si hay cuadro, MANDA el cuadro: un mes sin cuota es un mes sin
        // previsión. Sin este corte, acortar o mover el calendario devolvía el
        // control al cálculo genérico —que sigue leyendo `meses_cobro`— y
        // resucitaba la previsión vieja con el importe equivocado.
        const cuadroPrestamo = pos.tipo === 'prestamo_p2p' ? cuadroDePosicion(pos) : null;
        const cobroPrestamo = cuadroPrestamo
          ? cobroPrevistoDelMes(pos, monthPrefix, retencion)
          : null;

        if (cuadroPrestamo) {
          // Una cuota que el usuario ya dio por cobrada al registrar el
          // préstamo no se vuelve a prever: ese dinero ya está en el saldo del
          // banco y proponerlo otra vez sería contarlo dos veces.
          const pagosPrevios: Array<{ estado?: string; fecha_pago?: string }> =
            rendimiento.pagos_generados ?? [];
          const yaCobrada =
            cobroPrestamo != null &&
            pagosPrevios.some(
              (pago) =>
                pago.estado === 'pagado' &&
                String(pago.fecha_pago ?? '').startsWith(cobroPrestamo.fecha),
            );

          // Ojo con el `>= today` que usa el resto de fuentes: la regeneración
          // borra los `predicted` desde el DÍA 1 del mes en curso, así que
          // filtrar por "hoy" haría desaparecer la cuota de este mes que ya
          // venció y sigue sin puntear. La unidad aquí es el mes, no el día.
          if (cobroPrestamo && !yaCobrada && cobroPrestamo.neto > 0) {
            if (await isDuplicate('inversion_rendimiento', pos.id)) {
              skipped++;
            } else {
              await insertEvent({
                type: 'income' as const,
                amount: Math.round(cobroPrestamo.neto * 100) / 100,
                predictedDate: cobroPrestamo.fecha,
                description: cobroPrestamo.incluyeCapital
                  ? `Cuota préstamo – ${pos.nombre}`
                  : `Intereses netos – ${pos.nombre}`,
                sourceType: 'inversion_rendimiento' as const,
                sourceId: pos.id,
                accountId: resolveAccountId(
                  rendimiento.cuenta_destino_id ?? posAny.cuenta_cobro_id ?? posAny.cuenta_cargo_id,
                ),
                status: 'predicted' as const,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        } else if (mesesCobro.includes(month)) {
          const diaCobro = rendimiento.dia_cobro ?? 1;
          const fechaRend = buildDate(year, month, diaCobro);
          const fechaInicioRend: string = rendimiento.fecha_inicio_rendimiento?.split('T')[0] ?? '';
          const fechaFinRend: string | undefined = rendimiento.fecha_fin_rendimiento?.split('T')[0];

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
                  accountId: resolveAccountId(
                    rendimiento.cuenta_destino_id ?? posAny.cuenta_cobro_id ?? posAny.cuenta_cargo_id,
                  ),
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
    // V62: configuracion_fiscal store removed · using hardcoded defaults
    try {
      const configFiscal = {
        incluir_prevision_irpf: true,
        mes_declaracion: 6,
        dia_declaracion: 25,
        minusvalias_pendientes: [] as { anio: number; importe: number }[],
        cuenta_irpf_id: undefined as number | undefined,
      };

      if (configFiscal.incluir_prevision_irpf) {
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
              .filter(m => m.anio >= añoFiscal - 4 && m.anio < añoFiscal)
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
