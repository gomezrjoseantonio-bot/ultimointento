// ============================================================================
// ATLAS · TAREA 18.0 · Motor elegibilidad deducciones autonómicas · tipos
// ============================================================================
//
// Tipos compartidos por el módulo `src/services/fiscal/`:
//   · `CcaaRules`      · paquete por CCAA (mínimos · escala · deducciones)
//   · `MinimoPersonalFamiliarCcaa` · cifras Art. 56-61 LIRPF (estatales) que
//     una CCAA puede reemplazar por las propias.
//   · `TramoEscalaAutonomica` · escala autonómica por tramos.
//   · `DeduccionAutonomica` + `RequisitosDeduccion` · motor genérico de
//     elegibilidad (regla 0.7 · NUNCA aplicar deducción sin evaluar).
//   · `ResultadoElegibilidad` / `ResultadoDeduccion` · output del evaluador.
//
// Política · NO inventar (regla 0.2 spec) · cada cifra autonómica DEBE
// llevar `fuenteOficial` poblado en el archivo de cada CCAA.
// ============================================================================

import type { FiscalContext } from '../fiscalContextService';

// Re-export para que los archivos `ccaaRules/*.ts` puedan importar el tipo
// junto al resto desde un único módulo (`./tipos`).
export type { FiscalContext };

// ─── Mínimos personales y familiares · Art. 56-61 LIRPF ─────────────────────

export interface MinimoPersonalFamiliarCcaa {
  /** Mínimo del contribuyente · 5550 € estatal · una CCAA puede aprobar el suyo (Art. 57.1 LIRPF). */
  minimoContribuyente: number;
  /** Bono adicional ≥65 años · 1150 € estatal (Art. 57.2 LIRPF). */
  bonoMayor65: number;
  /** Bono adicional ≥75 años · 1400 € estatal (acumulativo al anterior). */
  bonoMayor75Adicional: number;

  /** Mínimo por 1er descendiente · 2400 € estatal (Art. 58.1). */
  descendiente1: number;
  /** Mínimo por 2º descendiente · 2700 €. */
  descendiente2: number;
  /** Mínimo por 3er descendiente · 4000 €. */
  descendiente3: number;
  /** Mínimo por 4º+ descendiente · 4500 €. */
  descendiente4Plus: number;
  /** Extra por descendiente menor de 3 años · 2800 € adicional al mínimo del descendiente. */
  descendienteMenor3Extra: number;

  /** Mínimo por ascendiente ≥65 años · 1150 € (Art. 59.1). */
  ascendienteMayor65: number;
  /** Adicional por ascendiente ≥75 años · 1400 €. */
  ascendienteMayor75Adicional: number;

  /** Mínimo por discapacidad ≥33% y <65% · 3000 € (Art. 60.1). */
  discapacidad33a65: number;
  /** Mínimo por discapacidad ≥65% · 9000 € (acumulativo asistencia). */
  discapacidad65Plus: number;
  /** Adicional gastos de asistencia · 3000 €. */
  discapacidadGastosAsistencia: number;
}

// ─── Escala autonómica IRPF ─────────────────────────────────────────────────

export interface TramoEscalaAutonomica {
  /** Tope superior de la base liquidable que entra en este tramo · `Infinity` para el último. */
  baseHasta: number;
  /** Tipo marginal · 0.085 = 8,5%. */
  tipoMarginal: number;
}

// ─── Datos de entrada del titular para evaluar deducciones ──────────────────

/**
 * Datos económicos del ejercicio que las deducciones pueden necesitar para
 * comprobar requisitos · `getDeduccionesAutonomicasEvaluadas` los recibe en
 * cada llamada (no se cachean · cambian por ejercicio).
 */
export interface DatosBaseDeduccion {
  /** Base imponible general + ahorro del titular · individual. */
  baseImponibleIndividual: number;
  /** Base imponible conjunta (si tributa conjunta o referencia). */
  baseImponibleConjunta?: number;
  /** Alquiler anual de vivienda habitual pagado por el titular. */
  alquilerAnual?: number;
  /** True si la fianza está depositada en el organismo autonómico (Madrid · IVIMA / Agencia de Vivienda Social). */
  fianzaDepositada?: boolean;
  /** True si el titular es el suscriptor del contrato (no subarriendo). */
  esTitularContrato?: boolean;
  /** Familia numerosa · `general` · `especial` · `false`. */
  familiaNumerosa?: 'general' | 'especial' | false;
  /** True si el titular es de familia monoparental (Ley 18/2003 + Decreto 151/2009 · Cataluña). */
  familiaMonoparental?: boolean;
  /** Días en situación de paro durante el ejercicio (Cataluña · ≥183 abre vía elegibilidad). */
  diasEnParo?: number;
  /** Tipo de vivienda objeto de la deducción · usado para verificar `requiereTipoVivienda`. */
  tipoVivienda?: 'habitual' | 'temporada-larga' | 'inversion';
  /** Duración del contrato de arrendamiento en años · algunas CCAA exigen ≥1. */
  duracionContratoAnios?: number;
  /** Ayudas públicas recibidas para arrendamiento (Castilla y León · bono alquiler joven · se restan antes del tope). */
  ayudasPublicasArrendamiento?: number;
  /** Importes específicos por inversión vivienda habitual · adquisición · obras · etc. */
  inversionViviendaHabitualAnual?: number;
  /** True si el titular es víctima de violencia de género (Valencia · Andalucía · etc.). */
  esVictimaViolenciaGenero?: boolean;
}

// ─── Requisitos de elegibilidad ─────────────────────────────────────────────

