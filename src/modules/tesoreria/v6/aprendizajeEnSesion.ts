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
// ============================================================================

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

/** Devuelve cuántas hermanas quedaron resueltas. */
export async function aplicarAprendizajeALasHermanas(a: AprendizajeEnSesion): Promise<number> {
  if (a.valores.esMejora) return 0;
  const ids = new Set(hermanasDeAprendizaje(a.linea, a.lineas, a.sinDecidir).map((h) => h.lineaId));
  const hermanas = a.lineas.filter((l) => ids.has(l.lineaId));
  if (hermanas.length === 0) return 0;
  const valores = valoresPorLinea(a.valores, hermanas);
  let resueltas = 0;
  for (let i = 0; i < hermanas.length; i++) {
    const h = hermanas[i];
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
