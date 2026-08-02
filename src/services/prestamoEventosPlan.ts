// ============================================================================
// Préstamos · qué previsiones tocar al guardar
// ============================================================================
//
// Guardar un préstamo regeneraba SIEMPRE sus previsiones: borraba todo lo que
// no estuviera `executed` y volvía a emitir el cuadro entero en `predicted`.
// Con un préstamo firmado hace cinco años eso significaba resucitar sesenta
// cuotas ya pagadas y meterlas en la bandeja de "por confirmar" — y encima
// perder las que el usuario había confirmado a mano.
//
// Y pasaba aunque solo se cambiara el NOMBRE, que no mueve el cuadro.
//
// Aquí vive la decisión, fuera del componente, para poder probarla.
// ============================================================================

import type { TreasuryEventDescriptor } from './prestamoCalculatorService';
import type { TreasuryEvent } from './db';

/** Estado con el que nace una previsión de préstamo. */
export type EstadoNuevo = 'predicted' | 'confirmed';

export interface PlanEventos {
  /** Ids de eventos a borrar antes de reemitir. */
  borrar: number[];
  /** Descriptores a emitir, con el estado que les toca. */
  emitir: Array<{ d: TreasuryEventDescriptor; status: EstadoNuevo }>;
}

/** Clave de una cuota dentro de su préstamo · la disposición es la 0. */
function claveDe(d: { numeroCuota?: number; fecha: string }): string {
  return d.numeroCuota != null ? `c${d.numeroCuota}` : `f${d.fecha.slice(0, 10)}`;
}

function claveDeEvento(e: TreasuryEvent): string {
  return e.numeroCuota != null
    ? `c${e.numeroCuota}`
    : `f${(e.predictedDate ?? '').slice(0, 10)}`;
}

/**
 * ¿Hay que rehacer las previsiones de este préstamo?
 *
 * Solo si cambia algo que mueve el cuadro. El nombre, la cuenta o una nota no
 * lo mueven: el calendario de pagos sigue siendo el mismo, y rehacerlo destruye
 * el trabajo de punteo que ya se hubiera hecho encima.
 */
export function cambiaElCuadro(
  antes: Record<string, unknown> | null,
  ahora: Record<string, unknown>,
): boolean {
  if (!antes) return true;
  const delCuadro = [
    'principalInicial',
    'plazoMesesTotal',
    'tipo',
    'tipoNominalAnualFijo',
    'valorIndiceActual',
    'diferencial',
    'tramoFijoMeses',
    'tipoNominalAnualMixtoFijo',
    'mesesSoloIntereses',
    'diferirPrimeraCuotaMeses',
    'diaCargoMes',
    'fechaFirma',
    'fechaPrimerCargo',
    'esquemaPrimerRecibo',
    'prorratearPrimerPeriodo',
    'cuentaCargoId',
  ];
  return delCuadro.some((k) => antes[k] !== ahora[k]);
}

/**
 * Qué borrar y qué emitir.
 *
 * Dos reglas:
 *
 * 1. Lo CONFIRMADO y lo CONCILIADO no se toca. Antes solo se respetaba
 *    `executed`, así que una cuota confirmada a mano se borraba y volvía como
 *    prevista: el usuario tenía que puntearla otra vez.
 *
 * 2. Una cuota ya VENCIDA no se emite. Ni prevista ni confirmada.
 *
 *    Primero probé a emitirla `confirmed`, razonando que el banco ya la había
 *    cobrado. Fue peor: al confirmarlas entran en el saldo, y el saldo de la
 *    cuenta YA refleja lo que el banco hizo. Con la disposición del préstamo
 *    —que también es un evento pasado— eso sumó el capital entero otra vez y
 *    los saldos se dispararon.
 *
 *    Lo correcto es no emitirla: una previsión es una PROYECCIÓN, y una cuota
 *    de hace cinco años no proyecta nada, es historia. La historia vive en el
 *    saldo, no en la bandeja.
 */
export function planificarEventos(params: {
  descriptores: TreasuryEventDescriptor[];
  existentes: TreasuryEvent[];
  hoy: string;
}): PlanEventos {
  const { descriptores, existentes, hoy } = params;

  const firmes = new Set<string>();
  const borrar: number[] = [];
  for (const e of existentes) {
    if (e.status === 'executed' || e.status === 'confirmed') {
      firmes.add(claveDeEvento(e));
      continue;
    }
    if (e.id != null) borrar.push(e.id);
  }

  const emitir = descriptores
    .filter((d) => !firmes.has(claveDe(d)))
    // Solo lo que está POR VENIR. Lo vencido ya ocurrió y ya está en el saldo.
    .filter((d) => d.fecha.slice(0, 10) >= hoy)
    .map((d) => ({ d, status: 'predicted' as EstadoNuevo }));

  return { borrar, emitir };
}


// ─── Reparar lo que ya se emitió mal ────────────────────────────────────────

/**
 * Eventos de préstamo con fecha PASADA que el guardado emitió de más.
 *
 * El guardado de un préstamo reemitía su cuadro entero cada vez, así que las
 * cuotas y la disposición de años anteriores acabaron en la base. Sobran las
 * dos veces:
 *
 *  · Si quedaron `predicted`, ensucian "por confirmar" pidiendo que se afirme
 *    algo que el banco hizo hace años.
 *  · Si quedaron `confirmed`, es peor: entran en el saldo, y el saldo de la
 *    cuenta ya refleja lo que el banco hizo. La disposición de un préstamo de
 *    78.500 € sumada otra vez dispara la cifra.
 *
 * Se BORRAN. Lo `executed` no se toca: eso está casado con un movimiento real
 * del banco y sí representa algo que ocurrió una sola vez.
 */
export function eventosPasadosDePrestamo(
  eventos: Array<{
    id?: number;
    prestamoId?: string;
    predictedDate?: string;
    status?: string;
  }>,
  hoy: string,
): number[] {
  return eventos
    .filter((e) => {
      if (e.id == null || !e.prestamoId) return false;
      if (e.status === 'executed') return false;
      const f = (e.predictedDate ?? '').slice(0, 10);
      return f !== '' && f < hoy;
    })
    .map((e) => e.id as number);
}
