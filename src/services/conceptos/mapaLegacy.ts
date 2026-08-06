// ============================================================================
// PASO 1 · Mapa (tipoFamilia, subtipo) → concepto · el contrato de la migración
// ============================================================================
//
// Hoy un gasto guarda cuatro campos de clasificación —`tipoFamilia`, `subtipo`,
// `categoria` y `tipo`— copiados del catálogo de la pestaña en la que se creó y
// congelados desde entonces. La unificación los sustituye por uno: `concepto`,
// del que se derivan familia y categoría (esta última según el ámbito).
//
// Este fichero es SÓLO la traducción de lo viejo a lo nuevo. No proyecta
// categorías ni casillas AEAT: eso llega en el paso 2, cuando exista el
// catálogo unificado. Va primero y aparte porque es el contrato del que
// dependen los demás pasos, y porque es lo único que se puede fijar con tests
// antes de tocar nada.
//
// La clave es `${tipoFamilia}:${subtipo}` porque `subtipo` NO identifica por sí
// solo: `otros` existe en las seis familias de personal y en ocho de las nueve
// de inmueble. Esa ambigüedad es justamente lo que la unificación retira —los
// conceptos nuevos llevan id único—, pero para LEER lo viejo hace falta el par.
//
// Regla dura: ante un par desconocido se devuelve `null`. No se adivina. Un
// concepto decide la casilla AEAT del gasto, y una suposición razonable
// contamina la declaración sin que nadie se entere.
// ============================================================================

/** Las familias del catálogo unificado. */
export type FamiliaId =
  | 'alquiler'
  | 'tributos'
  | 'comunidad'
  | 'suministros'
  | 'seguros'
  | 'cuotas'
  | 'suscripciones'
  | 'dia_a_dia'
  | 'gestion'
  | 'reparacion'
  | 'servicios'
  | 'mobiliario'
  | 'otros';

export type Ambito = 'personal' | 'inmueble';

export interface ConceptoDestino {
  /** Único en el sistema entero · sustituye al par (familia, subtipo). */
  id: string;
  familia: FamiliaId;
  /** Dónde se puede elegir. La categoría se proyecta a partir de esto (paso 2). */
  ambitos: readonly Ambito[];
}

/**
 * El vocabulario de llegada.
 *
 * Vive aquí de momento para que el mapa se pueda validar contra algo; en el
 * paso 2 se muda al catálogo unificado con su proyección por ámbito, y este
 * fichero pasará a importarlo. Lo que NO cambiará son los `id`: son la
 * referencia que van a guardar los gastos migrados.
 */
