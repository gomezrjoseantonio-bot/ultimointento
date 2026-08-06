// ============================================================================
// PASO 2 · Catálogo unificado de conceptos · un solo árbol
// ============================================================================
//
// Hasta aquí había DOS catálogos de presentación —uno personal y otro de
// inmueble— con familias distintas (6 y 9, de las que sólo `suministros` y
// `otros` coincidían) y con el mismo gasto clasificado de dos maneras según la
// pestaña en la que se diera de alta. De ahí salía el fallo que abrió esta
// tarea: un seguro de vida guardado con la familia `seguros`, que no existe en
// el catálogo personal, se volvía invisible en su propia pantalla.
//
// Aquí hay UN árbol: 13 familias, 60 conceptos con id único. Lo que cambiaba
// entre catálogos —la categoría— deja de estar en el concepto y pasa a ser una
// PROYECCIÓN por ámbito: el mismo concepto `luz` proyecta a
// `vivienda.suministros` en personal y a `inmueble.suministros` + la
// `categoryKey` `suministro_inmueble:luz` en inmueble.
//
// ── Lo que este fichero NO hace ─────────────────────────────────────────────
//
// No reasigna NADA. Cada proyección está copiada de lo que la app hace hoy:
// las personales de `TIPOS_GASTO_PERSONAL`, y las de inmueble de
// `TIPOS_GASTO_INMUEBLE_V2` (categoría) más `TRADUCCION_INMUEBLE`
// (`categoryKey`, que es quien decide la casilla AEAT vía `categoryCatalog`).
// El test de equivalencia lo comprueba par a par contra esas mismas fuentes, así
// que si alguien retoca una proyección a mano, la construcción se cae.
//
// La casilla AEAT sigue viviendo en `categoryCatalog.ts` y NO se escribe aquí.
// Ese fue el motivo de rehacer el diseño a mitad: la primera versión asignaba
// casillas a mano y en dos casos se desviaba de lo que la app ya hacía. Un
// catálogo que reordena conceptos no tiene por qué mover la declaración.
//
// ── Las cinco casillas que sí son nuevas ────────────────────────────────────
//
// Unificar abre combinaciones que antes no se podían elegir: `tasa_basuras`,
// `derrama`, `otros_comunidad` y `alarma` en personal, y `seguro_vida` en
// inmueble. Ninguna tiene proyección heredable, así que cada una copia la de su
// hermano de familia en ese ámbito y lo dice en un comentario. Son las únicas
// cinco líneas de este fichero que no salen de una fuente viva.
// ============================================================================

import type {
  BolsaPresupuesto,
  CategoriaGastoCompromiso,
  TipoCompromiso,
} from '../../types/compromisosRecurrentes';

/** Las 13 familias del árbol unificado. */
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

export interface Familia {
  id: FamiliaId;
  label: string;
  descripcion: string;
}

/**
 * Las familias, en orden de presentación.
 *
 * En qué ámbitos aparece cada una NO se declara: se deduce de si alguno de sus
 * conceptos proyecta a ese ámbito (`familiasDeAmbito`). Declararlo aparte sería
 * un segundo sitio donde equivocarse.
 */
export const FAMILIAS: readonly Familia[] = [
  { id: 'alquiler', label: 'Alquiler', descripcion: 'Alquiler de la vivienda' },
  { id: 'tributos', label: 'Tributos', descripcion: 'IBI · tasas municipales · multas' },
  { id: 'comunidad', label: 'Comunidad', descripcion: 'Cuota ordinaria · derramas' },
  { id: 'suministros', label: 'Suministros', descripcion: 'Luz · gas · agua · internet · telefonía' },
  { id: 'seguros', label: 'Seguros', descripcion: 'Hogar · vida · salud · coche · impago' },
  { id: 'cuotas', label: 'Cuotas', descripcion: 'Gimnasio · educación · colegios · ONG' },
  { id: 'suscripciones', label: 'Suscripciones', descripcion: 'Streaming · música · software · cloud · prensa' },
  { id: 'dia_a_dia', label: 'Día a día', descripcion: 'Supermercado · transporte · ocio · salud · ropa' },
  { id: 'gestion', label: 'Gestión', descripcion: 'Agencia · gestoría · asesoría' },
  { id: 'reparacion', label: 'Reparación y conservación', descripcion: 'Caldera · mantenimiento integral' },
  { id: 'servicios', label: 'Servicios y explotación', descripcion: 'Limpieza · lavandería · consumibles' },
  { id: 'mobiliario', label: 'Mobiliario y enseres', descripcion: 'Ropa de cama · menaje · muebles' },
  { id: 'otros', label: 'Otros', descripcion: 'Gastos personalizados' },
];

