// ============================================================================
// Tesorería V6 · cálculos de la pantalla (§4.1 · 4.2 · 4.3 · 4.10)
// ============================================================================
//
// Derivación PURA: entra el estado ya leído de la DB y salen los números que
// pinta la pantalla. Sin acceso a IndexedDB, para que sea barato de probar y
// para que el "saldo vivo" de §4.6 sea recalcular esto, no recargar la página.
//
// Reglas que atraviesan todo el fichero:
//   · Un evento DESCARTADO (v84) no existe a ningún efecto: no aparece en
//     pendientes, no suma a los KPIs, no afecta al Cierre. No ocurrió.
//   · Un evento ya EJECUTADO no se cuenta como pendiente: su realidad vive en
//     el `Movement` que generó, y contarlo dos veces inflaría el Cierre.
//   · Magnitud por |amount| y dirección por `type`, igual que
//     `accountBalanceService`: los generadores no comparten convención de
//     signo y sin `Math.abs` un gasto negativo se cuenta como ingreso.
// ============================================================================

import type { Account, Movement, TreasuryEvent } from './db';

export interface RangoMes {
  /** Primer día del mes · ISO `YYYY-MM-DD`. */
  desde: string;
  /** Último día del mes · ISO `YYYY-MM-DD`. */
  hasta: string;
  /** Número del último día (28-31), para el subtítulo "proyectado a día N". */
  ultimoDia: number;
}

export function rangoDelMes(year: number, month0: number): RangoMes {
  const ultimoDia = new Date(year, month0 + 1, 0).getDate();
  const mm = String(month0 + 1).padStart(2, '0');
  return {
    desde: `${year}-${mm}-01`,
    hasta: `${year}-${mm}-${String(ultimoDia).padStart(2, '0')}`,
    ultimoDia,
  };
}

const soloFecha = (iso?: string): string => (iso ?? '').slice(0, 10);

/** Importe con signo: magnitud por |amount|, dirección por `type`. */
export function importeConSigno(e: Pick<TreasuryEvent, 'amount' | 'type'>): number {
  const magnitud = Math.abs(e.amount);
  return e.type === 'income' ? magnitud : -magnitud;
}

/**
 * ¿Cuenta este evento como PENDIENTE (previsto que aún no ha ocurrido)?
 *
 * Descartado → no. Ejecutado → tampoco: ya hay un `Movement` que lo representa
 * y contarlo otra vez duplicaría el importe en el Cierre.
 */
export function esPendiente(e: TreasuryEvent): boolean {
  if (e.descartado) return false;
  return e.status === 'predicted' || e.status === 'confirmed';
}

const enRango = (iso: string, desde: string, hasta: string): boolean =>
  iso >= desde && iso <= hasta;

// ─── §4.1 · Hero ────────────────────────────────────────────────────────────

export interface KpisHero {
  saldo: number;
  numCuentas: number;
  pendienteEntrar: number;
  movimientosEntrar: number;
  pendienteSalir: number;
  movimientosSalir: number;
  /** Saldo + pendiente entrar + pendiente salir. */
  cierre: number;
  ultimoDia: number;
}

export function calcularKpisHero(params: {
  cuentas: Account[];
  saldoPorCuenta: Map<number, number>;
  eventos: TreasuryEvent[];
  year: number;
  month0: number;
}): KpisHero {
  const { cuentas, saldoPorCuenta, eventos, year, month0 } = params;
  const { desde, hasta, ultimoDia } = rangoDelMes(year, month0);

  const activas = cuentas.filter((c) => c.status !== 'DELETED');
  const saldo = activas.reduce((s, c) => s + (saldoPorCuenta.get(c.id ?? -1) ?? 0), 0);

  let pendienteEntrar = 0;
  let movimientosEntrar = 0;
  let pendienteSalir = 0;
  let movimientosSalir = 0;

  for (const e of eventos) {
    if (!esPendiente(e)) continue;
    if (!enRango(soloFecha(e.predictedDate), desde, hasta)) continue;
    const imp = importeConSigno(e);
    if (imp > 0) {
      pendienteEntrar += imp;
      movimientosEntrar++;
    } else if (imp < 0) {
      pendienteSalir += imp;
      movimientosSalir++;
    }
  }

  return {
    saldo: redondear(saldo),
    numCuentas: activas.length,
    pendienteEntrar: redondear(pendienteEntrar),
    movimientosEntrar,
    pendienteSalir: redondear(pendienteSalir),
    movimientosSalir,
    cierre: redondear(saldo + pendienteEntrar + pendienteSalir),
    ultimoDia,
  };
}

