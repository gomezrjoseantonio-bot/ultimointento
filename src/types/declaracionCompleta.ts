/**
 * declaracionCompleta.ts
 *
 * Modelo de datos rico para una declaración IRPF completa.
 * Es el contrato unificado que producen las 3 vías de importación
 * (XML, PDF vía Claude, manual) y que el distribuidor consume
 * para alimentar todos los módulos de ATLAS.
 *
 * PRINCIPIO: este modelo es un SUPERSET. Campos opcionales generosos.
 * Cada año fiscal puede tener campos que otros no tienen.
 * El campo camposExtra captura todo lo que no esté tipado explícitamente.
 */

// ═══════════════════════════════════════════════
// RAÍZ
// ═══════════════════════════════════════════════

export interface DeclaracionCompleta {
  meta: MetaDeclaracion;
  declarante: Declarante;
  trabajo?: TrabajoDeclarado;
  actividadEconomica?: ActividadEconomicaDeclarada;
  capitalMobiliario?: CapitalMobiliarioDeclarado;
  inmuebles: InmuebleDeclarado[];
  gananciasPerdidas?: GananciasPerdidas;
  planPensiones?: PlanPensionesDeclarado;
  integracion: IntegracionFiscal;
  resultado: ResultadoDeclaracion;
  arrastres: ArrastresDeclarados;
  cuentaDevolucion?: CuentaBancaria;
  cuentaIngreso?: CuentaBancaria;
  deducciones?: DeduccionesDeclaradas;
  casillas: Record<string, number>;
  camposExtra: Record<string, any>;
}

// ═══════════════════════════════════════════════
// META
// ═══════════════════════════════════════════════

export interface MetaDeclaracion {
  ejercicio: number;
  modelo: '100';
  fechaPresentacion: string;
  numeroJustificante: string;
  csv: string;
  referencia: string;
  versionModelo?: string;
  fuenteImportacion: 'xml' | 'pdf' | 'manual';
  confianza: 'total' | 'alta' | 'media';
  esComplementaria: boolean;
  esRectificativa: boolean;
  declaracionPrevia?: {
    justificante: string;
    devolucionSolicitada?: number;
    devolucionAcordada?: number;
    ingresosPrevios?: number;
    pagosPendientes?: number;
  };
  tipoDeclaracion: 'D' | 'I' | 'U' | 'N';
}

// ═══════════════════════════════════════════════
// DECLARANTE
// ═══════════════════════════════════════════════

export interface Declarante {
  nif: string;
  nombreCompleto: string;
  fechaNacimiento?: string;
  sexo?: 'H' | 'M';
  estadoCivil?: 'soltero' | 'casado' | 'viudo' | 'divorciado' | 'separado';
  codigoCCAA?: string;
  nombreCCAA?: string;
  tributacion: 'individual' | 'conjunta';
  asignacionSocial: boolean;
  asignacionIglesia: boolean;
  obligacionMaterial?: boolean;
}

// ═══════════════════════════════════════════════
// TRABAJO
// ═══════════════════════════════════════════════

export interface TrabajoDeclarado {
  retribucionesDinerarias: number;
  valoracionEspecie: number;
  ingresosACuentaEspecie: number;
  retribucionEspecieNeta: number;
  contribucionesPPEmpresa: number;
  totalIngresosIntegros: number;
  cotizacionesSS: number;
  rendimientoNetoPrevio: number;
  otrosGastosDeducibles: number;
  rendimientoNeto: number;
  rendimientoNetoReducido: number;
  retenciones: number;
  empleador?: EmpleadorDetectado;
}

export interface EmpleadorDetectado {
  nif: string;
  nombre?: string;
  regimenSS?: number;
}

// ═══════════════════════════════════════════════
// ACTIVIDAD ECONÓMICA
// ═══════════════════════════════════════════════

