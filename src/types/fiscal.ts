// ═══ ESTADOS Y TIPOS BASE ═══

export type EstadoEjercicio = 'en_curso' | 'cerrado' | 'declarado';
export type OrigenDeclaracion = 'pdf_importado' | 'xml_importado' | 'manual' | 'no_presentada';
export type TipoDocumentoFiscal =
  | 'factura'
  | 'contrato'
  | 'extracto_bancario'
  | 'recibo'
  | 'poliza'
  | 'certificado_retencion'
  | 'escritura'
  | 'nota_simple'
  | 'otro';

export type ConceptoFiscalVinculable =
  | 'ingresos_alquiler'
  | 'gastos_intereses'
  | 'gastos_reparacion'
  | 'gastos_comunidad'
  | 'gastos_servicios'
  | 'gastos_suministros'
  | 'gastos_seguros'
  | 'gastos_tributos'
  | 'amortizacion_muebles'
  | 'amortizacion_inmueble'
  | 'mejoras'
  | 'gastos_adquisicion'
  | 'retribuciones_trabajo'
  | 'ingresos_actividad'
  | 'gastos_actividad'
  | 'intereses_cuentas'
  | 'aportaciones_pp'
  | 'otro';

// ═══ EJERCICIO FISCAL — Entidad principal ═══

export interface EjercicioFiscal {
  ejercicio: number;
  estado: EstadoEjercicio;
  calculoAtlas?: DeclaracionIRPF;
  calculoAtlasFecha?: string;
  declaracionAeat?: DeclaracionIRPF;
  declaracionAeatFecha?: string;
  declaracionAeatPdfRef?: string;
  declaracionAeatOrigen: OrigenDeclaracion;
  casillasRaw?: Record<string, number | string>;
  arrastresRecibidos: ArrastresEjercicio;
  arrastresGenerados: ArrastresEjercicio;
  createdAt: string;
  updatedAt: string;
  cerradoAt?: string;
  declaradoAt?: string;
}

// ═══ DECLARACIÓN IRPF — Casillas del Modelo 100 ═══

export interface DeclaracionIRPF {
  personal?: {
    nif?: string;
    nombre?: string;
    estadoCivil?: string;
    comunidadAutonoma?: string;
    fechaNacimiento?: string;
  };
  trabajo: DeclaracionTrabajo;
  inmuebles: DeclaracionInmueble[];
  actividades: DeclaracionActividad[];
  capitalMobiliario: DeclaracionCapitalMobiliario;
  gananciasPerdidas: DeclaracionGananciasPerdidas;
  planPensiones: DeclaracionPlanPensiones;
  basesYCuotas: DeclaracionBasesYCuotas;
  rentasImputadas?: { sumaImputaciones: number };
}

export interface DeclaracionTrabajo {
  retribucionesDinerarias: number;
  retribucionEspecie: number;
  ingresosACuenta: number;
  contribucionesPPEmpresa: number;
  totalIngresosIntegros: number;
  cotizacionSS: number;
  rendimientoNetoPrevio: number;
  otrosGastosDeducibles: number;
  rendimientoNeto: number;
  rendimientoNetoReducido: number;
  retencionesTrabajoTotal: number;
}

export interface DeclaracionInmueble {
  orden: number;
  referenciaCatastral: string;
  direccion: string;
  porcentajePropiedad: number;
  uso: 'arrendamiento' | 'disposicion' | 'accesorio' | 'mixto';
  esAccesorio: boolean;
  refCatastralPrincipal?: string;
  derechoReduccion: boolean;
  nifArrendatario1?: string;
  nifArrendatario2?: string;
  fechaContrato?: string;
  diasArrendado: number;
  diasDisposicion: number;
  rentaImputada: number;
  ingresosIntegros: number;
  arrastresRecibidos: number;
  arrastresAplicados: number;
  interesesFinanciacion: number;
  gastosReparacion: number;
  gastos0105_0106Aplicados: number;
  arrastresGenerados: number;
  gastosComunidad: number;
  gastosServicios: number;
  gastosSuministros: number;
  gastosSeguros: number;
  gastosTributos: number;
  amortizacionMuebles: number;
  tipoAdquisicion?: 'onerosa' | 'lucrativa';
  fechaAdquisicion?: string;
  valorCatastral?: number;
  valorCatastralConstruccion?: number;
  porcentajeConstruccion?: number;
  importeAdquisicion?: number;
  gastosAdquisicion?: number;
  mejoras?: number;
  baseAmortizacion?: number;
  amortizacionInmueble: number;
  accesorio?: {
    tipoAdquisicion?: 'onerosa' | 'lucrativa';
    fechaAdquisicion?: string;
    diasArrendado?: number;
    valorCatastral?: number;
    valorCatastralConstruccion?: number;
    porcentajeConstruccion?: number;
    importeAdquisicion?: number;
    gastosAdquisicion?: number;
    baseAmortizacion?: number;
    amortizacion?: number;
  };
  rendimientoNeto: number;
  reduccion: number;
  rendimientoNetoReducido: number;
}

