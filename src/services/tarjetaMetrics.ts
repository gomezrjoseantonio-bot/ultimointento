// ============================================================================
// Tarjetas · lo consumido de verdad y el día a día · VOCABULARIO §3.5
// ============================================================================
//
// Vive aparte de `tesoreriaV6Metrics` porque una tarjeta no es una cuenta: no
// tiene saldo, tiene un ciclo, y su dinero no sale el día de la compra sino
// entero en el recibo.
//
// Derivación PURA, como el resto de la capa: entra lo ya leído de la DB y salen
// los números que pinta la pantalla.
// ============================================================================

import type { Movement, TreasuryEvent } from './db';
import {
  enRango,
  importeConSigno,
  rangoDelMes,
  redondear,
  soloFecha,
  type DiaCuenta,
} from './tesoreriaV6Metrics';
//
// Una compra con tarjeta NO es un cargo de la cuenta: el dinero sale entero en
// el recibo, el día de cargo. Por eso vive como PIEZA (`gasto_tarjeta`), que se
// puntea en el sitio —sin crear `Movement`— fijando `actualAmount` y pasando a
// `executed` (ver `services/personal/puntearPieza`).
//
// De ahí sale la línea que separa lo real de lo previsto, y que hasta ahora no
// se estaba respetando: la fila de la tarjeta enseñaba el importe del RECIBO
// —que suma piezas confirmadas y sin confirmar— bajo el rótulo "consumido". En
// una tarjeta recién anotada y sin puntear, eso decía "has consumido 1.010 €"
// cuando no se había confirmado ni un euro.
//
//   · confirmado = pieza `executed` (o el movimiento de una tarjeta de débito,
//     que sí mueve la cuenta al momento y por eso no tiene piezas)
//   · pendiente  = pieza viva sin puntear
//
// El recibo del ciclo sigue siendo la suma de las dos: es lo que el banco va a
// cargar, y es la cifra que manda para prever el cargo (§3.3).

/** ¿Es una PIEZA viva de esta tarjeta? · una compra anotada, punteable. */
const esPiezaDe = (e: TreasuryEvent, tarjetaId: number): boolean =>
  e.sourceType === 'gasto_tarjeta' && e.tarjetaId === tarjetaId && e.descartado !== true;

export interface ConsumoTarjeta {
  /** Lo que YA se confirmó del ciclo · positivo. */
  confirmado: number;
  /** Lo anotado que falta por confirmar · positivo. */
  pendiente: number;
  /** `confirmado + pendiente` · lo que el banco cargará en el recibo. */
  total: number;
  /** Cuántas compras quedan por puntear · alimenta la columna Estado. */
  porConfirmar: number;
}

/**
 * Lo consumido con una tarjeta en un rango, separando lo real de lo previsto.
 *
 * `desde`/`hasta` son ISO y ambos inclusive: quien llama decide si mira el
 * ciclo abierto (crédito) o el mes natural (débito).
 */
export function consumoDeTarjeta(params: {
  tarjetaId: number;
  eventos: TreasuryEvent[];
  movimientos: Movement[];
  desde: string;
  hasta: string;
}): ConsumoTarjeta {
  const { tarjetaId, eventos, movimientos, desde, hasta } = params;

  let confirmado = 0;
  let pendiente = 0;
  let porConfirmar = 0;

  for (const e of eventos) {
    if (!esPiezaDe(e, tarjetaId)) continue;
    if (!enRango(soloFecha(e.predictedDate), desde, hasta)) continue;
    if (e.status === 'executed') {
      confirmado = redondear(confirmado + Math.abs(e.actualAmount ?? e.amount));
    } else {
      pendiente = redondear(pendiente + Math.abs(e.amount));
      porConfirmar++;
    }
  }

  // El DÉBITO no tiene piezas: cobra al momento, así que su gasto real son los
  // movimientos que el usuario atribuyó a la tarjeta.
  for (const m of movimientos) {
    if (m.tarjetaId !== tarjetaId) continue;
    if (m.isOpeningBalance) continue;
    if (!enRango(soloFecha(m.date), desde, hasta)) continue;
    if (m.amount >= 0) continue;
    confirmado = redondear(confirmado + Math.abs(m.amount));
  }

  return { confirmado, pendiente, total: redondear(confirmado + pendiente), porConfirmar };
}

/**
 * El día a día de una tarjeta · la misma forma que el de una cuenta, para que
 * las pinte el mismo gráfico.
 *
 * Solo hay salidas: una tarjeta no ingresa. Una devolución (pieza `income`)
 * resta del gasto de su día en vez de dibujar una barra hacia arriba, que se
 * leería como un cobro.
 */
export function serieDiariaTarjeta(params: {
  tarjetaId: number;
  eventos: TreasuryEvent[];
  movimientos: Movement[];
  year: number;
  month0: number;
}): DiaCuenta[] {
  const { tarjetaId, eventos, movimientos, year, month0 } = params;
  const { desde, hasta, ultimoDia } = rangoDelMes(year, month0);
  const mm = String(month0 + 1).padStart(2, '0');

  const dias = new Map<string, DiaCuenta>();
  for (let d = 1; d <= ultimoDia; d++) {
    const dia = `${year}-${mm}-${String(d).padStart(2, '0')}`;
    dias.set(dia, { dia, entradaConf: 0, entradaPrev: 0, salidaConf: 0, salidaPrev: 0 });
  }

  for (const e of eventos) {
    if (!esPiezaDe(e, tarjetaId)) continue;
    const f = soloFecha(e.predictedDate);
    if (!enRango(f, desde, hasta)) continue;
    const punto = dias.get(f);
    if (!punto) continue;
    // `importeConSigno` da negativo a un gasto · aquí se acumula la magnitud y
    // una devolución (income) resta.
    const imp = -importeConSigno({ amount: e.actualAmount ?? e.amount, type: e.type });
    if (e.status === 'executed') punto.salidaConf = redondear(punto.salidaConf + imp);
    else punto.salidaPrev = redondear(punto.salidaPrev + imp);
  }

  for (const m of movimientos) {
    if (m.tarjetaId !== tarjetaId) continue;
    if (m.isOpeningBalance) continue;
    const f = soloFecha(m.date);
    if (!enRango(f, desde, hasta)) continue;
    const punto = dias.get(f);
    if (!punto) continue;
    punto.salidaConf = redondear(punto.salidaConf - m.amount);
  }

  return Array.from(dias.values());
}
