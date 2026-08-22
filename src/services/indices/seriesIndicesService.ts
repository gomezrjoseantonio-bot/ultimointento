// Lectura de las series oficiales · Euríbor, IPC e IRAV.
//
// El dato llega de un fichero estático que una tarea programada regenera cada
// mes (`scripts/indices/actualizar-indices.mjs`). Aquí solo se lee, se cachea
// para poder trabajar sin conexión, y se responde SIEMPRE por mes concreto.
//
// Tres reglas que gobiernan este módulo, y que valen más que su código:
//
//   1. No se rellenan huecos. Si no hay dato del mes que se pide, se devuelve
//      `null`. Devolver «el del mes anterior, que se le parece» es fabricar el
//      número del que cuelga una cuota o una renta.
//   2. Lo automático no pisa lo manual. Este servicio no escribe en
//      `financialValuesSnapshot`: propone, y quien decide es quien teclea.
//   3. Si la descarga falla se usa la última copia buena y se puede saber que
//      va con retraso (`mesesDeRetraso`). Un dato viejo señalado es útil; un
//      dato viejo disfrazado de fresco, no.

import { initDB } from '../db';
import type {
  IdSerie,
  SerieIndice,
  UnidadSerie,
  ValorDeSerie,
} from '../../types/seriesIndices';

const CLAVE_CACHE = (id: IdSerie) => `serieIndice:${id}`;

const RUTA = (id: IdSerie) => `${process.env.PUBLIC_URL ?? ''}/data/indices/${id}.json`;

/** `'2026-07'` a partir de una fecha ISO (`'2026-07-14'` o completa). */
export const periodoDe = (fechaISO: string): string => fechaISO.slice(0, 7);

const ES_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * ¿Esto que hemos descargado o leído de caché es una serie?
 *
 * Se valida a la entrada y no al usarla porque un JSON a medias —una descarga
 * cortada, un despliegue viejo— tiene que caer aquí y no tres capas más abajo
 * dentro de un cálculo, donde ya parece un número legítimo.
 */
export function esSerieValida(dato: unknown): dato is SerieIndice {
  if (typeof dato !== 'object' || dato === null) return false;
  const s = dato as Partial<SerieIndice>;
  if (s.esquema !== 1) return false;
  if (typeof s.id !== 'string' || typeof s.nombre !== 'string') return false;
  if (s.unidad !== 'porcentaje' && s.unidad !== 'indice') return false;
  if (typeof s.cadenciaMeses !== 'number' || s.cadenciaMeses <= 0) return false;
  if (typeof s.fuente !== 'object' || s.fuente === null) return false;
  if (typeof s.valores !== 'object' || s.valores === null) return false;
  return Object.entries(s.valores).every(
    ([periodo, valor]) => ES_PERIODO.test(periodo) && typeof valor === 'number' && Number.isFinite(valor),
  );
}

async function leerCache(id: IdSerie): Promise<SerieIndice | null> {
  try {
    const db = await initDB();
    const dato = await db.get('keyval', CLAVE_CACHE(id));
    return esSerieValida(dato) ? dato : null;
  } catch {
    return null;
  }
}

async function escribirCache(serie: SerieIndice): Promise<void> {
  try {
    const db = await initDB();
    await db.put('keyval', serie as never, CLAVE_CACHE(serie.id));
  } catch {
    // Sin caché se sigue funcionando · solo se pierde el modo sin conexión.
  }
}

/**
 * La serie, de la red si se puede y de la caché si no.
 *
 * `cache: 'no-cache'` pide revalidación: el fichero cambia una vez al mes y una
 * copia cacheada por el service worker durante semanas dejaría el índice nuevo
 * sin llegar justo el mes en que hace falta.
 */
export async function cargarSerie(id: IdSerie): Promise<SerieIndice | null> {
  try {
    const respuesta = await fetch(RUTA(id), { cache: 'no-cache' });
    if (!respuesta.ok) throw new Error(String(respuesta.status));
    const dato: unknown = await respuesta.json();
    if (!esSerieValida(dato)) throw new Error('formato inesperado');
    await escribirCache(dato);
    return dato;
  } catch {
    return leerCache(id);
  }
}

/** El último mes con dato publicado · `null` si la serie está vacía. */
export function ultimoPeriodo(serie: SerieIndice): string | null {
  const periodos = Object.keys(serie.valores).sort();
  return periodos.length > 0 ? periodos[periodos.length - 1] : null;
}

/**
 * El valor de un mes concreto. Sin aproximaciones: o está, o es `null`.
 */
export function valorEnMes(serie: SerieIndice, periodo: string): ValorDeSerie | null {
  const valor = serie.valores[periodo];
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null;
  return { valor, periodo, unidad: serie.unidad, fuente: serie.fuente, metodo: 'auto' };
}

/**
 * Variación interanual en % de un mes · solo tiene sentido en series `indice`.
 *
 * El IPC se publica como número índice sobre una base, y lo que se aplica a una
 * renta es cuánto ha subido respecto al MISMO mes del año anterior. Sin el dato
 * de hace doce meses no hay variación que calcular, y se devuelve `null`.
 */
export function variacionInteranual(serie: SerieIndice, periodo: string): number | null {
  if (serie.unidad !== 'indice') return null;
  const actual = serie.valores[periodo];
  const anterior = serie.valores[restarUnAno(periodo)];
  if (typeof actual !== 'number' || typeof anterior !== 'number' || anterior === 0) return null;
  return (actual / anterior - 1) * 100;
}

/**
 * El porcentaje que aplicaría a una actualización de renta de ese mes.
 *
 * Unifica las dos formas en que publican los organismos: el IRAV ya viene como
 * tasa y se usa tal cual; el IPC viene como índice y hay que compararlo con el
 * de hace un año. Quien llama no debería tener que saber cuál es cuál.
 */
export function porcentajeDeActualizacion(serie: SerieIndice, periodo: string): number | null {
  if (serie.unidad === 'porcentaje') return valorEnMes(serie, periodo)?.valor ?? null;
  return variacionInteranual(serie, periodo);
}

/**
 * Cuántos meses lleva la serie sin dato nuevo, descontando su cadencia normal.
 *
 * `0` es al día. Un número mayor que 0 significa que la fuente publicó algo que
 * no tenemos, o que la tarea programada lleva rota ese tiempo. Es lo que
 * permite avisar en pantalla en vez de servir un índice viejo en silencio.
 */
export function mesesDeRetraso(serie: SerieIndice, hoyISO: string): number | null {
  const ultimo = ultimoPeriodo(serie);
  if (!ultimo) return null;
  const distancia = mesesEntre(ultimo, periodoDe(hoyISO));
  return Math.max(0, distancia - serie.cadenciaMeses);
}

const restarUnAno = (periodo: string): string => {
  const [ano, mes] = periodo.split('-');
  return `${Number(ano) - 1}-${mes}`;
};

const mesesEntre = (desde: string, hasta: string): number => {
  const [a1, m1] = desde.split('-').map(Number);
  const [a2, m2] = hasta.split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
};

export type { IdSerie, SerieIndice, UnidadSerie, ValorDeSerie };