/** Cómo se clasifica el concepto cuando el gasto es del titular. */
export interface ProyeccionPersonal {
  categoria: CategoriaGastoCompromiso;
  /** Bolsa del 50/30/20. */
  bolsa: BolsaPresupuesto;
}

/** Cómo se clasifica el concepto cuando el gasto es de un inmueble. */
export interface ProyeccionInmueble {
  categoria: CategoriaGastoCompromiso;
  /**
   * `key` de `categoryCatalog.ts` · es QUIEN DECIDE LA CASILLA AEAT.
   *
   * `null` cuando el tratamiento no depende del concepto sino del hecho
   * concreto, y por tanto hay que preguntárselo al usuario al confirmar. Hoy
   * sólo la derrama: conservación (deducible) o mejora (se amortiza).
   */
  categoryKey: string | null;
  /** Variante dentro de la key · hoy sólo luz/gas/agua/internet/telefonía. */
  subtypeKey?: string;
  estado: 'ok' | 'pregunta';
}

export interface Concepto {
  /** Único en el sistema · sustituye al par (tipoFamilia, subtipo). */
  id: string;
  familia: FamiliaId;
  label: string;
  tipoCompromiso: TipoCompromiso;
  /** Presente ⇔ el concepto se puede elegir en gasto personal. */
  personal?: ProyeccionPersonal;
  /** Presente ⇔ el concepto se puede elegir en gasto de inmueble. */
  inmueble?: ProyeccionInmueble;
  /** El que rellena el usuario a mano · lleva descripción libre. */
  esPersonalizado?: boolean;
}

