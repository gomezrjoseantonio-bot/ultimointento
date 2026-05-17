// proyeccionActivoService · servicio genérico para proyectar el valor futuro de
// cualquier activo (plan de pensiones · fondo · acción · préstamo · depósito · crypto).
//
// T-INVERSIONES-DETALLE-PP-v1 · §4.D. Renombrado de `proyeccionInversionService`
// (decisión Q-PRE-G) para evitar confusión con los servicios `proyeccionService`
// del módulo Horizon (presupuesto/comparativa).
//
// IMPORTANTE · esta función NO debe acoplarse al tipo del activo. La caller pasa
// los inputs y recibe puntos {año, valor} listos para pintar.

import type { BenchmarkReferencia } from '../types/benchmarksReferencia';

// ── Tipos públicos ────────────────────────────────────────────────────────────

export type TipoActivoProyectable =
  | 'plan_pensiones'
  | 'fondo'
  | 'accion'
  | 'prestamo'
  | 'deposito'
  | 'crypto'
  | 'otro';

export interface ProyeccionInputs {
  /** Valor actual del activo en €. */
  saldoActual: number;
  /** Capital aportado acumulado hasta hoy en € (informativo · no usado en VF). */
  aportadoActual: number;
  /** Aportación recurrente anual estimada hacia adelante en € (0 si pasivo). */
  aportacionAnualEstimada: number;
  /** Años transcurridos desde la apertura del activo. */
  anosTranscurridos: number;
  /**
   * TWR anualizado real del activo (decimal · −0,001 = −0,1 %).
   * Si el activo tiene <2 años de histórico · pasar `null`: el servicio
   * usará `benchmarkReferencia` como base conservadora.
   */
  twrHistorico: number | null;
  /** Fecha de nacimiento del usuario (ISO) · null si desconocida. */
  fechaNacimientoUsuario: string | null;
  /** Edad objetivo de rescate · usada para calcular `anosHastaRescate`. */
  edadObjetivoRescate: number;
  /** Inflación anual asumida en % (ej. 2.0 = 2 %). */
  inflacionAnualAsumida: number;
  /** Benchmark de referencia · usado para escenario "si cambias gestora". */
  benchmarkReferencia: BenchmarkReferencia | null;
  /** Override de años hasta rescate si no hay fecha de nacimiento. Opcional. */
  anosHastaRescateFallback?: number;
}

export interface ProyeccionPunto {
  /** Año natural (ej. 2026). */
  ano: number;
  /** Valor del activo al cierre del año en €. */
  valor: number;
  /** Capital aportado acumulado al cierre del año en €. */
  aportadoAcumulado: number;
}

export interface ProyeccionEscenario {
  /** TWR aplicado a este escenario (decimal). */
  twrAplicado: number;
  /** Serie de puntos · uno por año desde hoy hasta el rescate. */
  puntos: ProyeccionPunto[];
  /** Valor final nominal en € (último punto de la serie). */
  valorFinal: number;
}

export interface ProyeccionResult {
  anosHastaRescate: number;
  /** Año natural de rescate (ej. 2049). */
  anoRescate: number;
  /** Fecha de rescate ISO (yyyy-mm-dd). */
  fechaRescate: string;

  /** Escenario base · usa `twrHistorico` (o benchmark si null). */
  escenarioActual: ProyeccionEscenario;
  /** "Si cambias gestora" · usa TWR del benchmark. Null si no hay benchmark. */
  escenarioConBenchmark: ProyeccionEscenario | null;
  /** "Si aportas el máximo" · igual escenario actual con aporte aumentado. */
  escenarioConMaxAportacion: ProyeccionEscenario;

  /** Cono de incertidumbre · −2 pp sobre el escenario actual. */
  conoBajo: ProyeccionEscenario;
  /** Cono de incertidumbre · +2 pp sobre el escenario actual. */
  conoAlto: ProyeccionEscenario;

