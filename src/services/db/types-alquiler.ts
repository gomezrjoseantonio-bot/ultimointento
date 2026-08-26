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
//   · `media_estancia` y `corta_estancia` → 0 % · «otros arrendamientos»,
//     art. 3 LAU
//
// Los tres se nombran por la DURACIÓN, que es lo que el arrendador decide y lo
// único que los separa de verdad. Los nombres viejos mezclaban criterios —
// `habitual` describía al inquilino, `turistico` el uso, `temporada` el
// calendario— y por eso cada capa elegía el suyo.
//
// Por qué `larga_estancia` y no `vivienda_habitual`, que sería el término de la
// LAU: porque `vivienda_habitual` ya está ocupado, y por lo contrario. En
// `Property.usoTipo` significa «aquí vivo yo» — el inmueble exento, que no se
// alquila. Los dos conceptos son opuestos y el literal no puede servir para los
// dos: el subtipo que reduce es `larga_estancia`.
//
// `media_estancia` y `corta_estancia` resuelven al mismo 0 %, pero siguen
// siendo dos subtipos: el arrendador los distingue, la duración típica no se
// parece y las obligaciones no fiscales tampoco. Fundirlos porque coinciden en
// un número sería perder información que el usuario sí tiene.
//
// Dónde cae la frontera entre uno y otro por FECHAS no se decide aquí: hoy lo
// elige quien da de alta el contrato.
//
// No hay `actividad_economica`. El inversor de ATLAS alquila como capital
// inmobiliario; el hospedaje con servicios es otro negocio y no se modela.
// ============================================================================

export type SubtipoAlquiler = 'larga_estancia' | 'media_estancia' | 'corta_estancia';

/** Los tres, en el orden en que se ofrecen. */
export const SUBTIPOS_ALQUILER: readonly SubtipoAlquiler[] = [
  'larga_estancia',
  'media_estancia',
  'corta_estancia',
] as const;

/** Cómo se llama cada uno de cara al usuario. */
export const NOMBRE_SUBTIPO: Record<SubtipoAlquiler, string> = {
  larga_estancia: 'Larga estancia',
  media_estancia: 'Media estancia',
  corta_estancia: 'Corta estancia',
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
  return normalizarSubtipo(subtipo) === 'media_estancia' || normalizarSubtipo(subtipo) === 'corta_estancia';
}

/**
 * El centinela con el que el repo marca «sin fecha de fin conocida».
 *
 * No es una fecha: es la ausencia de una. Medir una duración contra él daría
 * setenta y tres años de larga estancia por un dato que nadie ha puesto.
 *
 * Estaba escrito dos veces —en `contractService` y copiado en
 * `contractImportCreationService`—, así que vive aquí y los dos lo importan:
 * cambiarlo en un sitio y no en el otro dejaría medio repo leyendo 2099 como
 * una fecha real.
 */
export const FECHA_FIN_INDEFINIDO = '2099-12-31';

/** Días entre dos fechas ISO contando los dos extremos · `null` si no se puede. */
function diasDeDuracion(inicio: string, fin: string): number | null {
  const a = Date.parse(`${inicio}T00:00:00Z`);
  const b = Date.parse(`${fin}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  // Los dos extremos cuentan: quien entra el 1 y sale el 31 ocupa 31 días, no
  // 30. Es como lo cuenta el arrendador y como cuadran las fronteras de abajo.
  const dias = Math.round((b - a) / 86400000) + 1;
  return dias > 0 ? dias : null;
}

/**
 * El subtipo que PROPONEN las fechas del contrato.
 *
 *   · hasta 31 días  → corta estancia
 *   · de 32 a 364    → media estancia
 *   · 365 o más      → larga estancia
 *
 * Es una propuesta, no una clasificación: la ley mira el uso y no solo el
 * calendario, así que el arrendador puede sobrescribirla. Nueve meses pueden ser
 * el curso de un estudiante o la mudanza de quien se traslada por trabajo, y no
 * tienen por qué declararse igual.
 *
 * `null` cuando no hay duración que medir —falta una fecha, no se entiende, el
 * fin es anterior al inicio, o el fin es el centinela de «indefinido»—. Sin
 * propuesta no se preselecciona nada: caer en corta estancia por un dato que
 * falta sería empujar al tramo que NO reduce.
 */
export function clasificarPorDuracion(
  fechaInicio: string | undefined | null,
  fechaFin: string | undefined | null,
): SubtipoAlquiler | null {
  if (!fechaInicio || !fechaFin) return null;
  if (fechaFin === FECHA_FIN_INDEFINIDO) return null;

  const dias = diasDeDuracion(fechaInicio, fechaFin);
  if (dias === null) return null;

  if (dias <= 31) return 'corta_estancia';
  if (dias < 365) return 'media_estancia';
  return 'larga_estancia';
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
  return 'media_estancia';
}

/** Un valor cualquiera leído de la base, normalizado al vocabulario de hoy. */
export function normalizarSubtipo(valor: unknown): SubtipoAlquiler | undefined {
  // Los nombres viejos de los tres. No quedan en el código; se reconocen aquí
  // porque un dato cargado antes del renombrado los trae, y leerlo mal
  // cambiaría su fiscalidad.
  if (valor === 'corta_estancia' || valor === 'turistico' || valor === 'vacacional') {
    return 'corta_estancia';
  }
  if (valor === 'media_estancia' || valor === 'temporada') return 'media_estancia';
  if (valor === 'larga_estancia' || valor === 'habitual') return 'larga_estancia';
  return undefined;
}
