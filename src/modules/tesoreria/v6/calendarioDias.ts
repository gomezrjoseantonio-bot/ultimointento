// ============================================================================
// Tesorería V6 · §4.9 · el mes, día a día
// ============================================================================
//
// Derivación pura: la rejilla de días con su neto, qué días dejan una cuenta
// corta, y el resumen del mes.
//
// El punto ámbar es la parte que de verdad importa y la que no se puede sacar
// del neto del día: un día con neto POSITIVO puede dejar una cuenta en números
// rojos si el ingreso entra en una cuenta y el cargo sale de otra. Por eso el
// aviso se calcula por cuenta, arrastrando saldo día a día, y no mirando el
// total del día.
// ============================================================================

import type { Account, Movement, TreasuryEvent } from '../../../services/db';
import { esPendiente, importeConSigno, rangoDelMes } from '../../../services/tesoreriaV6Metrics';

export interface DiaCalendario {
  /** ISO yyyy-mm-dd. */
  fecha: string;
  /** Día del mes (1-31). */
  numero: number;
  /** Neto REAL del día: confirmado + conciliado + lo previsto que queda. */
  neto: number;
  /** Cuántos apuntes hay · 0 = celda vacía, sin cifra. */
  apuntes: number;
  /** Alguna cuenta se queda en negativo al cerrar este día (§4.9 · ámbar). */
  dejaCuentaCorta: boolean;
  /** Quedan previstos sin confirmar en este día. */
  tienePendientes: boolean;
}

export interface ResumenMes {
  quedaEntrar: number;
  quedaSalir: number;
  /** Saldo hoy + todo lo pendiente del mes · el mismo Cierre del hero (§4.1). */
  cierre: number;
}

/**
 * Huecos antes del día 1 con la semana empezando en LUNES (§4.9).
 *
 * `getDay()` devuelve 0 para domingo, así que domingo necesita 6 huecos y no 0.
 */
export function huecosIniciales(year: number, month0: number): number {
  const diaSemana = new Date(year, month0, 1).getDay();
  return (diaSemana + 6) % 7;
}

