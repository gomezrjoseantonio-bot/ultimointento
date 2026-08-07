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
