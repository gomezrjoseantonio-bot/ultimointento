// Series oficiales publicadas · Euríbor, IPC e IRAV.
//
// Son datos PÚBLICOS e iguales para todo el mundo: no son del usuario, así que
// no viven en un store propio de IndexedDB sino en ficheros estáticos que una
// tarea programada actualiza sola (ver `docs/INDICES-automatizacion-v1.md`).
//
// La forma clave es `valores`: un mapa `'YYYY-MM' → número`, NO un valor único
// vigente. Una revisión de hipoteca de marzo necesita el índice DE MARZO, y una
// renta que se actualiza en septiembre el DE SEPTIEMBRE. Con un valor único, el
// dato correcto de hoy pisaba el dato correcto de ayer y los recálculos
// históricos dejaban de ser reproducibles.

export type IdSerie = 'euribor-12m' | 'ipc' | 'irav' | 'ipv-segunda-mano';

/**
 * Qué significa el número guardado.
 *
 * Existe porque no controlamos en qué formato publica cada organismo: el
 * Euríbor se publica como tipo (%), el IPC como número índice sobre una base, y
 * el IRAV como tasa (%). Guardar lo que publica la fuente —sin convertirlo al
 * vuelo— evita inventar precisión, y es el servicio quien decide qué hacer con
 * cada unidad al leer.
 */
export type UnidadSerie = 'porcentaje' | 'indice';

export interface FuenteSerie {
  /** Organismo, tal como se cita al usuario. */
  nombre: string;
  /** Página o endpoint del que sale el dato. */
  url: string;
  /** Identificador de la serie en el origen · para poder rehacer la descarga. */
  serieOrigen: string;
}

export interface SerieIndice {
  /** Versión del formato del fichero · sube si cambia la forma. */
  esquema: 1;
  id: IdSerie;
  nombre: string;
  unidad: UnidadSerie;
  /** Cada cuántos meses publica la fuente · para saber cuándo va con retraso. */
  cadenciaMeses: number;
  fuente: FuenteSerie;
  /** Cuándo corrió la última descarga · `null` si nunca se ha poblado. */
  actualizadoEn: string | null;
  /** `'YYYY-MM'` → valor publicado para ese mes. */
  valores: Record<string, number>;
}

/**
 * Un valor leído de una serie, con su procedencia pegada.
 *
 * La procedencia no es decorado: si un cálculo fiscal usa un índice, hay que
 * poder decir de dónde salió y de qué mes. `metodo` distingue lo descargado de
 * lo que teclea el usuario, y lo tecleado siempre manda.
 */
export interface ValorDeSerie {
  valor: number;
  periodo: string;
  unidad: UnidadSerie;
  fuente: FuenteSerie;
  metodo: 'auto';
}