  /** Valor final nominal del escenario actual. */
  valorFinalNominal: number;
  /** Valor final descontando inflación (€ de hoy). */
  valorFinalReal: number;
  /** Diferencia escenarioConBenchmark.valorFinal − escenarioActual.valorFinal. */
  diferenciaConBenchmark: number | null;
}

// ── Helpers internos ──────────────────────────────────────────────────────────

/**
 * TWR rolling 5 años del benchmark.
 * Toma los 5 valores anuales más recientes y compone CAGR.
 * Devuelve null si hay <2 años de datos.
 */
export function computeTwrRolling5y(
  benchmark: BenchmarkReferencia | null,
): number | null {
  if (!benchmark) return null;
  const anosOrdenados = Object.keys(benchmark.valoresAnuales)
    .map((k) => Number(k))
    .sort((a, b) => b - a);
  if (anosOrdenados.length < 2) return null;
  const top5 = anosOrdenados.slice(0, 5);
  // Compone (1 + pct/100) y saca media geométrica.
  let producto = 1;
  for (const ano of top5) {
    producto *= 1 + benchmark.valoresAnuales[ano] / 100;
  }
  const cagr = Math.pow(producto, 1 / top5.length) - 1;
  return cagr;
}

/**
 * Calcula años hasta rescate desde la fecha de nacimiento + edadObjetivoRescate.
 * Si no hay fecha · usa `anosHastaRescateFallback` (default 25).
 */
function calcularAnosHastaRescate(
  fechaNacimientoUsuario: string | null,
  edadObjetivoRescate: number,
  fallback: number = 25,
): number {
  if (!fechaNacimientoUsuario) return Math.max(1, fallback);
  const nacimiento = new Date(fechaNacimientoUsuario);
  if (Number.isNaN(nacimiento.getTime())) return Math.max(1, fallback);
  const hoy = new Date();
  const edadActual = (hoy.getTime() - nacimiento.getTime()) / (365.25 * 24 * 3600 * 1000);
  const anos = Math.round(edadObjetivoRescate - edadActual);
  return Math.max(1, anos);
}

/**
 * Proyecta la serie de puntos {ano, valor, aportadoAcumulado} a un TWR dado.
 * Aplica fórmula valor futuro punto a punto · evita derivar todo el final
 * de una sola fórmula para poder pintar la curva.
 *
 * Modelo · aporte se hace al inicio de cada año, luego rentabilidad anual r.
 * v(t+1) = (v(t) + aporte) · (1 + r)
 */
