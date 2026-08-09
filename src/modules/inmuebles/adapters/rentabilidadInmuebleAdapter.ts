// Adaptador de rentabilidad del inmueble · Fase 7 (rentabilidad robusta).
//
// Cálculo PURO (sin IndexedDB) que distingue lo PREVISTO de lo REAL:
//   - ingresos previstos (contratos) vs cobrados (renta confirmada en Tesorería)
//   - gastos previstos (compromisos recurrentes) vs pagados (gastos reales)
//   - resultado operativo estimado vs real
//   - rentabilidad bruta y neta, y cashflow (restando la cuota del préstamo)
//
// Cada magnitud se etiqueta `real` | `previsto` | `estimado` para que la UI no
// mezcle una previsión con un dato consolidado. No duplica ingresos ni gastos:
// cada cifra viene de una única fuente que el llamador ya ha resuelto.

export type EtiquetaDato = 'real' | 'previsto' | 'estimado';

export interface MetricaEtiquetada {
  valor: number;
  etiqueta: EtiquetaDato;
}

export interface RentabilidadInmuebleInput {
  /** Coste de adquisición · denominador de las rentabilidades. */
  costeAdquisicion: number;
  ejercicio: number;
  /** Renta anual prevista (contratos activos · rentaMensual×12). */
  ingresosPrevistosAnual?: number;
  /** Renta anual cobrada (Tesorería · confirmada/ejecutada del ejercicio). */
  ingresosCobradosAnual?: number;
  /** Gasto anual previsto (compromisos recurrentes). */
  gastosPrevistosAnual?: number;
  /** Gasto operativo anual real registrado (gastosInmueble del ejercicio). */
  gastosPagadosAnual?: number;
  /** Cuota anual del préstamo imputada al inmueble. */
  cuotaPrestamoAnual?: number;
}

export interface RentabilidadInmuebleResumen {
  ejercicio: number;
  ingresosPrevistos?: number;
  ingresosCobrados?: number;
  gastosPrevistos?: number;
  gastosPagados?: number;
  /** Ingresos previstos − gastos previstos (solo si ambos existen). */
  resultadoOperativoEstimado?: number;
  /** Ingresos cobrados − gastos pagados (solo si ambos existen). */
  resultadoOperativoReal?: number;
  /** Rentabilidad bruta % · usa cobrados (real) si existen, si no previstos. */
  rentabilidadBruta?: MetricaEtiquetada;
  /** Rentabilidad neta % · usa el resultado real si existe, si no el estimado. */
  rentabilidadNeta?: MetricaEtiquetada;
  cuotaPrestamoAnual?: number;
  /** Resultado estimado − cuota de préstamo. */
  cashflowEstimado?: number;
  /** Resultado real − cuota de préstamo. */
  cashflowReal?: number;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

export function calcularRentabilidadInmueble(
  input: RentabilidadInmuebleInput,
): RentabilidadInmuebleResumen {
  const coste = input.costeAdquisicion;
  const ingresosPrevistos = input.ingresosPrevistosAnual;
  const ingresosCobrados = input.ingresosCobradosAnual;
  const gastosPrevistos = input.gastosPrevistosAnual;
  const gastosPagados = input.gastosPagadosAnual;
  const cuota = input.cuotaPrestamoAnual;

  const resultadoOperativoEstimado =
    ingresosPrevistos !== undefined && gastosPrevistos !== undefined
      ? round2(ingresosPrevistos - gastosPrevistos)
      : undefined;

  const resultadoOperativoReal =
    ingresosCobrados !== undefined && gastosPagados !== undefined
      ? round2(ingresosCobrados - gastosPagados)
      : undefined;

  // Bruta: preferimos lo cobrado (real) sobre lo previsto.
  let rentabilidadBruta: MetricaEtiquetada | undefined;
  if (coste > 0) {
    if (ingresosCobrados !== undefined) {
      rentabilidadBruta = { valor: round2((ingresosCobrados * 100) / coste), etiqueta: 'real' };
    } else if (ingresosPrevistos !== undefined) {
      rentabilidadBruta = { valor: round2((ingresosPrevistos * 100) / coste), etiqueta: 'previsto' };
    }
  }

  // Neta: preferimos el resultado real sobre el estimado.
  let rentabilidadNeta: MetricaEtiquetada | undefined;
  if (coste > 0) {
    if (resultadoOperativoReal !== undefined) {
      rentabilidadNeta = { valor: round2((resultadoOperativoReal * 100) / coste), etiqueta: 'real' };
    } else if (resultadoOperativoEstimado !== undefined) {
      rentabilidadNeta = {
        valor: round2((resultadoOperativoEstimado * 100) / coste),
        etiqueta: 'estimado',
      };
    }
  }

  const cashflowEstimado =
    resultadoOperativoEstimado !== undefined
      ? round2(resultadoOperativoEstimado - (cuota ?? 0))
      : undefined;

  const cashflowReal =
    resultadoOperativoReal !== undefined
      ? round2(resultadoOperativoReal - (cuota ?? 0))
      : undefined;

  return {
    ejercicio: input.ejercicio,
    ingresosPrevistos: ingresosPrevistos !== undefined ? round2(ingresosPrevistos) : undefined,
    ingresosCobrados: ingresosCobrados !== undefined ? round2(ingresosCobrados) : undefined,
    gastosPrevistos: gastosPrevistos !== undefined ? round2(gastosPrevistos) : undefined,
    gastosPagados: gastosPagados !== undefined ? round2(gastosPagados) : undefined,
    resultadoOperativoEstimado,
    resultadoOperativoReal,
    rentabilidadBruta,
    rentabilidadNeta,
    cuotaPrestamoAnual: cuota !== undefined ? round2(cuota) : undefined,
    cashflowEstimado,
    cashflowReal,
  };
}
