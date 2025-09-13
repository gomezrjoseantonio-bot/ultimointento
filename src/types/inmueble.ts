// Esquema de datos — Inmueble (v1.0)
// Following exact specifications from problem statement

export type EstadoInmueble = 'ACTIVO' | 'VENDIDO';
export type RegimenCompra = 'USADA_ITP' | 'NUEVA_IVA_AJD';
export type MetodoAmortizacion = 'REGLA_GENERAL_3' | 'ESPECIAL';
export type TipoAdquisicion = 'LUCRATIVA_ONEROSA';
export type ComplecionStatus = 'PENDIENTE' | 'PARCIAL' | 'COMPLETO';

// 17 CCAA + Ceuta/Melilla
export type ComunidadAutonoma = 
  | 'Andalucía' | 'Aragón' | 'Asturias' | 'Baleares' | 'Canarias' 
  | 'Cantabria' | 'Castilla-La Mancha' | 'Castilla y León' | 'Cataluña' 
  | 'Extremadura' | 'Galicia' | 'La Rioja' | 'Madrid' | 'Murcia' 
  | 'Navarra' | 'País Vasco' | 'Valencia' | 'Ceuta' | 'Melilla';

export interface DireccionInmueble {
  calle: string; // 1-120 chars
  numero: string; // 1-10 chars
  piso?: string; // 0-10 chars, optional
  puerta?: string; // 0-10 chars, optional
  cp: string; // pattern: ^\d{5}$ - obligatorio
  municipio: string; // 1-80 chars, autocompletado por CP (editable)
  provincia: string; // 1-80 chars, autocompletado por CP (editable)
  ca: ComunidadAutonoma; // autocompletado por CP (editable)
}

export interface CaracteristicasFisicas {
  m2: number; // >0, 2 decimales
  habitaciones: number; // ≥0 integer
  banos: number; // ≥0 integer
  anio_construccion?: number; // 1800-2100, opcional
}

export interface GastosCompra {
  notaria: number; // ≥0, 2 dec, default 0
  registro: number; // ≥0, 2 dec, default 0
  gestoria: number; // ≥0, 2 dec, default 0
  inmobiliaria: number; // ≥0, 2 dec, default 0
  psi: number; // ≥0, 2 dec, default 0 - Personal Shopper Inmobiliario
  otros: number; // ≥0, 2 dec, default 0
}

export interface ImpuestosCompra {
  // Para USADA_ITP
  itp_importe?: number; // ≥0, 2 dec
  itp_porcentaje_info?: number; // ≥0, 4 dec - sólo informativo
  
  // Para NUEVA_IVA_AJD
  iva_importe?: number; // ≥0, 2 dec
  iva_porcentaje_info?: number; // ≥0, 4 dec - sólo informativo
  ajd_importe?: number; // ≥0, 2 dec
  ajd_porcentaje_info?: number; // ≥0, 4 dec - sólo informativo
}

export interface CompraInmueble {
  fecha_compra: string; // date-iso - obligatorio
  regimen: RegimenCompra; // obligatorio
  precio_compra: number; // ≥0, 2 dec - obligatorio
  gastos: GastosCompra;
  impuestos: ImpuestosCompra; // todos guardados en €, no en %
  
  // Derivados (persistidos para reporting y consistencia temporal)
  total_gastos: number; // suma de gastos
  total_impuestos: number; // suma de impuestos en €
  coste_total_compra: number; // precio_compra + total_gastos + total_impuestos
  eur_por_m2: number; // coste_total_compra / caracteristicas.m2 (si m2>0)
}

export interface FiscalidadInmueble {
  valor_catastral_total: number; // ≥0, 2 dec
  valor_catastral_construccion: number; // ≥0, 2 dec
  porcentaje_construccion: number; // 0-100, 4 dec - auto = VCc/VC*100, editable
  tipo_adquisicion: TipoAdquisicion; // const LUCRATIVA_ONEROSA - no visible, fijo
  metodo_amortizacion: MetodoAmortizacion; // default REGLA_GENERAL_3
  amortizacion_anual_base: number; // ≥0, 2 dec - base sobre la que se aplica %
  porcentaje_amortizacion_info: number; // default 3.0000 - sólo informativo
  nota?: string; // aclaraciones puntuales (ej.: casos especiales AEAT)
}

export interface RelacionesInmueble {
  contratos_ids: string[]; // contratos de alquiler activos/históricos
  prestamos_ids: string[]; // hipotecas/préstamos vinculados
  cuentas_bancarias_ids: string[]; // cuentas utilizadas por este inmueble
  documentos_ids: string[]; // docs subidos (escrituras, IBI, seguros…)
}

export interface AuditoriaInmueble {
  created_at: string; // datetime-iso
  created_by: string; // userId
  updated_at: string; // datetime-iso
  updated_by: string; // userId
  version: number; // empieza en 1; +1 por edición relevante
}

// Estado de completitud por bloque
export interface CompletitudInmueble {
  identificacion_status: ComplecionStatus;
  caracteristicas_status: ComplecionStatus;
  compra_status: ComplecionStatus;
  fiscalidad_status: ComplecionStatus;
}

// Interfaz principal del inmueble
export interface Inmueble {
  // Identificación
  id: string; // UUID PK
  alias: string; // 1-80 chars - nombre corto visible
  direccion: DireccionInmueble;
  ref_catastral?: string; // 0-30 chars, opcional
  estado: EstadoInmueble; // por defecto ACTIVO
  fecha_alta: string; // date-iso - set por sistema
  fecha_venta?: string; // date-iso, opcional - requerido sólo si estado=VENDIDO
  
  // Características físicas
  caracteristicas: CaracteristicasFisicas;
  
  // Compra y costes asociados
  compra: CompraInmueble;
  
  // Fiscalidad y amortización
  fiscalidad: FiscalidadInmueble;
  
  // Enlaces (relaciones; no embebidos)
  relaciones: RelacionesInmueble;
  
  // Auditoría
  auditoria: AuditoriaInmueble;
  
  // Estado de completitud
  completitud: CompletitudInmueble;
}

// Partial types for form steps
export interface InmuebleStep1 {
  alias: string;
  direccion: Partial<DireccionInmueble>;
  ref_catastral?: string;
  estado: EstadoInmueble;
}

export interface InmuebleStep2 {
  caracteristicas: Partial<CaracteristicasFisicas>;
}

export interface InmuebleStep3 {
  compra: Partial<CompraInmueble>;
}

export interface InmuebleStep4 {
  fiscalidad: Partial<FiscalidadInmueble>;
}

// Validation error messages (estandarizados)
export const INMUEBLE_ERRORS = {
  ERR_CP_INVALIDO: "El código postal debe tener 5 dígitos.",
  ERR_REGIMEN_OBLIGATORIO: "Selecciona el régimen de la compra (usada u obra nueva).",
  ERR_IMPUESTO_NEGATIVO: "El importe de impuesto no puede ser negativo.",
  ERR_ESTADO_VENDIDO_SIN_FECHA: "Para marcar 'Vendido' debes indicar la fecha de venta.",
  ERR_RELACIONES_PENDIENTES: "Este inmueble tiene elementos vinculados. Elige desasociar o eliminar en cascada."
} as const;

// Helper type for creating new properties
export type NuevoInmueble = Omit<Inmueble, 'id' | 'auditoria' | 'relaciones' | 'completitud'>;