// ============================================================================
// Punteo unificado · modelo canónico (Bloque 3 · P1)
// ============================================================================
//
// Un solo vocabulario de estados para las 4 vistas de punteo (mockup validado
// por Jose · Registro v2). Derivación PURA desde los datos existentes — sin
// campos nuevos en el esquema:
//
//   · PREVISTO   = TreasuryEvent status 'predicted' (proyección sin puntear)
//   · CONFIRMADO = realidad SIN evidencia de extracto: evento 'confirmed'
//     (legacy) o Movement cuya fuente no es un import bancario (punteo manual
//     vía confirmTreasuryEvent · alta manual). "Tu palabra".
//   · CONCILIADO = realidad CON evidencia de extracto: Movement con
//     source 'import'. "La palabra del banco".
//
//   real = confirmado ∨ conciliado — TODOS los consumidores (saldo, fiscal,
//   financiación) usan `esReal`; la distinción confirmado/conciliado es solo
//   de evidencia y únicamente la pinta la UI de punteo.
//
// Reglas visuales validadas: orden del día = ingresos → gastos, dentro de
// cada grupo por |importe| descendente (estable). Chips a 0 se ocultan salvo
// Todos y Previstos. Discrepancias con auto-entendido bajo umbral (calderilla).
// ============================================================================

import type { TreasuryEvent, Movement } from '../db';

// ─── Estados ────────────────────────────────────────────────────────────────

export type EstadoPunteo = 'previsto' | 'confirmado' | 'conciliado';

export const esReal = (estado: EstadoPunteo): boolean => estado !== 'previsto';

/**
 * Cómo se llama cada estado EN PANTALLA · una sola vez, para las cuatro vistas.
 *
 * `previsto` se lee "Por confirmar" y no "previsto": es el nombre de la tarea
 * que tiene el usuario delante, el mismo de la pestaña donde vive, y no
 * describe el estado interno sino lo que falta por hacer con él.
 *
 * La clave interna no se toca: son tres estados derivados que están en medio
 * módulo, y renombrarlos por una cuestión de rótulo sería mover el modelo para
 * arreglar una etiqueta.
 */
export const ESTADO_LABEL: Record<EstadoPunteo, string> = {
  previsto: 'Por confirmar',
  confirmado: 'Confirmado',
  conciliado: 'Conciliado',
};

/** Estado de una previsión (evento no ejecutado). */
export function estadoDeEvento(e: Pick<TreasuryEvent, 'status'>): EstadoPunteo {
  return e.status === 'confirmed' ? 'confirmado' : 'previsto';
}

/**
 * Estado de un movimiento real. Conciliado ⟺ evidencia de extracto bancario
 * (source 'import'); cualquier otra realidad (punteo manual · alta a mano ·
 * inbox de documentos) es Confirmado — "tu palabra", sin extracto detrás.
 */
export function estadoDeMovimiento(m: Pick<Movement, 'source'>): EstadoPunteo {
  return m.source === 'import' ? 'conciliado' : 'confirmado';
}

// ─── Ítem unificado de la lista de punteo ───────────────────────────────────

