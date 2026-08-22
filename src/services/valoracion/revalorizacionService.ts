// Lo que pagaste, actualizado por lo que ha hecho el mercado desde entonces.
//
// El otro método de valoración. El precio de zona mira lo que se paga hoy en
// esa calle; este parte de un dato que sí es tuyo —lo que costó y cuándo— y le
// aplica el Índice de Precios de Vivienda del INE.
//
// Ninguno de los dos es mejor: se equivocan por motivos distintos. El de zona
// no sabe cómo es tu piso; este supone que se ha comportado como la media
// nacional. Por eso interesan los dos: cuando convergen, la estimación es
// sólida; cuando se separan, esa distancia es la información.

import { cargarSerie, periodoDe, variacionEntre } from '../indices/seriesIndicesService';

export interface Revalorizacion {
  /** El precio de compra llevado a hoy. */
  valor: number;
  /** Lo que se pagó, tal cual. */
  precioCompra: number;
  /** Cuánto ha subido el índice desde entonces · 1,88 es un +88 %. */
  factor: number;
  /** El trimestre de referencia de la compra · `'2015-06'`. */
  periodoCompra: string;
  /** El último trimestre publicado. */
  periodoActual: string;
  fuente: string;
}

/**
 * Revaloriza una compra con el IPV.
 *
 * Devuelve `null` en cuanto falte algo: sin precio, sin fecha, sin serie o sin
 * un trimestre publicado cerca de la compra. Un valor a medias aquí sería un
 * número inventado con aspecto de cálculo.
 */
export async function revalorizarCompra(
  precioCompra: number,
  fechaCompraISO: string,
  hoyISO: string = new Date().toISOString().slice(0, 10),
): Promise<Revalorizacion | null> {
  if (!Number.isFinite(precioCompra) || precioCompra <= 0) return null;
  if (!fechaCompraISO || fechaCompraISO.length < 7) return null;

  const serie = await cargarSerie('ipv-segunda-mano');
  if (!serie) return null;

  const periodoCompra = periodoDe(fechaCompraISO);
  const periodoHoy = periodoDe(hoyISO);
  const factor = variacionEntre(serie, periodoCompra, periodoHoy);
  if (factor == null) return null;

  const publicados = Object.keys(serie.valores).sort();
  return {
    valor: Math.round(precioCompra * factor),
    precioCompra,
    factor,
    periodoCompra,
    periodoActual: publicados[publicados.length - 1],
    fuente: serie.fuente.nombre,
  };
}
