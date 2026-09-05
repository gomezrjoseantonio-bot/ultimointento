// Cuotas de préstamo · el cuadro de amortización que el usuario ya tiene.
//
// `planPagos.periodos[]` lleva `fechaCargo`, `cuota`, `interes` y `amortizacion`
// por periodo: la fecha y el importe con los que el banco va a girar. Casar una
// línea del extracto contra eso es una igualdad, no una estimación.
//
// Dos líneas del cuadro que NO son un recibo del banco y no pueden casar:
//   · `esAdelantoDeCapital` · una entrega de capital que apuntó el propio
//     usuario al amortizar. No la gira el banco.
//   · un periodo ya `pagado` con `movimientoTesoreriaId` · ya tiene su
//     movimiento; volver a casarlo contra otra línea contaría la cuota dos veces.
//
// E2.4 · el histórico. El cuadro existe para todas las cuotas, pasadas y
// futuras, así que aquí nunca dependió de la previsión. Lo que fallaba era
// otra cosa: la igualdad de fecha era AL DÍA, y el banco no gira el día que
// dice el cuadro cuando cae en fin de semana o festivo (el 1 es domingo → gira
// el 2). Dos cambios, los dos sin aproximar el importe:
//   · la fecha del cuadro se acepta a ±5 días · el importe sigue exacto al
//     céntimo y el periodo sigue siendo único, así que no hay dónde confundirse;
//   · el nº de contrato del préstamo (`numeroContrato`), si el banco lo escribe
//     en el concepto («PRESTAMO 0049 0052 143 0004926»), identifica el préstamo
//     antes de mirar fecha o importe (E2.1 lo extrae). Con identidad, la cuota
//     es la del cuadro más cercana en fecha con ese importe exacto.

import type { Prestamo } from '../../types/prestamos';
import type { PeriodoPago } from '../../types/planPagos';
import type { Movement } from '../db';
import type { OrigenDeterminista } from './tipos';
import { mismoDia, mismoImporte } from './igualdad';
import { identificadoresDeMovimiento, normalizarIdentificador } from '../identificadoresDelConcepto';

const MS_DIA = 86_400_000;
/** Cuánto puede mover el banco la fecha del cuadro · fin de semana y festivo. */
export const MARGEN_DIAS_CUOTA = 5;
/** Un nº de contrato con menos dígitos no identifica nada. */
const DIGITOS_MINIMOS_CONTRATO = 8;

/** ¿Este periodo del cuadro puede corresponder a una línea del banco? */
export function esGirableporElBanco(p: PeriodoPago): boolean {
  if (p.esAdelantoDeCapital) return false;
  if (p.pagado && p.movimientoTesoreriaId) return false;
  return true;
}

/**
 * Cómo se llama esta cuota en pantalla.
 *
 * «Cuota 7/240 · Unicaja». Nunca el id del préstamo ni el nombre del campo: el
 * usuario reconoce su préstamo por el banco y por el número de cuota.
 */
export function tituloDeCuota(prestamo: Prestamo, p: PeriodoPago, total: number): string {
  const nombre = prestamo.nombre?.trim() || prestamo.banco?.trim() || 'préstamo';
  return `Cuota ${p.periodo}/${total} · ${nombre}`;
}

