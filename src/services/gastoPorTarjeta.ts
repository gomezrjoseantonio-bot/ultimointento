// ============================================================================
// Cuánto se ha gastado con una tarjeta en un periodo · VOCABULARIO §3.5
// ============================================================================
//
// «Es una sola cifra y de ella salen las tres respuestas que siguen»: sin ella
// ni se puede prever el cargo (§3.3), ni demostrar una bonificación de hipoteca
// (§3.6), ni saber lo que rinde el cashback (§3.7).
//
// Y ya existe, sin necesidad de guardar nada nuevo: para una tarjeta de crédito
// el gasto de un periodo ES su recibo. El banco carga exactamente eso.
//
//   - El periodo CERRADO tiene su cargo cobrado: la cifra es la real.
//   - El periodo ABIERTO todavía crece, y su cifra es la previsión viva —
//     justo lo que describe Jose: «si mañana gasto algo de la tarjeta tendré
//     que hacer una anotación manual e irá creciendo».
//
// Lo que NO cubre: el gasto con tarjeta de DÉBITO. Ese no tiene recibo —cobra
// al momento— y hoy nada dice de qué tarjeta salió cada movimiento. Ver §8.
//
// Puro: no lee la base. Quien llame le pasa los eventos.
// ============================================================================

import type { TreasuryEvent } from './db';

/** Lo gastado con UNA tarjeta en UN periodo. */
export interface GastoDeUnPeriodo {
  tarjetaId: number;
  /** El corte que cierra el periodo · ISO `YYYY-MM-DD`. Identifica al periodo. */
  fechaCorte: string;
  /** Cuándo sale (o salió) el dinero de la cuenta. */
  fechaCargo: string;
  importe: number;
  /**
   * `cerrado` = el cargo ya se cobró y cuadró contra el extracto, así que la
   * cifra es la REAL. `abierto` = todavía es una previsión y puede crecer.
   *
   * La distinción importa: una bonificación se demuestra con lo cerrado, no con
   * lo que esperas gastar.
   */
  estado: 'cerrado' | 'abierto';
}

/** Reconoce el recibo de una tarjeta y saca de su clave a quién pertenece. */
function periodoDelRecibo(ev: TreasuryEvent): { tarjetaId: number; fechaCorte: string } | null {
  if (ev.sourceType !== 'tarjeta_recibo' || typeof ev.sourceId !== 'string') return null;
  // `tarjeta-<id>-<YYYY-MM-DD>` · ver `claveDeRecibo`.
  const m = /^tarjeta-(\d+)-(\d{4}-\d{2}-\d{2})$/.exec(ev.sourceId);
  return m ? { tarjetaId: Number(m[1]), fechaCorte: m[2] } : null;
}

/**
 * Ya ocurrió: el cargo se cobró y quedó ligado a un movimiento del extracto.
 *
 * Mismo criterio que el resto de la aplicación (`esPrevisionIntocable`), menos
 * el descarte: un recibo descartado no es gasto cerrado, es gasto que no fue.
 */
function yaSeCobro(ev: TreasuryEvent): boolean {
  return ev.status === 'executed' || ev.executedMovementId != null;
}

/**
 * El gasto por (tarjeta · periodo), del más reciente al más antiguo.
 *
 * Un recibo DESCARTADO no cuenta: el usuario dijo que no ocurre, así que no es
 * gasto ni previsto ni real. Contarlo inflaría tanto la bonificación como el
 * cashback — y las dos cosas se presumen ante terceros.
 */
export function gastoPorTarjeta(eventos: TreasuryEvent[]): GastoDeUnPeriodo[] {
  const salida: GastoDeUnPeriodo[] = [];

  for (const ev of eventos) {
    if (ev.descartado === true) continue;
    const periodo = periodoDelRecibo(ev);
    if (!periodo) continue;

    salida.push({
      ...periodo,
      fechaCargo: ev.predictedDate,
      // El importe se guarda en negativo —es un gasto—; aquí interesa cuánto.
      importe: Math.abs(ev.amount),
      estado: yaSeCobro(ev) ? 'cerrado' : 'abierto',
    });
  }

  return salida.sort((a, b) => b.fechaCorte.localeCompare(a.fechaCorte));
}

/** Lo gastado con una tarjeta entre dos cortes, ambos incluidos. */
export function gastoDeLaTarjeta(
  periodos: GastoDeUnPeriodo[],
  tarjetaId: number,
  opciones: { desde?: string; hasta?: string; soloCerrados?: boolean } = {}
): number {
  return periodos
    .filter((p) => p.tarjetaId === tarjetaId)
    .filter((p) => (opciones.desde ? p.fechaCorte >= opciones.desde : true))
    .filter((p) => (opciones.hasta ? p.fechaCorte <= opciones.hasta : true))
    .filter((p) => (opciones.soloCerrados ? p.estado === 'cerrado' : true))
    .reduce((suma, p) => suma + p.importe, 0);
}
