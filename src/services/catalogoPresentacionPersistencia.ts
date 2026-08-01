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
   * `ok`       · traducción directa, sin ambigüedad fiscal.
   * `pendiente`· necesita decisión de Jose · ver `nota`. NO se persiste hasta
   *              resolverse: la ficha de §4.5 debe impedir guardar y avisar.
   */
  estado: 'ok' | 'pendiente';
  /** Por qué está pendiente, o qué matiz tiene la traducción. */
  nota?: string;
}

// ─── Inmueble ───────────────────────────────────────────────────────────────

export const TRADUCCION_INMUEBLE: Record<ClavePresentacion, TraduccionCategoria> = {
  // Tributos
  'tributos:ibi': { categoryKey: 'ibi_inmueble', estado: 'ok' },
  'tributos:tasa_basuras': { categoryKey: 'basuras_inmueble', estado: 'ok' },
  'tributos:licencia_turistica': {
    categoryKey: null,
    estado: 'pendiente',
    nota:
      'No hay key para licencia turística. `otros_inmueble` no lleva casilla AEAT; ' +
      '`ibi_inmueble`/`basuras_inmueble` van a 0115 (tributos y recargos). Si la licencia ' +
      'es tributo local deducible, 0115 sería lo correcto — pero eso lo decide Jose.',
  },
  'tributos:otros': {
    categoryKey: null,
    estado: 'pendiente',
    nota:
      'Está bajo la familia Tributos, así que fiscalmente apunta a 0115, pero su `categoria` ' +
      'de presentación es `inmueble.otros` (sin casilla). Elegir entre `otros_inmueble` (sin ' +
      'casilla) y una key de tributo con 0115.',
  },

  // Comunidad
  'comunidad:cuota_ordinaria': { categoryKey: 'comunidad_inmueble', estado: 'ok' },
  'comunidad:derrama': {
    categoryKey: null,
    estado: 'pendiente',
    nota:
      'Una derrama puede ser gasto deducible (conservación · 0109/0106) o MEJORA capitalizable ' +
      '(`mejora_inmueble`, que amortiza en vez de deducir) según su naturaleza. Es la decisión ' +
      'con más impacto fiscal de esta tabla. Puede que necesite preguntarse por movimiento en ' +
      'vez de fijarse aquí.',
  },
  'comunidad:otros': { categoryKey: 'comunidad_inmueble', estado: 'ok' },

  // Suministros
  'suministros:luz': { categoryKey: 'suministro_inmueble', subtypeKey: 'luz', estado: 'ok' },
  'suministros:gas': { categoryKey: 'suministro_inmueble', subtypeKey: 'gas', estado: 'ok' },
  'suministros:agua': { categoryKey: 'suministro_inmueble', subtypeKey: 'agua', estado: 'ok' },
  'suministros:internet': {
    categoryKey: 'suministro_inmueble',
    subtypeKey: 'internet',
    estado: 'ok',
  },
  'suministros:telefonia': {
    categoryKey: null,
    estado: 'pendiente',
    nota:
      '`SUMINISTRO_SUBTYPES` solo tiene luz/agua/gas/internet. O se añade el sub-tipo ' +
      '`telefonia` al catálogo de persistencia, o se colapsa en `internet`. Colapsar pierde ' +
      'el detalle en el histórico.',
  },
  'suministros:alarma': {
    categoryKey: null,
    estado: 'pendiente',
    nota:
      'Mismo hueco de sub-tipo que telefonía, y además dudoso que sea suministro: una alarma ' +
      'es más un servicio contratado (`servicio_inmueble`, 0108) que un suministro (0113). ' +
      'Casillas distintas.',
  },
  'suministros:otros': {
    categoryKey: 'suministro_inmueble',
    estado: 'ok',
    nota: 'Sin sub-tipo · queda como suministro genérico (0113).',
  },

  // Seguros
  'seguros:hogar': { categoryKey: 'seguro_inmueble', estado: 'ok' },
  'seguros:impago': { categoryKey: 'seguro_inmueble', estado: 'ok' },
  'seguros:vida': {
    categoryKey: null,
    estado: 'pendiente',
    nota:
      'El seguro de vida suele ir vinculado a la hipoteca, no al arrendamiento. Meterlo en ' +
      '`seguro_inmueble` (0114) lo declara como gasto del alquiler, que puede no proceder. ' +
      'Quizá pertenezca a financiación y no a esta familia.',
  },
  'seguros:otros': { categoryKey: 'seguro_inmueble', estado: 'ok' },

  // Gestión
  'gestion:honorarios_agencia': {
    categoryKey: 'servicio_inmueble',
    estado: 'ok',
    nota: 'Servicios de profesionales (0108) · coincide con `inmueble.gestionAlquiler`.',
  },
  'gestion:gestoria': { categoryKey: 'servicio_inmueble', estado: 'ok' },
  'gestion:asesoria': { categoryKey: 'servicio_inmueble', estado: 'ok' },
  'gestion:comision_plataformas': {
    categoryKey: null,
    estado: 'pendiente',
    nota:
      'Comisión de Booking/Airbnb. ¿Servicio profesional (0108) o gasto de comercialización ' +
      'por otra casilla? En alquiler turístico el tratamiento puede diferir del residencial.',
  },
  'gestion:otros': { categoryKey: 'servicio_inmueble', estado: 'ok' },

  // Reparación y conservación
  'reparacion:mantenimiento_caldera': { categoryKey: 'reparacion_inmueble', estado: 'ok' },
  'reparacion:mantenimiento_integral': { categoryKey: 'reparacion_inmueble', estado: 'ok' },
  'reparacion:limpieza': {
    categoryKey: null,
    estado: 'pendiente',
    nota:
      'La limpieza es un servicio (0108), no una reparación (0106), pero su `categoria` de ' +
      'presentación es `inmueble.opex` y vive bajo la familia Reparación. Afecta a las 4 ' +
      'entradas de limpieza/lavandería de esta familia.',
  },
  'reparacion:limpieza_zonas_comunes': {
    categoryKey: null,
    estado: 'pendiente',
    nota: 'Igual que `limpieza`. Además podría ser gasto de comunidad (0109) si lo factura la comunidad.',
  },
  'reparacion:limpieza_por_estancia': {
    categoryKey: null,
    estado: 'pendiente',
    nota: 'Igual que `limpieza`. Propio de alquiler turístico.',
  },
  'reparacion:ropa_cama_lavanderia': {
    categoryKey: null,
    estado: 'pendiente',
    nota:
      'Servicio (0108) o consumible. Si se considera mobiliario/enseres podría ir a ' +
      '`mobiliario_inmueble` (0117, amortizable), que es tratamiento distinto.',
  },
  'reparacion:consumibles_bienvenida': {
    categoryKey: null,
    estado: 'pendiente',
    nota: 'Consumible de alquiler turístico. Candidatos: `servicio_inmueble` (0108) u `otros_inmueble`.',
  },
  'reparacion:otros': { categoryKey: 'reparacion_inmueble', estado: 'ok' },

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
    categoryKey: null,
    estado: 'pendiente',
    nota:
      'No hay `gasto_personal_suministros`. El label de `gasto_personal_vivienda` ya dice ' +
      '"Vivienda · alquiler · suministros · IBI · seguros", así que colapsarlo ahí parece la ' +
      'intención — pero el catálogo de presentación los separa en dos familias. Confirmar que ' +
      'el colapso es querido y no una key que falta.',
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
 * Entradas sin destino fiscal decidido. La UI de alta/edición debe impedir
 * guardar con una de estas y decir por qué, en vez de persistir un
 * `categoryKey` inventado.
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
