// Los 60 conceptos del catálogo unificado · SÓLO DATOS.
//
// Vive aparte de `catalogoConceptos.ts` porque aquello es la lógica —tipos,
// consultas y la capa de conceptos propios del usuario— y esto es una tabla que
// se lee de arriba abajo. Mezclarlas hacía un fichero en el que había que
// bajar quinientas líneas para encontrar una función.
//
// Cómo se llenó y por qué no reasigna nada: ver la cabecera de
// `catalogoConceptos.ts`.

import type { Concepto } from './catalogoConceptos';

/** El catálogo de fábrica · lo que trae ATLAS. Los propios del usuario se
 *  suman aparte (`conceptosUsuarioService`) y nunca se mezclan aquí. */
export const CONCEPTOS_BASE: readonly Concepto[] = [
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
