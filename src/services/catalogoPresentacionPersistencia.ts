// ============================================================================
// Tabla de traducción PRESENTACIÓN → PERSISTENCIA (Tesorería V6 · D3)
// ============================================================================
//
// ESTO NO ES UN TERCER CATÁLOGO. Es una tabla de traducción entre las dos
// capas que ya existen, y no debe ganar entradas propias:
//
//   PRESENTACIÓN  · `modules/inmuebles/wizards/utils/tiposDeGastoInmueble.ts`
//                   (`TIPOS_GASTO_INMUEBLE_V2`) y su gemelo personal
//                   `modules/personal/wizards/utils/tiposDeGastoPersonal.ts`.
//                   Familia → concepto. Es lo que ve y elige el usuario, y lo
//                   que dibuja el mockup de Tesorería V6 (§4.5).
//
//   PERSISTENCIA  · `services/categoryCatalog.ts` (`categoryKey`). Es lo que
//                   se guarda en `TreasuryEvent.categoryKey` /
//                   `Movement.categoryKey` / `GastoInmueble.categoryKey`, y lo
//                   que alimenta el tratamiento fiscal (casilla AEAT y store
//                   de destino).
//
// Añadir un concepto nuevo se hace en el catálogo de PRESENTACIÓN y luego se
// traduce aquí. Si no tiene traducción fiscal clara, se marca `pendiente` — NO
// se inventa un destino "razonable": `categoryKey` alimenta la declaración, y
// un mapeo mal hecho la contamina en silencio.
//
// La unificación real de ambos catálogos es tarea aparte (adenda §4).
// ============================================================================

/** Clave de presentación: `${tipoId}:${subtipoId}` del catálogo de inmueble. */
export type ClavePresentacion = string;

export interface TraduccionCategoria {
  /** `key` de `categoryCatalog.ts` que se persiste. `null` si está pendiente. */
  categoryKey: string | null;
  /** Sub-tipo para categorías con variantes (hoy solo `suministro_inmueble`). */
  subtypeKey?: string;
  /**
   * `ok`        · traducción directa, sin ambigüedad fiscal.
   * `pregunta`  · NO tiene traducción fija **por naturaleza**, no por falta de
   *               decisión: el tratamiento depende del hecho concreto y solo lo
   *               sabe el usuario. La ficha de §4.5 tiene que preguntárselo al
   *               confirmar. Hoy solo la derrama (conservación vs. mejora).
   * `pendiente` · falta decidirlo · ver `nota`. NO se persiste hasta resolverse.
   */
  estado: 'ok' | 'pregunta' | 'pendiente';
  /** Por qué está pendiente, o qué matiz tiene la traducción. */
  nota?: string;
  /**
   * Salidas posibles de un `pregunta`. La tabla no puede elegir sola, pero sí
   * sabe a dónde va CADA respuesta — si no, responder no serviría de nada y la
   * ficha tendría que adivinar la key por su cuenta.
   */
  opciones?: Record<string, { categoryKey: string | null; esMejora?: boolean; label: string }>;
}

// ─── Inmueble ───────────────────────────────────────────────────────────────

