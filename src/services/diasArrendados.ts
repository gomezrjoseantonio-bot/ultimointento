// ============================================================================
// Cuántos días de un año estuvo arrendado un inmueble
// ============================================================================
//
// La UNIÓN de los intervalos de sus contratos, recortada al año natural.
//
// Se cuenta así y no de otra manera por dos casos que se dan a la vez en la
// misma cartera:
//
//   · Contratos CONSECUTIVOS — un piso de febrero a junio y otra vez de
//     septiembre a diciembre estuvo arrendado 272 días, no 150. Sumar.
//   · Contratos SIMULTÁNEOS — dos habitaciones alquiladas los mismos meses son
//     un piso arrendado esos meses, no el doble. No duplicar.
//
// El máximo de los solapes —que es lo que hacía `getRentalDaysForYear`— acierta
// en el segundo caso por accidente y falla en el primero: con él, la
// amortización salía corta y la imputación de renta, que se calcula por resta
// sobre los días del año, salía larga.
//
// Vive en un módulo hoja porque la usan dos servicios que no deberían
// depender el uno del otro: `aeatAmortizationService` (amortización del
// ejercicio) y `gananciaPatrimonialService` (amortización acumulada al vender).
// La implementación estaba escrita en el segundo y el primero no la veía; la
// misma cuenta hecha dos veces es exactamente cómo se separaron.
// ============================================================================

/** Lo mínimo que hace falta de un contrato para medir su ocupación. */
export interface ContratoConFechas {
  fechaInicio?: string | null;
  fechaFin?: string | null;
  /** @deprecated Espejo legacy · lo escriben los importadores. */
  startDate?: string | null;
  /** @deprecated Espejo legacy · lo escriben los importadores. */
  endDate?: string | null;
}

const DIA_MS = 86_400_000;

const ts = (iso: string | null | undefined): number => {
  if (!iso) return NaN;
  return new Date(iso).getTime();
};

/**
 * Los días del año `anio` en que el inmueble estuvo arrendado.
 *
 * `hasta` recorta el año por la derecha — es la fecha de venta, y solo la pasa
 * quien está liquidando una. Sin ella se cuenta el año entero; una fecha
 * ilegible se ignora, porque perder los días de un año por un dato mal escrito
 * sería peor que no recortarlos.
 *
 * Los contratos llegan YA FILTRADOS por inmueble: quién es de quién lo decide
 * `esContratoDelInmueble`, que sabe de los dos campos que lo dicen.
 */
export function diasArrendadosEnAno(
  contratos: readonly ContratoConFechas[],
  anio: number,
  hasta?: string,
): number {
  const inicioAnio = Date.UTC(anio, 0, 1);
  const finAnio = Date.UTC(anio, 11, 31);

  const corte = hasta != null ? ts(hasta) : NaN;
  const finEfectivo = Number.isFinite(corte) ? Math.min(corte, finAnio) : finAnio;
  if (finEfectivo < inicioAnio) return 0;

  // Cada contrato, recortado al tramo que cuenta.
  const tramos: Array<{ desde: number; hasta: number }> = [];
  for (const c of contratos) {
    const inicio = ts(c.fechaInicio ?? c.startDate);
    if (!Number.isFinite(inicio)) continue;
    // Sin fecha de fin sigue vivo: se recorta contra el final del año igual que
    // el centinela `FECHA_FIN_INDEFINIDO`, que tampoco es una fecha real.
    const finIso = c.fechaFin ?? c.endDate;
    const fin = finIso != null ? ts(finIso) : finEfectivo;
    if (!Number.isFinite(fin)) continue;

    const desde = Math.max(inicio, inicioAnio);
    const recortado = Math.min(fin, finEfectivo);
    if (desde <= recortado) tramos.push({ desde, hasta: recortado });
  }
  if (tramos.length === 0) return 0;

  // Fundir lo que se toca y sumar. Dos tramos separados por menos de un día
  // —el 30 de junio y el 1 de julio— no dejan hueco: el piso no estuvo vacío.
  tramos.sort((a, b) => a.desde - b.desde);
  let dias = 0;
  let actual = { ...tramos[0] };
  for (let i = 1; i < tramos.length; i++) {
    const t = tramos[i];
    if (t.desde <= actual.hasta + DIA_MS) {
      actual.hasta = Math.max(actual.hasta, t.hasta);
    } else {
      dias += Math.floor((actual.hasta - actual.desde) / DIA_MS) + 1;
      actual = { ...t };
    }
  }
  dias += Math.floor((actual.hasta - actual.desde) / DIA_MS) + 1;
  return dias;
}
