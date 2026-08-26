// ============================================================================
// Lo que se cobra de un contrato en un mes concreto
// ============================================================================
//
// El primer mes y el último no son meses enteros: un contrato que empieza el 16
// cobra del 16 a fin de mes, y uno que termina el 10 cobra hasta el 10. En el
// medio, el mes completo.
//
// Esta aritmética ya estaba escrita en `contractService.calculateRentPeriodsNew`,
// pero la ejecutaba únicamente `treasuryForecastService.regenerateRentalsForecast`,
// un generador de rentas MUERTO (su entrada, `regenerateMonthForecast`, no tenía
// un solo llamante en todo el repo). El generador vivo —`generateMonthlyForecasts`—
// emitía el mes entero por los dos extremos, así que la previsión del mes de
// entrada pedía más dinero del que el inquilino debe. Ambas se retiraron en el
// mismo cambio que trajo este fichero: hoy hay un solo camino de renta.
//
// De aquella versión se trae la aritmética, NO su forma:
//
//   · Su bucle avanzaba con
//     `current.setMonth(current.getMonth() + 1)` sobre una fecha que conservaba
//     el día de inicio, así que un contrato que empezara el 31 de enero SALTABA
//     febrero (31 ene + 1 mes = 3 mar). Aquí no hace falta ningún bucle: el
//     generador ya va mes a mes y esto responde por un mes.
//
//   · Sus dos `if` (primer mes / último mes) se PISABAN cuando el contrato
//     empezaba y terminaba dentro del mismo mes: el segundo sobrescribía al
//     primero y cobraba del día 1 al de fin, ignorando el día de entrada. Un
//     contrato del 10 al 20 salía como 20 días en vez de 11. Aquí es un solo
//     tramo —de cuándo empieza a cuándo acaba, dentro del mes—, así que el caso
//     no puede existir.
//
// Las fechas se leen del TEXTO ISO, sin construir `Date` para compararlas:
// `new Date('2028-06-16')` es medianoche UTC y `new Date(2028, 5, 1)` es
// medianoche local, y comparar las dos se tuerce según la zona horaria de quien
// ejecute. Del contrato solo hacen falta año, mes y día.
// ============================================================================

/** Lo mínimo que hace falta de un contrato para saber qué cobra este mes. */
export interface PeriodoDeContrato {
  /** ISO `YYYY-MM-DD` (admite fecha-hora completa). */
  fechaInicio: string;
  /** ISO `YYYY-MM-DD` (admite fecha-hora completa). */
  fechaFin: string;
}

interface PartesDeFecha {
  year: number;
  month: number;
  day: number;
}

const partesISO = (iso: string | undefined | null): PartesDeFecha | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
};

/** Cuántos días tiene ese mes (`month` en base 1). */
const diasDelMes = (year: number, month: number): number => new Date(year, month, 0).getDate();

/**
 * Días de ese mes que cubre el contrato, y días que tiene el mes.
 *
 * `dias === diasDelMes` es el mes completo. `dias === 0` es que el contrato no
 * toca ese mes (el llamante ya suele haberlo filtrado antes).
 */
export function diasDeRentaEnElMes(
  contrato: PeriodoDeContrato,
  year: number,
  month: number,
): { dias: number; diasDelMes: number } {
  const total = diasDelMes(year, month);
  const inicio = partesISO(contrato.fechaInicio);
  const fin = partesISO(contrato.fechaFin);

  // Sin fecha legible no se inventa un tramo parcial: se cobra el mes entero,
  // que es lo que hacía el generador antes de existir el prorrateo.
  if (!inicio && !fin) return { dias: total, diasDelMes: total };

  const empiezaEsteMes = inicio != null && inicio.year === year && inicio.month === month;
  const terminaEsteMes = fin != null && fin.year === year && fin.month === month;

  const desde = empiezaEsteMes ? Math.min(Math.max(inicio!.day, 1), total) : 1;
  const hasta = terminaEsteMes ? Math.min(Math.max(fin!.day, 1), total) : total;

  return { dias: Math.max(0, hasta - desde + 1), diasDelMes: total };
}

/**
 * El importe que toca cobrar este mes · el mensual prorrateado por días.
 *
 * `importeMensual` es la renta mensual EFECTIVA del contrato: puede ser
 * `contract.rentaMensual` o el importe que fuerce el plan de gestión delegada
 * (padre neto en flujo A). Prorratear va después de decidir cuál es, porque un
 * contrato que empieza a mitad de mes cobra media renta venga el mensual de
 * donde venga.
 *
 * ── GANCHO · importe de primer mes personalizado ──────────────────────────
 * El arrendador puede fijar a mano lo que se cobra el primer mes, y los
 * contratos reales lo traen distinto del aritmético. Ese campo NO existe hoy en
 * `Contract` (revisado `db/types-contratos.ts:158-345`) y NO se inventa aquí:
 * nace en el cableado del alta. Cuando exista, este es el único sitio que hay
 * que tocar — esta función es el punto único donde se decide el importe del mes
 * y `generateMonthlyForecasts` no calcula nada por su cuenta. El importe
 * explícito GANA sobre el prorrateo.
 */
export function importeDeLaRentaDelMes(
  contrato: PeriodoDeContrato,
  year: number,
  month: number,
  importeMensual: number,
): number {
  if (!Number.isFinite(importeMensual) || importeMensual === 0) return 0;

  const { dias, diasDelMes: total } = diasDeRentaEnElMes(contrato, year, month);
  if (dias >= total) return importeMensual;
  if (dias <= 0) return 0;

  return Math.round(((importeMensual * dias) / total) * 100) / 100;
}
