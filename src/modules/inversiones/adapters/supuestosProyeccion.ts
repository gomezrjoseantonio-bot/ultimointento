// INVERSIONES V1 · Fase 5 (supuestos de proyección · escenario compartido) ·
// ÚNICO PUNTO DE DEFINICIÓN de los supuestos que usan las proyecciones del
// módulo de Inversiones (galería trayectoria a 20 años · Fase 2 · y fichas ·
// Fase 3). La rentabilidad objetivo y la inflación NO se hardcodean: se leen
// del escenario compartido (`escenariosService`), el mismo que usa Mi Plan /
// T-PROYECCIÓN.
//
// ⚠️ AVISO (Fase 5 · "PARA y avisa si no está claro dónde vive"):
// El escenario (`SupuestosProyeccion`) SÍ define la INFLACIÓN
// (`inflacionGastosPct`, default 2,5%) y la rentabilidad del AHORRO/caja
// (`rentabilidadAhorroPct`, default 2,0%), pero NO existe hoy un campo de
// "rentabilidad objetivo" para inversiones (acciones/planes/fondos). En la app
// esa tasa se deriva del comportamiento realizado de cada activo
// (CAGR / TWR · ver `proyeccionActivoService`). Por eso, para el crecimiento
// NOMINAL por posición usamos la CAGR realizada de la propia posición
// (dato real, no inventado) y, cuando no hay CAGR fiable, caemos a la
// rentabilidad de ahorro del escenario como suelo compartido. Si algún día se
// añade una "rentabilidadObjetivoInversionesPct" al escenario, este es el
// único sitio donde hay que conectarla (ver nota PENDIENTE abajo).

import { getSupuestosProyeccion } from '../../../services/escenariosService';

/** Supuestos efectivos de proyección para la galería/fichas de Inversiones. */
export interface SupuestosGaleria {
  /** Inflación anual (%) · del escenario · para llevar valores a € de hoy. */
  inflacionPct: number;
  /** Rentabilidad de ahorro/caja (%) · del escenario · suelo de fallback. */
  rentabilidadAhorroPct: number;
  /**
   * Rentabilidad objetivo de inversiones (%) o `null` si el escenario no la
   * define (hoy: siempre `null` · ver aviso de cabecera). Cuando es `null`,
   * el crecimiento nominal se deriva por posición (CAGR realizada).
   */
  rentabilidadObjetivoPct: number | null;
}

// Techo de saneamiento de la CAGR realizada al proyectar (evita que una
// posición con +300% en un año dispare una banda absurda en la trayectoria). El
// SUELO no es una constante: es la rentabilidad de ahorro del escenario (ver
// `tasaNominalPosicion`), para que ninguna posición se proyecte por debajo del
// mínimo compartido.
export const PROY_RATE_MAX_PCT = 15;

/** Horizonte de la trayectoria de la galería (años). Spec Fase 2 §2.2. */
export const PROY_HORIZONTE_AÑOS = 20;

/**
 * Rentabilidad objetivo por defecto para inversiones (%) · base del slider de
 * proyección de una ficha CUANDO la posición aún no tiene un rendimiento
 * realizado (CAGR/TWR) fiable del que partir. Vive AQUÍ —único punto de
 * definición— en vez de escondida como número mágico dentro de una ficha
 * (regla C-PROY-5: ninguna dinámica trae su propia constante).
 *
 * TODO (Fase 5 · decisión de Jose · "PARA y avisa"): el escenario compartido
 * NO define hoy una "rentabilidad objetivo de inversiones" (solo inflación y
 * rentabilidad de ahorro/caja). Cuando se decida añadir un campo editable
 * `rentabilidadObjetivoInversionesPct` a `SupuestosProyeccion`, mapearlo en
 * `obtenerSupuestosGaleria().rentabilidadObjetivoPct` y esta constante pasa a
 * ser solo el default de ese campo.
 */
export const RENT_OBJETIVO_INVERSIONES_DEFAULT_PCT = 8;

/**
 * Lee los supuestos del escenario compartido. Única puerta de lectura para el
 * módulo de Inversiones · si mañana la galería y las fichas necesitan otra
 * fuente, se cambia aquí y en ningún otro sitio.
 */
export async function obtenerSupuestosGaleria(): Promise<SupuestosGaleria> {
  const s = await getSupuestosProyeccion();
  return {
    inflacionPct: s.inflacionGastosPct,
    rentabilidadAhorroPct: s.rentabilidadAhorroPct,
    // PENDIENTE (Fase 5 · avisar a Jose): el escenario no tiene "rentabilidad
    // objetivo" de inversiones. Cuando exista, mapearla aquí en vez de `null`.
    rentabilidadObjetivoPct: null,
  };
}

/**
 * Tasa de crecimiento nominal anual (fracción, p.ej. 0,07) que se usa para
 * proyectar una posición hacia el futuro:
 *   1. rentabilidad objetivo del escenario, si existe (hoy null).
 *   2. CAGR realizada de la posición, saneada al rango
 *      [rentabilidadAhorroPct, PROY_RATE_MAX_PCT]: el SUELO es la rentabilidad
 *      de ahorro del escenario (una posición no se proyecta por debajo del
 *      mínimo compartido) y el TECHO evita CAGRs absurdas.
 *   3. sin CAGR fiable → rentabilidad de ahorro del escenario (el propio suelo).
 *
 * NUNCA hardcodea una tasa: todo sale del escenario o del dato realizado.
 */
export function tasaNominalPosicion(
  cagrPct: number | null | undefined,
  supuestos: SupuestosGaleria,
): number {
  if (supuestos.rentabilidadObjetivoPct != null) {
    return supuestos.rentabilidadObjetivoPct / 100;
  }
  const suelo = supuestos.rentabilidadAhorroPct;
  if (cagrPct != null && Number.isFinite(cagrPct)) {
    const clamped = Math.min(PROY_RATE_MAX_PCT, Math.max(suelo, cagrPct));
    return clamped / 100;
  }
  return suelo / 100;
}