export interface ActividadEconomicaDeclarada {
  tipo: string;
  iae: string;
  modalidad: 'normal' | 'simplificada';
  ingresosExplotacion: number;
  subvenciones: number;
  totalIngresos: number;
  gastosSS: number;
  gastosServicios: number;
  otrosGastos: number;
  totalGastos: number;
  rendimientoPrevio?: number;
  reduccionSimplificada?: number;
  totalGastosDeducibles?: number;
  rendimientoNeto: number;
  rendimientoNetoReducido: number;
  retenciones: number;
  pagosFraccionados: number;
}

// ═══════════════════════════════════════════════
// CAPITAL MOBILIARIO
// ═══════════════════════════════════════════════

export interface CapitalMobiliarioDeclarado {
  intereses: FuenteRendimiento[];
  dividendos: FuenteRendimiento[];
  otrosRendimientos: FuenteRendimiento[];
  totalBruto: number;
  gastosDeducibles: number;
  rendimientoNeto: number;
  rendimientoNetoReducido: number;
  retenciones: number;
}

export interface FuenteRendimiento {
  importe: number;
  retencion: number;
  gastosDeducibles?: number;
}

// ═══════════════════════════════════════════════
// INMUEBLES — El corazón
// ═══════════════════════════════════════════════

export interface InmuebleDeclarado {
  refCatastral: string;
  direccion: string;
  porcentajePropiedad: number;
  esUrbana: boolean;
  valorCatastralTotal?: number;
  valorCatastral?: number;
  valorCatastralConstruccion?: number;
  porcentajeConstruccion?: number;
  catastralRevisado?: boolean;
  tipoAdquisicion?: 'onerosa' | 'herencia' | 'donacion';
  fechaAdquisicion?: string;
  precioAdquisicion?: number;
  gastosAdquisicion?: number;
  mejorasAnteriores?: number;
  mejorasEjercicio: MejoraDeclarada[];
  baseAmortizacion?: number;
  amortizacionAnualInmueble?: number;
  amortizacionManual?: number;
  amortizacionMobiliario?: number;
  usos: UsoInmueble[];
  arrendamientos: ArrendamientoDeclarado[];
  gastos: GastosInmueble;
  gastosPendientesPrevios: number;
  gastosPendientesPreviosAplicados: number;
  // IMP4GCPEA — arrastre recibido de ejercicios anteriores (casilla 0103 Modelo 100)
  arrastresRecibidos?: number;
  rendimientoNeto: number;
  reduccionVivienda: number;
  rendimientoNetoReducido: number;
  gastosPendientesGenerados: number;
  accesorio?: InmuebleAccesorioDeclarado;
  esAccesorioDe?: string;
  proveedores: ProveedorDetectado[];
}

export interface UsoInmueble {
  tipo: 'disposicion' | 'arrendado' | 'accesorio';
  dias: number;
  rentaImputada?: number;
}

export interface ArrendamientoDeclarado {
  tipoArrendamiento?: 'vivienda' | 'no_vivienda';
  esResidenciaHabitual?: boolean;
  regimenReduccion?: string;
  nifArrendatarios: string[];
  fechaContrato?: string;
  tieneReduccion: boolean;
  ingresos: number;
  diasArrendado: number;
  amortizacionManual?: number;
  interesesFinanciacion?: number;
  reparacionConservacion?: number;
  comunidad?: number;
  suministros?: number;
  seguros?: number;
  ibiTasas?: number;
  serviciosTerceros?: number;
  amortizacionMobiliario?: number;
  proveedores: ProveedorDetectado[];
}

export interface GastosInmueble {
  interesesFinanciacion: number;
  reparacionConservacion: number;
  gastosAplicados: number;
  comunidad: number;
  suministros: number;
  seguros: number;
  ibiTasas: number;
  serviciosTerceros: number;
  amortizacionMobiliario: number;
}

export interface MejoraDeclarada {
  fecha?: string;
  importe: number;
  nifProveedor?: string;
}

export interface InmuebleAccesorioDeclarado {
  refCatastral: string;
  direccion?: string;
  refCatastralPrincipal: string;
  fechaAdquisicion?: string;
  precioAdquisicion?: number;
  gastosAdquisicion?: number;
  valorCatastral?: number;
  valorCatastralConstruccion?: number;
  porcentajeConstruccion?: number;
  baseAmortizacion?: number;
  amortizacionAnual?: number;
  diasArrendado?: number;
}