function dia(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Días entre dos fechas ISO · `Infinity` si alguna falta. */
function diasEntre(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.abs(dia(a) - dia(b)) / MS_DIA;
}

/**
 * ¿El concepto del banco lleva el nº de contrato de ESTE préstamo?
 *
 * Igualdad de los dígitos normalizados, o que uno termine en el otro con al
 * menos ocho dígitos: el banco escribe «0049 0052 143 0004926» y el usuario
 * pudo guardar el contrato con o sin la entidad delante.
 */
export function llevaElContrato(m: Movement, prestamo: Prestamo): boolean {
  const propio = normalizarIdentificador(prestamo.numeroContrato ?? '').replace(/\D/g, '');
  if (propio.length < DIGITOS_MINIMOS_CONTRATO) return false;
  for (const id of identificadoresDeMovimiento(m)) {
    if (id.tipo !== 'contrato') continue;
    const ajeno = id.valor.replace(/\D/g, '');
    if (ajeno.length < DIGITOS_MINIMOS_CONTRATO) continue;
    if (ajeno === propio || ajeno.endsWith(propio) || propio.endsWith(ajeno)) return true;
  }
  return false;
}

function origenDeCuota(m: Movement, pr: Prestamo, p: PeriodoPago, total: number, como: OrigenDeterminista['como']): OrigenDeterminista {
  return {
    movementId: m.id as number,
    fuente: 'prestamo',
    origenId: String(pr.id ?? ''),
    piezaId: String(p.periodo),
    titulo: tituloDeCuota(pr, p, total),
    como,
    desglose: {
      tipo: 'prestamo',
      periodo: p.periodo,
      interes: p.interes,
      amortizacion: p.amortizacion,
    },
    ...(pr.inmuebleId != null ? { inmuebleId: Number(pr.inmuebleId) } : {}),
  };
}

/**
 * Reconoce las líneas que son una cuota de algún préstamo.
 *
 * Se recorre movimiento a movimiento y se para en la PRIMERA cuota que cuadra:
 * dos préstamos con la misma cuota el mismo día es un empate que no se puede
 * resolver por importe y fecha, y elegir uno a ciegas es peor que no elegir.
 * Ese caso se deja sin reconocer y cae en «te necesitan», que es donde el
 * usuario lo resuelve de un vistazo.
 *
 * Un periodo del cuadro solo puede explicar UNA línea del lote: si dos líneas
 * caen a ±5 días de la misma cuota con el mismo importe (un recibo devuelto y
 * vuelto a girar), se queda con la más cercana y la otra pregunta.
 */
export function cuotasQueCuadran(
  movimientos: Movement[],
  prestamos: Prestamo[],
): OrigenDeterminista[] {
  const out: OrigenDeterminista[] = [];
  const periodosUsados = new Set<string>();

  for (const m of movimientos) {
    if (m.id == null) continue;
    // Una cuota SALE de la cuenta. Un abono nunca es una cuota.
    if (m.amount >= 0) continue;

    // Con identidad · el préstamo está dicho; se busca su cuota.
    const conContrato = prestamos.filter((pr) => llevaElContrato(m, pr));
    const donde = conContrato.length > 0 ? conContrato : prestamos;
    const como: OrigenDeterminista['como'] = conContrato.length > 0 ? 'identidad' : 'fecha_importe';

    const candidatos: { o: OrigenDeterminista; dias: number; clave: string }[] = [];

    for (const pr of donde) {
      const periodos = pr.planPagos?.periodos;
      if (!periodos?.length) continue;

      for (const p of periodos) {
        if (!esGirableporElBanco(p)) continue;
        if (!mismoImporte(p.cuota, m.amount)) continue;
        const dias = mismoDia(p.fechaCargo, m.date) ? 0 : diasEntre(p.fechaCargo, m.date);
        if (dias > MARGEN_DIAS_CUOTA) continue;
        const clave = `${pr.id}|${p.periodo}`;
        if (periodosUsados.has(clave)) continue;
        candidatos.push({ o: origenDeCuota(m, pr, p, periodos.length, como), dias, clave });
      }
    }

    if (candidatos.length === 0) continue;
    // Con varias cuotas a tiro (dos préstamos con la misma cuota, o dos
    // periodos pegados) gana la del día exacto; si ninguna lo clava, o dos lo
    // clavan, es empate y no se elige.
    candidatos.sort((a, b) => a.dias - b.dias);
    const mejor = candidatos[0];
    if (candidatos.length > 1 && candidatos[1].dias === mejor.dias) continue;
    if (candidatos.length > 1 && mejor.dias > 0) continue;

    periodosUsados.add(mejor.clave);
    out.push(mejor.o);
  }

  return out;
}
