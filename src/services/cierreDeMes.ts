// ============================================================================
// Cerrar el mes · VOCABULARIO §6 quater
// ============================================================================
//
// Un mes abierto no distingue «el cobro está por llegar» de «el cobro no ha
// llegado». Los dos salen como «todavía no cuenta», y con eso una bonificación
// no se puede perder nunca — ni ganar del todo.
//
// No se arregla con un umbral de días. Lo arregla ESTO: hay un momento en que
// se trabaja para cerrar el mes, y **lo que quede abierto entonces es que no se
// ha producido** *(decisión de Jose · 4 ago 2026)*.
//
// Cerrar es un acto del usuario, con tres reglas que salen de cómo lo pidió
// *(Jose · 5 ago 2026: «mes entero, con la lista delante y pudiendo reabrir»)*:
//
//   1. **Mes entero.** No se cierra cuenta a cuenta: el mes es la unidad con la
//      que se trabaja, y media verdad por cuenta sería peor que ninguna.
//   2. **La lista delante.** `loQueQuedaAbierto` dice exactamente qué se va a
//      dar por no ocurrido, con sus importes, ANTES de tocar nada. Cerrar sin
//      ver la lista es borrar previsiones de un plumazo.
//   3. **Se puede reabrir**, y reabrir devuelve **solo lo que este cierre
//      descartó**. Lo que el usuario había descartado a mano antes sigue
//      descartado: no lo descartó el cierre, así que no le toca deshacerlo.
//
// No inventa nada nuevo para marcar lo no ocurrido: usa `descartado`, que ya
// significa eso y ya sabe que no es un borrado (V84).
// ============================================================================

import { initDB, type TreasuryEvent } from './db';

/** Dónde vive la lista de meses cerrados. */
const CLAVE = 'cierresDeMes';

export interface CierreDeMes {
  /** El mes cerrado · `YYYY-MM`. */
  mes: string;
  /** Cuándo se cerró · ISO. */
  cerradoAt: string;
  /**
   * Los eventos que ESTE cierre dio por no ocurridos.
   *
   * Se guardan uno a uno para que reabrir devuelva exactamente estos y no lo
   * que el usuario ya había descartado por su cuenta.
   */
  descartados: number[];
}

/** Lo que quedaría por ocurrido si se cerrara ahora mismo. */
export interface LoQueQuedaAbierto {
  mes: string;
  eventos: TreasuryEvent[];
  /** Lo que se daría por NO cobrado. */
  totalEntra: number;
  /** Lo que se daría por NO pagado. */
  totalSale: number;
}

const esMes = (mes: string): boolean => /^\d{4}-\d{2}$/.test(mes);

/** El mes de una fecha ISO · `2026-08-05` → `2026-08`. */
const mesDe = (iso: string): string => (iso ?? '').slice(0, 7);

/**
 * Los previstos de ese mes que siguen sin ocurrir.
 *
 * Un evento **ejecutado** no entra: ocurrió. Uno ya **descartado** tampoco: ya
 * consta como no ocurrido, y volver a contarlo lo apuntaría dos veces en el
 * recibo del cierre y lo resucitaría al reabrir.
 */
const sigueAbierto = (e: TreasuryEvent): boolean =>
  e.status !== 'executed' && e.descartado !== true && typeof e.id === 'number';

const siguenAbiertos = (eventos: TreasuryEvent[], mes: string): TreasuryEvent[] =>
  eventos.filter((e) => mesDe(e.predictedDate) === mes && sigueAbierto(e));

/** Los meses cerrados, tal como están guardados. */
export async function cierres(): Promise<CierreDeMes[]> {
  const db = await initDB();
  const guardado = (await db.get('keyval', CLAVE)) as CierreDeMes[] | undefined;
  return Array.isArray(guardado) ? guardado : [];
}