export const CONCEPTOS: readonly Concepto[] = [
  // ── Alquiler ──────────────────────────────────────────────────────
  {
    id: 'alquiler_vivienda',
    familia: 'alquiler',
    label: 'Alquiler',
    tipoCompromiso: 'otros',
    personal: { categoria: 'vivienda.alquiler', bolsa: 'necesidades' },
  },
  // ── Tributos ──────────────────────────────────────────────────────
  {
    id: 'ibi',
    familia: 'tributos',
    label: 'IBI',
    tipoCompromiso: 'impuesto',
    personal: { categoria: 'vivienda.ibi', bolsa: 'necesidades' },
    inmueble: { categoria: 'inmueble.ibi', categoryKey: 'ibi_inmueble', estado: 'ok' },
  },
  {
    id: 'tasa_basuras',
    familia: 'tributos',
    label: 'Basuras y alcantarillado',
    tipoCompromiso: 'impuesto',
    // Ámbito nuevo · hereda de `ibi`: un tributo local, igual que el IBI.
    personal: { categoria: 'vivienda.ibi', bolsa: 'necesidades' },
    inmueble: { categoria: 'inmueble.ibi', categoryKey: 'basuras_inmueble', estado: 'ok' },
  },
  {
    id: 'licencia_turistica',
    familia: 'tributos',
    label: 'Licencia turística',
    tipoCompromiso: 'impuesto',
    inmueble: { categoria: 'inmueble.otros', categoryKey: 'tributo_inmueble', estado: 'ok' },
  },
  {
    id: 'multas',
    familia: 'tributos',
    label: 'Multas',
    tipoCompromiso: 'impuesto',
    personal: { categoria: 'obligaciones.multas', bolsa: 'obligaciones' },
  },
  {
    id: 'otros_tributos',
    familia: 'tributos',
    label: 'Otros tributos',
    tipoCompromiso: 'impuesto',
    personal: { categoria: 'obligaciones.multas', bolsa: 'obligaciones' },
    inmueble: { categoria: 'inmueble.otros', categoryKey: 'tributo_inmueble', estado: 'ok' },
  },
  // ── Comunidad ─────────────────────────────────────────────────────
  {
    id: 'comunidad_ordinaria',
    familia: 'comunidad',
    label: 'Comunidad',
    tipoCompromiso: 'comunidad',
    personal: { categoria: 'vivienda.comunidad', bolsa: 'necesidades' },
    inmueble: { categoria: 'inmueble.comunidad', categoryKey: 'comunidad_inmueble', estado: 'ok' },
  },
  {
    id: 'derrama',
    familia: 'comunidad',
    label: 'Derrama',
    tipoCompromiso: 'comunidad',
    // Ámbito nuevo · hereda de `comunidad_ordinaria`: lo cobra la comunidad, igual que la cuota.
    personal: { categoria: 'vivienda.comunidad', bolsa: 'necesidades' },
    inmueble: { categoria: 'inmueble.comunidad', categoryKey: null, estado: 'pregunta' },
  },
  {
    id: 'otros_comunidad',
    familia: 'comunidad',
    label: 'Otros',
    tipoCompromiso: 'comunidad',
    // Ámbito nuevo · hereda de `comunidad_ordinaria`: lo cobra la comunidad, igual que la cuota.
    personal: { categoria: 'vivienda.comunidad', bolsa: 'necesidades' },
    inmueble: { categoria: 'inmueble.comunidad', categoryKey: 'comunidad_inmueble', estado: 'ok' },
  },
  // ── Suministros ───────────────────────────────────────────────────
  {
    id: 'luz',
    familia: 'suministros',
    label: 'Luz',
    tipoCompromiso: 'suministro',
    personal: { categoria: 'vivienda.suministros', bolsa: 'necesidades' },
    inmueble: {
      categoria: 'inmueble.suministros',
      categoryKey: 'suministro_inmueble',
      subtypeKey: 'luz',
      estado: 'ok',
    },
  },
  {
    id: 'gas',
    familia: 'suministros',
    label: 'Gas',
    tipoCompromiso: 'suministro',
    personal: { categoria: 'vivienda.suministros', bolsa: 'necesidades' },
    inmueble: {
      categoria: 'inmueble.suministros',
      categoryKey: 'suministro_inmueble',
      subtypeKey: 'gas',
      estado: 'ok',
    },
  },
  {
    id: 'agua',
    familia: 'suministros',
    label: 'Agua',
    tipoCompromiso: 'suministro',
    personal: { categoria: 'vivienda.suministros', bolsa: 'necesidades' },
    inmueble: {
      categoria: 'inmueble.suministros',
      categoryKey: 'suministro_inmueble',
      subtypeKey: 'agua',
      estado: 'ok',
    },
  },
  {
    id: 'internet',
    familia: 'suministros',
    label: 'Internet',
    tipoCompromiso: 'suministro',
    personal: { categoria: 'vivienda.suministros', bolsa: 'necesidades' },
    inmueble: {
      categoria: 'inmueble.suministros',
      categoryKey: 'suministro_inmueble',
      subtypeKey: 'internet',
      estado: 'ok',
    },
  },
  {
    id: 'telefonia',
    familia: 'suministros',
    label: 'Telefonía · móvil',
    tipoCompromiso: 'suministro',
    personal: { categoria: 'vivienda.suministros', bolsa: 'necesidades' },
    inmueble: {
      categoria: 'inmueble.suministros',
      categoryKey: 'suministro_inmueble',
      subtypeKey: 'telefonia',
      estado: 'ok',
    },
  },
  {
    id: 'alarma',
    familia: 'suministros',
    label: 'Alarma',
    tipoCompromiso: 'suministro',
    // Ámbito nuevo · hereda de `luz`: es un recibo de suministro más.
    personal: { categoria: 'vivienda.suministros', bolsa: 'necesidades' },
    inmueble: { categoria: 'inmueble.suministros', categoryKey: 'servicio_inmueble', estado: 'ok' },
  },
  {
    id: 'otros_suministros',
    familia: 'suministros',
    label: 'Otros',
    tipoCompromiso: 'suministro',
    personal: { categoria: 'vivienda.suministros', bolsa: 'necesidades' },
    inmueble: {
      categoria: 'inmueble.suministros',
      categoryKey: 'suministro_inmueble',
      estado: 'ok',
    },
  },
  // ── Seguros ───────────────────────────────────────────────────────
  {
    id: 'seguro_hogar',
    familia: 'seguros',
    label: 'Seguro hogar',
    tipoCompromiso: 'seguro',
    personal: { categoria: 'vivienda.seguros', bolsa: 'necesidades' },
    inmueble: { categoria: 'inmueble.seguros', categoryKey: 'seguro_inmueble', estado: 'ok' },
  },
  {
    id: 'seguro_vida',
    familia: 'seguros',
    label: 'Seguro vida',
    tipoCompromiso: 'seguro',
    personal: { categoria: 'salud', bolsa: 'necesidades' },
    // Ámbito nuevo · hereda de `seguro_hogar`: una vez vive en el inmueble es una prima de seguro (0114).
    inmueble: { categoria: 'inmueble.seguros', categoryKey: 'seguro_inmueble', estado: 'ok' },
  },
  {
    id: 'seguro_salud',
    familia: 'seguros',
    label: 'Seguro salud',
    tipoCompromiso: 'seguro',
    personal: { categoria: 'salud', bolsa: 'necesidades' },
  },
  {
    id: 'seguro_coche',
    familia: 'seguros',
    label: 'Seguro coche',
    tipoCompromiso: 'seguro',
    personal: { categoria: 'transporte', bolsa: 'necesidades' },
  },
  {
    id: 'seguro_impago',
    familia: 'seguros',
    label: 'Impago',
    tipoCompromiso: 'seguro',
    inmueble: { categoria: 'inmueble.seguros', categoryKey: 'seguro_inmueble', estado: 'ok' },
  },
  {
    id: 'otros_seguros',
    familia: 'seguros',
    label: 'Seguro · otros',
    tipoCompromiso: 'seguro',
    personal: { categoria: 'personal', bolsa: 'necesidades' },
    inmueble: { categoria: 'inmueble.seguros', categoryKey: 'seguro_inmueble', estado: 'ok' },
  },
  // ── Cuotas ────────────────────────────────────────────────────────
  {
    id: 'gimnasio',
    familia: 'cuotas',
    label: 'Gimnasio',
    tipoCompromiso: 'cuota',
    personal: { categoria: 'ocio', bolsa: 'deseos' },
  },
  {
    id: 'educacion',
    familia: 'cuotas',
    label: 'Educación · colegio · universidad',
    tipoCompromiso: 'cuota',
    personal: { categoria: 'educacion', bolsa: 'necesidades' },
  },
  {
    id: 'profesional',
    familia: 'cuotas',
    label: 'Profesional · colegio · sindicato',
    tipoCompromiso: 'cuota',
    personal: { categoria: 'educacion', bolsa: 'necesidades' },
  },
  {
    id: 'ong',
    familia: 'cuotas',
    label: 'ONG · donaciones recurrentes',
    tipoCompromiso: 'cuota',
    personal: { categoria: 'ocio', bolsa: 'deseos' },
  },
  {
    id: 'otros_cuotas',
    familia: 'cuotas',
    label: 'Otros',
    tipoCompromiso: 'cuota',
    personal: { categoria: 'personal', bolsa: 'deseos' },
  },
  // ── Suscripciones ─────────────────────────────────────────────────
  {
    id: 'streaming',
    familia: 'suscripciones',
    label: 'Streaming',
    tipoCompromiso: 'suscripcion',
    personal: { categoria: 'suscripciones', bolsa: 'deseos' },
  },
  {
    id: 'musica',
    familia: 'suscripciones',
    label: 'Música',
    tipoCompromiso: 'suscripcion',
    personal: { categoria: 'suscripciones', bolsa: 'deseos' },
  },
  {
    id: 'software',
    familia: 'suscripciones',
    label: 'Software',
    tipoCompromiso: 'suscripcion',
    personal: { categoria: 'suscripciones', bolsa: 'deseos' },
  },
  {
    id: 'cloud',
    familia: 'suscripciones',
    label: 'Cloud',
    tipoCompromiso: 'suscripcion',
    personal: { categoria: 'suscripciones', bolsa: 'deseos' },
  },
  {
    id: 'prensa',
    familia: 'suscripciones',
    label: 'Prensa',
    tipoCompromiso: 'suscripcion',
    personal: { categoria: 'suscripciones', bolsa: 'deseos' },
  },
  {
    id: 'otros_suscripciones',
    familia: 'suscripciones',
    label: 'Otros',
    tipoCompromiso: 'suscripcion',
    personal: { categoria: 'suscripciones', bolsa: 'deseos' },
  },
  // ── Día a día ─────────────────────────────────────────────────────
  {
    id: 'supermercado',
    familia: 'dia_a_dia',
    label: 'Supermercado · alimentación',
    tipoCompromiso: 'otros',
    personal: { categoria: 'alimentacion', bolsa: 'necesidades' },
  },
  {
    id: 'transporte',
    familia: 'dia_a_dia',
    label: 'Transporte · gasolina',
    tipoCompromiso: 'otros',
    personal: { categoria: 'transporte', bolsa: 'necesidades' },
  },
  {
    id: 'mantenimiento_coche',
    familia: 'dia_a_dia',
    label: 'Mantenimiento coche',
    tipoCompromiso: 'otros',
    personal: { categoria: 'transporte', bolsa: 'necesidades' },
  },
  {
    id: 'salud_gasto',
    familia: 'dia_a_dia',
    label: 'Salud · farmacia · médicos',
    tipoCompromiso: 'otros',
    personal: { categoria: 'salud', bolsa: 'necesidades' },
  },
  {
    id: 'restaurantes',
    familia: 'dia_a_dia',
    label: 'Restaurantes · cafeterías',
    tipoCompromiso: 'otros',
    personal: { categoria: 'ocio', bolsa: 'deseos' },
  },
  {
    id: 'ocio',
    familia: 'dia_a_dia',
    label: 'Ocio · cine · planes',
    tipoCompromiso: 'otros',
    personal: { categoria: 'ocio', bolsa: 'deseos' },
  },
  {
    id: 'ropa',
    familia: 'dia_a_dia',
    label: 'Ropa · calzado',
    tipoCompromiso: 'otros',
    personal: { categoria: 'personal', bolsa: 'deseos' },
  },
  {
    id: 'cuidado_personal',
    familia: 'dia_a_dia',
    label: 'Cuidado personal · peluquería',
    tipoCompromiso: 'otros',
    personal: { categoria: 'personal', bolsa: 'deseos' },
  },
  {
    id: 'otros_dia_a_dia',
    familia: 'dia_a_dia',
    label: 'Otros',
    tipoCompromiso: 'otros',
    personal: { categoria: 'personal', bolsa: 'deseos' },
  },
  // ── Gestión ───────────────────────────────────────────────────────
  {
    id: 'honorarios_agencia',
    familia: 'gestion',
    label: 'Gestión del alquiler',
    tipoCompromiso: 'otros',
    inmueble: {
      categoria: 'inmueble.gestionAlquiler',
      categoryKey: 'servicio_inmueble',
      estado: 'ok',
    },
  },
  {
    id: 'gestoria',
    familia: 'gestion',
    label: 'Gestoría',
    tipoCompromiso: 'otros',
    inmueble: {
      categoria: 'inmueble.gestionAlquiler',
      categoryKey: 'servicio_inmueble',
      estado: 'ok',
    },
  },
  {
    id: 'asesoria',
    familia: 'gestion',
    label: 'Asesoría',
    tipoCompromiso: 'otros',
    inmueble: {
      categoria: 'inmueble.gestionAlquiler',
      categoryKey: 'servicio_inmueble',
      estado: 'ok',
    },
  },
  {
    id: 'comision_plataformas',
    familia: 'gestion',
    label: 'Comisión de plataformas',
    tipoCompromiso: 'otros',
    inmueble: {
      categoria: 'inmueble.gestionAlquiler',
      categoryKey: 'servicio_inmueble',
      estado: 'ok',
    },
  },
  {
    id: 'otros_gestion',
    familia: 'gestion',
    label: 'Otros',
    tipoCompromiso: 'otros',
    inmueble: {
      categoria: 'inmueble.gestionAlquiler',
      categoryKey: 'servicio_inmueble',
      estado: 'ok',
    },
  },
  // ── Reparación y conservación ─────────────────────────────────────
  {
    id: 'mantenimiento_caldera',
    familia: 'reparacion',
    label: 'Mantenimiento de la caldera',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'reparacion_inmueble', estado: 'ok' },
  },
  {
    id: 'mantenimiento_integral',
    familia: 'reparacion',
    label: 'Mantenimiento integral',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'reparacion_inmueble', estado: 'ok' },
  },
  {
    id: 'otros_reparacion',
    familia: 'reparacion',
    label: 'Otros',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'reparacion_inmueble', estado: 'ok' },
  },
  // ── Servicios y explotación ───────────────────────────────────────
  {
    id: 'limpieza',
    familia: 'servicios',
    label: 'Limpieza',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'servicio_inmueble', estado: 'ok' },
  },
  {
    id: 'limpieza_zonas_comunes',
    familia: 'servicios',
    label: 'Limpieza de zonas comunes',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'servicio_inmueble', estado: 'ok' },
  },
  {
    id: 'limpieza_por_estancia',
    familia: 'servicios',
    label: 'Limpieza por estancia',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'servicio_inmueble', estado: 'ok' },
  },
  {
    id: 'lavanderia',
    familia: 'servicios',
    label: 'Lavandería',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'servicio_inmueble', estado: 'ok' },
  },
  {
    id: 'consumibles_bienvenida',
    familia: 'servicios',
    label: 'Consumibles de bienvenida',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'servicio_inmueble', estado: 'ok' },
  },
  {
    id: 'otros_servicios',
    familia: 'servicios',
    label: 'Otros',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'servicio_inmueble', estado: 'ok' },
  },
  // ── Mobiliario y enseres ──────────────────────────────────────────
  {
    id: 'ropa_enseres',
    familia: 'mobiliario',
    label: 'Ropa de cama y enseres',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'mobiliario_inmueble', estado: 'ok' },
  },
  {
    id: 'muebles',
    familia: 'mobiliario',
    label: 'Muebles',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'mobiliario_inmueble', estado: 'ok' },
  },
  {
    id: 'otros_mobiliario',
    familia: 'mobiliario',
    label: 'Otros',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'mobiliario_inmueble', estado: 'ok' },
  },
  // ── Otros ─────────────────────────────────────────────────────────
  {
    id: 'personalizado',
    familia: 'otros',
    label: 'Personalizado',
    tipoCompromiso: 'otros',
    esPersonalizado: true,
    personal: { categoria: 'personal', bolsa: 'deseos' },
    inmueble: { categoria: 'inmueble.otros', categoryKey: 'otros_inmueble', estado: 'ok' },
  },
];

