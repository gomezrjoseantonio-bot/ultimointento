// ============================================================================
// §4.5 · rellenar la ficha desde una fila de punteo
// ============================================================================
//
// Vive aquí y no dentro de un drawer porque el lápiz existe en los DOS: en la
// cuenta (§4.4) y en el día (§4.9). Estaba escrito solo en el de cuenta, así
// que al conectar el del día habría acabado copiado — y un mapeo duplicado es
// un mapeo que se corrige en un sitio y se olvida en el otro.
// ============================================================================

import type { ItemPunteo } from '../../../services/punteo/punteoModel';
import type { ValoresFicha } from './FichaMovimiento';

/**
 * Rellena la ficha con lo que ya sabe ATLAS · el usuario solo corrige (§4.5).
 *
 * La clasificación es la del catálogo único (familia + subtipo) tal y como está
 * persistida: no hay traducción que hacer.
 */
export function valoresDesdeItem(
  item: ItemPunteo,
  cuentaId: number | null
): Partial<ValoresFicha> {
  // Un traspaso interno se abre SIEMPRE mirando desde el origen, se haya
  // pulsado el lápiz en la pata que se haya pulsado: "de esta cuenta a esta
  // otra" se lee igual desde las dos, y con la entrada de titular el usuario
  // vería el traspaso del revés.
  if (item.traspaso) {
    return {
      tipo: 'transferencia',
      concepto: (item.detalle ?? item.concepto).replace(/ · (salida|entrada)$/, ''),
      importe: -Math.abs(item.importe),
      fecha: item.fecha,
      cuentaId: item.traspaso.origenId,
      cuentaDestinoId: item.traspaso.destinoId,
      inmuebleId: null,
    };
  }

  // El ámbito lo decide el inmueble del apunte. La clasificación viaja tal cual
  // está persistida (familia + subtipo del catálogo único): si no la hay, la
  // ficha abre SIN CLASIFICAR, que es la verdad, en vez de con la primera
  // familia del catálogo, que al guardar reclasificaría a espaldas del usuario.
  const inmuebleId = typeof item.activo?.inmuebleId === 'number' ? item.activo.inmuebleId : null;
  return {
    tipo: item.importe >= 0 ? 'ingreso' : 'gasto',
    // La ficha edita la DESCRIPCIÓN del movimiento, no el rótulo de la fila.
    // Desde §6.3 el título de la fila es quién cobra ("Mapfre") y la
    // descripción baja a `detalle`; abrir la ficha con "Mapfre" en el campo de
    // texto sobrescribiría "Seguro hogar" en cuanto se guardara.
    concepto: item.detalle ?? item.concepto,
    importe: item.importe,
    fecha: item.fecha,
    cuentaId: item.cuentaId ?? cuentaId,
    inmuebleId,
    // Sin esto, corregir un importe borraría la tarjeta: la ficha guarda lo que
    // tiene en pantalla, y lo que no le llega llega vacío.
    tarjetaId: item.tarjetaId ?? null,
    ...(item.familia ? { familia: item.familia, subtipo: item.subtipo ?? '' } : {}),
  };
}
