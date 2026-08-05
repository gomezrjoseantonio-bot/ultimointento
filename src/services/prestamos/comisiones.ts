// ============================================================================
// Lo que cuesta adelantar dinero · VOCABULARIO §6 bis · quater
// ============================================================================
//
// Amortizar antes de tiempo puede llevar comisión, y **la escritura manda**.
// Aquí vive UNA sola cuenta, porque había cuatro y ninguna coincidía:
//
//   · `simulateAmortization` multiplicaba el campo en crudo por el importe, o
//     sea lo leía como fracción — y encima leía `comisionAmortizacionParcial`,
//     que no lo escribe nadie: la simulación de amortización parcial daba
//     comisión CERO siempre, ignorando lo que hubieras guardado.
//   · `LoanSettlementModal` adivinaba: `<= 1` fracción, `> 1` porcentaje.
//   · `propertyAnalysisUtils` multiplicaba en crudo, como fracción.
//   · `propertySaleService` adivinaba a tres bandas, y por encima de 100 lo
//     tomaba por euros.
//
// La unidad son **PUNTOS PORCENTUALES**: `0.25` es 0,25 %, como se teclea y
// como lo dice el papel del banco. Adivinar era imposible además de feo: los
// topes que fija la ley para el variable son 0,25 % y 0,15 %, y para el consumo
// 1 % y 0,5 % — todos por debajo de 1, o sea que la heurística `<= 1` fallaba
// **justo en las cifras que la ley prescribe**.
//
// ── Parcial y total son DOS comisiones ──────────────────────────────────────
//
// Legalmente las dos son «reembolso anticipado» y comparten tope, pero el tope
// es un MÁXIMO: nada obliga a que se pacten iguales, y lo normal es que no lo
// sean.
//
//   > Yo por ejemplo tenía que si cancelaba totalmente la hipoteca era un
//   > 0,25 % pero parcial era un 0… el propio banco me dijo: cancelas
//   > parcialmente todo menos una cuota y listo.
//   >
//   > — Jose, 5 de agosto de 2026
//
// Por eso son dos campos y no uno. Tratarlas como un solo concepto no podría ni
// representar esa hipoteca, y borraría justo el dato del que sale esa decisión:
// que cancelar del todo cuesta y dejar viva una cuota no.
//
// ── La ley acota, pero aquí no se aplica ────────────────────────────────────
//
// Los topes dependen de qué préstamo sea —si es vivienda, si el prestatario es
// consumidor, la fecha de firma, cuál de las dos opciones del variable se
// pactó— y de que exista pérdida financiera para el banco. ATLAS no sabe casi
// nada de eso, así que **no recorta nada en silencio**: guarda lo pactado y
// calcula con ello. Avisar de que una cifra parece pasarse del tope es otra
// conversación, y va en §8.
//
// Lo que SÍ se aplica es la **ventana**: casi todas se pactan «durante los N
// primeros años». Pasada la ventana la comisión es cero, y eso cambia el
// resultado de cada simulación.
// ============================================================================

import type { Prestamo } from '../../types/prestamos';
import { esISO, partes } from './fechas';

/** Adelantar una parte del capital, o cancelar el préstamo entero. */
export type TipoDeReembolso = 'PARCIAL' | 'TOTAL';

export interface ComisionDeReembolso {
  /** Lo pactado, en PUNTOS PORCENTUALES · `0.25` son 0,25 %. */
  porcentaje: number;
  /** Lo que se paga por ella, en euros. */
  importe: number;
  /**
   * El contrato la tenía, pero su ventana ya pasó · se cobra cero.
   *
   * Se distingue de «no había comisión» para que la pantalla pueda decir por
   * qué no se paga nada: no es lo mismo no tenerla que haberla agotado.
   */
  fueraDeVentana: boolean;
}

const numero = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;

/** Meses completos entre dos fechas ISO. */
function mesesEntre(desde: string, hasta: string): number {
  const [y1, m1, d1] = partes(desde);
  const [y2, m2, d2] = partes(hasta);
  const meses = (y2 - y1) * 12 + (m2 - m1);
  return d2 < d1 ? meses - 1 : meses;
}

/** Lo pactado para ese tipo de reembolso · porcentaje y ventana. */
function loPactado(prestamo: Prestamo, tipo: TipoDeReembolso) {
  return tipo === 'TOTAL'
    ? {
        porcentaje: numero(prestamo.comisionCancelacionTotal),
        vigenciaMeses: numero(prestamo.comisionCancelacionVigenciaMeses),
      }
    : {
        porcentaje: numero(prestamo.comisionAmortizacionAnticipada),
        vigenciaMeses: numero(prestamo.comisionAmortizacionVigenciaMeses),
      };
}

/**
 * Lo que cuesta adelantar `importe` euros ese día.
 *
 * `importe` es el capital que se adelanta: en una cancelación total, todo lo
 * que queda vivo. La fecha decide si la ventana sigue abierta; sin fecha se
 * calcula como si lo estuviera, que es lo que el contrato dice mientras nadie
 * demuestre lo contrario.
 */
export function comisionDeReembolso(
  prestamo: Prestamo,
  operacion: { tipo: TipoDeReembolso; importe: number; fecha?: string }
): ComisionDeReembolso {
  const { porcentaje, vigenciaMeses } = loPactado(prestamo, operacion.tipo);
  const capital = numero(operacion.importe);

  const nada = { porcentaje: 0, importe: 0, fueraDeVentana: false };
  if (porcentaje <= 0) return nada;

  // La ventana · «durante los tres primeros años», y después cero. Sin fecha de
  // firma no se puede saber si sigue abierta, así que se toma por abierta: lo
  // que el contrato dice, en vez de un cero inventado.
  if (
    vigenciaMeses > 0 &&
    esISO(prestamo.fechaFirma) &&
    esISO(operacion.fecha) &&
    mesesEntre(prestamo.fechaFirma, operacion.fecha) >= vigenciaMeses
  ) {
    return { porcentaje: 0, importe: 0, fueraDeVentana: true };
  }

  if (capital <= 0) return { porcentaje, importe: 0, fueraDeVentana: false };

  return {
    porcentaje,
    // Una sola división entre cien, aquí y en ningún otro sitio.
    importe: Math.round(capital * (porcentaje / 100) * 100) / 100,
    fueraDeVentana: false,
  };
}
