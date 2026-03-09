/**
 * Financial calculation service for loans
 * Implements standard French amortization system formulas
 */

import { CuotaPrestamo, ConfiguracionPrestamo } from '../types/loans';

/**
 * Calculates constant monthly payment (PMT) using the French method
 * Formula: C = P * [i * (1 + i)^n] / [(1 + i)^n - 1]
 */
export function calcularCuotaMensual(
  capital: number,
  tasaAnual: number,
  numMeses: number
): number {
  const i = tasaAnual / 100 / 12; // Monthly decimal rate

  if (i === 0) {
    // No interest: payment = capital / months
    return capital / numMeses;
  }

  // Standard PMT formula
  const potencia = Math.pow(1 + i, numMeses);
  const cuota = capital * (i * potencia) / (potencia - 1);

  return cuota;
}

/**
 * Calculates interest for a given period using daily rate
 * Considers actual days for partial periods
 */
export function calcularInteresesPeriodo(
  capitalPendiente: number,
  tasaAnual: number,
  diasPeriodo: number,
  baseCalculo: 365 | 360 = 365
): number {
  const tasaDiaria = tasaAnual / 100 / baseCalculo;
  return capitalPendiente * tasaDiaria * diasPeriodo;
}

/**
 * Calculates the number of days from fechaInicio to fechaFin.
 * Returns 0 if fechaFin is before fechaInicio.
 */
export function calcularDiasEntreFechas(
  fechaInicio: string,
  fechaFin: string
): number {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  const diffTime = fin.getTime() - inicio.getTime();
  if (diffTime <= 0) return 0;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Generates the complete amortization schedule
 * Uses French amortization with monthly interest rate (capital * annual_rate / 12)
 * Tracks actual calendar days per period for display
 */
export function generarCuadroAmortizacion(
  config: ConfiguracionPrestamo
): CuotaPrestamo[] {
  const {
    capital,
    tasa_anual,
    plazo_meses,
    fecha_inicio,
    fecha_primera_cuota,
  } = config;

  // Calculate constant monthly payment
  const cuotaMensual = calcularCuotaMensual(capital, tasa_anual, plazo_meses);
  const tasaMensual = tasa_anual / 100 / 12;

  const cuotas: CuotaPrestamo[] = [];
  let capitalPendiente = capital;
  let fechaActual = new Date(fecha_primera_cuota);
  let fechaAnterior = new Date(fecha_inicio);

  for (let i = 1; i <= plazo_meses; i++) {
    // Calculate actual days in period for display
    const diasPeriodo = calcularDiasEntreFechas(
      fechaAnterior.toISOString().split('T')[0],
      fechaActual.toISOString().split('T')[0]
    );

    // Calculate interest using monthly rate (French amortization standard)
    const intereses = capitalPendiente * tasaMensual;

    // Capital amortized = payment minus interest
    let amortizacionCapital = cuotaMensual - intereses;

    // Last payment: settle remaining balance
    if (i === plazo_meses) {
      amortizacionCapital = capitalPendiente;
    }

    // Update outstanding capital
    capitalPendiente = Math.max(0, capitalPendiente - amortizacionCapital);

    const fechaStr = fechaActual.toISOString().split('T')[0];

    cuotas.push({
      numero: i,
      fecha: fechaStr,
      fecha_vencimiento: fechaStr,
      cuota_total: i === plazo_meses ? amortizacionCapital + intereses : cuotaMensual,
      amortizacion_capital: amortizacionCapital,
      intereses: intereses,
      capital_pendiente: capitalPendiente,
      dias_periodo: diasPeriodo,
      tasa_periodo: tasa_anual,
      pagado: false
    });

    // Prepare next iteration
    fechaAnterior = new Date(fechaActual);
    fechaActual.setMonth(fechaActual.getMonth() + 1);
  }

  return cuotas;
}

/**
 * Validates that a generated schedule matches expected values
 * Useful for testing
 */
export function validarCuadroAmortizacion(
  generado: CuotaPrestamo[],
  esperado: Partial<CuotaPrestamo>[],
  tolerancia: number = 0.01 // 1 cent
): { valido: boolean; errores: string[] } {
  const errores: string[] = [];

  for (let i = 0; i < esperado.length; i++) {
    const cuotaGenerada = generado[i];
    const cuotaEsperada = esperado[i];

    if (cuotaEsperada.cuota_total !== undefined) {
      const diff = Math.abs(cuotaGenerada.cuota_total - cuotaEsperada.cuota_total);
      if (diff > tolerancia) {
        errores.push(
          `Mes ${i + 1}: Cuota esperada ${cuotaEsperada.cuota_total}, ` +
          `obtenida ${cuotaGenerada.cuota_total} (diff: ${diff.toFixed(2)})`
        );
      }
    }

    if (cuotaEsperada.amortizacion_capital !== undefined) {
      const diff = Math.abs(cuotaGenerada.amortizacion_capital - cuotaEsperada.amortizacion_capital);
      if (diff > tolerancia) {
        errores.push(
          `Mes ${i + 1}: Amortización esperada ${cuotaEsperada.amortizacion_capital}, ` +
          `obtenida ${cuotaGenerada.amortizacion_capital}`
        );
      }
    }

    if (cuotaEsperada.intereses !== undefined) {
      const diff = Math.abs(cuotaGenerada.intereses - cuotaEsperada.intereses);
      if (diff > tolerancia) {
        errores.push(
          `Mes ${i + 1}: Intereses esperados ${cuotaEsperada.intereses}, ` +
          `obtenidos ${cuotaGenerada.intereses}`
        );
      }
    }
  }

  return {
    valido: errores.length === 0,
    errores
  };
}
