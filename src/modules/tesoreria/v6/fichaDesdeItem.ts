// ============================================================================
// §4.5 · rellenar la ficha desde una fila de punteo
// ============================================================================
//
// Vive aquí y no dentro de un drawer porque el lápiz existe en los DOS: en la
// cuenta (§4.4) y en el día (§4.9). Estaba escrito solo en el de cuenta, así
// que al conectar el del día habría acabado copiado — y un mapeo duplicado es
// un mapeo que se corrige en un sitio y se olvida en el otro.
// ============================================================================

import { presentacionDe } from '../../../services/catalogoPresentacionPersistencia';
import type { ItemPunteo } from '../../../services/punteo/punteoModel';
import type { ValoresFicha } from './FichaMovimiento';

/**
 * Rellena la ficha con lo que ya sabe ATLAS · el usuario solo corrige (§4.5).
 *
 * La clasificación se recupera haciendo el camino inverso de la tabla de
 * traducción: el registro guarda `categoryKey`, pero la ficha enseña familia y
 * concepto. Si la vuelta no es unívoca, `presentacionDe` devuelve `undefined` y
 * la ficha abre SIN CLASIFICAR — que es la verdad — en vez de con la primera
 * familia del catálogo, que al guardar habría reclasificado a espaldas del
 * usuario.
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

  const presentacion = presentacionDe(item.categoryKey, item.subtypeKey);
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
    inmuebleId: typeof item.activo?.inmuebleId === 'number' ? item.activo.inmuebleId : null,
    ...(presentacion ? { familia: presentacion.tipoId, subtipo: presentacion.subtipoId } : {}),
  };
}
