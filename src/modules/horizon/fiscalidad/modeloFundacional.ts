import type { EjercicioFiscal, EstadoEjercicio } from '../../../types/fiscal';

export type TruthColumn = 'calculado' | 'declarado' | 'documentado';
export type TruthPriority = 'aeat' | 'atlas' | 'manual';
export type CarryForwardSource = 'casillas_aeat' | 'calculo_atlas' | 'manual';

export interface FiscalExerciseContext {
  ejercicio: number;
  estado: EstadoEjercicio;
  hasDeclaracionAeat: boolean;
  hasCalculoAtlas: boolean;
  hasManualCarryForwards?: boolean;
}

export interface FiscalLifecycleSummary {
  estadoLabel: string;
  subtitle: string;
  visibleColumns: TruthColumn[];
  recalculaMotor: boolean;
  calculadoCongelado: boolean;
  truthPriority: TruthPriority;
  carryForwardSource: CarryForwardSource;
  allowsEdits: boolean;
  allowsDocuments: boolean;
}

function hasArrastresManuales(ejercicio?: EjercicioFiscal): boolean {
  return Boolean(
    (ejercicio?.arrastresRecibidos?.porAnio?.length ?? 0) > 0
      || (ejercicio?.arrastresRecibidos?.porInmueble?.length ?? 0) > 0,
  );
}

export function buildFiscalExerciseContext(
  ejercicio: number,
  currentYear: number,
  fiscalExercise?: EjercicioFiscal,
): FiscalExerciseContext {
  const inferredState: EstadoEjercicio = fiscalExercise?.estado
    ?? (ejercicio >= currentYear ? 'en_curso' : 'cerrado');

  return {
    ejercicio,
    estado: inferredState,
    hasDeclaracionAeat: Boolean(fiscalExercise?.declaracionAeat),
    hasCalculoAtlas: Boolean(fiscalExercise?.calculoAtlas),
    hasManualCarryForwards: hasArrastresManuales(fiscalExercise),
  };
}

export function getVisibleTruthColumns(estado: EstadoEjercicio): TruthColumn[] {
  if (estado === 'declarado') {
    return ['calculado', 'declarado', 'documentado'];
  }

  return ['calculado'];
}

export function shouldRecalculateFiscalExercise(estado: EstadoEjercicio): boolean {
  return estado === 'en_curso' || estado === 'cerrado';
}

export function getTruthPriority(context: FiscalExerciseContext): TruthPriority {
  if (context.hasDeclaracionAeat) {
    return 'aeat';
  }

  if (context.hasCalculoAtlas) {
    return 'atlas';
  }

  return 'manual';
}

export function getCarryForwardSource(context: FiscalExerciseContext): CarryForwardSource {
  if (context.hasDeclaracionAeat) {
    return 'casillas_aeat';
  }

  if (context.hasCalculoAtlas) {
    return 'calculo_atlas';
  }

  return context.hasManualCarryForwards ? 'manual' : 'manual';
}

export function summarizeFiscalLifecycle(context: FiscalExerciseContext): FiscalLifecycleSummary {
  const visibleColumns = getVisibleTruthColumns(context.estado);
  const recalculaMotor = shouldRecalculateFiscalExercise(context.estado);
  const truthPriority = getTruthPriority(context);
  const carryForwardSource = getCarryForwardSource(context);

  if (context.estado === 'declarado') {
    return {
      estadoLabel: 'Declarado',
      subtitle: 'AEAT pasa a ser la verdad principal; ATLAS conserva la última foto calculada y la documentación sigue evolucionando.',
      visibleColumns,
      recalculaMotor,
      calculadoCongelado: true,
      truthPriority,
      carryForwardSource,
      allowsEdits: false,
      allowsDocuments: true,
    };
  }

  if (context.estado === 'cerrado') {
    return {
      estadoLabel: 'Cerrado sin declarar',
      subtitle: 'ATLAS trabaja con la foto cerrada del 31/12 y permite ajustes antes de presentar la declaración.',
      visibleColumns,
      recalculaMotor,
      calculadoCongelado: false,
      truthPriority,
      carryForwardSource,
      allowsEdits: true,
      allowsDocuments: true,
    };
  }

  return {
    estadoLabel: 'En curso',
    subtitle: 'El motor recalcula en vivo con los datos actuales; todavía es una estimación operativa.',
    visibleColumns,
    recalculaMotor,
    calculadoCongelado: false,
    truthPriority,
    carryForwardSource,
    allowsEdits: true,
    allowsDocuments: true,
  };
}

export function shouldOfferDeclarationBootstrap(entityCount: number, hasUploadedDeclaration: boolean): boolean {
  return entityCount === 0 && hasUploadedDeclaration;
}

export function getDeclarationBootstrapCopy(entityCount: number, hasUploadedDeclaration: boolean): string {
  if (shouldOfferDeclarationBootstrap(entityCount, hasUploadedDeclaration)) {
    return 'Primera declaración detectada: ATLAS debe ofrecer crear inmuebles, contratos, préstamos, mejoras y arrastres de golpe.';
  }

  if (entityCount === 0) {
    return 'El usuario puede empezar desde cero y añadir solo los arrastres mínimos que necesite, sin onboarding forzado.';
  }

  return 'Las declaraciones adicionales deben enriquecer entidades existentes y evitar duplicados usando la referencia catastral y el histórico del cliente.';
}