export const TRADUCCION_INMUEBLE: Record<ClavePresentacion, TraduccionCategoria> = {
  // Tributos · todos a 0115 (tributos y recargos no estatales).
  'tributos:ibi': { categoryKey: 'ibi_inmueble', estado: 'ok' },
  'tributos:tasa_basuras': { categoryKey: 'basuras_inmueble', estado: 'ok' },
  'tributos:licencia_turistica': {
    categoryKey: 'tributo_inmueble',
    estado: 'ok',
    nota: 'D3 · tasa municipal no estatal · mismo trato que IBI y basuras (0115).',
  },
  'tributos:otros': {
    categoryKey: 'tributo_inmueble',
    estado: 'ok',
    nota: 'D3 · si cuelga de Tributos, tributa como tributo (0115).',
  },

  // Comunidad
  'comunidad:cuota_ordinaria': { categoryKey: 'comunidad_inmueble', estado: 'ok' },
  'comunidad:derrama': {
    categoryKey: null,
    estado: 'pregunta',
    nota:
      'D3 · NO se traduce a una key fija, y no es un olvido: una derrama es ' +
      'conservación (deducible en el ejercicio) o MEJORA (capitalizable, se ' +
      'amortiza) según la obra, no según el concepto. Lo decide el usuario al ' +
      'confirmar el movimiento: conservación → gasto deducible · mejora → alta ' +
      'en `mejorasInmueble`. Es la única pregunta fiscal de la ficha, y está ' +
      'justificada porque ATLAS no puede saberlo y equivocarse cuesta caro en ' +
      'las dos direcciones.',
    opciones: {
      conservacion: { categoryKey: 'comunidad_inmueble', label: 'Conservación' },
      // Una mejora NO es gasto: se capitaliza y amortiza, así que no lleva key
      // de gasto sino alta en `mejorasInmueble`.
      mejora: { categoryKey: null, esMejora: true, label: 'Mejora' },
    },
  },
  'comunidad:otros': { categoryKey: 'comunidad_inmueble', estado: 'ok' },

  // Suministros · 0113
  'suministros:luz': { categoryKey: 'suministro_inmueble', subtypeKey: 'luz', estado: 'ok' },
  'suministros:gas': { categoryKey: 'suministro_inmueble', subtypeKey: 'gas', estado: 'ok' },
  'suministros:agua': { categoryKey: 'suministro_inmueble', subtypeKey: 'agua', estado: 'ok' },
  'suministros:internet': { categoryKey: 'suministro_inmueble', subtypeKey: 'internet', estado: 'ok' },
  'suministros:telefonia': {
    categoryKey: 'suministro_inmueble',
    subtypeKey: 'telefonia',
    estado: 'ok',
    nota: 'D3 · sub-tipo propio · NO se colapsa en internet: se contratan y facturan aparte.',
  },
  'suministros:alarma': {
    categoryKey: 'servicio_inmueble',
    estado: 'ok',
    nota: 'D3 · vigilancia contratada · es servicio (0108), no suministro (0113).',
  },
  'suministros:otros': {
    categoryKey: 'suministro_inmueble',
    estado: 'ok',
    nota: 'Sin sub-tipo · suministro genérico (0113).',
  },

  // Seguros · 0114 · el de vida salió del catálogo de inmueble (D3): va ligado
  // a la hipoteca, no al arrendamiento, y deducirlo aquí levanta una paralela.
  'seguros:hogar': { categoryKey: 'seguro_inmueble', estado: 'ok' },
  'seguros:impago': { categoryKey: 'seguro_inmueble', estado: 'ok' },
  'seguros:otros': { categoryKey: 'seguro_inmueble', estado: 'ok' },

  // Gestión · servicios de profesionales (0108)
  'gestion:honorarios_agencia': { categoryKey: 'servicio_inmueble', estado: 'ok' },
  'gestion:gestoria': { categoryKey: 'servicio_inmueble', estado: 'ok' },
  'gestion:asesoria': { categoryKey: 'servicio_inmueble', estado: 'ok' },
  'gestion:comision_plataformas': {
    categoryKey: 'servicio_inmueble',
    estado: 'ok',
    nota: 'D3 · comercialización (Booking/Airbnb) · servicio de terceros (0108).',
  },
  'gestion:otros': { categoryKey: 'servicio_inmueble', estado: 'ok' },

  // Reparación y conservación · 0106 · ya solo lo que repara de verdad
  'reparacion:mantenimiento_caldera': { categoryKey: 'reparacion_inmueble', estado: 'ok' },
  'reparacion:mantenimiento_integral': { categoryKey: 'reparacion_inmueble', estado: 'ok' },
  'reparacion:otros': { categoryKey: 'reparacion_inmueble', estado: 'ok' },

  // Servicios y explotación · 0108 · familia nueva de D3. Separarla de
  // Reparación resolvió cinco pendientes de golpe.
  'servicios:limpieza': { categoryKey: 'servicio_inmueble', estado: 'ok' },
  'servicios:limpieza_zonas_comunes': {
    categoryKey: 'servicio_inmueble',
    estado: 'ok',
    nota:
      'D3 · servicio de limpieza contratado POR EL PROPIETARIO (0108). Si la ' +
      'limpieza la factura la comunidad, no es este concepto: va en ' +
      '`comunidad:cuota_ordinaria` (0109). Los distingue quién emite la ' +
      'factura, y eso el usuario ya lo resuelve al elegir concepto — no hace ' +
      'falta preguntárselo después.',
  },
  'servicios:limpieza_por_estancia': { categoryKey: 'servicio_inmueble', estado: 'ok' },
  'servicios:lavanderia': {
    categoryKey: 'servicio_inmueble',
    estado: 'ok',
    nota: 'D3 · mitad servicio del antiguo `ropa_cama_lavanderia`.',
  },
  'servicios:consumibles_bienvenida': { categoryKey: 'servicio_inmueble', estado: 'ok' },
  'servicios:otros': { categoryKey: 'servicio_inmueble', estado: 'ok' },

  // Mobiliario y enseres · 0117 · AMORTIZABLE, no gasto del ejercicio
  'mobiliario:ropa_enseres': {
    categoryKey: 'mobiliario_inmueble',
    estado: 'ok',
    nota: 'D3 · mitad bien duradero del antiguo `ropa_cama_lavanderia` · amortiza (0117).',
  },
  'mobiliario:muebles': { categoryKey: 'mobiliario_inmueble', estado: 'ok' },
  'mobiliario:otros': { categoryKey: 'mobiliario_inmueble', estado: 'ok' },

  // Otros
  'otros:personalizado': {
    categoryKey: 'otros_inmueble',
    estado: 'ok',
    nota: 'Concepto libre del usuario · sin casilla AEAT por defecto.',
  },
};

// ─── Personal ───────────────────────────────────────────────────────────────

