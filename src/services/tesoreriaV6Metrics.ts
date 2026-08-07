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
import { isTransferKey } from './categoryCatalog';

/**
 * Un traspaso interno NO es gasto ni ingreso · el dinero no entra ni sale del
 * patrimonio, cambia de cuenta. Contando sus patas, sacar 20 € al cajero
 * aparecía a la vez como 20 € gastados y 20 € ingresados.
 */
function esTraspasoInterno(r: { categoryKey?: string }): boolean {
  return isTransferKey(r.categoryKey);
}

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

  // Lo que QUEDA POR VENIR este mes · es lo que puede dejar la cuenta corta.
  const porVenir = eventos
    .filter((e) => esPendiente(e))
    .filter((e) => {
      const f = soloFecha(e.predictedDate);
      return f >= hoy && f <= hasta;
    })
    .sort((a, b) => soloFecha(a.predictedDate).localeCompare(soloFecha(b.predictedDate)));

  // Recorrido día a día: el primer punto en negativo es el que se avisa.
  let acumulado = saldoHoy;
  for (const e of porVenir) {
    acumulado += importeConSigno(e);
    if (acumulado < 0) {
      return { tipo: 'se-queda-corta', minimo: redondear(acumulado), dia: soloFecha(e.predictedDate) };
    }
  }

  /**
   * "N por confirmar" tiene que ser el MISMO N que la bandeja de §4.4.
   *
   * Contaba `f >= hoy` —lo que queda por venir— mientras la bandeja lista
   * `f <= hoy` —lo que ya venció y sigue sin confirmar—. Son dos conjuntos casi
   * disjuntos: solo se tocan en el día de hoy. La tarjeta decía 9, se pulsaba, y
   * la pestaña de dentro decía 3.
   *
   * Manda la bandeja: "por confirmar" es una TAREA, y lo que aún no ha llegado
   * no es una tarea. Lo que viene ya se cuenta en el hero ("queda entrar/salir")
   * y en la rejilla de meses, y si además hunde la cuenta se dice arriba con
   * "se queda corta", que es el aviso que sí mira hacia delante.
   *
   * Sin tope de mes, igual que la bandeja: un recibo de hace dos meses que nadie
   * confirmó sigue siendo trabajo pendiente hoy.
   */
  const porConfirmar = eventos.filter((e) => {
    // Y con el MISMO criterio: solo lo previsto. `esPendiente` incluye además
    // los `confirmed` —la venta de un piso, la liquidación de un préstamo—, que
    // están decididos y esperan al banco, no al usuario: la bandeja los mandó a
    // Confirmados y contarlos aquí volvería a desalinear la tarjeta y la
    // pestaña, que es el defecto que este contador vino a arreglar.
    if (!esPendiente(e) || e.status !== 'predicted') return false;
    const f = soloFecha(e.predictedDate);
    // Con fecha vacía la comparación `'' <= hoy` es CIERTA: sin esta guarda un
    // evento sin fecha se colaría en la cuenta y no en la bandeja.
    return f !== '' && f <= hoy;
  }).length;

  return porConfirmar > 0 ? { tipo: 'por-confirmar', n: porConfirmar } : { tipo: 'al-dia' };
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
 * siguiente.
 *
 * Todos los meses cuentan ENTEROS, incluido el en curso. Este último recortaba
 * por `hoy`, y eso dejaba fuera los previstos vencidos sin confirmar: una renta
 * del día 1 que todavía no ha entrado sigue siendo dinero que falta por entrar.
 * El hero los cuenta, así que recortar aquí hacía que la misma cifra saliera
 * distinta en dos sitios de la misma pantalla.
 */
