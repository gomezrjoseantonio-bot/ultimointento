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

  /**
   * Override manual del TER (Total Expense Ratio) anual del plan en formato
   * porcentual decimal · 1.5 = 1,50 %. Prevalece sobre el catálogo curado
   * (`TER_CATALOGO_PP`). Vacío · resuelve por catálogo o cae a "sin dato".
   * T-FICHA-PP-PULIDO v1 · Bug #1 · campo opcional · sin DB bump.
   */
  terOverride?: number;

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

  // Fechas: fechaSolicitud (cuando el partícipe firma) precede a fechaEjecucion
  // (cuando la gestora destino recibe el dinero · 7-15 días después).
  fechaSolicitud?: string;
  fechaEjecucion: string;

  gestoraOrigen: string;
  gestoraDestino: string;
  isinOrigen?: string;
  isinDestino?: string;

  // valorTraspaso: valor del plan en el momento del traspaso (canónico, usado
  // por rentabilidadPlanService para cerrar el bloque anterior y abrir el
  // siguiente). Para traspasos totales coincide con importeTraspasado; para
  // parciales son distintos.
  //
  // OPCIONAL · los traspasos legacy (V65 anterior a TAREA 13 v4) sólo
  // tienen `importeTraspasado`. Al leer, normalizar con
  // `valorTraspasoNormalizado()` (servicio rentabilidad) que aplica el
  // fallback `valorTraspaso ?? (esTotal ? importeTraspasado : null)`.
  valorTraspaso?: number;
  // importeTraspasado: importe efectivamente movido (legacy field, alias del
  // anterior si esTotal=true). Se mantiene para no romper datos previos.
  importeTraspasado: number;
  esTotal: boolean;

  // Aportaciones acumuladas hasta este traspaso, snapshot opcional para
  // reconciliación de rentabilidad.
  aportacionesAcumuladasMomento?: number;

  cambioTipoAdministrativo?: boolean;
  // tipoAdministrativoOrigen/Destino: snapshot del tipo en el momento del
  // traspaso. Si cambioTipoAdministrativo=true son distintos.
  tipoAdministrativoOrigen?: TipoAdministrativo;
  tipoAdministrativoDestino?: TipoAdministrativo;
  nuevoTipoAdministrativo?: TipoAdministrativo;
  // politicaInversionOrigen/Destino: snapshot de la política en el momento.
  politicaInversionOrigen?: PoliticaInversion;
  politicaInversionDestino?: PoliticaInversion;
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

/**
 * @deprecated TAREA 13 v4 · Commit 5 · usar `ResultadoValidacionDetallado`.
 * Se mantiene el tipo legacy por si algún consumidor externo del SDK lo
 * importó; ningún consumidor interno lo usa ya.
 */
export interface ResultadoValidacionAportacion {
  deducible: number;
  exceso: number;
  limiteAplicable: number;
  totalAportado: number;
}

/**
 * TAREA 13 v4 · Commit 5 (G+H) · §3.2 spec.
 *
 * Resultado detallado de validación de una aportación: indica si es
 * deducible, qué porción exacta lo es, motivo si hay tope, etc. Aplica el
 * doble criterio del art. 52 LIRPF: el menor entre el límite económico
 * (1.500 € / 8.500 € / 10.000 € / etc.) y el 30 % de los rendimientos netos
 * del trabajo + actividades económicas.
 */
export interface ResultadoValidacionDetallado {
  esDeducible: boolean;
  importeDeducible: number;
  excesoNoDeducible: number;
  motivo?: string;
  limiteAplicable: number;
  totalAportadoEjercicio: number;
  /** Tope absoluto por la regla del 30 % de rendimientos netos. */
  tope30Rendimientos?: number;
  /** Tope económico aplicable según tipo (PPI 1.500 / PPE 8.500 / etc.). */
  topeEconomico: number;
}

/**
 * TAREA 13 v4 · Commit 5 (G+H) · §3.3 spec.
 *
 * Cálculo de la reducción de base imponible por aportaciones a planes de
 * pensiones para un ejercicio. Devuelve desglose por tipo y aviso de exceso.
 */
export interface ResultadoReduccionBaseImponible {
  totalAportadoTitular: number;
  totalAportadoEmpresa: number;
  totalAportadoConyuge: number;
  desgloseDeduciblesPorTipo: {
    PPI: number;
    PPA: number;
    PPE: number;
    PPES_autonomos: number;
    PPES_sectorial: number;
    PPES_publico: number;
    PPES_cooperativas: number;
  };
  totalDeducibleAplicado: number;
  /** Importe que excede del límite y queda pendiente de aplicación en años posteriores (5 años). */
  excesoArrastrable: number;
  /** Avisos para el usuario · ej. "se ha excedido el tope conjunto", "cónyuge supera 8.000 €". */
  alertas: string[];
}