export const TRADUCCION_PERSONAL: Record<string, TraduccionCategoria> = {
  vivienda: { categoryKey: 'gasto_personal_vivienda', estado: 'ok' },
  dia_a_dia: { categoryKey: 'gasto_personal_dia_dia', estado: 'ok' },
  suscripciones: { categoryKey: 'gasto_personal_suscripciones', estado: 'ok' },
  seguros_cuotas: { categoryKey: 'gasto_personal_seguros_cuotas', estado: 'ok' },
  otros: { categoryKey: 'gasto_personal_otros', estado: 'ok' },
  suministros: {
    categoryKey: 'gasto_personal_vivienda',
    estado: 'ok',
    nota:
      'D3 · colapsa en vivienda a propósito: en personal no hay casilla que ganar ' +
      'con la granularidad, y el label de esa key ya dice "…alquiler · suministros · ' +
      'IBI · seguros". Presentación los sigue mostrando separados.',
  },
};

// ─── Consulta ───────────────────────────────────────────────────────────────

/** Traducción de un concepto de inmueble. `undefined` si la clave no existe. */
export function traducirInmueble(
  tipoId: string,
  subtipoId: string
): TraduccionCategoria | undefined {
  return TRADUCCION_INMUEBLE[`${tipoId}:${subtipoId}`];
}

/** Traducción de una familia de gasto personal. */
export function traducirPersonal(tipoId: string): TraduccionCategoria | undefined {
  return TRADUCCION_PERSONAL[tipoId];
}

/**
 * Clave persistida de un gasto PERSONAL a partir de su familia del catálogo
 * unificado (`FamiliaId`).
 *
 * En personal no hay casilla AEAT que ganar con la granularidad —lo dice la
 * cabecera de `TRADUCCION_PERSONAL`—, así que las trece familias colapsan en
 * las cinco macro-categorías `gasto_personal_*` de `categoryCatalog.ts`, que
 * son las que ya usa el otro alta manual. Elegir aquí y no en la ficha
 * mantiene la regla: la pantalla enseña familia y concepto, la persistencia la
 * fija esta capa.
 *
 * Nunca devuelve vacío: lo que no encaje cae en `gasto_personal_otros`, que es
 * exactamente lo que es.
 */
export function keyPersonalDeFamilia(familia: string): string {
  switch (familia) {
    case 'alquiler':
    case 'tributos':
    case 'comunidad':
    case 'suministros':
      return 'gasto_personal_vivienda';
    case 'dia_a_dia':
      return 'gasto_personal_dia_dia';
    case 'suscripciones':
      return 'gasto_personal_suscripciones';
    case 'seguros':
    case 'cuotas':
      return 'gasto_personal_seguros_cuotas';
    default:
      return 'gasto_personal_otros';
  }
}

/**
 * Camino INVERSO: de lo persistido (`categoryKey` + `subtypeKey`) a lo que ve
 * el usuario (familia + concepto). Lo necesita la ficha de §4.5 para nacer
 * rellena con la clasificación que ya tiene el registro.
 *
 * Devuelve `undefined` cuando la vuelta NO es unívoca — o la key no está en la
 * tabla, o varias familias distintas caen en la misma key. Adivinar una de
 * ellas sería peor que no rellenar: la ficha mostraría una clasificación que el
 * usuario no eligió y la guardaría como si sí. Quien llame debe tratar el
 * `undefined` como "no lo sé", no como "no tiene".
 */
export function presentacionDe(
  categoryKey: string | undefined,
  subtypeKey?: string
): { tipoId: string; subtipoId: string } | undefined {
  if (!categoryKey) return undefined;

  const candidatos = Object.entries(TRADUCCION_INMUEBLE).filter(
    ([, t]) => t.categoryKey === categoryKey && (t.subtypeKey ?? undefined) === (subtypeKey ?? undefined)
  );
  if (candidatos.length !== 1) return undefined;

  const [tipoId, subtipoId] = candidatos[0][0].split(':');
  return { tipoId, subtipoId };
}

/**
 * Entradas sin destino fiscal decidido. La UI de alta/edición debe impedir
 * guardar con una de estas y decir por qué, en vez de persistir un
 * `categoryKey` inventado.
 *
 * Tras D3 está VACÍA: las trece se resolvieron. Se mantiene porque el candado
 * del test la usa para exigir que toda entrada nueva se traduzca o se declare.
 */
export function pendientesDeDecision(): Array<{ clave: string; nota: string }> {
  const out: Array<{ clave: string; nota: string }> = [];
  for (const [clave, t] of Object.entries(TRADUCCION_INMUEBLE)) {
    if (t.estado === 'pendiente') out.push({ clave, nota: t.nota ?? '' });
  }
  for (const [clave, t] of Object.entries(TRADUCCION_PERSONAL)) {
    if (t.estado === 'pendiente') out.push({ clave: `personal:${clave}`, nota: t.nota ?? '' });
  }
  return out;
}

/**
 * Conceptos que la ficha debe PREGUNTAR al confirmar, porque su tratamiento
 * depende del hecho y no del concepto. Hoy solo la derrama.
 */
export function requierenPregunta(): string[] {
  return Object.entries(TRADUCCION_INMUEBLE)
    .filter(([, t]) => t.estado === 'pregunta')
    .map(([clave]) => clave);
}
