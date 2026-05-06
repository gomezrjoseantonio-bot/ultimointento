// ============================================================================
// ATLAS · TAREA 18.0 · Servicio evaluador de deducciones autonómicas
// ============================================================================
//
// Motor genérico de elegibilidad · regla 0.7 SAGRADA · ATLAS NUNCA aplica
// una deducción autonómica sin pasar por `evaluarElegibilidad()`.
//
// Pipeline ·
//   1) `getReglasCcaa(ctx.comunidadAutonoma)` · paquete CCAA o fallback
//   2) Para cada `DeduccionAutonomica` · ejecutar `evaluarElegibilidad`
//   3) Si elegible · `calcularImporte` + tope absoluto + base máxima
//   4) Devolver `ResultadoDeduccion[]` (tanto elegibles como no · con motivos)
//
// Funciones puras · idempotentes (regla 0.4) · sin side effects.
// ============================================================================

import type { FiscalContext } from '../fiscalContextService';
import type {
  DatosBaseDeduccion,
  DeduccionAutonomica,
  ResultadoDeduccion,
  ResultadoElegibilidad,
} from './tipos';
import { getReglasCcaa as lookupReglasCcaa } from './ccaaRules/index';

// ─── Re-exports públicos ────────────────────────────────────────────────────

export { lookupReglasCcaa as getReglasCcaa };

// ─── Evaluador unitario ─────────────────────────────────────────────────────

/**
 * Evalúa elegibilidad de una deducción para un contexto + datos base.
 *
 * Función pura · idempotente · NO lee de IndexedDB · NO hace I/O.
 *
 * @returns `ResultadoElegibilidad` · `elegible=true` solo si TODOS los
 *   requisitos se cumplen · `motivosNoElegible` enumera cada falla con
 *   texto legible para UI/log.
 */
