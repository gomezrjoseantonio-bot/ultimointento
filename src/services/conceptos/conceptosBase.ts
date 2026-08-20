// Los conceptos del catálogo unificado · SÓLO DATOS.
//
// Vive aparte de `catalogoConceptos.ts` porque aquello es la lógica —tipos,
// consultas y la capa de conceptos propios del usuario— y esto es una tabla que
// se lee de arriba abajo. Mezclarlas hacía un fichero en el que había que
// bajar quinientas líneas para encontrar una función.
//
// P8a (Jose, 20 ago 2026): reorganizado a los Tipos acordados (§9 quater). El
// `id` de cada concepto NO cambia —los apuntes guardan `conceptoId` y tienen que
// seguir resolviendo— y su proyección fiscal tampoco; lo único que se mueve es la
// carpeta (`familia`). Se añaden los subtipos que faltaban y se le da ámbito
// personal a mobiliario (comprar un mueble de tu casa también se clasifica). El
// catálogo es para TESORERÍA —de dónde sale el dinero—: todo gasto real tiene que
// poder elegirse; la fiscalidad es capa de encima (diferida).

import type { Concepto } from './catalogoConceptos';

/** El catálogo de fábrica · lo que trae ATLAS. Los propios del usuario se
 *  suman aparte (`conceptosUsuarioService`) y nunca se mezclan aquí. */