// ─── Consulta ───────────────────────────────────────────────────────────────

const PORID = new Map(CONCEPTOS.map((c) => [c.id, c]));
const FAMPORID = new Map(FAMILIAS.map((f) => [f.id, f]));

/** El concepto, o `undefined` si ese id no existe. */
export function conceptoPorId(id: string | undefined | null): Concepto | undefined {
  return id ? PORID.get(id) : undefined;
}

export function familiaPorId(id: string | undefined | null): Familia | undefined {
  return id ? FAMPORID.get(id as FamiliaId) : undefined;
}

/** Dónde se puede elegir · se deduce de qué proyecciones tiene. */
export function ambitosDe(c: Concepto): Ambito[] {
  const out: Ambito[] = [];
  if (c.personal) out.push('personal');
  if (c.inmueble) out.push('inmueble');
  return out;
}

/** Los conceptos elegibles en un ámbito, en orden de catálogo. */
export function conceptosDeAmbito(ambito: Ambito): Concepto[] {
  return CONCEPTOS.filter((c) => (ambito === 'personal' ? c.personal : c.inmueble) !== undefined);
}

/** Las familias con al menos un concepto en ese ámbito, en orden. */
export function familiasDeAmbito(ambito: Ambito): Familia[] {
  const vivas = new Set(conceptosDeAmbito(ambito).map((c) => c.familia));
  return FAMILIAS.filter((f) => vivas.has(f.id));
}

