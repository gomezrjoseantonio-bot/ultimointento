// ============================================================================
// De la FEIN al préstamo · sin escalas · VOCABULARIO §6 bis · quinquies
// ============================================================================
//
// Lo leído iba antes por `PrestamoFinanciacion`, un tipo viejo que **no tiene
// dónde poner** el valor del índice, ni la base de cálculo, ni la tasación. Los
// tres se leían bien de la FEIN y morían en esa escala, con consecuencias que
// se veían en pantalla:
//
//   · sin el Euríbor, el tramo variable se estimaba al **1,75 %** —el
//     diferencial a secas— y el total a pagar de la hipoteca de Unicaja salía
//     **103.154 €** en vez de los **136.390,31 €** que dice su propia FEIN;
//   · sin la base, un préstamo que liquida sobre 365 días se calculaba sobre el
//     mes comercial.
//
// «Las funcionalidades detrás de las dos bandejas no son las mismas... ¿no
// deberías primero sustituir una cosa por la otra?» *(Jose · 6 ago 2026)*. Esto
// es esa sustitución: el borrador va **directo** al tipo bueno, `Prestamo`, que
// es el mismo que usa la edición.
// ============================================================================

import type {
  Bonificacion,
  Prestamo,
  ReglaBonificacion,
} from '../../types/prestamos';
import type { FeinLoanDraft } from '../../types/fein';

/**
 * Qué hay que demostrar, según cómo llamó la FEIN a esa bonificación.
 *
 * Las cifras van a CERO a propósito: la FEIN dice el umbral en prosa —«por
 * importe igual o superior a 2.500,00 euros netos mensuales»— y de ahí no sale
 * un número fiable. Cero significa «no dicho», y la verificación lo dirá así en
 * vez de dar la bonificación por incumplida (§6 ter).
 */
function reglaDesdeFEIN(id: string, descripcion: string): ReglaBonificacion {
  switch (id) {
    case 'nomina':
      return { tipo: 'NOMINA', minimoMensual: 0 };
    case 'hogar':
      return { tipo: 'SEGURO_HOGAR', activo: true };
    case 'vida':
      return { tipo: 'SEGURO_VIDA', activo: true };
    case 'pensiones':
      return { tipo: 'PLAN_PENSIONES', activo: true };
    case 'tarjeta':
      return { tipo: 'TARJETA', importeMinimo: 0 };
    case 'recibos':
      return { tipo: 'RECIBOS', minimoRecibos: 0 };
    case 'alarma':
      return { tipo: 'ALARMA', activo: true };
    default:
      return { tipo: 'OTRA', descripcion };
  }
}

const TIPO_DE_BONIFICACION: Record<string, Bonificacion['tipo']> = {
  nomina: 'NOMINA',
  hogar: 'SEGURO_HOGAR',
  vida: 'SEGURO_VIDA',
  pensiones: 'PENSIONES',
  tarjeta: 'TARJETA',
  recibos: 'RECIBOS',
  alarma: 'ALARMA',
};

/**
 * Las bonificaciones que la FEIN OFRECE.
 *
 * Ofrece, no las que tengas: la de Unicaja lista catorce bloques —seguro
 * agrario y seguro de comercio incluidos— y cuáles contrataste es decisión
 * tuya. Por eso entran `INACTIVO`: se ven, con sus puntos exactos, y tú marcas
 * las que van. Marcarlas todas sería inventarse un contrato.
 */
function bonificacionesDesdeDraft(draft: FeinLoanDraft): Bonificacion[] {
  return (draft.bonificaciones ?? [])
    .filter((b) => b.etiqueta && typeof b.descuentoPuntos === 'number')
    .map((b, i) => ({
      id: `${b.id || 'otros'}-${i}`,
      tipo: TIPO_DE_BONIFICACION[b.id] ?? 'OTROS',
      nombre: b.etiqueta,
      reduccionPuntosPorcentuales: b.descuentoPuntos as number,
      impacto: { puntos: b.descuentoPuntos as number },
      estado: 'INACTIVO' as const,
      regla: reglaDesdeFEIN(b.id, b.criterio || b.etiqueta),
      // La ventana de §6 ter · la FEIN de Unicaja dice que revisa cada año.
      lookbackMeses: 12,
    }));
}

