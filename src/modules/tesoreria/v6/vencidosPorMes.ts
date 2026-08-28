// ============================================================================
// La cola de lo que venció y sigue sin confirmar
// ============================================================================
//
// Desde #1813, un previsto que no llegó a tiempo sobrevive al cambio de mes: es
// trabajo pendiente, no basura. Pero el calendario enseña UN mes, así que en
// septiembre ese recibo de agosto no lo veía nadie — sobrevivía y se quedaba
// mudo, que para el caso es casi lo mismo.
//
// Se agrupa por el mes del que VIENE, una casilla por mes y no un cajón de
// sastre: saber que algo lleva dos meses colgando es media respuesta.
// ============================================================================

import type { TreasuryEvent } from '../../../services/db';
import { esPendiente, importeConSigno } from '../../../services/tesoreriaV6Metrics';
import { nombreMes } from './formatoV6';

export interface MesVencido {
  /** `2026-08` · identifica la casilla. */
  clave: string;
  year: number;
  /** 0-11 · para navegar al mes con un clic. */
  month0: number;
  /** «Agosto» · con mayúscula, que es como encabeza la casilla. */
  etiqueta: string;
  pendientes: TreasuryEvent[];
  /** Neto con signo · un gasto resta, un cobro suma. */
  total: number;
}

/**
 * Las colas de meses anteriores al que se está mirando.
 *
 * Dos condiciones, y las dos hacen falta:
 *
 *   · **anterior al mes en pantalla** — lo del mes que se mira ya se ve en la
 *     rejilla, y repetirlo arriba sería contarlo dos veces;
 *   · **anterior a hoy** — si se navega a octubre desde septiembre, lo de
 *     septiembre no es una cola atrasada: es el mes de al lado, y todavía puede
 *     ocurrir.
 *
 * Devuelve de lo más reciente a lo más viejo: agosto antes que julio.
 */
export function vencidosPorMes(params: {
  eventos: TreasuryEvent[];
  /** Mes que se está mirando. */
  year: number;
  month0: number;
  /** Hoy, ISO `YYYY-MM-DD`. */
  hoy: string;
}): MesVencido[] {
  const { eventos, year, month0, hoy } = params;
  const mesEnPantalla = `${year}-${String(month0 + 1).padStart(2, '0')}`;
  const mesDeHoy = hoy.slice(0, 7);
  // El más restrictivo de los dos topes.
  const tope = mesEnPantalla < mesDeHoy ? mesEnPantalla : mesDeHoy;

  const porMes = new Map<string, TreasuryEvent[]>();
  for (const e of eventos) {
    if (!esPendiente(e)) continue;
    const mes = (e.predictedDate ?? '').slice(0, 7);
    if (!mes || mes >= tope) continue;
    const cola = porMes.get(mes);
    if (cola) cola.push(e);
    else porMes.set(mes, [e]);
  }

  return [...porMes.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([clave, pendientes]) => {
      const [y, m] = clave.split('-').map(Number);
      return {
        clave,
        year: y,
        month0: m - 1,
        etiqueta: capitalizar(nombreMes(m - 1)),
        pendientes,
        total: pendientes.reduce((s, e) => s + importeConSigno(e), 0),
      };
    });
}

const capitalizar = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);