export interface ItemPunteo {
  /** Clave estable de la lista: 'evt-<id>' | 'mov-<id>'. */
  key: string;
  kind: 'evento' | 'movimiento';
  /** id del registro subyacente (TreasuryEvent.id o Movement.id). */
  refId: number;
  estado: EstadoPunteo;
  /** ISO yyyy-mm-dd del cargo (predictedDate o date). */
  fecha: string;
  concepto: string;
  /**
   * §6.3 · la traducción de ATLAS ("seguro hogar", "comunidad"), que va DEBAJO
   * de quién cobra. `undefined` cuando no aporta nada sobre el título: mejor
   * una línea menos que repetir lo mismo dos veces.
   */
  detalle?: string;
  /**
   * Contexto del activo · null = Personal.
   *
   * `alias` es OPCIONAL a propósito: si el nombre real del inmueble no se puede
   * resolver, no se inventa un "Inmueble 3" —un id interno no le dice nada al
   * lector— y la fila simplemente no pinta subtítulo (§2.2).
   */
  activo: { inmuebleId: number | string; alias?: string } | null;
  /** Etiqueta de origen (Financiación · Ingreso · Suministro · Recibo…). */
  origen: string;
  cuentaId: number | null;
  /** Importe con signo (+ ingreso · − gasto). */
  importe: number;
  /** Importe previsto original si el real difiere (para mostrar en gris). */
  importePrevisto?: number;
  /**
   * §7 · documentos del Archivo vinculados a este movimiento (factura, recibo).
   *
   * Solo los movimientos reales los tienen: una previsión aún no ha generado
   * ningún papel. Viaja hasta la ficha para poder enlazarlos desde ahí.
   */
  documentIds?: number[];
  /**
   * Con qué tarjeta se pagó · §3.5.
   *
   * Viaja hasta la ficha para que abra con ella puesta. Sin esto, corregir un
   * importe habría BORRADO la atribución de tarjeta: la ficha guarda lo que
   * tiene en pantalla, y lo que no le llega llega vacío.
   */
  tarjetaId?: number;
  /**
   * Si esta fila se puede corregir o borrar desde el lápiz.
   *
   * Una previsión siempre; un movimiento solo si lo anotó el usuario. Lo
   * importado del banco es realidad —tocarlo descuadra el saldo contra el que
   * se concilia— y lo nacido de confirmar una previsión se deshace
   * despunteando, no borrando. Sin esta marca el lápiz salía en TODAS las
   * filas de la lista o en ninguna.
   */
  editable?: boolean;
  /**
   * Si esta fila es una pata de un traspaso interno, la operación ENTERA.
   *
   * Se resuelve aquí y no en la pantalla porque cuál es el origen depende de
   * qué pata sea: `transferMetadata.targetAccountId` guarda "la otra cuenta",
   * o sea el DESTINO en la salida y el ORIGEN en la entrada. Con ese cálculo
   * repartido por la UI, corregir un traspaso desde la pata de entrada lo
   * habría dado la vuelta.
   */
  traspaso?: { eventId: number; origenId: number; destinoId: number };
  /**
   * §9 · "deja el saldo en −2 €".
   *
   * Va en la fila y no en un aviso aparte porque la pregunta que responde es
   * sobre ESE cargo: cuál de los del día es el que hunde la cuenta. Un banner
   * arriba diría que algo pasa, pero no cuál.
   */
  avisoSaldo?: string;
  /** Discrepancia banco-vs-confirmado pendiente de revisar. */
  discrepancia?: DiscrepanciaPunteo;
  /**
   * De qué previsión NACIÓ este movimiento · solo si nació de una.
   *
   * Es lo que separa un movimiento punteado de uno dado de alta a mano o
   * llegado del inbox: solo el primero se puede despuntear, porque solo ahí hay
   * una previsión a la que volver. Deshacer los otros no los devolvería a
   * ninguna parte — los borraría.
   */
  previsionId?: number;
  /** Agrupación madre/hijas (alquiler por habitaciones · fraccionados). */
  grupoId?: string;
  /**
   * Cómo se lee esta fila CUANDO CUELGA DE SU MADRE.
   *
   * Una renta de habitación dice dos cosas distintas según dónde esté. Suelta,
   * tiene que decirlo todo —"Alquiler · el piso" arriba y el inquilino con su
   * habitación debajo—, porque nada más lo dice. Bajo la madre, el piso ya lo
   * encabeza el grupo y repetirlo en cada hija es escribirlo cuatro veces: ahí
   * la fila se queda con lo que la distingue de sus hermanas.
   *
   * Van los dos juegos en el ítem porque la misma renta puede acabar en
   * cualquiera de las dos situaciones —depende de cuántas caigan ese día— y no
   * se sabe hasta pintar.
   */
  bajoMadre?: { concepto: string; detalle?: string };
  /**
   * Clasificación tal y como está persistida. La lista no la pinta; viaja para
   * que la ficha de §4.5 pueda abrir con la clasificación REAL del registro en
   * vez de con la primera del catálogo. `undefined` = sin clasificar.
   */
  categoryKey?: string;
  subtypeKey?: string;
  /** Concepto fino guardado (F2) · para reabrir la ficha en el subtipo exacto. */
  conceptoId?: string;
  /**
   * T3 · ruta de la ficha del gasto recurrente que emitió esta previsión.
   *
   * Solo la traen las que salen de un compromiso: una previsión de contrato o
   * anotada a mano no tiene gasto detrás que abrir. Se resuelve en el adaptador
   * (`rutaDelGastoRecurrente`) y no en la fila, porque la fila ya no ve el
   * evento — y sin esto, corregir el ciclo de un recibo obligaba a salir de
   * Tesorería y buscarlo por el nombre.
   */
  gastoRecurrente?: string;
  /**
   * T4 · esta previsión está DESCARTADA · el usuario dijo que no va a ocurrir.
   *
   * Sigue existiendo y no caduca (T1), así que se puede consultar y recuperar.
   * Viaja en la fila porque descartar por error no tenía vuelta en ninguna
   * vista: `recuperarPrevisto` existía desde V84 sin un solo botón detrás.
   */
  descartado?: boolean;
}

export interface DiscrepanciaPunteo {
  importeConfirmado: number;
  importeBanco: number;
  delta: number;
  revisada: boolean;
}

// ─── Discrepancias ──────────────────────────────────────────────────────────

/** Bajo este |Δ| la discrepancia nace ya revisada (calderilla · Euribor). */
export const UMBRAL_AUTO_ENTENDIDO = 0.5;

export function calcularDiscrepancia(
  importeConfirmado: number,
  importeBanco: number,
  umbralAutoEntendido: number = UMBRAL_AUTO_ENTENDIDO,
): DiscrepanciaPunteo | null {
  const delta = Math.round((importeBanco - importeConfirmado) * 100) / 100;
  if (delta === 0) return null;
  return {
    importeConfirmado,
    importeBanco,
    delta,
    revisada: Math.abs(delta) < umbralAutoEntendido,
  };
}

// ─── Orden y agrupación ─────────────────────────────────────────────────────