export interface DeclaracionActividad {
  contribuyente: 'declarante' | 'conyuge';
  tipoActividad: string;
  epigrafeIAE: string;
  modalidad: 'normal' | 'simplificada';
  ingresos: number;
  gastos: number;
  provisionDificilJustificacion?: number;
  rendimientoNeto: number;
  rendimientoNetoReducido: number;
  retencionesActividad: number;
}

export interface DeclaracionCapitalMobiliario {
  interesesCuentas: number;
  otrosRendimientos: number;
  totalIngresosIntegros: number;
  rendimientoNeto: number;
  rendimientoNetoReducido: number;
  retencionesCapital: number;
}

export interface DeclaracionGananciasPerdidas {
  gananciasNoTransmision: number;
  perdidasNoTransmision: number;
  saldoNetoGeneral: number;
  gananciasTransmision: number;
  perdidasTransmision: number;
  saldoNetoAhorro: number;
  compensacionPerdidasAnteriores: number;
  perdidasPendientes: PerdidasPendientes[];
}

export interface PerdidasPendientes {
  ejercicioOrigen: number;
  importeOriginal: number;
  importeAplicado: number;
  importePendiente: number;
  caducaEjercicio: number;
  origen: string;
}

export interface DeclaracionPlanPensiones {
  aportacionesTrabajador: number;
  contribucionesEmpresariales: number;
  totalConDerecho: number;
  reduccionAplicada: number;
}

export interface DeclaracionBasesYCuotas {
  baseImponibleGeneral: number;
  baseImponibleAhorro: number;
  baseLiquidableGeneral: number;
  baseLiquidableAhorro: number;
  cuotaIntegraEstatal: number;
  cuotaIntegraAutonomica: number;
  cuotaIntegra: number;
  cuotaLiquidaEstatal: number;
  cuotaLiquidaAutonomica: number;
  cuotaLiquida: number;
  cuotaResultante: number;
  retencionesTotal: number;
  cuotaDiferencial: number;
  resultadoDeclaracion: number;
}

// ═══ ARRASTRES ═══

export interface ArrastresEjercicio {
  gastos0105_0106: ArrastreGastoInmueble[];
  perdidasPatrimonialesAhorro: ArrastrePerdidasAhorro[];
  amortizacionesAcumuladas: ArrastreAmortizacion[];
  // Compatibilidad legacy para módulos que aún leen el modelo anterior.
  porInmueble?: ArrastreGastoInmueble[];
  porAnio?: ArrastrePerdidasAhorro[];
}

export interface ArrastreGastoInmueble {
  inmuebleId?: string;
  referenciaCatastral: string;
  ejercicioOrigen: number;
  importeOriginal: number;
  importeAplicado: number;
  importePendiente: number;
  caducaEjercicio: number;
}

export interface ArrastrePerdidasAhorro {
  ejercicioOrigen: number;
  importeOriginal: number;
  importeAplicado: number;
  importePendiente: number;
  caducaEjercicio: number;
  origen: string;
  detalle?: string;
}

export interface ArrastreAmortizacion {
  inmuebleId?: string;
  referenciaCatastral: string;
  amortizacionDeducida: number;
  amortizacionEstandar: number;
  amortizacionAplicada: number;
  ejercicioDesde: number;
  ejercicioHasta: number;
}

// ═══ DOCUMENTACIÓN FISCAL ═══

export interface DocumentoFiscal {
  id?: number;
  ejercicio: number;
  tipo: TipoDocumentoFiscal;
  concepto: ConceptoFiscalVinculable;
  inmuebleId?: string;
  inmuebleRef?: string;
  importe: number;
  fechaDocumento: string;
  fechaSubida: string;
  archivoRef?: string;
  archivoNombre?: string;
  archivoTipo?: string;
  descripcion?: string;
  proveedorNif?: string;
  proveedorNombre?: string;
}

// ═══ ARRASTRES MANUALES ═══

export interface ArrastreManual {
  id?: number;
  tipo: 'gastos_0105_0106' | 'perdidas_ahorro' | 'perdidas_general';
  ejercicioOrigen: number;
  importe: number;
  inmuebleId?: string;
  referenciaCatastral?: string;
  detalle?: string;
  reemplazadoPorImportacion: boolean;
  createdAt: string;
}

// ═══ COBERTURA DOCUMENTAL ═══

export interface LineaCoberturaDocumental {
  concepto: ConceptoFiscalVinculable;
  descripcion: string;
  inmuebleRef?: string;
  importeDeclarado: number;
  importeDocumentado: number;
  diferencia: number;
  estado: 'cubierto' | 'parcial' | 'sin_documentar';
  documentos: DocumentoFiscal[];
}

export interface InformeCoberturaDocumental {
  ejercicio: number;
  lineas: LineaCoberturaDocumental[];
  totalDeclarado: number;
  totalDocumentado: number;
  riesgoTotal: number;
  nivelRiesgo: 'bajo' | 'medio' | 'alto';
}

export function createEmptyArrastresEjercicio(): ArrastresEjercicio {
  return {
    gastos0105_0106: [],
    perdidasPatrimonialesAhorro: [],
    amortizacionesAcumuladas: [],
    porInmueble: [],
    porAnio: [],
  };
}
