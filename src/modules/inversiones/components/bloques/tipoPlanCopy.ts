// tipoPlanCopy · helper tipo-aware para PPI · PPE · PPES · PPA.
// T-INVERSIONES-DETALLE-PP-v1 · §5.4.
//
// El switch vive AQUÍ (no acoplado a componentes) · cualquier bloque que
// necesite copy diferenciado lo importa. PR 4 lo usa en BloqueCostes y
// BloqueProyeccion · spec §5.6.1 lo usa en BloqueSandbox para topes.

import type { TipoAdministrativo } from '../../../../types/planesPensiones';

export interface CopyPorTipo {
  /** P1 mensaje · accionable o informativo. */
  p1Modo: 'accionable' | 'informativo';
  /** P3 título · cambia según quién paga. */
  costesTitulo: string;
  /** P3 banner · template con sustitución {nombreEmpresa}. */
  costesBannerTemplate: string;
  /** P3 banner · tono visual. */
  costesBannerTono: 'accionable' | 'educativo' | 'info-garantizado';
  /** P3 · ¿muestra botón "Buscar plan con TER menor"? */
  mostrarBotonBuscarTerMenor: boolean;
  /** P5 · tope de aportación anual en € para el slider del sandbox. */
  topeAportacionAnualBase: number;
}

export interface ContextoTipoPlan {
  tipoAdministrativo: TipoAdministrativo;
  /** Sólo PPA · plan garantizado · cambia el copy de comisiones. */
  garantizado?: boolean;
  /** Sólo PPES · si es autónomo el tope sube a 5.750 €. */
  esAutonomo?: boolean;
  /** Sólo si participante con discapacidad · tope sube a 24.250 €. */
  discapacidad?: boolean;
  /** Empresa promotora · sustituye {nombreEmpresa} en el copy PPE. */
  nombreEmpresa?: string | null;
}

/**
 * Resuelve el copy + topes según el tipo administrativo (§5.4 + §5.6.1).
 */
export function getCopyPorTipo(ctx: ContextoTipoPlan): CopyPorTipo {
  const { tipoAdministrativo, garantizado, esAutonomo, discapacidad, nombreEmpresa } = ctx;

  switch (tipoAdministrativo) {
    case 'PPI':
      return {
        p1Modo: 'accionable',
        costesTitulo: 'Lo que te cobra la gestora',
        costesBannerTemplate:
          'Cambiando a un plan con TER 0,5 % ahorrarías {ahorro} € en comisiones futuras · traspaso fiscal-neutro.',
        costesBannerTono: 'accionable',
        mostrarBotonBuscarTerMenor: true,
        topeAportacionAnualBase: discapacidad ? 24_250 : 1_500,
      };

    case 'PPA':
      return {
        p1Modo: 'accionable',
        costesTitulo: 'Lo que te cobra la gestora',
        costesBannerTemplate: garantizado
          ? 'Las comisiones ya están descontadas del rendimiento garantizado · informativo.'
          : 'Cambiando a un plan con TER 0,5 % ahorrarías {ahorro} € en comisiones futuras.',
        costesBannerTono: garantizado ? 'info-garantizado' : 'accionable',
        mostrarBotonBuscarTerMenor: !garantizado,
        topeAportacionAnualBase: discapacidad ? 24_250 : 1_500,
      };

    case 'PPES':
      return {
        p1Modo: 'accionable',
        costesTitulo: 'Lo que te cobra la gestora',
        costesBannerTemplate:
          'Cambiando a un plan con TER 0,5 % ahorrarías {ahorro} € en comisiones futuras.',
        costesBannerTono: 'accionable',
        mostrarBotonBuscarTerMenor: true,
        topeAportacionAnualBase: discapacidad ? 24_250 : esAutonomo ? 5_750 : 1_500,
      };

    case 'PPE':
      return {
        p1Modo: 'informativo',
        costesTitulo: 'Lo que cuesta tener este plan',
        costesBannerTemplate: nombreEmpresa
          ? `Esto lo paga la empresa promotora · informativo. Cuando dejes ${nombreEmpresa} podrás traspasar a un PPI con TER más bajo.`
          : 'Esto lo paga la empresa promotora · informativo. Cuando dejes la empresa podrás traspasar a un PPI con TER más bajo.',
        costesBannerTono: 'educativo',
        mostrarBotonBuscarTerMenor: false,
        // PPE · 1.500 € titular + 8.500 € empresa = 10.000 € (art. 51.7).
        topeAportacionAnualBase: discapacidad ? 24_250 : 10_000,
      };
  }
}

/**
 * Mapa de etiqueta legible · útil para badges y headings.
 */
export const TIPO_LABEL_CORTO: Record<TipoAdministrativo, string> = {
  PPI: 'PPI · individual',
  PPE: 'PPE · empleo',
  PPES: 'PPES · simplificado',
  PPA: 'PPA · asegurado',
};