function generarSerie(
  saldoInicial: number,
  aportadoInicial: number,
  aporteAnual: number,
  twr: number,
  anos: number,
  anoBase: number,
): ProyeccionPunto[] {
  const puntos: ProyeccionPunto[] = [];
  let valor = saldoInicial;
  let aportado = aportadoInicial;
  // Punto inicial · año base.
  puntos.push({ ano: anoBase, valor: round2(valor), aportadoAcumulado: round2(aportado) });
  for (let i = 1; i <= anos; i++) {
    valor = (valor + aporteAnual) * (1 + twr);
    aportado = aportado + aporteAnual;
    puntos.push({
      ano: anoBase + i,
      valor: round2(valor),
      aportadoAcumulado: round2(aportado),
    });
  }
  return puntos;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function ultimoValor(serie: ProyeccionPunto[]): number {
  return serie.length === 0 ? 0 : serie[serie.length - 1].valor;
}

// ── Función pública ───────────────────────────────────────────────────────────

/**
 * Proyecta el valor futuro de un activo según los inputs.
 *
 * Función pura · sin side effects · no toca IndexedDB. La caller obtiene los
 * inputs de los stores `miPlan` · `personal` · `benchmarksReferencia` y los
 * pasa aquí.
 *
 * Reglas (§4.D):
 * - Si `twrHistorico` es null · usa `computeTwrRolling5y(benchmark)` como base.
 * - Si tampoco hay benchmark · usa 0.02 (2 %) como TWR neutro de fallback.
 * - Conos · TWR base ±2 pp.
 * - Escenario benchmark · TWR del benchmark rolling 5y · null si no hay.
 * - Escenario máx aportación · multiplica `aportacionAnualEstimada` × 3 como
 *   tope orientativo (el sandbox del PR 4 permite ajustar con sliders reales).
 * - Valor real · descuenta inflación nominal con (1 + π)^n.
 */
export function proyectarInversion(inputs: ProyeccionInputs): ProyeccionResult {
  const anos = calcularAnosHastaRescate(
    inputs.fechaNacimientoUsuario,
    inputs.edadObjetivoRescate,
    inputs.anosHastaRescateFallback ?? 25,
  );

  const twrBase = inputs.twrHistorico ?? computeTwrRolling5y(inputs.benchmarkReferencia) ?? 0.02;
  const twrBench = computeTwrRolling5y(inputs.benchmarkReferencia);

  const anoBase = new Date().getFullYear();

  const escenarioActual: ProyeccionEscenario = {
    twrAplicado: twrBase,
    puntos: generarSerie(
      inputs.saldoActual,
      inputs.aportadoActual,
      inputs.aportacionAnualEstimada,
      twrBase,
      anos,
      anoBase,
    ),
    valorFinal: 0,
  };
  escenarioActual.valorFinal = ultimoValor(escenarioActual.puntos);

  const escenarioConBenchmark: ProyeccionEscenario | null =
    twrBench == null
      ? null
      : (() => {
          const puntos = generarSerie(
            inputs.saldoActual,
            inputs.aportadoActual,
            inputs.aportacionAnualEstimada,
            twrBench,
            anos,
            anoBase,
          );
          return {
            twrAplicado: twrBench,
            puntos,
            valorFinal: ultimoValor(puntos),
          };
        })();

  const escenarioConMaxAportacion: ProyeccionEscenario = (() => {
    const aporteMax = Math.max(inputs.aportacionAnualEstimada * 3, inputs.aportacionAnualEstimada);
    const puntos = generarSerie(
      inputs.saldoActual,
      inputs.aportadoActual,
      aporteMax,
      twrBase,
      anos,
      anoBase,
    );
    return { twrAplicado: twrBase, puntos, valorFinal: ultimoValor(puntos) };
  })();

  const conoBajo: ProyeccionEscenario = (() => {
    const r = twrBase - 0.02;
    const puntos = generarSerie(
      inputs.saldoActual,
      inputs.aportadoActual,
      inputs.aportacionAnualEstimada,
      r,
      anos,
      anoBase,
    );
    return { twrAplicado: r, puntos, valorFinal: ultimoValor(puntos) };
  })();

  const conoAlto: ProyeccionEscenario = (() => {
    const r = twrBase + 0.02;
    const puntos = generarSerie(
      inputs.saldoActual,
      inputs.aportadoActual,
      inputs.aportacionAnualEstimada,
      r,
      anos,
      anoBase,
    );
    return { twrAplicado: r, puntos, valorFinal: ultimoValor(puntos) };
  })();

  const valorFinalNominal = escenarioActual.valorFinal;
  const inflacionPct = inputs.inflacionAnualAsumida / 100;
  const valorFinalReal = round2(valorFinalNominal / Math.pow(1 + inflacionPct, anos));
  const diferenciaConBenchmark = escenarioConBenchmark
    ? round2(escenarioConBenchmark.valorFinal - valorFinalNominal)
    : null;

  const fechaRescate = new Date(anoBase + anos, 11, 31).toISOString().slice(0, 10);

  return {
    anosHastaRescate: anos,
    anoRescate: anoBase + anos,
    fechaRescate,
    escenarioActual,
    escenarioConBenchmark,
    escenarioConMaxAportacion,
    conoBajo,
    conoAlto,
    valorFinalNominal,
    valorFinalReal,
    diferenciaConBenchmark,
  };
}