/**
 * Orden canónico DENTRO de un día: ingresos primero, luego gastos; dentro de
 * cada grupo por |importe| descendente. Desempate por key → estable (nada
 * salta al puntear).
 */
export function compararEnDia(a: ItemPunteo, b: ItemPunteo): number {
  const aIngreso = a.importe > 0 ? 0 : 1;
  const bIngreso = b.importe > 0 ? 0 : 1;
  if (aIngreso !== bIngreso) return aIngreso - bIngreso;
  const abs = Math.abs(b.importe) - Math.abs(a.importe);
  if (abs !== 0) return abs;
  return a.key.localeCompare(b.key);
}

export interface DiaPunteo {
  fecha: string;
  items: ItemPunteo[];
  totalIngresos: number;
  totalGastos: number;
}

/** Agrupa por día (días descendentes · el más reciente arriba) y ordena dentro. */
export function agruparPorDia(items: ItemPunteo[]): DiaPunteo[] {
  const porFecha = new Map<string, ItemPunteo[]>();
  for (const it of items) {
    const f = it.fecha.slice(0, 10);
    const arr = porFecha.get(f);
    if (arr) arr.push(it);
    else porFecha.set(f, [it]);
  }
  return Array.from(porFecha.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([fecha, arr]) => ({
      fecha,
      items: arr.slice().sort(compararEnDia),
      totalIngresos: round2(arr.filter((i) => i.importe > 0).reduce((s, i) => s + i.importe, 0)),
      totalGastos: round2(arr.filter((i) => i.importe < 0).reduce((s, i) => s + i.importe, 0)),
    }));
}

// ─── Chips de estado (con regla de ocultar-a-cero) ──────────────────────────

export interface ConteoEstados {
  todos: number;
  previstos: number;
  confirmados: number;
  conciliados: number;
  discrepancias: number;
}

export function contarEstados(items: ItemPunteo[]): ConteoEstados {
  let previstos = 0;
  let confirmados = 0;
  let conciliados = 0;
  let discrepancias = 0;
  for (const it of items) {
    if (it.estado === 'previsto') previstos++;
    else if (it.estado === 'confirmado') confirmados++;
    else conciliados++;
    if (it.discrepancia && !it.discrepancia.revisada) discrepancias++;
  }
  return { todos: items.length, previstos, confirmados, conciliados, discrepancias };
}

export type ChipEstado = 'todos' | 'previstos' | 'confirmados' | 'conciliados' | 'discrepancias';

/**
 * Chips visibles: los que están a 0 se ocultan, SALVO Todos y Previstos
 * (siempre presentes · son la vista base y la cola de trabajo).
 */
export function chipsVisibles(c: ConteoEstados): ChipEstado[] {
  const out: ChipEstado[] = ['todos', 'previstos'];
  if (c.confirmados > 0) out.push('confirmados');
  if (c.conciliados > 0) out.push('conciliados');
  if (c.discrepancias > 0) out.push('discrepancias');
  return out;
}

export function filtrarPorChip(items: ItemPunteo[], chip: ChipEstado): ItemPunteo[] {
  switch (chip) {
    case 'todos':
      return items;
    case 'previstos':
      return items.filter((i) => i.estado === 'previsto');
    case 'confirmados':
      return items.filter((i) => i.estado === 'confirmado');
    case 'conciliados':
      return items.filter((i) => i.estado === 'conciliado');
    case 'discrepancias':
      return items.filter((i) => i.discrepancia && !i.discrepancia.revisada);
  }
}

// ─── Madre/hijas (alquiler por habitaciones · recibos fraccionados) ─────────

export interface GrupoPunteo {
  grupoId: string;
  hijas: ItemPunteo[];
  cobradas: number;
  total: number;
  /** Importe ya real (suma de hijas reales). */
  importeReal: number;
  /** Importe previsto total del grupo. */
  importePrevistoTotal: number;
  completo: boolean;
}

/**
 * Agrupa los items que comparten `grupoId` dentro del mismo día. Devuelve la
 * lista con las hijas de cada grupo contiguas y el índice de grupos. Un grupo
 * de 1 no forma madre.
 */
export function agruparHijas(items: ItemPunteo[]): Map<string, GrupoPunteo> {
  const grupos = new Map<string, GrupoPunteo>();
  for (const it of items) {
    if (!it.grupoId) continue;
    let g = grupos.get(it.grupoId);
    if (!g) {
      g = { grupoId: it.grupoId, hijas: [], cobradas: 0, total: 0, importeReal: 0, importePrevistoTotal: 0, completo: false };
      grupos.set(it.grupoId, g);
    }
    g.hijas.push(it);
    g.total++;
    g.importePrevistoTotal = round2(g.importePrevistoTotal + (it.importePrevisto ?? it.importe));
    if (esReal(it.estado)) {
      g.cobradas++;
      g.importeReal = round2(g.importeReal + it.importe);
    }
  }
  for (const g of grupos.values()) {
    g.completo = g.cobradas === g.total;
    if (g.total < 2) grupos.delete(g.grupoId);
  }
  return grupos;
}

// ─── Utilidades ─────────────────────────────────────────────────────────────

export const round2 = (n: number): number => Math.round(n * 100) / 100;