// ─── §4.2 · Estado de cada tarjeta de cuenta ────────────────────────────────

export type EstadoCuenta =
  | { tipo: 'al-dia' }
  | { tipo: 'por-confirmar'; n: number }
  | { tipo: 'se-queda-corta'; minimo: number; dia: string };

/**
 * Un solo estado por tarjeta, en este orden de prioridad:
 *   1. se queda corta · el saldo proyectado baja de 0 algún día del mes
 *   2. N por confirmar
 *   3. al día
 *
 * "Se queda corta" gana porque es lo único que pide actuar.
 */
export function estadoDeCuenta(params: {
  saldoHoy: number;
  eventos: TreasuryEvent[];
  year: number;
  month0: number;
  hoy: string;
}): EstadoCuenta {
  const { saldoHoy, eventos, year, month0, hoy } = params;
  const { hasta } = rangoDelMes(year, month0);

  const pendientes = eventos
    .filter((e) => esPendiente(e))
    .filter((e) => {
      const f = soloFecha(e.predictedDate);
      return f >= hoy && f <= hasta;
    })
    .sort((a, b) => soloFecha(a.predictedDate).localeCompare(soloFecha(b.predictedDate)));

  // Recorrido día a día: el primer punto en negativo es el que se avisa.
  let acumulado = saldoHoy;
  for (const e of pendientes) {
    acumulado += importeConSigno(e);
    if (acumulado < 0) {
      return { tipo: 'se-queda-corta', minimo: redondear(acumulado), dia: soloFecha(e.predictedDate) };
    }
  }

  return pendientes.length > 0 ? { tipo: 'por-confirmar', n: pendientes.length } : { tipo: 'al-dia' };
}

// ─── §4.3 · Rejilla de 6 meses ──────────────────────────────────────────────

export interface MesProyectado {
  year: number;
  month0: number;
  /** Saldo proyectado al cierre del mes. */
  cierre: number;
  entra: number;
  sale: number;
  enCurso: boolean;
}

/**
 * Proyección encadenada: el cierre de un mes es el saldo de partida del
 * siguiente. En el mes en curso, "entra"/"sale" son lo que QUEDA (solo cuenta
 * desde hoy); en los futuros, el mes entero.
 */
