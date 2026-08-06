// ============================================================================
// PASO 1 · Mapa (tipoFamilia, subtipo) → concepto · el contrato de la migración
// ============================================================================
//
// Hoy un gasto guarda cuatro campos de clasificación —`tipoFamilia`, `subtipo`,
// `categoria` y `tipo`— copiados del catálogo de la pestaña en la que se creó y
// congelados desde entonces. La unificación los sustituye por uno: `concepto`,
// del que se derivan familia y categoría (esta última según el ámbito).
//
// Este fichero es SÓLO la traducción de lo viejo a lo nuevo. La proyección —a
// qué categoría y a qué casilla AEAT lleva cada concepto— vive en
// `catalogoConceptos.ts` (paso 2). Aquí se traduce; allí se clasifica.
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

import { CONCEPTOS, conceptoPorId as conceptoDelCatalogo, ambitosDe } from './catalogoConceptos';
import type { Ambito, Concepto, FamiliaId } from './catalogoConceptos';

export type { Ambito, FamiliaId };

/**
 * Un destino del mapa · el concepto del catálogo unificado, con sus ámbitos ya
 * resueltos.
 *
 * `ambitos` no se declara en ningún sitio: se deduce de qué proyecciones tiene
 * el concepto en `catalogoConceptos.ts`. Un concepto se puede elegir en un
 * ámbito exactamente cuando sabe cómo clasificarse en él.
 */
export interface ConceptoDestino {
  id: string;
  familia: FamiliaId;
  ambitos: readonly Ambito[];
}

const destinoDe = (c: Concepto): ConceptoDestino => ({
  id: c.id,
  familia: c.familia,
  ambitos: ambitosDe(c),
});

/**
 * El vocabulario de llegada · vista del catálogo unificado.
 *
 * Era una copia mientras el catálogo no existía; ahora deriva de él, para que
 * no haya dos listas de conceptos que puedan separarse.
 */
export const CONCEPTOS_DESTINO: readonly ConceptoDestino[] = CONCEPTOS.map(destinoDe);

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

/** El concepto de destino, o `undefined` si ese id no existe. */
export function conceptoPorId(id: string): ConceptoDestino | undefined {
  const c = conceptoDelCatalogo(id);
  return c ? destinoDe(c) : undefined;
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

/** `subtipo` → los conceptos a los que podría referirse, por ámbito. */
const PORSUBTIPO = new Map<string, Set<string>>();
for (const [par, id] of Object.entries(MAPA_LEGACY)) {
  const subtipo = par.slice(par.indexOf(':') + 1);
  for (const ambito of conceptoPorId(id)?.ambitos ?? []) {
    const clave = `${ambito}|${subtipo}`;
    if (!PORSUBTIPO.has(clave)) PORSUBTIPO.set(clave, new Set());
    PORSUBTIPO.get(clave)!.add(id);
  }
}

/**
 * Rescate para registros SIN `tipoFamilia` · sólo cuando no hay elección.
 *
 * `tipoFamilia` es un campo que se rellenó a posteriori (migración V68), así que
 * hay registros antiguos que sólo tienen `subtipo`. Esto NO es la vuelta del
 * «resolver por subtipo suelto» que `resolverConcepto` prohíbe: aquí se exige
 * que en ese ámbito haya EXACTAMENTE UN concepto posible. `luz` sólo puede ser
 * `luz`, así que no se está eligiendo nada; `otros` puede ser nueve cosas, así
 * que devuelve `null` y el registro se queda para revisar.
 */
export function resolverConceptoPorSubtipoUnico(
  subtipo: string | undefined,
  ambito: Ambito,
): string | null {
  if (!subtipo) return null;
  const candidatos = PORSUBTIPO.get(`${ambito}|${subtipo}`);
  if (!candidatos || candidatos.size !== 1) return null;
  return [...candidatos][0];
}