export function proyectarMeses(params: {
  saldoHoy: number;
  eventos: TreasuryEvent[];
  year: number;
  month0: number;
  /**
   * Ya no se usa para recortar el mes en curso —ese cuenta entero, como el
   * hero— pero se mantiene en la firma: quien llama sigue pasándolo y quitarlo
   * obligaría a tocar todos los sitios sin ganar nada.
   */
  hoy?: string;
  meses?: number;
}): MesProyectado[] {
  const { saldoHoy, eventos, year, month0, meses = 6 } = params;
  const out: MesProyectado[] = [];
  let saldo = saldoHoy;

  for (let i = 0; i < meses; i++) {
    const d = new Date(year, month0 + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const { desde, hasta } = rangoDelMes(y, m);
    const enCurso = i === 0;

    // El mes en curso cuenta DESDE EL DÍA 1, no desde hoy.
    //
    // Recortaba por `hoy`, y eso dejaba fuera los previstos VENCIDOS sin
    // confirmar: una renta del día 1 que todavía no ha entrado sigue siendo
    // dinero que falta por entrar. El hero sí los cuenta, así que la misma
    // cifra salía distinta en dos sitios de la misma pantalla —725 € de
    // diferencia con dos rentas vencidas— y el cierre de la tarjeta quedaba
    // por debajo del cierre del hero.
    //
    // Es la misma regla que ya sigue el calendario: un previsto no está en el
    // saldo de hoy ni aunque su fecha haya pasado, porque sigue sin confirmarse
    // y por tanto sigue por venir.

    let entra = 0;
    let sale = 0;
    for (const e of eventos) {
      if (!esPendiente(e)) continue;
      if (!enRango(soloFecha(e.predictedDate), desde, hasta)) continue;
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
}

/* Aquí vivía `peorQuePrevisto`, y era la raíz de una contradicción.
 *
 * Estas tres líneas comparan lo ACUMULADO HASTA HOY contra el previsto del MES
 * ENTERO: por eso Ingresos dice 31 % y Gastos 22 % el día 7. Eso es avance, no
 * rendimiento. Convertir esa misma resta en un veredicto —"mejor de lo
 * previsto"— es comparar medio mes contra un mes: a principios de mes SIEMPRE
 * sale "mejor", porque el grueso del gasto aún no ha pasado.
 *
 * Y el veredicto salía a la vez que el del pie, que sí compara iguales (lo
 * previsto DE LO YA CONFIRMADO contra lo pagado). La tarjeta llegaba a decir
 * "Neto +935,74 € mejor de lo previsto" y, tres líneas más abajo, "acabarás
 * −38 € peor de lo previsto".
 *
 * El veredicto es UNO y es `desviacion`. Las líneas cuentan avance. */

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
  // Lo que YA ha pasado este mes, con lo que se había previsto para ello.
  //
  // Dos poblaciones suman aquí: las previsiones cumplidas —cada una con su
  // previsto original y lo que de verdad costó— y las salidas que no
  // respondían a ninguna previsión, que entran con previsto 0. Dejar fuera a
  // las segundas era lo que hacía decir "acabarás igual que lo previsto" con
  // el dinero ya gastado.
  let previstoDeLoConfirmado = 0;
  let pagadoDeLoConfirmado = 0;

  // Los movimientos que YA responden a una previsión · para no contarlos dos
  // veces al sumar abajo lo que salió sin estar previsto.
  const yaContados = new Set<number>();
  // Red de seguridad para datos viejos: previsiones ejecutadas que no guardaron
  // a qué movimiento dieron lugar. Se casan por fecha e importe, igual que hace
  // `calculateAccountBalanceAtDate` con el mismo problema. Contar de más aquí
  // sería peor que no contar: diría que te has gastado el doble.
  const sinVinculo = new Map<string, number>();
  //
  // La cuenta entra en la clave. Sin ella, dos cargos del mismo importe el
  // mismo día en cuentas distintas se casarían entre sí y un gasto no previsto
  // de verdad desaparecería del cálculo — y con diez cuentas eso no es raro.
  // A cambio, un evento viejo cuya cuenta se cambió al confirmar no casará y su
  // pago contará dos veces; es un caso mucho más improbable que el anterior.
  const claveImplicita = (cuenta: unknown, fecha: string, importe: number): string =>
    `${cuenta ?? '?'}|${soloFecha(fecha)}|${Math.abs(importe).toFixed(2)}`;

  for (const e of eventos) {
    if (e.descartado) continue;
    // El mismo criterio que abajo · un traspaso previsto tampoco es gasto ni
    // ingreso. Filtrarlo solo en los movimientos dejaba el previsto inflado por
    // las dos patas y la comparación contra el real comparando cosas distintas.
    if (esTraspasoInterno(e)) continue;
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
      const materializado = e.executedMovementId ?? e.movementId;
      if (materializado != null) {
        yaContados.add(Number(materializado));
      } else {
        const clave = claveImplicita(e.accountId, e.predictedDate, costeReal);
        sinVinculo.set(clave, (sinVinculo.get(clave) ?? 0) + 1);
      }
    }
  }

  // Lo que salió SIN estar previsto también es desviación · y de la peor.
  //
  // La frase comparaba solo previsiones cumplidas contra su propio coste, así
  // que un pago que nunca se previó —anotado a mano, o un cargo del banco que
  // no casó con nada— no aparecía por ningún lado: la pantalla decía "acabarás
  // igual que lo previsto" con 86 € fuera de plan ya salidos de la cuenta.
  //
  // Previsto 0 y pagado su importe: eso es exactamente lo que fue.
  for (const m of movimientos) {
    if (!enRango(soloFecha(m.date), desde, hasta)) continue;
    if (m.isOpeningBalance) continue;
    if (m.amount >= 0) continue;
    if (esTraspasoInterno(m)) continue;
    if (m.id != null && yaContados.has(m.id)) continue;
    const clave = claveImplicita(m.accountId, m.date, m.amount);
    const pendientes = sinVinculo.get(clave) ?? 0;
    if (pendientes > 0) {
      sinVinculo.set(clave, pendientes - 1);
      continue;
    }
    pagadoDeLoConfirmado += Math.abs(m.amount);
  }

  let realIngresos = 0;
  let realGastos = 0;
  for (const m of movimientos) {
    if (!enRango(soloFecha(m.date), desde, hasta)) continue;
    if (m.isOpeningBalance) continue;
    if (esTraspasoInterno(m)) continue;
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
      },
      {
        clave: 'Gastos',
        real: redondear(realGastos),
        previsto: redondear(previstoGastos),
        porcentaje: pct(realGastos, previstoGastos),
      },
      {
        clave: 'Neto',
        real: redondear(netoReal),
        previsto: redondear(netoPrev),
        // §3.4 · el Neto SÍ tiene porcentaje cuando ambos son positivos.
        //
        // Estaba fijado a `null` porque el neto puede ser negativo, y ahí un
        // "128 %" se lee como mejor cuando significa haber gastado de más. Pero
        // eso solo pasa con magnitudes negativas: con las dos en positivo el
        // porcentaje dice exactamente lo que tiene que decir —cuánto llevas de
        // lo previsto— y es lo que hace el mockup. Fuera de ese caso, `null`, y
        // la fila enseña el neto que llevas junto al previsto, sin porcentaje.
        porcentaje: netoReal >= 0 && netoPrev > 0 ? pct(netoReal, netoPrev) : null,
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
