// ============================================================================
// Lo máximo que la ley deja cobrar por adelantar dinero · §6 bis · quater
// ============================================================================
//
// Esto NO calcula lo que pagas: lo que pagas lo dice tu escritura. Esto propone
// una cifra **al dar de alta el préstamo**, para que el campo no nazca en cero.
//
// Porque cero tampoco es neutral:
//
//   > Sí que debería prerrellenar con el % máximo cuando se crea, de tal forma
//   > que si es distinto se cambie y si no, al menos guarde un dato.
//   >
//   > — Jose, 5 de agosto de 2026
//
// Tiene razón: dejarlo en cero afirma «no hay comisión», que es una afirmación
// fuerte y además optimista. Un tope legal propuesto es mejor dato — siempre
// que quede claro que lo puso ATLAS y no el papel del banco, y de eso se
// encarga el `origen` de la comisión.
//
// ── Lo que la ley dice, y lo que NO se puede deducir ────────────────────────
//
// El tope no siempre es un número:
//
//   · **Hipoteca desde el 16-jun-2019 (Ley 5/2019), variable** · se pacta UNA
//     de dos: 0,25 % los 3 primeros años, o 0,15 % los 5 primeros. Después,
//     cero. Cuál de las dos se pactó **no se puede deducir**, así que se
//     ofrecen las dos y elige quien tiene la escritura delante.
//   · **La misma, a tipo fijo** · 2 % los 10 primeros años y 1,5 % después.
//     Dos tramos, no un número.
//   · **Hipoteca entre el 09-dic-2007 y el 15-jun-2019 (Ley 41/2007)** ·
//     compensación por desistimiento, 0,5 % los 5 primeros años y 0,25 %
//     después.
//   · **Mixta** · depende del tipo que esté vigente el día que amortizas, así
//     que no se propone nada.
//   · **Personal o al consumo (Ley 16/2011)** · 1 % si queda más de un año y
//     0,5 % si queda menos — depende del plazo QUE QUEDA, no del tiempo desde
//     la firma, así que tampoco encaja aquí y no se propone.
//
// Y por encima de todo: la compensación **nunca puede superar la pérdida
// financiera** del banco. Eso no se calcula sin la curva de tipos, así que se
// dice y no se computa.
// ============================================================================

import type { TramoDeComision } from './comisiones';
import { esISO } from './fechas';

/** El día en que entró en vigor la Ley 5/2019. */
const LCCI_DESDE = '2019-06-16';
/** El día en que entró en vigor la Ley 41/2007. */
const LEY_41_DESDE = '2007-12-09';

export interface OpcionDeTope {
  /** Para distinguirlas en la pantalla. */
  id: string;
  /** Cómo se lee · «0,25 % los 3 primeros años». */
  etiqueta: string;
  /** De dónde sale · para poder citarlo. */
  fundamento: string;
  tramos: TramoDeComision[];
}

export interface PrestamoParaTopes {
  /** Hipotecario, personal… · lo que decide qué ley aplica. */
  tipoPrestamo?: string;
  tipoInteres?: 'fijo' | 'variable' | 'mixto';
  fechaFirma?: string;
}

const esHipotecario = (p: PrestamoParaTopes): boolean =>
  p.tipoPrestamo === 'hipotecario';

/**
 * Los topes que la ley permite para ese préstamo, si se pueden saber.
 *
 * Devuelve **varias** opciones cuando la ley deja elegir —el variable de la
 * Ley 5/2019— y **ninguna** cuando no se puede deducir. Una lista vacía no es
 * un fallo: es que ATLAS no sabe, y entonces no propone.
 */
export function topesDeReembolso(prestamo: PrestamoParaTopes): OpcionDeTope[] {
  if (!esHipotecario(prestamo) || !esISO(prestamo.fechaFirma)) return [];

  const firma = prestamo.fechaFirma.slice(0, 10);

  // Antes de la Ley 41/2007 el régimen era contractual y variadísimo · no hay
  // un tope que proponer sin inventárselo.
  if (firma < LEY_41_DESDE) return [];

  if (firma < LCCI_DESDE) {
    return [
      {
        id: 'desistimiento',
        etiqueta: '0,50 % los 5 primeros años, 0,25 % después',
        fundamento: 'Compensación por desistimiento · Ley 41/2007',
        tramos: [{ hastaMes: 60, porcentaje: 0.5 }, { porcentaje: 0.25 }],
      },
    ];
  }

  // Una mixta cambia de régimen cuando cambia de tipo, así que el tope depende
  // de qué tipo esté vigente el día que amortices. No se propone nada.
  if (prestamo.tipoInteres === 'mixto') return [];

  if (prestamo.tipoInteres === 'fijo') {
    return [
      {
        id: 'fijo',
        etiqueta: '2 % los 10 primeros años, 1,50 % después',
        fundamento: 'Ley 5/2019, art. 23',
        tramos: [{ hastaMes: 120, porcentaje: 2 }, { porcentaje: 1.5 }],
      },
    ];
  }

  if (prestamo.tipoInteres === 'variable') {
    // La ley dice que se pacta UNA de las dos · no se puede deducir cuál, así
    // que se ofrecen ambas y decide quien tiene la escritura.
    return [
      {
        id: 'variable-3',
        etiqueta: '0,25 % los 3 primeros años, después nada',
        fundamento: 'Ley 5/2019, art. 23 · opción A',
        tramos: [{ hastaMes: 36, porcentaje: 0.25 }, { porcentaje: 0 }],
      },
      {
        id: 'variable-5',
        etiqueta: '0,15 % los 5 primeros años, después nada',
        fundamento: 'Ley 5/2019, art. 23 · opción B',
        tramos: [{ hastaMes: 60, porcentaje: 0.15 }, { porcentaje: 0 }],
      },
    ];
  }

  return [];
}
