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
 * 2. Una cuota ya VENCIDA nace `confirmed`, no `predicted`. El banco la cobró
 *    —`prestamosService` la da por pagada desde hace tiempo— así que meterla en
 *    "por confirmar" es pedir que se afirme algo que ya consta. Solo lo que
 *    está por venir nace previsto.
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
    .map((d) => ({
      d,
      status: (d.fecha.slice(0, 10) <= hoy ? 'confirmed' : 'predicted') as EstadoNuevo,
    }));

  return { borrar, emitir };
}


// ─── Reparar lo que ya se emitió mal ────────────────────────────────────────

/**
 * Cuotas de préstamo VENCIDAS que quedaron como "por confirmar".
 *
 * Las emitió el guardado de un préstamo antes de que esto se arreglara: al
 * cambiarle el nombre reemitía el cuadro entero en `predicted`, así que las
 * cuotas de años anteriores aparecen en la bandeja pidiendo que se confirme
 * algo que el banco cobró hace tiempo.
 *
 * Se identifica por lo que son: previsión de préstamo, con fecha pasada y sin
 * confirmar. No se toca nada más.
 */
export function cuotasVencidasSinConfirmar(
  eventos: Array<{
    id?: number;
    prestamoId?: string;
    predictedDate?: string;
    status?: string;
    descartado?: boolean;
  }>,
  hoy: string,
): number[] {
  return eventos
    .filter((e) => {
      if (e.id == null || !e.prestamoId) return false;
      if (e.status !== 'predicted' || e.descartado) return false;
      const f = (e.predictedDate ?? '').slice(0, 10);
      return f !== '' && f < hoy;
    })
    .map((e) => e.id as number);
}