export function proyectarMeses(params: {
  saldoHoy: number;
  eventos: TreasuryEvent[];
  year: number;
  month0: number;
  hoy: string;
  meses?: number;
}): MesProyectado[] {
  const { saldoHoy, eventos, year, month0, hoy, meses = 6 } = params;
  const out: MesProyectado[] = [];
  let saldo = saldoHoy;

  for (let i = 0; i < meses; i++) {
    const d = new Date(year, month0 + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const { desde, hasta } = rangoDelMes(y, m);
    const enCurso = i === 0;
    // En el mes en curso solo queda por pasar lo de hoy en adelante.
    const inicio = enCurso && hoy > desde ? hoy : desde;

    let entra = 0;
    let sale = 0;
    for (const e of eventos) {
      if (!esPendiente(e)) continue;
      if (!enRango(soloFecha(e.predictedDate), inicio, hasta)) continue;
      const imp = importeConSigno(e);
      if (imp > 0) entra += imp;
      else sale += imp;
    }

    saldo = saldo + entra + sale;
    out.push({
      year: y,
      month0: m,
      cierre: redondear(saldo),
      entra: redondear(entra),
      sale: redondear(sale),
      enCurso,
    });
  }

  return out;
}

// ─── §4.10 · Cómo va {mes} ──────────────────────────────────────────────────

export interface LineaRealidad {
  clave: 'Ingresos' | 'Gastos' | 'Neto';
  real: number;
  previsto: number;
  /**
   * Porcentaje de lo real sobre SU PROPIO previsto · `null` cuando no tiene
   * sentido.
   *
   * A3 · con magnitudes que pueden ser NEGATIVAS el porcentaje engaña: un neto
   * real de −1.048 € sobre un previsto de −821 € da 128 %, y una barra al 128 %
   * se lee como "voy sobrado" cuando significa justo lo contrario — se ha
   * gastado más de lo previsto. Ingresos y Gastos son magnitudes positivas y sí
   * admiten avance; el Neto no, y por eso no lleva barra.
   */
  porcentaje: number | null;
  /** true si lo real es PEOR que lo previsto · la nota va en `--warn`. */
  peorQuePrevisto: boolean;
}

export interface Realidad {
  lineas: LineaRealidad[];
  /**
   * Desviación comparando IGUALES: lo que se había previsto **de lo ya
   * confirmado**, contra lo realmente pagado. Positiva = mejor de lo previsto.
   */
  desviacion: number;
  previstoDeLoConfirmado: number;
  pagadoReal: number;
}

/**
 * Realidad sobre lo previsto del mes.
 *
 * `previstoTotal*` sale de TODOS los eventos del mes (ocurridos o no), que es
 * contra lo que se mide el avance. La desviación, en cambio, compara solo lo
 * ya confirmado contra su propia previsión: mezclar ambas cosas daría una
 * desviación falsa por lo que aún no ha pasado.
 */
export function calcularRealidad(params: {
  eventos: TreasuryEvent[];
  movimientos: Movement[];
  year: number;
  month0: number;
}): Realidad {
  const { eventos, movimientos, year, month0 } = params;
  const { desde, hasta } = rangoDelMes(year, month0);

  let previstoIngresos = 0;
  let previstoGastos = 0;
  // Previsión y coste real SOLO de lo ya materializado · comparar iguales.
  let previstoDeLoConfirmado = 0;
  let pagadoDeLoConfirmado = 0;

  for (const e of eventos) {
    if (e.descartado) continue;
    if (!enRango(soloFecha(e.predictedDate), desde, hasta)) continue;
    const imp = importeConSigno(e);
    if (imp > 0) previstoIngresos += imp;
    else previstoGastos += Math.abs(imp);

    // A2 · la desviación se calcula MOVIMIENTO A MOVIMIENTO, no con agregados.
    //
    // Antes esto se comparaba contra la suma de TODOS los gastos reales del
    // mes, incluidos los que no responden a ninguna previsión — así que no
    // comparaba iguales, y con datos donde cada previsto se materializa por su
    // importe exacto daba 0 € siempre.
    //
    // El dato bueno está persistido: `amount` conserva el previsto ORIGINAL y
    // `actualAmount` guarda lo que de verdad costó (`confirmTreasuryEvent` no
    // pisa `amount`). Si un recibo se presupuestó en 120 € y vino de 96 €, la
    // desviación de esa línea es +24 €.
    if (e.status === 'executed' && imp < 0) {
      const previstoOriginal = Math.abs(e.amount);
      const costeReal = e.actualAmount != null ? Math.abs(e.actualAmount) : previstoOriginal;
      previstoDeLoConfirmado += previstoOriginal;
      pagadoDeLoConfirmado += costeReal;
    }
  }

  let realIngresos = 0;
  let realGastos = 0;
  for (const m of movimientos) {
    if (!enRango(soloFecha(m.date), desde, hasta)) continue;
    if (m.isOpeningBalance) continue;
    if (m.amount > 0) realIngresos += m.amount;
    else realGastos += Math.abs(m.amount);
  }

  // Solo para magnitudes que no pueden ser negativas (ingresos y gastos).
  const pct = (real: number, prev: number): number =>
    prev === 0 ? 0 : Math.round((real / prev) * 100);

  const netoReal = realIngresos - realGastos;
  const netoPrev = previstoIngresos - previstoGastos;

  return {
    lineas: [
      {
        clave: 'Ingresos',
        real: redondear(realIngresos),
        previsto: redondear(previstoIngresos),
        porcentaje: pct(realIngresos, previstoIngresos),
        // Ingresar MENOS de lo previsto es peor.
        peorQuePrevisto: realIngresos < previstoIngresos,
      },
      {
        clave: 'Gastos',
        real: redondear(realGastos),
        previsto: redondear(previstoGastos),
        porcentaje: pct(realGastos, previstoGastos),
        // Gastar MÁS de lo previsto es peor.
        peorQuePrevisto: realGastos > previstoGastos,
      },
      {
        clave: 'Neto',
        real: redondear(netoReal),
        previsto: redondear(netoPrev),
        // Sin barra · ver la nota de `porcentaje`.
        porcentaje: null,
        peorQuePrevisto: netoReal < netoPrev,
      },
    ],
    desviacion: redondear(previstoDeLoConfirmado - pagadoDeLoConfirmado),
    previstoDeLoConfirmado: redondear(previstoDeLoConfirmado),
    // Lo que costaron ESOS mismos conceptos · no todo el gasto del mes.
    pagadoReal: redondear(pagadoDeLoConfirmado),
  };
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