export interface ProveedorDetectado {
  nif: string;
  concepto: 'reparacion' | 'mejora' | 'gestion' | 'servicios' | 'otro';
  importe: number;
  fecha?: string;
}

// ═══════════════════════════════════════════════
// GANANCIAS Y PÉRDIDAS
// ═══════════════════════════════════════════════

export interface GananciasPerdidas {
  fondos: OperacionFondo[];
  criptomonedas: OperacionCripto[];
  premios?: number;
  otrasTransmisiones: OperacionTransmision[];
  totalGananciasAhorro: number;
  totalPerdidasAhorro: number;
  saldoNetoAhorro: number;
  totalGananciasGeneral: number;
  totalPerdidasGeneral: number;
  saldoNetoGeneral: number;
}

export interface OperacionFondo {
  nifFondo: string;
  valorTransmision: number;
  valorAdquisicion: number;
  ganancia: number;
  retencion: number;
}

export interface OperacionCripto {
  moneda: string;
  claveContraprestacion: string;
  valorTransmision: number;
  valorAdquisicion: number;
  resultado: number;
}

export interface OperacionTransmision {
  descripcion?: string;
  valorTransmision: number;
  valorAdquisicion: number;
  resultado: number;
}

// ═══════════════════════════════════════════════
// PLAN DE PENSIONES
// ═══════════════════════════════════════════════

export interface PlanPensionesDeclarado {
  aportacionesTrabajador: number;
  contribucionesEmpresa: number;
  nifEmpleador?: string;
  nombreEmpleador?: string;
  totalConDerechoReduccion: number;
}

// ═══════════════════════════════════════════════
// DEDUCCIONES
// ═══════════════════════════════════════════════

export interface DeduccionesDeclaradas {
  donativosImporte?: number;
  donativosDeduccion?: number;
  autonomicas: number;
  estatales: number;
}

// ═══════════════════════════════════════════════
// INTEGRACIÓN FISCAL
// ═══════════════════════════════════════════════

export interface IntegracionFiscal {
  baseImponibleGeneral: number;
  baseImponibleAhorro: number;
  reduccionPP: number;
  baseLiquidableGeneral: number;
  baseLiquidableAhorro: number;
  minimoPersonalEstatal: number;
  minimoPersonalAutonomico: number;
}

// ═══════════════════════════════════════════════
// RESULTADO
// ═══════════════════════════════════════════════

export interface ResultadoDeclaracion {
  cuotaIntegraEstatal: number;
  cuotaIntegraAutonomica: number;
  cuotaLiquidaEstatal: number;
  cuotaLiquidaAutonomica: number;
  deduccionesAutonomicas: number;
  deduccionesEstatales: number;
  cuotaAutoliquidacion: number;
  totalRetencionesPagos: number;
  cuotaDiferencial: number;
  resultadoDeclaracion: number;
  tipoMedioEstatal?: number;
  tipoMedioAutonomico?: number;
  irpfCCAA?: number;
  ingresosPrevios?: number;
  importeRectificativa?: number;
}

// ═══════════════════════════════════════════════
// ARRASTRES SALIENTES
// ═══════════════════════════════════════════════

export interface ArrastresDeclarados {
  gastosPendientes: ArrastreGastoDeclarado[];
  perdidasPatrimoniales: ArrastrePerdidaDeclarada[];
}

export interface ArrastreGastoDeclarado {
  refCatastral: string;
  importePendiente: number;
  añoOrigen: number;
  importeAplicado: number;
}

export interface ArrastrePerdidaDeclarada {
  tipo: 'ahorro' | 'general';
  importeInicial: number;
  importeAplicado: number;
  importePendiente: number;
  añoOrigen: number;
}

// ═══════════════════════════════════════════════
// AUXILIARES
// ═══════════════════════════════════════════════

export interface CuentaBancaria {
  iban: string;
}