/** Si ese mes está cerrado. */
export async function estaCerrado(mes: string): Promise<boolean> {
  return (await cierres()).some((c) => c.mes === mes);
}

/**
 * Los meses que se pueden cerrar · del más reciente al más antiguo.
 *
 * Vive aquí y no en la pantalla porque «qué mes se puede cerrar» es la misma
 * regla que aplica `cerrarMes` al negarse: solo un mes YA TERMINADO. Escrita en
 * los dos sitios, la pantalla acabaría ofreciendo un botón que el motor rechaza.
 */
export function mesesParaCerrar(hoy: string, cuantos = 6): string[] {
  const actual = mesDe(hoy);
  if (!esMes(actual)) return [];

  const [y, m] = actual.split('-').map(Number);
  const meses: string[] = [];
  for (let i = 1; i <= cuantos; i++) {
    meses.push(new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
  }
  return meses;
}

/**
 * Qué se va a dar por no ocurrido · LA LISTA DELANTE.
 *
 * Se llama antes de cerrar y no toca nada. Devuelve la lista vacía si el mes ya
 * está cerrado: no hay nada que enseñar.
 */
export async function loQueQuedaAbierto(mes: string): Promise<LoQueQuedaAbierto> {
  const vacio: LoQueQuedaAbierto = { mes, eventos: [], totalEntra: 0, totalSale: 0 };
  if (!esMes(mes) || (await estaCerrado(mes))) return vacio;

  const db = await initDB();
  const eventos = siguenAbiertos((await db.getAll('treasuryEvents')) as TreasuryEvent[], mes);

  return { mes, eventos, ...totales(eventos) };
}

const suma = (total: number, e: TreasuryEvent): number => total + Math.abs(Number(e.amount) || 0);
const redondear = (n: number): number => Math.round(n * 100) / 100;

/** Lo que no entraría y lo que no saldría · el mismo reparto para los dos sitios. */
const totales = (eventos: TreasuryEvent[]): { totalEntra: number; totalSale: number } => ({
  totalEntra: redondear(eventos.filter((e) => e.type === 'income').reduce(suma, 0)),
  totalSale: redondear(eventos.filter((e) => e.type !== 'income').reduce(suma, 0)),
});

/** Un mes de la tira de cierre · lo que hay que saber de él sin abrirlo. */
export interface MesCerrable {
  mes: string;
  /** Cuándo se cerró · ausente = sigue abierto. */
  cerradoAt?: string;
  /** Lo que quedaría por ocurrido · o lo que quedó, si ya está cerrado. */
  cuantos: number;
  totalEntra: number;
  totalSale: number;
}

/**
 * La tira de meses cerrables, con su estado · UNA lectura y UNA pasada.
 *
 * Preguntar mes a mes con `loQueQuedaAbierto` daría lo mismo, pero leyendo la
 * base de datos y recorriendo los eventos una vez por cada mes. La lista que
 * enseña la pantalla sale de aquí.
 */
export async function mesesCerrables(hoy: string, cuantos = 6): Promise<MesCerrable[]> {
  const meses = mesesParaCerrar(hoy, cuantos);
  if (meses.length === 0) return [];

  const db = await initDB();
  const [cerrados, eventos] = await Promise.all([
    cierres(),
    db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
  ]);

  const porMes = new Map<string, TreasuryEvent[]>();
  for (const e of eventos) {
    if (!sigueAbierto(e)) continue;
    const suyo = porMes.get(mesDe(e.predictedDate));
    if (suyo) suyo.push(e);
    else porMes.set(mesDe(e.predictedDate), [e]);
  }

  return meses.map((mes) => {
    const cerrado = cerrados.find((c) => c.mes === mes);
    // Un mes cerrado ya no tiene «lo que quedaría»: lo que quedaba está
    // descartado, y lo que se cuenta es cuánto fue.
    if (cerrado) {
      return {
        mes,
        cerradoAt: cerrado.cerradoAt,
        cuantos: cerrado.descartados.length,
        totalEntra: 0,
        totalSale: 0,
      };
    }

    const abiertos = porMes.get(mes) ?? [];
    return { mes, cuantos: abiertos.length, ...totales(abiertos) };
  });
}

/**
 * Cierra el mes · lo que quedaba abierto pasa a NO ocurrido.
 *
 * Solo se cierra un mes **ya terminado**: al mes en curso todavía le quedan
 * días para que llegue lo que falta, y darlo por no ocurrido sería exactamente
 * el número inventado que esto viene a evitar.
 *
 * Idempotente: cerrar dos veces devuelve el cierre que ya había sin volver a
 * descartar nada.
 */
export async function cerrarMes(mes: string, hoy: string): Promise<CierreDeMes> {
  if (!esMes(mes)) throw new Error('El mes se dice en formato AAAA-MM');
  if (mes >= mesDe(hoy)) throw new Error('Solo se cierra un mes que ya ha terminado');

  const yaCerrado = (await cierres()).find((c) => c.mes === mes);
  if (yaCerrado) return yaCerrado;

  const db = await initDB();
  const abiertos = siguenAbiertos((await db.getAll('treasuryEvents')) as TreasuryEvent[], mes);

  const cerradoAt = new Date().toISOString();
  const tx = db.transaction('treasuryEvents', 'readwrite');
  for (const e of abiertos) {
    await tx.objectStore('treasuryEvents').put({
      ...e,
      descartado: true,
      descartadoAt: cerradoAt,
      motivoDescarte: `Cierre de ${mes}`,
    });
  }
  await tx.done;

  // Se vuelve a leer para escribir · entre la comprobación de arriba y esta
  // línea ha habido esperas, y sin esto dos cierres del mismo mes lanzados a la
  // vez dejarían DOS registros: `reabrirMes` cogería el primero que encuentre y
  // podría no devolver nada. Un mes, un cierre — y si el otro ya descartó algo,
  // sus ids se conservan en vez de perderse.
  const previos = await cierres();
  const gemelo = previos.find((c) => c.mes === mes);
  const cierre: CierreDeMes = {
    mes,
    cerradoAt: gemelo?.cerradoAt ?? cerradoAt,
    descartados: [...new Set([...(gemelo?.descartados ?? []), ...abiertos.map((e) => e.id as number)])],
  };
  await db.put('keyval', [...previos.filter((c) => c.mes !== mes), cierre], CLAVE);
  return cierre;
}

/**
 * Reabre el mes · devuelve a previsto SOLO lo que este cierre descartó.
 *
 * Lo que el usuario había descartado a mano antes sigue descartado: no lo
 * descartó el cierre, así que reabrirlo no es asunto suyo.
 */
export async function reabrirMes(mes: string): Promise<void> {
  const todos = await cierres();
  const cierre = todos.find((c) => c.mes === mes);
  if (!cierre) return;

  const db = await initDB();
  const tx = db.transaction('treasuryEvents', 'readwrite');
  const store = tx.objectStore('treasuryEvents');
  for (const id of cierre.descartados) {
    const e = (await store.get(id)) as TreasuryEvent | undefined;
    // Uno que ya no existe, o que entretanto se ejecutó de verdad, se deja como
    // está: reabrir el mes no puede desandar un hecho posterior.
    if (!e || e.status === 'executed') continue;
    // Las marcas se QUITAN, no se ponen a false · es lo que hace
    // `recuperarPrevisto`, y así no conviven dos maneras de decir «esto no está
    // descartado»: sin marca, y con la marca a false colgando.
    const { descartado, descartadoAt, motivoDescarte, ...limpio } = e;
    void descartado;
    void descartadoAt;
    void motivoDescarte;
    await store.put(limpio as TreasuryEvent);
  }
  await tx.done;

  await db.put('keyval', todos.filter((c) => c.mes !== mes), CLAVE);
}
