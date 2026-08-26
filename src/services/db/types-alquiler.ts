// ============================================================================
// El subtipo de alquiler · un solo vocabulario para toda la app
// ============================================================================
//
// Lo que el arrendador elige al dar de alta un contrato, y lo único que hace
// falta para resolver el eje fiscal. Tres valores, cerrado.
//
// Antes había cuatro listas paralelas que decían lo mismo con palabras
// distintas: `Contract.modalidad` usaba `habitual | temporada | vacacional`,
// `Property.usoTipo` usaba `larga_estancia | temporada | turistico | …`, y
// `RegimenAlquiler` y `documentoContrato.plantilla` tenían las suyas. El mismo
// alquiler se llamaba `vacacional` en un sitio y `turistico` en otro, y
// `habitual` frente a `larga_estancia`, así que cruzar los dos lados exigía
// traducir — y donde no se traducía, fallaba en silencio.
//
// El eje fiscal NO se elige: se deriva de aquí.
//
//   · `larga_estancia` → reduce · art. 23.2 LIRPF (50/60/70/90 %)
//   · `temporada` y `turistico` → 0 % · «otros arrendamientos», art. 3 LAU
//
// Por qué `larga_estancia` y no `vivienda_habitual`, que sería el término de la
// LAU: porque `vivienda_habitual` ya está ocupado, y por lo contrario. En
// `Property.usoTipo` significa «aquí vivo yo» — el inmueble exento, que no se
// alquila. Los dos conceptos son opuestos y el literal no puede servir para los
// dos: el subtipo que reduce es `larga_estancia`.
//
// `temporada` y `turistico` resuelven al mismo 0 %, pero siguen siendo dos
// subtipos: el arrendador los distingue, la duración típica no se parece y las
// obligaciones no fiscales tampoco. Fundirlos porque coinciden en un número
// sería perder información que el usuario sí tiene.
//
// No hay `actividad_economica`. El inversor de ATLAS alquila como capital
// inmobiliario; el hospedaje con servicios es otro negocio y no se modela.
// ============================================================================

export type SubtipoAlquiler = 'larga_estancia' | 'temporada' | 'turistico';

/** Los tres, en el orden en que se ofrecen. */
export const SUBTIPOS_ALQUILER: readonly SubtipoAlquiler[] = [
  'larga_estancia',
  'temporada',
  'turistico',
] as const;

/** Cómo se llama cada uno de cara al usuario. */
export const NOMBRE_SUBTIPO: Record<SubtipoAlquiler, string> = {
  larga_estancia: 'Vivienda habitual del inquilino',
  temporada: 'Temporada',
  turistico: 'Turístico',
};

/**
 * Si el subtipo da derecho a la reducción del art. 23.2 LIRPF.
 *
 * Solo el arrendamiento de vivienda del art. 2 LAU reduce. Temporada y
 * turístico son «otros arrendamientos» del art. 3 y tributan por todo.
 */
export function reduceElSubtipo(subtipo: SubtipoAlquiler | undefined | null): boolean {
  return subtipo === 'larga_estancia';
}

/**
 * Si el subtipo es de corta estancia · temporada o turístico.
 *
 * Los dos van juntos en todo lo fiscal, y preguntarlo así evita que alguien
 * enumere uno y se olvide del otro, que es de donde salían las divergencias.
 */
export function esCortaEstancia(subtipo: string | undefined | null): boolean {
  return normalizarSubtipo(subtipo) === 'temporada' || normalizarSubtipo(subtipo) === 'turistico';
}

/**
 * El subtipo que corresponde a un arrendamiento del Modelo 100.
 *
 * El XML solo distingue vivienda (TAR1) de «distinto de vivienda» (TAR2), y en
 * el segundo caben la temporada, el turístico y el local. Hay que escribir UN
 * subtipo en el contrato, así que se elige `temporada`: es el caso frecuente
 * del arrendador particular —el curso de un estudiante, un traslado— y el que
 * no impone un límite de duración que un contrato declarado de un año entero
 * incumpliría. El usuario puede cambiarlo en la ficha; lo que no puede es
 * adivinarlo ATLAS.
 *
 * Las dos rutas de importación llamaban a esto por su cuenta y elegían distinto
 * —una `temporada`, la otra el turístico— para el mismo campo del mismo XML.
 */
export function subtipoDeclarado(
  tipoArrendamiento: 'vivienda' | 'no_vivienda' | string | undefined | null,
): SubtipoAlquiler {
  // Sin dato se presume vivienda: es lo que declara la inmensa mayoría, y es la
  // presunción que ya hacían las dos rutas.
  if (!tipoArrendamiento || tipoArrendamiento === 'vivienda') return 'larga_estancia';
  return 'temporada';
}

/** Un valor cualquiera leído de la base, normalizado al vocabulario de hoy. */
export function normalizarSubtipo(valor: unknown): SubtipoAlquiler | undefined {
  // `vacacional` y `habitual` son los nombres viejos del turístico y de la
  // larga estancia. No quedan en el código; se reconocen aquí porque un dato
  // cargado antes del renombrado los trae, y leerlo mal cambiaría su fiscalidad.
  if (valor === 'turistico' || valor === 'vacacional') return 'turistico';
  if (valor === 'temporada') return 'temporada';
  if (valor === 'larga_estancia' || valor === 'habitual') return 'larga_estancia';
  return undefined;
}