export const CONCEPTOS_BASE: readonly Concepto[] = [
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
    personal: { categoria: 'vivienda.comunidad', bolsa: 'necesidades' },
    inmueble: { categoria: 'inmueble.comunidad', categoryKey: null, estado: 'pregunta' },
  },
  {
    id: 'otros_comunidad',
    familia: 'comunidad',
    label: 'Otros',
    tipoCompromiso: 'comunidad',
    personal: { categoria: 'vivienda.comunidad', bolsa: 'necesidades' },
    inmueble: { categoria: 'inmueble.comunidad', categoryKey: 'comunidad_inmueble', estado: 'ok' },
  },
  // ── Impuestos ─────────────────────────────────────────────────────
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
    id: 'circulacion',
    familia: 'tributos',
    label: 'Impuesto de circulación',
    tipoCompromiso: 'impuesto',
    // Tributo del vehículo · personal. Hereda la lógica de un tributo local.
    personal: { categoria: 'transporte', bolsa: 'necesidades' },
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
  // ── Seguro ────────────────────────────────────────────────────────
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
    inmueble: { categoria: 'inmueble.seguros', categoryKey: 'seguro_inmueble', estado: 'ok' },
  },
  {
    id: 'seguro_impago',
    familia: 'seguros',
    label: 'Impago',
    tipoCompromiso: 'seguro',
    inmueble: { categoria: 'inmueble.seguros', categoryKey: 'seguro_inmueble', estado: 'ok' },
  },
  {
    id: 'seguro_decesos',
    familia: 'seguros',
    label: 'Decesos',
    tipoCompromiso: 'seguro',
    personal: { categoria: 'personal', bolsa: 'necesidades' },
  },
  {
    id: 'seguro_coche',
    familia: 'seguros',
    label: 'Seguro vehículo',
    tipoCompromiso: 'seguro',
    personal: { categoria: 'transporte', bolsa: 'necesidades' },
  },
  {
    id: 'seguro_salud',
    familia: 'seguros',
    label: 'Seguro médico',
    tipoCompromiso: 'seguro',
    personal: { categoria: 'salud', bolsa: 'necesidades' },
  },
  {
    id: 'otros_seguros',
    familia: 'seguros',
    label: 'Seguro · otros',
    tipoCompromiso: 'seguro',
    personal: { categoria: 'personal', bolsa: 'necesidades' },
    inmueble: { categoria: 'inmueble.seguros', categoryKey: 'seguro_inmueble', estado: 'ok' },
  },
  // ── Reparación ────────────────────────────────────────────────────
  {
    id: 'reparacion_vehiculo',
    familia: 'reparacion',
    label: 'Vehículo',
    tipoCompromiso: 'otros',
    personal: { categoria: 'transporte', bolsa: 'necesidades' },
  },
  {
    id: 'reparacion_caldera',
    familia: 'reparacion',
    label: 'Caldera',
    tipoCompromiso: 'otros',
    personal: { categoria: 'personal', bolsa: 'necesidades' },
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'reparacion_inmueble', estado: 'ok' },
  },
  {
    id: 'reparacion_electrodomesticos',
    familia: 'reparacion',
    label: 'Electrodomésticos',
    tipoCompromiso: 'otros',
    personal: { categoria: 'personal', bolsa: 'necesidades' },
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'reparacion_inmueble', estado: 'ok' },
  },
  {
    id: 'otros_reparacion',
    familia: 'reparacion',
    label: 'Otros',
    tipoCompromiso: 'otros',
    personal: { categoria: 'personal', bolsa: 'necesidades' },
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'reparacion_inmueble', estado: 'ok' },
  },
  // ── Mantenimiento ─────────────────────────────────────────────────
  {
    id: 'mantenimiento_caldera',
    familia: 'mantenimiento',
    label: 'Caldera',
    tipoCompromiso: 'otros',
    personal: { categoria: 'personal', bolsa: 'necesidades' },
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'reparacion_inmueble', estado: 'ok' },
  },
  {
    id: 'mantenimiento_coche',
    familia: 'mantenimiento',
    label: 'Vehículo',
    tipoCompromiso: 'otros',
    personal: { categoria: 'transporte', bolsa: 'necesidades' },
  },
  {
    id: 'mantenimiento_itv',
    familia: 'mantenimiento',
    label: 'ITV',
    tipoCompromiso: 'otros',
    personal: { categoria: 'transporte', bolsa: 'necesidades' },
  },
  {
    id: 'mantenimiento_integral',
    familia: 'mantenimiento',
    label: 'Mantenimiento integral',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'reparacion_inmueble', estado: 'ok' },
  },
  // ── Suministro ────────────────────────────────────────────────────
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
    label: 'Móvil · telefonía',
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
  // ── Alarma ────────────────────────────────────────────────────────
  {
    id: 'alarma',
    familia: 'alarma',
    label: 'Alarma',
    tipoCompromiso: 'suministro',
    personal: { categoria: 'vivienda.suministros', bolsa: 'necesidades' },
    inmueble: { categoria: 'inmueble.suministros', categoryKey: 'servicio_inmueble', estado: 'ok' },
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
    id: 'consumibles_bienvenida',
    familia: 'gestion',
    label: 'Consumibles de bienvenida',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'servicio_inmueble', estado: 'ok' },
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
  // ── Limpieza ──────────────────────────────────────────────────────
  {
    id: 'limpieza_zonas_comunes',
    familia: 'limpieza',
    label: 'Zonas comunes',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'servicio_inmueble', estado: 'ok' },
  },
  {
    id: 'limpieza',
    familia: 'limpieza',
    label: 'Integral',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'servicio_inmueble', estado: 'ok' },
  },
  {
    id: 'limpieza_por_estancia',
    familia: 'limpieza',
    label: 'Por estancia',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'servicio_inmueble', estado: 'ok' },
  },
  {
    id: 'lavanderia',
    familia: 'limpieza',
    label: 'Lavandería',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'servicio_inmueble', estado: 'ok' },
  },
  {
    id: 'otros_servicios',
    familia: 'limpieza',
    label: 'Otros',
    tipoCompromiso: 'otros',
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'servicio_inmueble', estado: 'ok' },
  },
  // ── Supermercado ──────────────────────────────────────────────────
  {
    id: 'supermercado',
    familia: 'supermercado',
    label: 'Supermercado · alimentación',
    tipoCompromiso: 'otros',
    personal: { categoria: 'alimentacion', bolsa: 'necesidades' },
  },
  // ── Transporte ────────────────────────────────────────────────────
  {
    id: 'transporte',
    familia: 'transporte',
    label: 'Combustible · transporte',
    tipoCompromiso: 'otros',
    personal: { categoria: 'transporte', bolsa: 'necesidades' },
  },
  // ── Farmacia ──────────────────────────────────────────────────────
  {
    id: 'salud_gasto',
    familia: 'farmacia',
    label: 'Farmacia · salud · médicos',
    tipoCompromiso: 'otros',
    personal: { categoria: 'salud', bolsa: 'necesidades' },
  },
  // ── Suscripciones ─────────────────────────────────────────────────
  {
    id: 'gimnasio',
    familia: 'suscripciones',
    label: 'Gimnasio',
    tipoCompromiso: 'cuota',
    personal: { categoria: 'ocio', bolsa: 'deseos' },
  },
  {
    id: 'educacion',
    familia: 'suscripciones',
    label: 'Educación · colegio · universidad',
    tipoCompromiso: 'cuota',
    personal: { categoria: 'educacion', bolsa: 'necesidades' },
  },
  {
    id: 'profesional',
    familia: 'suscripciones',
    label: 'Profesional · colegio · sindicato',
    tipoCompromiso: 'cuota',
    personal: { categoria: 'educacion', bolsa: 'necesidades' },
  },
  {
    id: 'ong',
    familia: 'suscripciones',
    label: 'ONG · donaciones recurrentes',
    tipoCompromiso: 'cuota',
    personal: { categoria: 'ocio', bolsa: 'deseos' },
  },
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
  {
    // Legacy «Otros» de la antigua familia Cuotas · redundante con el de
    // Suscripciones · se conserva oculto para que los gastos que lo usaban sigan
    // resolviendo, pero no se ofrece.
    id: 'otros_cuotas',
    familia: 'suscripciones',
    label: 'Otros',
    tipoCompromiso: 'cuota',
    oculto: true,
    personal: { categoria: 'personal', bolsa: 'deseos' },
  },
  // ── Ocio ──────────────────────────────────────────────────────────
  {
    id: 'ocio',
    familia: 'ocio',
    label: 'Ocio · cine · planes',
    tipoCompromiso: 'otros',
    personal: { categoria: 'ocio', bolsa: 'deseos' },
  },
  // ── Viaje ─────────────────────────────────────────────────────────
  {
    id: 'viaje',
    familia: 'viaje',
    label: 'Viajes · escapadas',
    tipoCompromiso: 'otros',
    personal: { categoria: 'viajes', bolsa: 'deseos' },
  },
  // ── Restaurante ───────────────────────────────────────────────────
  {
    id: 'restaurantes',
    familia: 'restaurante',
    label: 'Restaurantes · cafeterías',
    tipoCompromiso: 'otros',
    personal: { categoria: 'ocio', bolsa: 'deseos' },
  },
  // ── Ropa y calzado ────────────────────────────────────────────────
  {
    id: 'ropa',
    familia: 'ropa',
    label: 'Ropa · calzado',
    tipoCompromiso: 'otros',
    personal: { categoria: 'personal', bolsa: 'deseos' },
  },
  // ── Cuidado personal ──────────────────────────────────────────────
  {
    id: 'cuidado_personal',
    familia: 'cuidado_personal',
    label: 'Cuidado personal · peluquería',
    tipoCompromiso: 'otros',
    personal: { categoria: 'personal', bolsa: 'deseos' },
  },
  // ── Alquiler ──────────────────────────────────────────────────────
  {
    id: 'alquiler_vivienda',
    familia: 'alquiler',
    label: 'Vivienda',
    tipoCompromiso: 'otros',
    personal: { categoria: 'vivienda.alquiler', bolsa: 'necesidades' },
  },
  {
    id: 'alquiler_vehiculo',
    familia: 'alquiler',
    label: 'Vehículo (renting)',
    tipoCompromiso: 'otros',
    personal: { categoria: 'transporte', bolsa: 'necesidades' },
  },
  // ── Mobiliario y enseres · ámbito personal añadido (P8a) ───────────
  {
    id: 'ropa_enseres',
    familia: 'mobiliario',
    label: 'Ropa de cama y enseres',
    tipoCompromiso: 'otros',
    personal: { categoria: 'personal', bolsa: 'deseos' },
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'mobiliario_inmueble', estado: 'ok' },
  },
  {
    id: 'muebles',
    familia: 'mobiliario',
    label: 'Muebles',
    tipoCompromiso: 'otros',
    personal: { categoria: 'personal', bolsa: 'deseos' },
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'mobiliario_inmueble', estado: 'ok' },
  },
  {
    id: 'otros_mobiliario',
    familia: 'mobiliario',
    label: 'Otros',
    tipoCompromiso: 'otros',
    personal: { categoria: 'personal', bolsa: 'deseos' },
    inmueble: { categoria: 'inmueble.opex', categoryKey: 'mobiliario_inmueble', estado: 'ok' },
  },
  // ── Otros ─────────────────────────────────────────────────────────
  {
    id: 'otros_dia_a_dia',
    familia: 'otros',
    label: 'Otros gastos del día a día',
    tipoCompromiso: 'otros',
    personal: { categoria: 'personal', bolsa: 'deseos' },
  },
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
