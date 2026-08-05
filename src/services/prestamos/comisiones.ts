// ============================================================================
// Lo que cuesta adelantar dinero · VOCABULARIO §6 bis · quater
// ============================================================================
//
// Amortizar antes de tiempo puede llevar comisión, y **la escritura manda**.
// Aquí vive UNA sola cuenta, porque había cuatro y ninguna coincidía:
//
//   · `simulateAmortization` multiplicaba el campo en crudo por el importe, o
//     sea lo leía como fracción — y encima leía `comisionAmortizacionParcial`,
//     que no lo escribía nadie: la simulación de amortización parcial daba
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
// ── Una comisión es un CALENDARIO, no un número ─────────────────────────────
//
// Lo normal es que cambie con el tiempo: «2 % los diez primeros años y 1,5 %
// después», «0,25 % los tres primeros y nada más». Por eso se guarda como
// tramos, y un porcentaje suelto es solo el caso de un tramo.
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
// Por eso son dos y no una. Tratarlas como un solo concepto no podría ni
// representar esa hipoteca, y borraría justo el dato del que sale esa decisión:
// que cancelar del todo cuesta y dejar viva una cuota no.
//
// ── De dónde sale la cifra ──────────────────────────────────────────────────
//
// Al dar de alta un préstamo ATLAS **propone** el tope legal, porque dejar el
// campo en cero tampoco es neutral: cero afirma «no hay comisión». Pero una
// cifra propuesta no es una cifra leída de la escritura, así que se guarda de
// dónde viene (`origen`) y la pantalla puede decir «estimado, confírmalo».
// ============================================================================

import type { Prestamo } from '../../types/prestamos';
import { esISO, partes } from './fechas';

/** Adelantar una parte del capital, o cancelar el préstamo entero. */
export type TipoDeReembolso = 'PARCIAL' | 'TOTAL';

/** Un tramo del calendario · «2 % hasta el mes 120». */
export interface TramoDeComision {
  /**
   * Hasta qué mes desde la firma rige, **sin incluirlo**.
   *
   * Ausente = de ahí al final. Un calendario sin último tramo abierto deja de
   * cobrar cuando se acaban los tramos, que también es una forma de decirlo.
   */
  hastaMes?: number;
  /** En PUNTOS PORCENTUALES · `0.25` son 0,25 %. */
  porcentaje: number;
}

/** Si la cifra la puso el usuario leyendo su escritura, o la propuso ATLAS. */
export type OrigenDeLaComision = 'ESCRITURA' | 'TOPE_LEGAL';

export interface ComisionPactada {
  tramos: TramoDeComision[];
  origen: OrigenDeLaComision;
}

export interface ComisionDeReembolso {
  /** El porcentaje que rige ESE día, en puntos porcentuales. */
  porcentaje: number;
  /** Lo que se paga por ella, en euros. */
  importe: number;
  /** Si el préstamo tiene comisión pactada · distinta de que hoy sea cero. */
  hayPactada: boolean;
  /**
   * Había comisión, pero el calendario ya no la cobra.
   *
   * Se distingue de «no había ninguna» para que la pantalla pueda decir por qué
   * no se paga nada: no es lo mismo no tenerla que haberla agotado.
   */
  agotada: boolean;
  /** De dónde sale la cifra · para poder avisar de que es una estimación. */
  origen: OrigenDeLaComision;
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

/** Los tramos que valen · sin porcentajes imposibles ni topes absurdos. */
const tramosValidos = (tramos: unknown): TramoDeComision[] =>
  (Array.isArray(tramos) ? tramos : [])
    .filter(
      (t): t is TramoDeComision =>
        t != null && typeof t.porcentaje === 'number' && Number.isFinite(t.porcentaje) && t.porcentaje >= 0
    )
    .map((t) => ({
      porcentaje: t.porcentaje,
      hastaMes:
        typeof t.hastaMes === 'number' && Number.isFinite(t.hastaMes) && t.hastaMes > 0
          ? Math.floor(t.hastaMes)
          : undefined,
    }));

/**
 * El calendario pactado para ese tipo de reembolso, o `null` si no hay.
 *
 * Los préstamos antiguos guardan un porcentaje suelto; se lee como un
 * calendario de un solo tramo en vez de mantener dos formas de lo mismo.
 */
export function comisionPactadaDe(
  prestamo: Prestamo,
  tipo: TipoDeReembolso
): ComisionPactada | null {
  const estructurada = tipo === 'TOTAL'
    ? prestamo.comisionReembolsoTotal
    : prestamo.comisionReembolsoParcial;

  if (estructurada) {
    const tramos = tramosValidos(estructurada.tramos);
    if (tramos.length > 0) {
      return {
        tramos,
        origen: estructurada.origen === 'TOPE_LEGAL' ? 'TOPE_LEGAL' : 'ESCRITURA',
      };
    }
  }

  // Lo que guardaban los préstamos de antes · un porcentaje y ya.
  const suelto = numero(
    tipo === 'TOTAL' ? prestamo.comisionCancelacionTotal : prestamo.comisionAmortizacionAnticipada
  );
  if (suelto > 0) return { tramos: [{ porcentaje: suelto }], origen: 'ESCRITURA' };

  return null;
}

/**
 * Lo que cuesta adelantar `importe` euros ese día.
 *
 * `importe` es el capital que se adelanta: en una cancelación total, todo lo
 * que queda vivo. La fecha decide qué tramo rige; sin fecha se toma el primero,
 * que es lo que el contrato cobra hoy mientras nadie diga otra cosa.
 */
export function comisionDeReembolso(
  prestamo: Prestamo,
  operacion: { tipo: TipoDeReembolso; importe: number; fecha?: string }
): ComisionDeReembolso {
  const pactada = comisionPactadaDe(prestamo, operacion.tipo);

  if (!pactada) {
    return { porcentaje: 0, importe: 0, hayPactada: false, agotada: false, origen: 'ESCRITURA' };
  }

  const meses =
    esISO(prestamo.fechaFirma) && esISO(operacion.fecha)
      ? Math.max(0, mesesEntre(prestamo.fechaFirma, operacion.fecha))
      : 0;

  // El tramo que rige ese día · el primero cuyo tope no se haya cumplido. Sin
  // ninguno, el calendario se ha acabado y no se cobra.
  const vigente = pactada.tramos.find((t) => t.hastaMes === undefined || meses < t.hastaMes);
  const porcentaje = vigente ? vigente.porcentaje : 0;

  const capital = numero(operacion.importe);

  return {
    porcentaje,
    // Una sola división entre cien, aquí y en ningún otro sitio.
    importe: porcentaje > 0 && capital > 0
      ? Math.round(capital * (porcentaje / 100) * 100) / 100
      : 0,
    hayPactada: true,
    // Tenía comisión y hoy no se cobra · es distinto de no tener ninguna.
    agotada: porcentaje === 0 && pactada.tramos.some((t) => t.porcentaje > 0),
    origen: pactada.origen,
  };
}
