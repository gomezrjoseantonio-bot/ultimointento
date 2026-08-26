// ============================================================================
// Lo que la declaración dice de un inmueble
// ============================================================================
//
// Subconjunto de `coord.aeat.declaracionCompleta.inmuebles[]` con lo que hace
// falta para reconstruir un ejercicio ya declarado sin volver a calcularlo: la
// amortización tal y como se presentó, la huella del alquiler por habitaciones
// y los arrendamientos por tramo.
//
// Vivía dentro de `fiscalSummaryService`, que ya pasaba de las 800 líneas.
// Es un bloque cerrado —lee la declaración y devuelve un objeto—, así que sale
// entero en vez de trocearse.
// ============================================================================

import { initDB } from './db';
import { getEjercicio } from './ejercicioResolverService';
import { normalizeRefCatastral } from './rendimientoActivoService';
import type { ArrendamientoDeclaradoTramo } from './desgloseReduccion';

export interface DeclaracionInmuebleSnapshot {
  /** 0123 — valor catastral total declarado */
  valorCatastralTotal?: number;
  /** 0124 — valor catastral construcción */
  valorCatastralConstruccion?: number;
  /** 0125 — % construcción */
  porcentajeConstruccion?: number;
  /** 0126 — importe adquisición */
  precioAdquisicion?: number;
  /** 0127 — gastos inherentes adquisición */
  gastosAdquisicion?: number;
  /** 0130 — base de amortización (cuando se declara amortización estándar) */
  baseAmortizacion?: number;
  /** 0131 (estándar) o 0132 (casos especiales) según `usaCasosEspeciales` */
  amortizacionAnualInmueble?: number;
  /** True cuando el inmueble declara amortización por casos especiales
   *  (modo III · alquiler de habitaciones o situaciones especiales). En ese
   *  caso `inmuebleCasillasService` no debe pintar el bloque 0123/0124/
   *  0125/0126/0130 (que no existe en la declaración) y debe etiquetar la
   *  amortización como 0132 en lugar de 0131. */
  usaCasosEspeciales: boolean;
  /** Múltiples `<Arrendamiento>` con `tipoArrendamiento` distinto · señal
   *  de inmueble mixto (larga + temporada). */
  tieneArrendamientosMixtos: boolean;
  /** Número total de `<Arrendamiento>` declarados (1 por unidad/habitación). */
  numArrendamientos: number;
  /** Los arrendamientos reducidos a lo único que el rótulo necesita: si
   *  llevaban reducción. El régimen se deriva de ahí, no del TAR. */
  arrendamientos: ArrendamientoDeclaradoTramo[];
}

export async function buildDeclaracionInmuebleSnapshot(
  db: Awaited<ReturnType<typeof initDB>>,
  propertyId: number,
  exerciseYear: number,
): Promise<DeclaracionInmuebleSnapshot | undefined> {
  let ej;
  try {
    ej = await getEjercicio(exerciseYear);
  } catch {
    return undefined;
  }
  const decl = ej?.aeat?.declaracionCompleta;
  if (!decl?.inmuebles || decl.inmuebles.length === 0) return undefined;

  const property = await db.get('properties', propertyId);
  const refProperty = normalizeRefCatastral(property?.cadastralReference);
  if (!refProperty) return undefined;
  const inm: any = decl.inmuebles.find(
    (i: any) => normalizeRefCatastral(i.refCatastral) === refProperty,
  );
  if (!inm) return undefined;

  const arrends: any[] = inm.arrendamientos ?? [];
  const tiposArrendamiento = new Set(arrends.map((a) => a.tipoArrendamiento).filter(Boolean));
  // Casos especiales (0132): la AEAT lo marca cuando hay amortización
  // declarada SIN bloque catastral (sin base, sin VC construcción) — es la
  // huella típica del alquiler por habitaciones / situaciones especiales.
  // FA32 caso real: amortizacionAnualInmueble=816,12 con baseAmortizacion=0.
  const amortInmueble = inm.amortizacionAnualInmueble ?? 0;
  const baseAmort = inm.baseAmortizacion ?? 0;
  const usaCasosEspeciales = amortInmueble > 0 && baseAmort === 0;

  return {
    valorCatastralTotal: inm.valorCatastralTotal ?? inm.valorCatastral,
    valorCatastralConstruccion: inm.valorCatastralConstruccion,
    porcentajeConstruccion: inm.porcentajeConstruccion,
    precioAdquisicion: inm.precioAdquisicion,
    gastosAdquisicion: inm.gastosAdquisicion,
    baseAmortizacion: baseAmort > 0 ? baseAmort : undefined,
    amortizacionAnualInmueble: amortInmueble > 0 ? amortInmueble : undefined,
    usaCasosEspeciales,
    tieneArrendamientosMixtos: tiposArrendamiento.size > 1,
    numArrendamientos: arrends.length,
    arrendamientos: arrends.map((a) => ({ conReduccion: a.tieneReduccion === true })),
  };
}