export const CONCEPTOS_DESTINO: readonly ConceptoDestino[] = [
  // ── alquiler ──────────────────────────────────────────────────────────
  { id: 'alquiler_vivienda', familia: 'alquiler', ambitos: ['personal'] },

  // ── tributos ──────────────────────────────────────────────────────────
  { id: 'ibi', familia: 'tributos', ambitos: ['personal', 'inmueble'] },
  { id: 'tasa_basuras', familia: 'tributos', ambitos: ['personal', 'inmueble'] },
  { id: 'licencia_turistica', familia: 'tributos', ambitos: ['inmueble'] },
  // Una multa no es deducible en un inmueble · sólo personal.
  { id: 'multas', familia: 'tributos', ambitos: ['personal'] },
  { id: 'otros_tributos', familia: 'tributos', ambitos: ['personal', 'inmueble'] },

  // ── comunidad ─────────────────────────────────────────────────────────
  { id: 'comunidad_ordinaria', familia: 'comunidad', ambitos: ['personal', 'inmueble'] },
  { id: 'derrama', familia: 'comunidad', ambitos: ['personal', 'inmueble'] },
  { id: 'otros_comunidad', familia: 'comunidad', ambitos: ['personal', 'inmueble'] },

  // ── suministros ───────────────────────────────────────────────────────
  { id: 'luz', familia: 'suministros', ambitos: ['personal', 'inmueble'] },
  { id: 'gas', familia: 'suministros', ambitos: ['personal', 'inmueble'] },
  { id: 'agua', familia: 'suministros', ambitos: ['personal', 'inmueble'] },
  { id: 'internet', familia: 'suministros', ambitos: ['personal', 'inmueble'] },
  // Personal lo llamaba `movil` e inmueble `telefonia` · se unifica en uno.
  { id: 'telefonia', familia: 'suministros', ambitos: ['personal', 'inmueble'] },
  { id: 'alarma', familia: 'suministros', ambitos: ['personal', 'inmueble'] },
  { id: 'otros_suministros', familia: 'suministros', ambitos: ['personal', 'inmueble'] },

  // ── seguros ───────────────────────────────────────────────────────────
  { id: 'seguro_hogar', familia: 'seguros', ambitos: ['personal', 'inmueble'] },
  // El que empezó todo: existe en los dos ámbitos, y lo que decide la pregunta
  // de la hipoteca es a cuál va, no qué concepto se guarda.
  { id: 'seguro_vida', familia: 'seguros', ambitos: ['personal', 'inmueble'] },
  { id: 'seguro_salud', familia: 'seguros', ambitos: ['personal'] },
  { id: 'seguro_coche', familia: 'seguros', ambitos: ['personal'] },
  { id: 'seguro_impago', familia: 'seguros', ambitos: ['inmueble'] },
  { id: 'otros_seguros', familia: 'seguros', ambitos: ['personal', 'inmueble'] },

  // ── cuotas ────────────────────────────────────────────────────────────
  // Sale de partir `seguros_cuotas`: un gimnasio no es un seguro.
  { id: 'gimnasio', familia: 'cuotas', ambitos: ['personal'] },
  { id: 'educacion', familia: 'cuotas', ambitos: ['personal'] },
  { id: 'profesional', familia: 'cuotas', ambitos: ['personal'] },
  { id: 'ong', familia: 'cuotas', ambitos: ['personal'] },
  { id: 'otros_cuotas', familia: 'cuotas', ambitos: ['personal'] },

  // ── suscripciones ─────────────────────────────────────────────────────
  { id: 'streaming', familia: 'suscripciones', ambitos: ['personal'] },
  { id: 'musica', familia: 'suscripciones', ambitos: ['personal'] },
  { id: 'software', familia: 'suscripciones', ambitos: ['personal'] },
  { id: 'cloud', familia: 'suscripciones', ambitos: ['personal'] },
  { id: 'prensa', familia: 'suscripciones', ambitos: ['personal'] },
  { id: 'otros_suscripciones', familia: 'suscripciones', ambitos: ['personal'] },

  // ── día a día ─────────────────────────────────────────────────────────
  { id: 'supermercado', familia: 'dia_a_dia', ambitos: ['personal'] },
  { id: 'transporte', familia: 'dia_a_dia', ambitos: ['personal'] },
  { id: 'mantenimiento_coche', familia: 'dia_a_dia', ambitos: ['personal'] },
  // `salud_gasto` y no `salud` para no confundirlo con la CATEGORÍA `salud`,
  // que es a donde proyecta. Un id de concepto y una categoría con el mismo
  // nombre se leen mal en cuanto los dos aparecen juntos en un registro.
  { id: 'salud_gasto', familia: 'dia_a_dia', ambitos: ['personal'] },
  { id: 'restaurantes', familia: 'dia_a_dia', ambitos: ['personal'] },
  { id: 'ocio', familia: 'dia_a_dia', ambitos: ['personal'] },
  { id: 'ropa', familia: 'dia_a_dia', ambitos: ['personal'] },
  { id: 'cuidado_personal', familia: 'dia_a_dia', ambitos: ['personal'] },
  { id: 'otros_dia_a_dia', familia: 'dia_a_dia', ambitos: ['personal'] },

  // ── gestión ───────────────────────────────────────────────────────────
  { id: 'honorarios_agencia', familia: 'gestion', ambitos: ['inmueble'] },
  { id: 'gestoria', familia: 'gestion', ambitos: ['inmueble'] },
  { id: 'asesoria', familia: 'gestion', ambitos: ['inmueble'] },
  { id: 'comision_plataformas', familia: 'gestion', ambitos: ['inmueble'] },
  { id: 'otros_gestion', familia: 'gestion', ambitos: ['inmueble'] },

  // ── reparación ────────────────────────────────────────────────────────
  { id: 'mantenimiento_caldera', familia: 'reparacion', ambitos: ['inmueble'] },
  { id: 'mantenimiento_integral', familia: 'reparacion', ambitos: ['inmueble'] },
  { id: 'otros_reparacion', familia: 'reparacion', ambitos: ['inmueble'] },

  // ── servicios ─────────────────────────────────────────────────────────
  { id: 'limpieza', familia: 'servicios', ambitos: ['inmueble'] },
  { id: 'limpieza_zonas_comunes', familia: 'servicios', ambitos: ['inmueble'] },
  { id: 'limpieza_por_estancia', familia: 'servicios', ambitos: ['inmueble'] },
  { id: 'lavanderia', familia: 'servicios', ambitos: ['inmueble'] },
  { id: 'consumibles_bienvenida', familia: 'servicios', ambitos: ['inmueble'] },
  { id: 'otros_servicios', familia: 'servicios', ambitos: ['inmueble'] },

  // ── mobiliario ────────────────────────────────────────────────────────
  { id: 'ropa_enseres', familia: 'mobiliario', ambitos: ['inmueble'] },
  { id: 'muebles', familia: 'mobiliario', ambitos: ['inmueble'] },
  { id: 'otros_mobiliario', familia: 'mobiliario', ambitos: ['inmueble'] },

  // ── otros ─────────────────────────────────────────────────────────────
  // El que crea el usuario a mano · su proyección fiscal se pregunta al darlo
  // de alta, no se hereda de la familia.
  { id: 'personalizado', familia: 'otros', ambitos: ['personal', 'inmueble'] },
];