export function evaluarElegibilidad(
  deduccion: DeduccionAutonomica,
  ctx: FiscalContext,
  datosBase: DatosBaseDeduccion,
): ResultadoElegibilidad {
  const motivos: string[] = [];
  const req = deduccion.requisitos;

  // ─── Edad del titular ─────────────────────────────────────────────────────
  if (req.edadMaxima !== undefined) {
    if (ctx.edadActual === null) {
      motivos.push(`edad no informada (requiere <${req.edadMaxima})`);
    } else if (ctx.edadActual >= req.edadMaxima) {
      motivos.push(`edad >${req.edadMaxima - 1}`);
    }
  }
  if (req.edadMinima !== undefined) {
    if (ctx.edadActual === null) {
      motivos.push(`edad no informada (requiere ≥${req.edadMinima})`);
    } else if (ctx.edadActual < req.edadMinima) {
      motivos.push(`edad <${req.edadMinima}`);
    }
  }

  // ─── Bases imponibles · individual / conjunta / familiar ──────────────────
  // El tope familiar (≥3 hijos) sólo aplica si el titular cumple ese perfil.
  // Si NO es familia numerosa, los topes a evaluar son individual/conjunta.
  const tieneTresMasHijos = (ctx.descendientes?.length ?? 0) >= 3;
  const esConjunta = ctx.tributacion === 'conjunta';

  if (tieneTresMasHijos && req.baseImponibleMaxFamiliar !== undefined) {
    const bi = esConjunta && datosBase.baseImponibleConjunta !== undefined
      ? datosBase.baseImponibleConjunta
      : datosBase.baseImponibleIndividual;
    if (bi > req.baseImponibleMaxFamiliar) {
      motivos.push(
        `BI familiar excede ${req.baseImponibleMaxFamiliar.toLocaleString('es-ES')}`,
      );
    }
  } else if (esConjunta && req.baseImponibleMaxConjunta !== undefined) {
    const bi = datosBase.baseImponibleConjunta ?? datosBase.baseImponibleIndividual;
    if (bi > req.baseImponibleMaxConjunta) {
      motivos.push(
        `BI conjunta excede ${req.baseImponibleMaxConjunta.toLocaleString('es-ES')}`,
      );
    }
  } else if (req.baseImponibleMaxIndividual !== undefined) {
    if (datosBase.baseImponibleIndividual > req.baseImponibleMaxIndividual) {
      motivos.push(
        `BI individual excede ${req.baseImponibleMaxIndividual.toLocaleString('es-ES')}`,
      );
    }
  }

  // ─── % alquiler sobre BI ──────────────────────────────────────────────────
  if (req.porcentajeMinAlquilerSobreBI !== undefined) {
    const alquiler = datosBase.alquilerAnual ?? 0;
    const biRef = datosBase.baseImponibleIndividual;
    if (biRef <= 0) {
      motivos.push('BI no informada · imposible verificar % alquiler');
    } else {
      const ratio = alquiler / biRef;
      if (ratio < req.porcentajeMinAlquilerSobreBI) {
        const pct = Math.round(req.porcentajeMinAlquilerSobreBI * 100);
        motivos.push(`alquiler <${pct}% BI`);
      }
    }
  }

  // ─── Fianza depositada ────────────────────────────────────────────────────
  if (req.requiereFianzaDepositada && datosBase.fianzaDepositada !== true) {
    motivos.push('fianza no depositada en organismo autonómico');
  }

  // ─── Familia numerosa ────────────────────────────────────────────────────
  if (req.requiereFamiliaNumerosa) {
    const fn = datosBase.familiaNumerosa;
    if (!fn) {
      motivos.push('no es familia numerosa');
    } else if (req.requiereFamiliaNumerosa === 'especial' && fn !== 'especial') {
      motivos.push('no es familia numerosa especial');
    }
  }

  // ─── Discapacidad ─────────────────────────────────────────────────────────
  if (req.requiereDiscapacidad) {
    const grado = ctx.discapacidadTitular;
    const minimo = req.requiereDiscapacidad.gradoMinimo;
    const cumpleGrado =
      (minimo <= 33 && (grado === 'hasta33' || grado === 'entre33y65' || grado === 'mas65')) ||
      (minimo <= 65 && (grado === 'entre33y65' || grado === 'mas65')) ||
      (minimo <= 100 && grado === 'mas65');
    if (!cumpleGrado) {
      motivos.push(`discapacidad <${minimo}%`);
    }
  }

  // ─── Tipo vivienda · titular contrato · residencia fiscal ────────────────
  if (req.requiereTitularContrato && datosBase.esTitularContrato === false) {
    motivos.push('no es titular del contrato');
  }
  // `requiereTipoVivienda` y `requiereResidenciaFiscalCcaa` se asumen TRUE
  // por contexto de uso (ATLAS solo evalúa si el titular reside en la CCAA
  // y la deducción es de su vivienda habitual). Si en el futuro se necesita
  // distinguir explícitamente, ampliar `DatosBaseDeduccion`.

  // ─── Si elegible · calcular importe ──────────────────────────────────────
  if (motivos.length === 0) {
    const bruto = deduccion.calcularImporte(ctx, datosBase);
    const tope = esConjunta && deduccion.topeAbsolutoConjunta !== undefined
      ? deduccion.topeAbsolutoConjunta
      : deduccion.topeAbsolutoIndividual;
    const final = Math.min(bruto, tope);
    const round2 = (n: number) => Math.round(n * 100) / 100;
    return {
      elegible: true,
      motivosNoElegible: [],
      importeAplicable: round2(final),
      topeAplicado: bruto >= tope || (deduccion.baseMaximaCalculo !== undefined &&
        (datosBase.alquilerAnual ?? 0) > deduccion.baseMaximaCalculo),
      importeTope: tope,
      fuenteOficial: deduccion.fuenteOficial,
    };
  }

  return {
    elegible: false,
    motivosNoElegible: motivos,
    importeAplicable: 0,
    fuenteOficial: deduccion.fuenteOficial,
  };
}

// ─── API pública del servicio ───────────────────────────────────────────────

/**
 * Devuelve TODAS las deducciones autonómicas evaluadas para el contexto.
 * Cada resultado incluye `elegible` + motivos + importe aplicable.
 *
 * Útil para UI · mostrar "estas deducciones existen para tu CCAA y por qué
 * no las aplicamos a tu caso".
 */
export async function getDeduccionesAutonomicasEvaluadas(
  ctx: FiscalContext,
  datosBase: DatosBaseDeduccion,
): Promise<ResultadoDeduccion[]> {
  const reglas = lookupReglasCcaa(ctx.comunidadAutonoma);
  return reglas.deducciones.map((deduccion) => ({
    deduccion,
    ...evaluarElegibilidad(deduccion, ctx, datosBase),
  }));
}

/**
 * Devuelve solo las deducciones elegibles · listo para sumar a la cuota
 * líquida · usado por `irpfCalculationService` cuando entra en T18.x.
 */
export async function getDeduccionesAutonomicasAplicables(
  ctx: FiscalContext,
  datosBase: DatosBaseDeduccion,
): Promise<ResultadoDeduccion[]> {
  const todas = await getDeduccionesAutonomicasEvaluadas(ctx, datosBase);
  return todas.filter((r) => r.elegible);
}
