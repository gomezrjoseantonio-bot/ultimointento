import { Icons } from '../../../../../design-system/v5';
import type { IconComponent } from '../../../../../design-system/v5';
import type { MotivoFinKey } from '../../../utils/historico/tipos';
import type { PillVariant } from '../../../../../design-system/v5';

export interface MotivoBoxCfg {
  icon: IconComponent;
  titulo: string;
  detalleDefault: string;
  tono: 'pos' | 'plain' | 'warn' | 'neg';
}

/** Etiqueta corta para el pill de la tabla. */
export const MOTIVO_LABEL: Record<MotivoFinKey, string> = {
  fin_natural: 'Fin natural',
  cambio_ciudad: 'Cambió de ciudad',
  no_renovacion_precio: 'No renovación · precio',
  incidencia_convivencia: 'Convivencia',
  rescision_impago: 'Impago',
  otros: 'Otros',
  sin_clasificar: 'Sin clasificar',
};

export const MOTIVO_PILL_VARIANT: Record<MotivoFinKey, PillVariant> = {
  fin_natural: 'pos',
  cambio_ciudad: 'gris',
  no_renovacion_precio: 'warn',
  incidencia_convivencia: 'warn',
  rescision_impago: 'neg',
  otros: 'gris',
  sin_clasificar: 'gris',
};

/** Configuración de la caja "Motivo de salida" del drawer ex-contrato. */
export const CONFIG_MOTIVO_BOX: Record<MotivoFinKey, MotivoBoxCfg> = {
  fin_natural: {
    icon: Icons.Success,
    titulo: 'Fin natural de contrato',
    detalleDefault: 'El contrato cumplió su duración prevista sin incidencias.',
    tono: 'pos',
  },
  cambio_ciudad: {
    icon: Icons.Compra,
    titulo: 'Cambió de ciudad',
    detalleDefault: 'El inquilino se mudó a otra ciudad.',
    tono: 'plain',
  },
  no_renovacion_precio: {
    icon: Icons.Cartera,
    titulo: 'No renovación por precio',
    detalleDefault: 'No hubo acuerdo en la renovación por desacuerdo en el precio.',
    tono: 'warn',
  },
  incidencia_convivencia: {
    icon: Icons.Alert,
    titulo: 'Incidencia de convivencia',
    detalleDefault: 'Conflictos de convivencia que motivaron la salida.',
    tono: 'warn',
  },
  rescision_impago: {
    icon: Icons.Warning,
    titulo: 'Rescisión por impago',
    detalleDefault: 'Contrato rescindido tras procedimiento por impago.',
    tono: 'neg',
  },
  otros: {
    icon: Icons.Info,
    titulo: 'Otros motivos',
    detalleDefault: 'Salida por motivo no clasificado.',
    tono: 'plain',
  },
  sin_clasificar: {
    icon: Icons.Info,
    titulo: 'Sin clasificar',
    detalleDefault: 'No se registró un motivo de salida para este contrato.',
    tono: 'plain',
  },
};