/** Los conceptos de una familia en un ámbito · lo que pinta un selector. */
export function conceptosDe(familia: FamiliaId, ambito: Ambito): Concepto[] {
  return conceptosDeAmbito(ambito).filter((c) => c.familia === familia);
}

/**
 * La clasificación que le toca a un gasto · `undefined` si ese concepto no se
 * puede usar en ese ámbito.
 *
 * `undefined` NO es "usa lo que haya": es que la combinación no existe, y quien
 * llame debe negarse a guardar en vez de improvisar una categoría. Esa es la
 * regla que faltaba y por la que un seguro de vida acabó en un ámbito donde su
 * familia no existía.
 */
export function proyectar(
  conceptoId: string | undefined | null,
  ambito: Ambito,
): ProyeccionPersonal | ProyeccionInmueble | undefined {
  const c = conceptoPorId(conceptoId);
  if (!c) return undefined;
  return ambito === 'personal' ? c.personal : c.inmueble;
}

/**
 * Conceptos cuyo tratamiento fiscal hay que preguntar al confirmar.
 * Hoy sólo la derrama · ver `ProyeccionInmueble.categoryKey`.
 */
export function requierenPregunta(): Concepto[] {
  return CONCEPTOS.filter((c) => c.inmueble?.estado === 'pregunta');
}
