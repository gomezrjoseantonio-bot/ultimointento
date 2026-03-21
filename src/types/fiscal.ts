import type { DeclaracionIRPF } from '../services/irpfCalculationService';

export type EstadoEjercicio = 'en_curso' | 'cerrado' | 'declarado';

export type OrigenDeclaracion = 'pdf_importado' | 'manual' | 'no_presentada';

export interface DeclaracionInmueble {
  referenciaCatastral?: string;
  direccion?: string;
  uso?: 'arrendamiento' | 'disposicion' | 'accesorio' | 'mixto';
  ingresosIntegros?: number;
  gastosDeducibles?: number;
  amortizacion?: number;
  rendimientoNeto?: number;
  rendimientoNetoReducido?: number;
  arrastresAplicados?: number;
  arrastresGenerados?: number;
}

export interface DocumentoFiscal {
  id?: string;
  nombre: string;
  tipo: 'factura' | 'contrato' | 'extracto' | 'declaracion' | 'justificante' | 'otro';
  categoria?: string;
  conceptoFiscal: string;
  importe?: number;
  importeDeclarado?: number;
  estado?: 'pendiente' | 'documentado' | 'rechazado';
  fechaDocumento?: string;
  fechaSubida: string;
  ejercicio: number;
  inmuebleRef?: string;
  origenId?: number | string;
  storageRef?: string;
  notas?: string;
}

export interface ArrastrePorInmueble {
  inmuebleRef?: string;
  concepto: 'gastos_0105_0106' | 'amortizacion' | 'otros';
  ejercicioOrigen: number;
  ejercicioAplicacion?: number;
  importePendiente: number;
  importeAplicado?: number;
  fechaOrigen?: string;
}

export interface ArrastrePorAnio {
  tipo: 'perdidas_ahorro' | 'deduccion' | 'otros';
  ejercicioOrigen: number;
  ejercicioCaducidad?: number;
  importePendiente: number;
  importeAplicado?: number;
  descripcion?: string;
}

export interface ArrastresEjercicio {
  porInmueble: ArrastrePorInmueble[];
  porAnio: ArrastrePorAnio[];
}

export interface InformeCoberturaLinea {
  conceptoFiscal: string;
  importeDeclarado: number;
  importeDocumentado: number;
  importePendiente: number;
  documentos: DocumentoFiscal[];
  estado: 'completo' | 'parcial' | 'sin_documentar';
}

export interface InformeCobertura {
  ejercicio: number;
  totalDocumentos: number;
  totalConceptos: number;
  totalImporteDeclarado: number;
  totalImporteDocumentado: number;
  totalImportePendiente: number;
  porcentajeCobertura: number;
  riesgo: 'bajo' | 'medio' | 'alto';
  lineas: InformeCoberturaLinea[];
}

export interface EjercicioFiscal {
  id?: number;
  ejercicio: number;
  estado: EstadoEjercicio;
  calculoAtlas?: DeclaracionIRPF;
  calculoAtlasFecha?: string;
  declaracionAeat?: DeclaracionIRPF;
  declaracionAeatFecha?: string;
  declaracionAeatPdfRef?: string;
  declaracionAeatOrigen: OrigenDeclaracion;
  arrastresRecibidos: ArrastresEjercicio;
  arrastresGenerados: ArrastresEjercicio;
  documentos: DocumentoFiscal[];
  createdAt: string;
  updatedAt: string;
  cerradoAt?: string;
  declaradoAt?: string;
}

export function createEmptyArrastresEjercicio(): ArrastresEjercicio {
  return {
    porInmueble: [],
    porAnio: [],
  };
}
