/**
 * informeDistribucion.ts
 *
 * Informe de lo que el distribuidor hizo (o propone hacer)
 * al procesar una DeclaracionCompleta. El wizard lo usa
 * para mostrar el paso 2 "esto es lo que ATLAS ha entendido".
 */

export interface InformeDistribucion {
  ejercicio: number;
  fuente: 'xml' | 'pdf' | 'manual';
  confianza: 'total' | 'alta' | 'media';

  perfil: {
    nif: string;
    nombre: string;
    ccaa?: string;
    empleador?: string;
    actualizado: boolean;
  };

  resumenFiscal: {
    resultado: number;
    cuotaIntegra: number;
    retenciones: number;
    baseLiquidableGeneral: number;
    baseLiquidableAhorro: number;
    tipoDeclaracion: string;
  };

  inmuebles: InmuebleDistribuido[];
  contratosDetectados: ContratoDetectado[];
  gastosRecurrentesPropuestos: GastoRecurrentePropuesto[];
  prestamosDetectados: PrestamoDetectado[];
  proveedores: ProveedorDistribuido[];
  inversiones: InversionDetectada[];

  arrastres: {
    perdidasPendientesTotal: number;
    gastosPendientesTotal: number;
    detallePerdidasPorAno: { ano: number; importe: number }[];
    detalleGastosPorInmueble: { ref: string; direccionCorta: string; importe: number }[];
  };

  cuentaBancaria?: string;

  trabajo?: {
    ingresoBruto: number;
    retenciones: number;
    tipoRetencion: number;
    empleador?: string;
  };

  actividad?: {
    iae: string;
    modalidad: string;
    rendimientoNeto: number;
  };

  stats: {
    inmueblesCreados: number;
    inmueblesActualizados: number;
    inmueblesSinCambios: number;
    arrastresGuardados: number;
    contratosDetectados: number;
    proveedoresNuevos: number;
  };
}

export interface InmuebleDistribuido {
  refCatastral: string;
  direccionCorta: string;
  accion: 'creado' | 'actualizado' | 'sin_cambios';
  camposNuevos?: string[];
  rendimientoNeto: number;
  ingresosBrutos: number;
  tipoUso: string;
  diasArrendado?: number;
  diasVacio?: number;
  tieneReduccion: boolean;
}

export interface ContratoDetectado {
  refCatastral: string;
  direccionCorta: string;
  nifInquilinos: string[];
  fechaContrato?: string;
  tipoArrendamiento?: string;
  ingresosAnuales: number;
}

export interface GastoRecurrentePropuesto {
  refCatastral: string;
  direccionCorta: string;
  concepto: string;
  importeAnual: number;
  importeMensualEstimado: number;
}

export interface PrestamoDetectado {
  refCatastral: string;
  direccionCorta: string;
  interesesAnuales: number;
}

export interface ProveedorDistribuido {
  nif: string;
  concepto: string;
  importe: number;
  inmuebleRef?: string;
}

export interface InversionDetectada {
  tipo: 'fondo' | 'crypto' | 'otro';
  descripcion: string;
  resultado: number;
}
