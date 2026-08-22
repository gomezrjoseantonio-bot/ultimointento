// Lo que se paga por metro cuadrado en una zona · Notariado.
//
// Sale del Portal Estadístico del Notariado, que publica PRECIOS DE ESCRITURA:
// dinero que cambió de manos ante notario, no lo que alguien pide en un
// anuncio. Su granularidad máxima es el código postal, que es justo lo que
// `Property.postalCode` ya guarda.
//
// Esto NO es una tasación y el tipo está pensado para que no pueda confundirse
// con una: cada dato viaja con el nivel geográfico del que sale, cuántas
// escrituras hay detrás y si el propio Notariado lo marca como estimado. Un
// número sin esa compañía no debería enseñarse.

export type NivelZona = 'codigo-postal' | 'provincia';

/** Régimen del inmueble, tal como lo guarda `Property.transmissionRegime`. */
export type RegimenInmueble = 'usada' | 'obra-nueva';

export interface PrecioZona {
  /** Euros por metro cuadrado de la zona. */
  precioM2: number;
  /** Precio medio de la operación completa en la zona. */
  precioMedio: number;
  /** Superficie media de las viviendas de la zona. */
  superficieMedia: number;
  /** Escrituras sobre las que se calcula · con cuatro, la media no dice nada. */
  operaciones: number;
  /** De esas, cuántas tenían el dato informado. */
  operacionesInformadas: number;
  /** El propio Notariado marca cuándo su cifra es estimada y no medida. */
  estimado: boolean;
  /** De qué nivel salió · si hubo que subir de código postal a provincia. */
  nivel: NivelZona;
  /** El código consultado · `'08272'` o `'08'`. */
  zona: string;
  /** Cuándo se preguntó · el servicio no dice a qué periodo corresponde. */
  consultadoEn: string;
}

/**
 * Una estimación de valor, con todo lo que hace falta para juzgarla.
 *
 * `valor` nunca se enseña solo. La fiabilidad no es un adorno: con 3 escrituras
 * detrás, el número es una anécdota; con 200, una referencia.
 */
export interface EstimacionZona {
  valor: number;
  precioZona: PrecioZona;
  /** Qué crédito darle · lo decide el tamaño de la muestra y el nivel. */
  fiabilidad: 'alta' | 'media' | 'baja';
}
