// ============================================================================
// El plan de amortizaciones en la tesorería · §6 bis · quater
// ============================================================================
//
// Un plan guardado es dinero que va a salir de la cuenta. Si no se ve donde se
// ve el resto, la previsión dice que en junio salen 455 € cuando su dueño ya ha
// decidido que salen 3.655, y el aviso de saldo corto llega tarde.
//
// ── Por dónde ───────────────────────────────────────────────────────────────
//
// Las previsiones de un préstamo NO nacen en `treasuryForecastService`: su
// `regenerateLoansForecast` no lo llama nadie. Nacen al guardar el préstamo, en
// `PrestamoPageV2`, con `generarTreasuryEventDescriptors` + `planificarEventos`.
// Esto se engancha ahí y no en el otro, para no acabar con dos sitios emitiendo
// los mismos eventos — el día que el primero se reviva, serían duplicados.
//
// Y la decisión de qué se borra y qué se emite se REUTILIZA entera, porque sus
// dos reglas valen igual aquí: lo confirmado, lo conciliado y lo descartado no
// se tocan, y lo vencido no se emite. Un adelanto planificado para marzo del año
// pasado no proyecta nada.
//
// ── Solo lo del plan ────────────────────────────────────────────────────────
//
// `planificarEventos` borra lo que no reconoce, así que se le pasan ÚNICAMENTE
// los eventos de amortización de ese préstamo. Con la lista entera se llevaría
// por delante las cuotas del cuadro, que no son suyas.
// ============================================================================

import { initDB, type TreasuryEvent } from '../db';
import { planificarEventos } from '../prestamoEventosPlan';
import type { TreasuryEventDescriptor } from '../prestamoCalculatorService';
import type { PlanPagos, Prestamo } from '../../types/prestamos';
import { simularPlanDeAdelantos } from './planDeAdelantos';

/** Lo que marca a un evento como salido de un plan de amortizaciones. */
export const ORIGEN_DEL_PLAN = 'amortizacion_anticipada' as const;

/**
 * Los cargos que el plan promete · uno por adelanto.
 *
 * El importe es la SALIDA DE CAJA entera —capital, comisión y gastos—, no el
 * capital solo: lo que hay que tener en la cuenta ese día es lo que se va, y
 * una previsión corta es la que deja el saldo en rojo sin avisar.
 */
export function descriptoresDelPlan(
  prestamo: Prestamo,
  cuadro: PlanPagos | null
): TreasuryEventDescriptor[] {
  const guardado = prestamo.planDeAmortizaciones;
  if (!guardado?.generaPrevisiones || !guardado.reglas?.length) return [];

  const cuentaIdNum = parseInt(prestamo.cuentaCargoId ?? '', 10);
  const cuentaId = Number.isFinite(cuentaIdNum) ? cuentaIdNum : undefined;

  // Por el motor de siempre · la comisión de cada adelanto depende del cupo
  // anual consumido hasta ese día, así que sacarla adelanto a adelanto por
  // separado daría otra cifra que la que enseña la pantalla.
  const simulacion = simularPlanDeAdelantos(prestamo, cuadro, guardado.reglas, {
    modo: guardado.modo,
    limiteAnualExento: guardado.limiteAnualExento,
    gastosFijosPorOperacion: guardado.gastosFijosPorOperacion,
  });

  return simulacion.adelantos.map((a) => ({
    fecha: a.fecha,
    tipo: 'gasto' as const,
    importe: a.salidaCaja,
    cuentaId,
    concepto: `Amortización planificada · ${prestamo.nombre}`,
    prestamoId: prestamo.id,
    // Sin `numeroCuota` a propósito: no es una cuota del cuadro, y ponerle una
    // la haría chocar con el recibo que lleva ese número. La clave de estos es
    // su fecha, que es como los distingue `planificarEventos`.
    desglose: { capital: a.aplicado, intereses: 0 },
  }));
}

/** Los eventos de tesorería que salieron de un plan, de ese préstamo. */
export const sonDelPlan = (e: TreasuryEvent, prestamoId: string): boolean =>
  e.sourceType === ORIGEN_DEL_PLAN && e.prestamoId === prestamoId;

/**
 * Deja la tesorería diciendo lo que dice el plan de hoy.
 *
 * Se llama al guardar el plan. Si el plan deja de generar previsiones —o se
 * borra—, los descriptores salen vacíos y esto se lleva las pendientes: un plan
 * que ya no está no puede seguir prometiendo cargos.
 */
export async function sincronizarPrevisionesDelPlan(
  prestamo: Prestamo,
  cuadro: PlanPagos | null,
  hoy: string
): Promise<{ borradas: number; emitidas: number }> {
  const db = await initDB();
  const todos = (await db.getAll('treasuryEvents')) as TreasuryEvent[];

  const plan = planificarEventos({
    descriptores: descriptoresDelPlan(prestamo, cuadro),
    existentes: todos.filter((e) => sonDelPlan(e, prestamo.id)),
    hoy,
  });

  for (const id of plan.borrar) {
    await db.delete('treasuryEvents', id);
  }

  const ahora = new Date().toISOString();
  const inmueble = prestamo.destinos?.find((d) => d.inmuebleId)?.inmuebleId ?? prestamo.inmuebleId;

  for (const { d, status } of plan.emitir) {
    const event: Omit<TreasuryEvent, 'id'> = {
      type: 'financing',
      amount: d.importe,
      predictedDate: d.fecha,
      description: d.concepto,
      sourceType: ORIGEN_DEL_PLAN,
      sourceId: prestamo.id,
      accountId: d.cuentaId,
      prestamoId: prestamo.id,
      status,
      ambito: inmueble ? 'INMUEBLE' : 'PERSONAL',
      inmuebleId: inmueble != null ? Number(inmueble) : undefined,
      createdAt: ahora,
      updatedAt: ahora,
      generadoPor: 'treasurySyncService',
    };
    await db.add('treasuryEvents', event as TreasuryEvent);
  }

  return { borradas: plan.borrar.length, emitidas: plan.emitir.length };
}