export function diasDelMes(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

function iso(year: number, month0: number, dia: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Construye la rejilla del mes.
 *
 * `saldoPorCuenta` es el saldo de cada cuenta HOY, que es el ancla desde la que
 * se arrastra el saldo día a día para detectar las cuentas cortas.
 */
export function construirDias(params: {
  year: number;
  month0: number;
  eventos: TreasuryEvent[];
  movimientos: Movement[];
  cuentas: Account[];
  saldoPorCuenta: Map<number, number>;
  hoy: string;
}): DiaCalendario[] {
  const { year, month0, eventos, movimientos, cuentas, saldoPorCuenta, hoy } = params;
  const { desde, hasta } = rangoDelMes(year, month0);
  const total = diasDelMes(year, month0);

  // Neto y conteo por día · realidad (movimientos) + lo previsto que sigue vivo.
  const netoPorDia = new Map<string, number>();
  const apuntesPorDia = new Map<string, number>();
  const pendientesPorDia = new Set<string>();
  // Flujo por (cuenta, día) · solo de lo que ESTÁ POR VENIR, porque el saldo de
  // hoy ya incorpora todo lo pasado.
  const flujoFuturo = new Map<number, Map<string, number>>();

  const anota = (fecha: string, importe: number, cuentaId: number | null, futuro: boolean) => {
    if (fecha < desde || fecha > hasta) return;
    netoPorDia.set(fecha, (netoPorDia.get(fecha) ?? 0) + importe);
    apuntesPorDia.set(fecha, (apuntesPorDia.get(fecha) ?? 0) + 1);
    if (!futuro || cuentaId == null) return;
    let porFecha = flujoFuturo.get(cuentaId);
    if (!porFecha) {
      porFecha = new Map();
      flujoFuturo.set(cuentaId, porFecha);
    }
    porFecha.set(fecha, (porFecha.get(fecha) ?? 0) + importe);
  };

  for (const m of movimientos) {
    if (m.isOpeningBalance) continue;
    const fecha = (m.date ?? '').slice(0, 10);
    // Un movimiento ya ocurrido está dentro del saldo de hoy; uno con fecha
    // futura (domiciliación ya cargada, apunte adelantado) todavía no.
    anota(fecha, m.amount, m.accountId ?? null, fecha > hoy);
  }

  for (const e of eventos) {
    if (!esPendiente(e)) continue;
    const fecha = (e.predictedDate ?? '').slice(0, 10);
    // Un previsto NUNCA está en el saldo de hoy, ni siquiera si su fecha ya
    // pasó: sigue sin confirmarse, así que sigue por venir.
    anota(fecha, importeConSigno(e), e.accountId ?? null, true);
    if (fecha >= desde && fecha <= hasta) pendientesPorDia.add(fecha);
  }

  // Arrastre por cuenta para el punto ámbar.
  const diasCortos = new Set<string>();
  for (const c of cuentas) {
    if (c.id == null) continue;
    const porFecha = flujoFuturo.get(c.id);
    if (!porFecha) continue;
    let saldo = saldoPorCuenta.get(c.id) ?? 0;
    for (let d = 1; d <= total; d++) {
      const fecha = iso(year, month0, d);
      const flujoDelDia = porFecha.get(fecha) ?? 0;
      saldo += flujoDelDia;

      // El punto marca el día que DEJA la cuenta corta, no todos los días que
      // sigue estándolo.
      //
      // Antes bastaba con `saldo < 0`, y eso encendía el aviso en el resto entero
      // del mes en cuanto una cuenta cruzaba a negativo — con lo que el ámbar
      // aparecía en casi todos los días y dejaba de significar "mira aquí".
      //
      // Ahora hacen falta las dos cosas: que el día tenga movimiento propio en
      // esa cuenta (un día sin nada nunca avisa) y que la cuenta cierre ese día
      // en negativo. Así el punto señala el día en que hay que hacer algo.
      //
      // No se filtra por `fecha >= hoy`: `flujoFuturo` ya contiene SOLO lo que
      // está por ocurrir. Un previsto vencido y sin confirmar sigue por venir
      // aunque su fecha pasara —el cargo no ha llegado— y si hunde la cuenta
      // hay que verlo. Lo ya ocurrido no entra aquí porque vive en el saldo.
      if (flujoDelDia !== 0 && saldo < 0) diasCortos.add(fecha);
    }
  }

  const dias: DiaCalendario[] = [];
  for (let d = 1; d <= total; d++) {
    const fecha = iso(year, month0, d);
    dias.push({
      fecha,
      numero: d,
      neto: Math.round((netoPorDia.get(fecha) ?? 0) * 100) / 100,
      apuntes: apuntesPorDia.get(fecha) ?? 0,
      dejaCuentaCorta: diasCortos.has(fecha),
      tienePendientes: pendientesPorDia.has(fecha),
    });
  }
  return dias;
}

/**
 * Saldo de cada cuenta AL EMPEZAR un día concreto (§9).
 *
 * Se arrastra desde el saldo de HOY sumando solo lo que está por venir, que es
 * exactamente lo que hace el punto ámbar: el saldo de hoy ya incorpora todo lo
 * pasado, así que volver a sumarlo lo contaría dos veces.
 *
 * Por eso solo tiene sentido de hoy en adelante. Para un día ya pasado devuelve
 * `null`: el saldo que hubo ese día no se puede reconstruir desde aquí sin
 * deshacer movimientos, y una cifra inventada en un aviso es peor que no dar
 * aviso ninguno.
 */
export function saldoAlEmpezarElDia(params: {
  fecha: string;
  eventos: TreasuryEvent[];
  movimientos: Movement[];
  saldoPorCuenta: Map<number, number>;
  hoy: string;
}): Map<number, number> | null {
  const { fecha, eventos, movimientos, saldoPorCuenta, hoy } = params;
  if (fecha < hoy) return null;

  const saldos = new Map(saldoPorCuenta);
  const suma = (cuentaId: number | null | undefined, importe: number) => {
    if (cuentaId == null) return;
    saldos.set(cuentaId, (saldos.get(cuentaId) ?? 0) + importe);
  };

  // Solo lo ANTERIOR al día pedido: lo de ese día es justo lo que se va a ir
  // marcando encima, y contarlo aquí lo duplicaría.
  for (const m of movimientos) {
    if (m.isOpeningBalance) continue;
    const f = (m.date ?? '').slice(0, 10);
    if (f > hoy && f < fecha) suma(m.accountId, m.amount);
  }
  for (const e of eventos) {
    if (!esPendiente(e)) continue;
    const f = (e.predictedDate ?? '').slice(0, 10);
    if (f < fecha) suma(e.accountId, importeConSigno(e));
  }
  return saldos;
}

/** Resumen de la cabecera del drawer (§4.9). */
export function resumirMes(params: {
  year: number;
  month0: number;
  eventos: TreasuryEvent[];
  saldoTotalHoy: number;
}): ResumenMes {
  const { year, month0, eventos, saldoTotalHoy } = params;
  const { desde, hasta } = rangoDelMes(year, month0);

  let quedaEntrar = 0;
  let quedaSalir = 0;
  for (const e of eventos) {
    if (!esPendiente(e)) continue;
    const fecha = (e.predictedDate ?? '').slice(0, 10);
    if (fecha < desde || fecha > hasta) continue;
    const imp = importeConSigno(e);
    if (imp > 0) quedaEntrar += imp;
    else quedaSalir += imp;
  }

  return {
    quedaEntrar,
    quedaSalir,
    cierre: saldoTotalHoy + quedaEntrar + quedaSalir,
  };
}
