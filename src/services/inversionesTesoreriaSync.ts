// Puente Inversiones → Tesorería.
//
// Las previsiones de tesorería de una inversión (la cuota de un préstamo, los
// intereses de un depósito, la compra inicial, las aportaciones) las calcula
// `treasurySyncService` leyendo la posición. Pero ese cálculo solo corre cuando
// alguien lo dispara: Nóminas, Gastos e Inmuebles llamaban a
// `regenerateForecastsForward` tras cada cambio e Inversiones no, así que
// editar un préstamo dejaba en Tesorería la previsión anterior —importe viejo,
// cuenta vieja, cuotas de un calendario que ya no existe—.
//
// `regenerateForecastsForward` borra los `predicted` de hoy en adelante y los
// vuelve a generar, así que arrastra también los huérfanos: si acortas el
// préstamo o le mueves las fechas, las previsiones de los meses que ya no
// tienen cuota desaparecen en vez de quedarse colgadas. Lo confirmado
// (`confirmed` / `executed`) y lo descartado NO se tocan: son realidad, no
// previsión.

import { regenerateForecastsForward } from './treasuryBootstrapService';
import { initDB, type TreasuryEvent } from './db';
import { inversionesService } from './inversionesService';
import { confirmTreasuryEvent } from './treasuryConfirmationService';

/**
 * Regenera las previsiones de tesorería tras crear, editar o dar de baja una
 * inversión.
 *
 * No propaga errores: si la regeneración falla, el guardado de la posición ya
 * ha ido bien y no queremos deshacerlo · se registra y se sigue.
 */
export async function resincronizarTesoreriaInversiones(motivo: string): Promise<void> {
  try {
    const res = await regenerateForecastsForward();
    if (res.errores.length) {
      // eslint-disable-next-line no-console
      console.warn(`[inversiones] tesorería · ${motivo} · con errores`, res.errores);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[inversiones] tesorería · ${motivo} · no se pudo regenerar`, err);
  }
}

/**
 * Concilia (puntea) la APORTACIÓN INICIAL de una posición recién creada · para
 * que el desembolso baje YA del saldo (decisión de Jose · "confirmado = lo
 * hemos hecho").
 *
 * Modelo: una aportación inicial con cuenta de cargo y fecha ≤ hoy es dinero
 * que ya salió del banco. En vez de dejarla como previsión ("por confirmar"),
 * la registramos como MOVIMIENTO real con el mismo mecanismo que "puntear"
 * (`confirmTreasuryEvent`): crea un movimiento conciliado que descuenta del
 * saldo, no la duplica en el cierre (los `executed` se excluyen de pendiente) y
 * trae el anti-duplicado frente al extracto real cuando se importe.
 *
 * Solo actúa sobre la aportación INICIAL (la que sintetiza `createPosicion`) y
 * solo si su fecha es ≤ hoy · las aportaciones futuras siguen como previsión.
 * No propaga errores.
 */
export async function conciliarAportacionInicial(posicionId: number): Promise<void> {
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const pos = await inversionesService.getPosicion(posicionId);
    if (!pos) return;

    const aportaciones = (pos.aportaciones ?? []).filter((a) => a.tipo === 'aportacion');
    // La inicial es la que `createPosicion` marca con notas 'Aportación inicial';
    // si no la hubiera, la más antigua.
    const inicial =
      aportaciones.find((a) => a.notas === 'Aportación inicial') ??
      [...aportaciones].sort((a, b) => (String(a.fecha) < String(b.fecha) ? -1 : 1))[0];
    if (!inicial || inicial.id == null) return;

    const fechaAp = String(inicial.fecha ?? '').slice(0, 10);
    // Solo si ya ha ocurrido (fecha ≤ hoy). Las futuras quedan como previsión.
    if (!fechaAp || fechaAp > hoy) return;
    // Sin cuenta de cargo no hay movimiento que registrar.
    if (pos.cuenta_cargo_id == null && (inicial as { cuenta_cargo_id?: number }).cuenta_cargo_id == null) {
      return;
    }

    const db = await initDB();
    const eventos = (await db.getAllFromIndex(
      'treasuryEvents',
      'sourceId',
      inicial.id,
    )) as TreasuryEvent[];
    const evento = eventos.find(
      (e) => e.sourceType === 'inversion_aportacion' && e.status === 'predicted',
    );
    if (!evento || evento.id == null) return;

    await confirmTreasuryEvent(evento.id);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[inversiones] conciliar aportación inicial', err);
  }
}

/**
 * Concilia las aportaciones INICIALES que sigan "por confirmar" en TODAS las
 * posiciones (barrido idempotente). Sirve para las creadas antes de que este
 * comportamiento existiera y como red de seguridad si el conciliado del alta no
 * llegó a correr. Solo toca aportaciones iniciales con fecha ≤ hoy · una vez
 * conciliadas (executed) no se vuelven a tocar. No propaga errores.
 */
export async function conciliarAportacionesInicialesPendientes(): Promise<void> {
  try {
    const posiciones = await inversionesService.getPosiciones();
    for (const pos of posiciones) {
      if (pos.id == null) continue;
      await conciliarAportacionInicial(pos.id);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[inversiones] conciliar aportaciones iniciales pendientes', err);
  }
}
