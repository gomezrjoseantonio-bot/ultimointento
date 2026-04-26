// src/types/planesPensiones.ts
// TAREA 13: Tipos para el módulo dedicado de planes de pensiones

export type TipoAdministrativo = 'PPI' | 'PPE' | 'PPES' | 'PPA';

export type SubtipoPPE = 'empleador_unico' | 'promocion_conjunta';

export type SubtipoPPES = 'sectorial' | 'sector_publico' | 'cooperativas' | 'autonomos';

export type PoliticaInversion =
  | 'renta_fija_corto'
  | 'renta_fija_largo'
  | 'renta_variable'
  | 'renta_mixta'
  | 'garantizado'
  | 'ciclo_vida'
  | 'desconocido';

export type ModalidadAportacion = 'aportacion_definida' | 'prestacion_definida' | 'mixto';

export type EstadoPlan = 'activo' | 'rescatado_total' | 'rescatado_parcial' | 'traspasado_externo';

export type OrigenAportacion =
  | 'manual'
  | 'xml_aeat'
  | 'nomina_vinculada'
  | 'migrado_v60';

export type GranularidadAportacion = 'anual' | 'mensual' | 'puntual';

export type AportanteRol = 'titular' | 'empresa' | 'conyuge';

export interface PlanPensiones {
  id: string; // UUID estable durante toda la trayectoria

  nombre: string;
  titular: 'yo' | 'pareja';
  personalDataId: number;

  tipoAdministrativo: TipoAdministrativo;
  subtipoPPE?: SubtipoPPE;
  subtipoPPES?: SubtipoPPES;
  garantizado?: boolean;

  politicaInversion?: PoliticaInversion;
  porcentajeRentaVariable?: number;

  modalidadAportacion?: ModalidadAportacion;

  gestoraActual: string;
  isinActual?: string;
  fechaUltimaValoracion?: string;
  valorActual?: number;

  fechaContratacion: string;
  importeInicial?: number;

  empresaPagadora?: {
    cif: string;
    nombre: string;
    ingresoIdVinculado?: string;
  };

  participeConDiscapacidad?: boolean;

  estado: EstadoPlan;

  fechaCreacion: string;
  fechaActualizacion: string;

  origen: 'manual' | 'xml_aeat' | 'migrado_v60';
}

export interface AportacionPlan {
  id: string;
  planId: string;

  fecha: string;
  ejercicioFiscal: number;

  importeTitular: number;
  importeEmpresa: number;
  importeConyuge?: number;

  origen: OrigenAportacion;

  ingresoIdNomina?: string;
  movementId?: string;

  granularidad: GranularidadAportacion;
  mesesCubiertos?: number;

  casillaAEAT?: string;

  notas?: string;

  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface TraspasoPlanPensiones {
  id?: number;
  planId: string; // plan que realiza el traspaso (origen)
  planIdDestino?: string; // plan destino si existe en este sistema

  fechaEjecucion: string;

  gestoraOrigen: string;
  gestoraDestino: string;
  isinOrigen?: string;
  isinDestino?: string;

  importeTraspasado: number;
  esTotal: boolean;

  cambioTipoAdministrativo?: boolean;
  nuevoTipoAdministrativo?: TipoAdministrativo;
  nuevaPoliticaInversion?: PoliticaInversion;

  notas?: string;

  fechaCreacion: string;
  fechaActualizacion: string;
}

// ── Límites fiscales ─────────────────────────────────────────────────────────

export interface LimitesFiscalesPlan {
  limiteEconomico: number;
  limite30Rendimientos?: number;
  limiteEfectivo: number;
  descripcion: string;
}

export interface ResultadoValidacionAportacion {
  deducible: number;
  exceso: number;
  limiteAplicable: number;
  totalAportado: number;
}
