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

import type { PrimerCobroContrato } from './db/types-contratos';

/** Lo mínimo que hace falta de un contrato para saber qué cobra este mes. */
export interface PeriodoDeContrato {
  /** ISO `YYYY-MM-DD` (admite fecha-hora completa). */
  fechaInicio: string;
  /** ISO `YYYY-MM-DD` (admite fecha-hora completa). */
  fechaFin: string;
  /** Lo que se pactó para el primer mes · opcional (ver más abajo). */
  primerCobro?: PrimerCobroContrato;
}

/** El mes siguiente a uno dado, respetando el cambio de año. */
const mesSiguiente = (year: number, month: number): { year: number; month: number } =>
  month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

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
 * El importe que toca cobrar este mes · `0` si este mes no hay nada que pedir.
 *
 * `importeMensual` es la renta mensual EFECTIVA del contrato: puede ser
 * `contract.rentaMensual` o el importe que fuerce el plan de gestión delegada
 * (padre neto en flujo A). Prorratear va después de decidir cuál es, porque un
 * contrato que empieza a mitad de mes cobra media renta venga el mensual de
 * donde venga.
 *
 * ── El primer cobro pactado manda ─────────────────────────────────────────
 * El aritmético casi nunca es el número que se firma. «17 días de agosto más
 * septiembre entero, 565 €» es una cifra acordada —el prorrateo de ese caso da
 * 565,16—, y ATLAS tiene que emitir lo que se firmó. Por eso, cuando el contrato
 * trae `primerCobro`, su `importe` GANA sobre cualquier cálculo en el mes de
 * entrada, sea cual sea el modo: los cuatro modos son formas de PROPONER una
 * cifra en el alta, y las cuatro dejan ajustarla a mano.
 *
 * ── El mes adelantado no se cobra dos veces ───────────────────────────────
 * `dias_mas_adelanto` significa que en el primer cobro ya va la mensualidad
 * SIGUIENTE. Ese mes queda pagado antes de empezar, así que aquí devuelve 0 y el
 * generador no emite nada: pedirlo otra vez sería contar el mismo dinero dos
 * veces, que es el fallo que cerraron #1797 y #1800 por otras dos puertas. Se
 * deduce del modo y de `fechaInicio`, sin guardar qué mes está prepagado: un
 * segundo campo que dijera lo mismo podría contradecir al primero.
 */
export function importeDeLaRentaDelMes(
  contrato: PeriodoDeContrato,
  year: number,
  month: number,
  importeMensual: number,
): number {
  const inicio = partesISO(contrato.fechaInicio);
  const primerCobro = contrato.primerCobro;

  if (primerCobro && inicio) {
    const esMesDeEntrada = inicio.year === year && inicio.month === month;
    if (esMesDeEntrada) {
      return Number.isFinite(primerCobro.importe) ? primerCobro.importe : 0;
    }

    if (primerCobro.modo === 'dias_mas_adelanto') {
      const siguiente = mesSiguiente(inicio.year, inicio.month);
      if (siguiente.year === year && siguiente.month === month) return 0;
    }
  }

  if (!Number.isFinite(importeMensual) || importeMensual === 0) return 0;

  const { dias, diasDelMes: total } = diasDeRentaEnElMes(contrato, year, month);
  if (dias >= total) return importeMensual;
  if (dias <= 0) return 0;

  return Math.round(((importeMensual * dias) / total) * 100) / 100;
}