/**
 * El préstamo tal como lo describe la FEIN · lo que no diga, no viaja.
 *
 * Devuelve un `Partial` porque una FEIN nunca viene entera: está normalizada en
 * contenido y no en forma, y ningún lector lo saca todo. Los campos ausentes
 * los conserva `formDesdePrestamo` de lo que ya hubiera en pantalla, que es la
 * diferencia entre rellenar un hueco y pisar lo que había.
 */
export function prestamoDesdeDraft(draft: FeinLoanDraft): Partial<Prestamo> {
  const p = draft.prestamo;
  const hay = <T>(v: T | null | undefined): v is T => v !== null && v !== undefined;
  const tipo = p.tipo ?? undefined;

  const bonificaciones = bonificacionesDesdeDraft(draft);

  return {
    ...(p.banco ? { nombre: `Préstamo ${p.banco}`, banco: p.banco } : {}),
    ...(hay(p.capitalInicial) ? { principalInicial: p.capitalInicial } : {}),
    ...(hay(p.plazoMeses) ? { plazoMesesTotal: p.plazoMeses } : {}),
    ...(p.fechaFirmaPrevista ? { fechaFirma: p.fechaFirmaPrevista } : {}),
    ...(tipo ? { tipo } : {}),

    // En un mixto el TIN leído es el del TRAMO FIJO · dejarlo en el campo del
    // fijo lo escondía en el sitio de otro tipo de préstamo.
    ...(tipo === 'MIXTO'
      ? {
          ...(hay(p.tinFijo) ? { tipoNominalAnualMixtoFijo: p.tinFijo } : {}),
          ...(hay(p.tramoFijoMeses) ? { tramoFijoMeses: p.tramoFijoMeses } : {}),
        }
      : hay(p.tinFijo)
        ? { tipoNominalAnualFijo: p.tinFijo }
        : {}),

    ...(p.indiceReferencia ? { indice: p.indiceReferencia as Prestamo['indice'] } : {}),
    // Sin esto, el tramo variable se estimaba al diferencial pelado.
    ...(hay(p.valorIndiceActual) ? { valorIndiceActual: p.valorIndiceActual } : {}),
    ...(hay(p.diferencial) ? { diferencial: p.diferencial } : {}),
    // Cuándo mira el banco · UNA periodicidad para el préstamo entero: la
    // revisión es un acto y en él se revisan el índice y las bonificaciones.
    // Aquí se escribía además en `periodoRevisionBonificacionMeses`, o sea el
    // mismo dato en dos campos que después podían editarse por separado.
    ...(hay(p.revisionMeses) ? { periodoRevisionMeses: p.revisionMeses } : {}),

    // Los tres que el tipo viejo no sabía llevar.
    ...(p.baseCalculoIntereses ? { baseCalculoIntereses: p.baseCalculoIntereses } : {}),
    ...(hay(p.tasacion) ? { tasacion: p.tasacion } : {}),
    ...(hay(p.comisionAperturaPct) ? { comisionApertura: p.comisionAperturaPct } : {}),
    ...(hay(p.comisionMantenimientoMes) ? { comisionMantenimiento: p.comisionMantenimientoMes } : {}),

    ...(bonificaciones.length ? { bonificaciones } : {}),
    // CÓMO SE CONTROLAN · sin esto, las catorce de la FEIN de Unicaja suman
    // 3,00 p.p. y se comen entero un TIN del 2,60 %. El motor ya sabe aplicar
    // el tope (`tinConBonificaciones`); lo que faltaba era traérselo del papel.
    ...(hay(p.topeBonificacionPuntos) ? { topeBonificacionesTotal: p.topeBonificacionPuntos } : {}),

    // El seguro que el banco exige · no es cuota del préstamo, pero es precio
    // suyo y por eso entra en la TAE (§6 bis · quinquies).
    ...(hay(p.primaSegurosAnual) && p.primaSegurosAnual > 0
      ? {
          segurosVinculados: [
            {
              concepto: 'Seguro exigido por el banco',
              primaAnual: p.primaSegurosAnual,
              exigidoParaElTipo: true,
              naturaleza: 'GASTO_DEL_INMUEBLE' as const,
            },
          ],
        }
      : {}),
    ...(p.hipotecario ? { tipoPrestamoV2: 'hipotecario' } : {}),
  };
}
