// ============================================================================
// B9 · corregir el ciclo también recalcula lo que quedó pendiente detrás
// ============================================================================
//
// Regenerar las previsiones de un gasto recurrente empieza por retirar las
// vivas. Ese borrado no miraba la fecha, así que al cambiar el ciclo —de
// mensual a bimensual, por ejemplo— se llevaba por delante los VENCIDOS: los
// recibos que ya deberían haber salido y siguen sin puntear. Y no volvían: el
// motor proyecta desde el primer día del mes en curso, nunca hacia atrás. El
// trabajo pendiente desaparecía sin que nadie decidiera nada.
//
// «No borrar los vencidos» a secas tampoco vale. Si el gasto pasa a bimensual,
// el vencido de julio era una predicción de un recibo que YA NO TOCA: dejarlo
// esperando es peor que borrarlo, porque el usuario acabaría buscando en el
// extracto un cargo que nunca existió.
//
// La regla es la del propio ciclo: se aplica también hacia atrás.
//
//   · el nuevo ciclo SÍ contempla ese mes → el vencido se conserva (es trabajo
//     pendiente de verdad, alguien tiene que puntearlo o descartarlo),
//   · el nuevo ciclo NO lo contempla       → se limpia (era una predicción
//     falsa).
//
// El periodo es el AÑO-MES, la misma unidad que la clave de idempotencia
// (`claveOrigenPrevision`): ningún patrón de compromiso se repite dentro de un
// mes. Si al corregir el ciclo cambia solo el DÍA dentro de un mes que sigue
// tocando, el vencido se queda con su día viejo — y así debe ser: es un
// pendiente con identidad propia, no una proyección que se pueda reemitir,
// porque el motor no emite hacia atrás.
//
// Puro: no lee ni escribe la base.
// ============================================================================

import type { TreasuryEvent } from '../db';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';
import { expandirPatron } from './patronCalendario';
import { toISODateLocal } from '../../utils/recurrenceDateUtils';

/** `YYYY-MM` de una previsión · sus campos propios mandan sobre la fecha. */
export function periodoDePrevision(
  ev: Pick<TreasuryEvent, 'año' | 'mes' | 'predictedDate'>,
): string {
  const iso = typeof ev.predictedDate === 'string' ? ev.predictedDate : '';
  const año = ev.año ?? Number(iso.slice(0, 4));
  const mes = ev.mes ?? Number(iso.slice(5, 7));
  return `${año}-${String(mes).padStart(2, '0')}`;
}

/**
 * Los periodos (`YYYY-MM`) que el ciclo del compromiso contempla ENTRE dos
 * fechas, con sus dos topes de vigencia puestos: nada antes del primer cobro,
 * nada después del fin si lo hay.
 *
 * Un patrón con un dato corrupto hace saltar `expandirPatron` (blindaje
 * anti-cuelgue). Aquí eso se traduce en «no sé qué meses toca», y no saberlo no
 * puede ser motivo para conservar un pendiente que quizá ya no existe: se
 * devuelve vacío y el borrado se comporta como antes de B9.
 */
export function periodosDelCiclo(
  compromiso: Pick<CompromisoRecurrente, 'patron' | 'fechaInicio' | 'fechaFin'>,
  desde: string,
  hasta: string,
): Set<string> {
  const inicio = (compromiso.fechaInicio ?? '').slice(0, 10);
  const fin = (compromiso.fechaFin ?? '').slice(0, 10);
  const desdeReal = inicio && inicio > desde ? inicio : desde;
  const hastaReal = fin && fin < hasta ? fin : hasta;
  if (!desdeReal || !hastaReal || desdeReal > hastaReal) return new Set();
  try {
    return new Set(
      expandirPatron(compromiso.patron, desdeReal, hastaReal).map((f) =>
        toISODateLocal(f).slice(0, 7),
      ),
    );
  } catch {
    return new Set();
  }
}

/**
 * ¿Sobrevive esta previsión al recálculo?
 *
 * Solo se pregunta por lo VENCIDO —lo anterior al corte desde el que el motor
 * reproyecta—. De ahí en adelante el borrado y la reemisión hacen su trabajo de
 * siempre, y conservar allí sería justo lo contrario de regenerar.
 */
export function loConservaElCiclo(
  ev: Pick<TreasuryEvent, 'año' | 'mes' | 'predictedDate'>,
  periodos: Set<string>,
  corte: string,
): boolean {
  const fecha = (ev.predictedDate ?? '').slice(0, 10);
  // Sin fecha no hay vencido que valorar: se comporta como antes.
  if (!fecha || fecha >= corte) return false;
  return periodos.has(periodoDePrevision(ev));
}
