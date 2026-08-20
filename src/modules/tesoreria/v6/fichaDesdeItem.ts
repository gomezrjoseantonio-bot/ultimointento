// ============================================================================
// §4.5 · rellenar la ficha desde una fila de punteo
// ============================================================================
//
// Vive aquí y no dentro de un drawer porque el lápiz existe en los DOS: en la
// cuenta (§4.4) y en el día (§4.9). Estaba escrito solo en el de cuenta, así
// que al conectar el del día habría acabado copiado — y un mapeo duplicado es
// un mapeo que se corrige en un sitio y se olvida en el otro.
// ============================================================================

import { conceptoDesdeClasificacion, conceptoPorId } from '../../../services/conceptos/catalogoConceptos';
import type { ItemPunteo } from '../../../services/punteo/punteoModel';
import type { ValoresFicha } from './FichaMovimiento';

/**
 * Rellena la ficha con lo que ya sabe ATLAS · el usuario solo corrige (§4.5).
 *
 * La clasificación se recupera haciendo el camino inverso del catálogo
 * unificado: el registro guarda `categoryKey`, pero la ficha enseña familia y
 * concepto. Si la vuelta no es unívoca —o el gasto es personal, donde la key es
 * de brocha gorda—, `conceptoDesdeClasificacion` devuelve `undefined` y la ficha
 * abre SIN CLASIFICAR, que es la verdad, en vez de con la primera familia del
 * catálogo, que al guardar habría reclasificado a espaldas del usuario.
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

  // El ámbito lo decide el inmueble del apunte · en personal la clasificación
  // no es invertible (la key es de brocha gorda) y la ficha abre sin ella.
  const inmuebleId = typeof item.activo?.inmuebleId === 'number' ? item.activo.inmuebleId : null;
  // El concepto FINO guardado (F2) manda sobre la inversión gorda del
  // `categoryKey`: si el apunte recuerda que era "limpieza" o "gestoría", la
  // ficha reabre justo ese, en vez de re-derivar uno cualquiera de su familia y
  // corromperlo al guardar. Solo si no lo hay se recurre a la inversión.
  const guardado = item.conceptoId ? conceptoPorId(item.conceptoId) : undefined;
  const clas = guardado
    ? { familia: guardado.familia, conceptoId: guardado.id }
    : conceptoDesdeClasificacion(
        item.categoryKey,
        item.subtypeKey,
        inmuebleId != null ? 'inmueble' : 'personal',
      );
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
    categoryKey: item.categoryKey ?? null,
    subtypeKey: item.subtypeKey ?? null,
    ...(clas ? { familia: clas.familia, subtipo: clas.conceptoId } : {}),
  };
}