/**
 * Requisitos genéricos que el motor de elegibilidad sabe interpretar. Si una
 * deducción tiene reglas más complejas (ej · Madrid · solo en municipios <2500
 * habitantes) se modela en `calcularImporte` con lógica custom además.
 */
export interface RequisitosDeduccion {
  edadMaxima?: number;
  edadMinima?: number;
  baseImponibleMaxIndividual?: number;
  baseImponibleMaxConjunta?: number;
  /** Tope BI cuando la unidad familiar tiene >=3 hijos (familia numerosa). */
  baseImponibleMaxFamiliar?: number;
  /** % mínimo de alquiler anual sobre base imponible · 0.20 = 20%. */
  porcentajeMinAlquilerSobreBI?: number;

  requiereFianzaDepositada?: boolean;
  requiereFamiliaNumerosa?: 'general' | 'especial' | false;
  requiereDiscapacidad?: { gradoMinimo: number };
  requiereTipoVivienda?: 'habitual' | 'temporada-larga' | 'inversion';
  /** Siempre true para autonómicas · explícito como recordatorio. */
  requiereResidenciaFiscalCcaa?: boolean;
  /** Debe ser titular del contrato (no subarriendo). */
  requiereTitularContrato?: boolean;
  /** Duración mínima del contrato en años (Baleares · Valencia · 1 año). */
  duracionContratoMinAnios?: number;

  /**
   * Conjunto OR de condiciones · si al menos UNA se cumple · la deducción
   * pasa el filtro de elegibilidad por perfil. Usado por Cataluña (≤35 OR
   * paro 183+ días OR familia numerosa OR familia monoparental). El resto
   * de requisitos (BI · titular contrato · etc.) sigue evaluándose en AND.
   */
  condicionesElegibilidadOR?: Array<{
    edadMaxima?: number;
    edadMinima?: number;
    paroMinimoDias?: number;
    requiereFamiliaNumerosa?: 'general' | 'especial';
    requiereFamiliaMonoparental?: boolean;
    requiereDiscapacidad?: { gradoMinimo: number };
  }>;
}

// ─── Deducción autonómica ───────────────────────────────────────────────────

export interface DeduccionAutonomica {
  /** ID estable · `madrid-arrendamiento-vivienda-habitual`. */
  id: string;
  ccaa: string;
  nombre: string;
  descripcion: string;
  /** URL BOE · AEAT manual práctico · texto refundido autonómico. Obligatorio. */
  fuenteOficial: string;
  /** True solo si todas las cifras y requisitos están BOE-verificadas. */
  verified: boolean;

  /** Porcentaje aplicado a la base de cálculo · 0.30 = 30%. */
  porcentaje: number;
  /** Tope absoluto del importe deducible · individual · 1237.20. */
  topeAbsolutoIndividual: number;
  /** Tope absoluto en conjunta si distinto. */
  topeAbsolutoConjunta?: number;
  /**
   * Base máxima a la que se aplica `porcentaje` (Madrid · 4124 € · 30% × 4124
   * = 1237.20). Si `undefined` · `porcentaje × cantidadPagada` con tope
   * absoluto.
   */
  baseMaximaCalculo?: number;

  requisitos: RequisitosDeduccion;

  /**
   * Cálculo del importe bruto antes de aplicar topes · puro · idempotente.
   * OPCIONAL · si `undefined`, el motor calcula automáticamente con
   * `porcentaje × min(alquilerAnual, baseMaximaCalculo)`. Reservar este
   * hook solo para deducciones con lógica custom (escalas progresivas ·
   * combinaciones · etc.).
   */
  calcularImporte?: (ctx: FiscalContext, datosBase: DatosBaseDeduccion) => number;
}

// ─── Resultado de la evaluación ─────────────────────────────────────────────

export interface ResultadoElegibilidad {
  elegible: boolean;
  /** Motivos legibles · ej · ['edad >40', 'BI individual excede 25.620']. */
  motivosNoElegible: string[];
  /** Importe aplicable · 0 si no elegible. */
  importeAplicable: number;
  /** True si se aplicó tope absoluto o base máxima. */
  topeAplicado?: boolean;
  /** Tope concreto que se aplicó · ej · 1237.20. */
  importeTope?: number;
  /** Trasladado de `DeduccionAutonomica.fuenteOficial`. */
  fuenteOficial: string;
}

export interface ResultadoDeduccion extends ResultadoElegibilidad {
  /** Referencia a la deducción evaluada. */
  deduccion: DeduccionAutonomica;
}

// ─── Reglas por CCAA ────────────────────────────────────────────────────────

export interface CcaaRules {
  ccaa: string;
  /** Código ISO 3166-2 · `ES-MD` · `ES-CT`. */
  codigoIso: string;
  /** Fuente oficial de los mínimos personales/familiares. */
  fuenteOficialMinimos: string;
  /** Fuente oficial de la escala autonómica. */
  fuenteOficialEscala: string;

  minimoPersonalFamiliar: MinimoPersonalFamiliarCcaa;
  /** Tramos ordenados ascendentemente por `baseHasta` · último con `Infinity`. */
  escalaAutonomica: TramoEscalaAutonomica[];
  deducciones: DeduccionAutonomica[];

  /** Información sobre deflactación 2025 · si aplica. */
  deflactacion2025?: {
    aplicada: boolean;
    fuente: string;
  };

  /** True cuando todas las cifras de este paquete están BOE-verificadas. */
  verified: boolean;
  /** Notas relevantes · ausencias documentadas (Aragón sin deducción general). */
  notasMigracion?: string[];
}
