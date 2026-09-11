// ============================================================================
// E2.4.2 · Paso 2 · el aprendizaje intra-lote, visto desde la SESIÓN
// ============================================================================
//
// Sacado de `DrawerExtracto.tsx` para que el drawer no pase de 800 líneas
// (trinquete de salud). Aquí no hay UI: es lo que pasa justo después de que el
// usuario clasifique UNA línea con la ficha · las hermanas de aprendizaje del
// mismo lote (`hermanasDeAprendizaje` · misma clave, mismo signo, aún en «te
// necesitan») se resuelven con los mismos valores de la ficha, cada una con
// SU importe y SU fecha (`valoresPorLinea`), y quedan marcadas como resueltas
// por el motor (reclasificables desde Tesorería · reversible).
//
// Con TOPE (Jose · 11 sep 2026): hasta unas pocas hermanas se resuelven solas,
// como siempre. Más de esas, no se toca nada y se PREGUNTA: 28 Bizum de golpe
// por haber clasificado uno es demasiado para hacerlo sin avisar, aunque la
// clave ya no sea un cajón común (#1866).
// ============================================================================

import { useCallback, useState } from 'react';
import { gastoDesdeMovimiento, origenIdRecurrenteDelGasto } from '../../../services/altaMovimientoService';
import { hermanasDeAprendizaje } from '../../../services/clasificacion/aprendizajeEnLote';
import { marcarResueltaPorElMotor } from '../../../services/clasificacion/resueltaPorMotor';
import { valoresPorLinea } from './clasificarEnBloque';
import type { LineaExtracto } from './extractoSesion';
import type { GuardadoFicha } from './FichaMovimiento';

export interface AprendizajeEnSesion {
  /** La línea que el usuario acaba de clasificar. */
  linea: LineaExtracto;
  /** Lo que eligió en la ficha. */
  valores: GuardadoFicha;
  /** Todas las líneas de la sesión. */
  lineas: readonly LineaExtracto[];
  /** ¿Sigue esta línea en «te necesitan», sin gesto del usuario? */
  sinDecidir: (lineaId: number) => boolean;
  /** Se llama por cada hermana resuelta · el drawer la marca como creada. */
  onResuelta: (lineaId: number) => void;
}

/**
 * Hasta cuántas hermanas se resuelven SOLAS · D1. Un extracto mensual trae un
 * recibo por concepto; uno trimestral, tres. Cuatro o más iguales ya es
 * «muchos Bizum» o «muchas compras del súper», y ahí conviene mirar.
 */
export const TOPE_SIN_PREGUNTAR = 3;

export function hayQuePreguntar(cuantas: number): boolean {
  return cuantas > TOPE_SIN_PREGUNTAR;
}

/** Las hermanas que aprenderían de esta línea, tal como están AHORA. */
export function hermanasQueAprenderian(
  a: Pick<AprendizajeEnSesion, 'linea' | 'lineas' | 'sinDecidir'>,
): LineaExtracto[] {
  const ids = new Set(hermanasDeAprendizaje(a.linea, a.lineas, a.sinDecidir).map((h) => h.lineaId));
  return a.lineas.filter((l) => ids.has(l.lineaId));
}

/**
 * Resuelve `hermanas` con los valores de la ficha · si no se pasan, las que
 * aprenderían ahora. Devuelve cuántas quedaron resueltas.
 */
export async function aplicarAprendizajeALasHermanas(
  a: AprendizajeEnSesion,
  hermanas?: LineaExtracto[],
): Promise<number> {
  if (a.valores.esMejora) return 0;
  const lista = hermanas ?? hermanasQueAprenderian(a);
  if (lista.length === 0) return 0;
  const valores = valoresPorLinea(a.valores, lista);
  let resueltas = 0;
  for (let i = 0; i < lista.length; i++) {
    const h = lista[i];
    const w = valores[i];
    try {
      const origenIdRecurrente = await origenIdRecurrenteDelGasto(w.inmuebleId, w.familiaPersistir, w.fecha);
      const r = await gastoDesdeMovimiento({
        lineaId: h.lineaId,
        inmuebleId: w.inmuebleId,
        concepto: w.concepto,
        importe: w.importe,
        fecha: w.fecha,
        familia: w.familiaPersistir,
        subtipo: w.subtipoPersistir,
        origenIdRecurrente,
      });
      if (r.resultado === 'falta_casilla') continue;
      await marcarResueltaPorElMotor(h.lineaId);
      a.onResuelta(h.lineaId);
      resueltas++;
    } catch (err) {
      console.error('[aprendizajeEnSesion] no se pudo aplicar el aprendizaje a la línea hermana', h.lineaId, err);
    }
  }
  return resueltas;
}

/** Lo que el drawer tiene a la espera de un sí o un no. */
export interface ArrastrePendiente {
  a: AprendizajeEnSesion;
  cuantas: number;
}

/**
 * El arrastre con tope, como estado del drawer.
 *
 * `proponer` resuelve solo hasta el tope y, por encima, deja la pregunta en
 * `pendiente`. `confirmar` la ejecuta recalculando quién sigue pendiente con
 * lo de AHORA (`ahora.sinDecidir`): lo que el usuario haya tocado entre la
 * pregunta y el sí no se pisa. `descartar` la quita sin hacer nada · lo llama
 * el drawer al reiniciar, y `proponer` al llegar otra línea (D2 · la pregunta
 * no bloquea, y la última manda).
 */
export function useArrastreConTope() {
  const [pendiente, setPendiente] = useState<ArrastrePendiente | null>(null);

  const proponer = useCallback(async (a: AprendizajeEnSesion) => {
    setPendiente(null);
    if (a.valores.esMejora) return;
    const hermanas = hermanasQueAprenderian(a);
    if (hermanas.length === 0) return;
    if (hayQuePreguntar(hermanas.length)) {
      setPendiente({ a, cuantas: hermanas.length });
      return;
    }
    await aplicarAprendizajeALasHermanas(a, hermanas);
  }, []);

  const confirmar = useCallback(
    async (ahora: Pick<AprendizajeEnSesion, 'sinDecidir' | 'onResuelta'>) => {
      if (!pendiente) return;
      setPendiente(null);
      await aplicarAprendizajeALasHermanas({ ...pendiente.a, ...ahora });
    },
    [pendiente],
  );

  const descartar = useCallback(() => setPendiente(null), []);

  return { pendiente, proponer, confirmar, descartar };
}
