// ============================================================================
// PROVEEDORES · quién cobra
// ============================================================================
//
// Estaba dentro de `types-inmuebles.ts` y no es una cosa de inmuebles: un
// proveedor es quien cobra, y cobra igual por un piso que por la luz de casa.
// Se saca aquí en E3.1b, cuando el store pasa a ser TAMBIÉN el catálogo de
// «quién cobra y qué es» (un solo sitio · decisión de Jose).
// ============================================================================

export interface Proveedor {
  nif: string;
  nombre?: string;
  tipos: string[];
  /**
   * E3.1b · UN SOLO SITIO para «quién cobra y qué es». `tipos` dice a qué
   * casilla AEAT va; esto dice QUÉ ES, que es lo que el motor necesita para
   * clasificar un cargo por el NIF de quien cobra. `alias` es cómo lo escribe
   * el BANCO («FCC AQUALI447497»), que ningún registro oficial recoge.
   * `origen`: 'cliente' es tuyo y no sale de aquí (el NIF del fontanero es un
   * DNI); 'nacional' va anclado a un CIF de EMPRESA y por eso es compartible.
   */
  familia?: string;
  subtipo?: string;
  ambito?: 'personal' | 'inmueble';
  alias?: string[];
  confirmaciones?: number;
  origen?: 'cliente' | 'nacional';
  /**
   * V77 · wizard import XML V2 (pilar 3) · placeholder creado desde el XML sin
   * nombre conocido. La UI muestra badge "sin nombre" y el usuario lo completa
   * después. Sin índice · no requiere bump adicional.
   */
  sinNombre?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OperacionProveedor {
  id?: number;
  proveedorNif: string;
  inmuebleId: number;
  ejercicio: number;
  tipo: 'mejora' | 'reparacion' | 'gestion' | 'servicios';
  importe: number;
  documentId?: number;
  createdAt: string;
}

/**
 * E3.1b · LA clave del store, y una sola forma de calcularla.
 *
 * `proveedores` usa `nif` como keyPath, así que la clave tiene que salir igual
 * la escriba quien la escriba. Sin esto, un escritor que guarde «b33558172 » y
 * otro que busque «B33558172» crean DOS filas del mismo proveedor, y la segunda
 * nace sin sus `tipos` AEAT, sin su familia y sin su historial.
 */
export function claveDeProveedor(nif: string): string {
  return nif.toUpperCase().replace(/[\s.\-/]/g, '');
}