/**
 * Pares que YA NO están en ningún catálogo pero SÍ pueden estar en los datos.
 *
 * El catálogo ha cambiado con el tiempo, así que su contenido de hoy no es el
 * dominio de la migración: el dominio es lo que se llegó a guardar. Este es el
 * caso conocido —`vida` se retiró del catálogo de inmuebles cuando se decidió
 * que un seguro de vida sólo cuenta en un inmueble si lo exige la hipoteca—, y
 * es exactamente el gasto que destapó todo esto.
 */
export const PARES_HISTORICOS: readonly string[] = ['seguros:vida'];

/**
 * `${tipoFamilia}:${subtipo}` → id de concepto.
 *
 * Cubre los dos catálogos vivos y los pares históricos. Las seis claves que
 * existen en ambos catálogos (`suministros:luz`, `…:gas`, `…:agua`,
 * `…:internet`, `…:otros` y `otros:personalizado`) apuntan al MISMO concepto:
 * son el mismo gasto, y lo que cambiaba entre catálogos era la categoría, que
 * ahora se proyecta desde el ámbito.
 */
export const MAPA_LEGACY: Readonly<Record<string, string>> = {
  // ── catálogo de INMUEBLE ──────────────────────────────────────────────
  'tributos:ibi': 'ibi',
  'tributos:tasa_basuras': 'tasa_basuras',
  'tributos:licencia_turistica': 'licencia_turistica',
  'tributos:otros': 'otros_tributos',
  'comunidad:cuota_ordinaria': 'comunidad_ordinaria',
  'comunidad:derrama': 'derrama',
  'comunidad:otros': 'otros_comunidad',
  'suministros:luz': 'luz',
  'suministros:gas': 'gas',
  'suministros:agua': 'agua',
  'suministros:internet': 'internet',
  'suministros:telefonia': 'telefonia',
  'suministros:alarma': 'alarma',
  'suministros:otros': 'otros_suministros',
  'seguros:hogar': 'seguro_hogar',
  'seguros:impago': 'seguro_impago',
  'seguros:otros': 'otros_seguros',
  'gestion:honorarios_agencia': 'honorarios_agencia',
  'gestion:gestoria': 'gestoria',
  'gestion:asesoria': 'asesoria',
  'gestion:comision_plataformas': 'comision_plataformas',
  'gestion:otros': 'otros_gestion',
  'reparacion:mantenimiento_caldera': 'mantenimiento_caldera',
  'reparacion:mantenimiento_integral': 'mantenimiento_integral',
  'reparacion:otros': 'otros_reparacion',
  'servicios:limpieza': 'limpieza',
  'servicios:limpieza_zonas_comunes': 'limpieza_zonas_comunes',
  'servicios:limpieza_por_estancia': 'limpieza_por_estancia',
  'servicios:lavanderia': 'lavanderia',
  'servicios:consumibles_bienvenida': 'consumibles_bienvenida',
  'servicios:otros': 'otros_servicios',
  'mobiliario:ropa_enseres': 'ropa_enseres',
  'mobiliario:muebles': 'muebles',
  'mobiliario:otros': 'otros_mobiliario',
  'otros:personalizado': 'personalizado',

  // ── catálogo PERSONAL ─────────────────────────────────────────────────
  // `vivienda` era un paquete: dentro había un alquiler, un tributo, una
  // comunidad y un seguro. Al repartirse, cada uno va a su familia real.
  'vivienda:alquiler': 'alquiler_vivienda',
  'vivienda:ibi': 'ibi',
  'vivienda:comunidad': 'comunidad_ordinaria',
  'vivienda:seguro_hogar': 'seguro_hogar',
  'suministros:movil': 'telefonia',
  'dia_a_dia:supermercado': 'supermercado',
  'dia_a_dia:transporte': 'transporte',
  'dia_a_dia:restaurantes': 'restaurantes',
  'dia_a_dia:ocio': 'ocio',
  'dia_a_dia:salud': 'salud_gasto',
  'dia_a_dia:ropa': 'ropa',
  'dia_a_dia:cuidado_personal': 'cuidado_personal',
  'dia_a_dia:otros': 'otros_dia_a_dia',
  'suscripciones:streaming': 'streaming',
  'suscripciones:musica': 'musica',
  'suscripciones:software': 'software',
  'suscripciones:cloud': 'cloud',
  'suscripciones:prensa': 'prensa',
  'suscripciones:otros': 'otros_suscripciones',
  // `seguros_cuotas` mezclaba seguros y cuotas · se reparte en las dos.
  'seguros_cuotas:seguro_salud': 'seguro_salud',
  'seguros_cuotas:seguro_coche': 'seguro_coche',
  'seguros_cuotas:seguro_vida': 'seguro_vida',
  'seguros_cuotas:seguro_otros': 'otros_seguros',
  'seguros_cuotas:gimnasio': 'gimnasio',
  'seguros_cuotas:educacion': 'educacion',
  'seguros_cuotas:profesional': 'profesional',
  'seguros_cuotas:ong': 'ong',
  'seguros_cuotas:otros': 'otros_cuotas',
  'otros:impuestos': 'otros_tributos',
  'otros:multas': 'multas',
  'otros:mantenimiento_coche': 'mantenimiento_coche',

  // ── históricos · ya no están en el catálogo, sí en los datos ──────────
  'seguros:vida': 'seguro_vida',
};

/** Índice por id · para resolver sin recorrer la lista en cada llamada. */
const PORID = new Map(CONCEPTOS_DESTINO.map((c) => [c.id, c]));

/** El concepto de destino, o `undefined` si ese id no existe. */
export function conceptoPorId(id: string): ConceptoDestino | undefined {
  return PORID.get(id);
}

/**
 * Traduce un par legacy al concepto nuevo · `null` si no se reconoce.
 *
 * `null` NO es un fallo que haya que rellenar con lo más parecido: es la señal
 * de que ese gasto necesita que alguien lo mire. La migración (paso 3) los
 * dejará marcados en vez de asignarles un destino inventado, por la misma razón
 * que la capa de traducción actual marca `pendiente` en vez de improvisar: el
 * concepto decide la casilla AEAT.
 */
export function resolverConcepto(
  tipoFamilia: string | undefined,
  subtipo: string | undefined,
): string | null {
  if (!tipoFamilia || !subtipo) return null;
  return MAPA_LEGACY[`${tipoFamilia}:${subtipo}`] ?? null;
}
