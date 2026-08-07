// ============================================================================
// La nómina que entra en una cuenta, mes a mes · VOCABULARIO §6 ter
// ============================================================================
//
// La segunda fuente de §6 ter, después de la tarjeta. Lo que el banco mira para
// bonificar es **lo que le entra a él**: una nómina domiciliada en su cuenta,
// por encima de un mínimo, todos los meses.
//
// Y ya existe sin guardar nada nuevo, igual que el recibo de la tarjeta: el
// cobro de una nómina es un `TreasuryEvent` de ingreso con su cuenta de abono,
// que nace previsto y se cierra al conciliarlo contra el extracto.
//
// La diferencia con la tarjeta, y por eso este dato tiene otra forma: la
// tarjeta se mide por un TOTAL en la ventana, y la nómina **mes a mes**. Un
// semestre con 7.200 € de nómina no cumple «1.200 € al mes» si un mes vino
// vacío y otro doble.
//
// Puro: no lee la base. Quien llame le pasa los eventos.
// ============================================================================

import type { TreasuryEvent } from '../db';
import { yaSeCobro } from '../gastoPorTarjeta';

/** Lo cobrado por nómina en UNA cuenta y UN mes. */
export interface CobroDeUnMes {
  /** La cuenta donde entró · es lo que el banco exige, su cuenta. */
  cuentaId: number;
  /** El mes, `YYYY-MM` · identifica al periodo. */
  mes: string;
  /** La suma de lo que entró ese mes · dos nóminas en la misma cuenta suman. */
  importe: number;
  /**
   * `cerrado` = ya se cobró y cuadró contra el extracto. `abierto` = todavía es
   * una previsión.
   *
   * Misma distinción que en el gasto por tarjeta y por lo mismo: una
   * bonificación se demuestra con lo cobrado, no con lo que esperas cobrar.
   */
  estado: 'cerrado' | 'abierto';
}

/**
 * Lo cobrado por nómina, agrupado por (cuenta · mes).
 *
 * Un evento descartado no cuenta: el usuario dijo que no ocurre, así que no es
 * un cobro ni previsto ni real. Contarlo diría que cumples un requisito que no
 * cumples, y eso se paga en el recibo de la hipoteca (§3.6).
 *
 * El mes es el del cobro REAL cuando lo hay: una nómina prevista para el 25 de
 * abril que el banco abonó el 2 de mayo pertenece a mayo, que es cuando el
 * banco la vio entrar.
 */
export function cobrosDeNomina(eventos: TreasuryEvent[]): CobroDeUnMes[] {
  return agrupadoPorCuentaYMes(eventos, (ev) => ev.sourceType === 'nomina');
}

/**
 * **Todo** lo que entra en una cuenta, mes a mes · **la otra rama**.
 *
 * Muchos bancos no exigen una nómina: la FEIN de Unicaja dice «Nómina, o
 * Pensión, o Prestación económica de la Seguridad Social, por importe igual o
 * superior a 2.500,00 euros netos mensuales; **o ingresos recurrentes por
 * importe anual igual o superior a 30.000 euros netos**».
 *
 * Esa segunda rama **no exige nómina ninguna** —valen alquileres, dividendos,
 * lo que sea, mientras entre—, y mirándola solo con `cobrosDeNomina` no se
 * puede cumplir jamás: ahí solo entra lo marcado como nómina. Quien cobra de
 * sus pisos salía como que **no cumple** y se le decía que perdía medio punto
 * que no pierde *(Jose · 6 ago 2026: «esto es la madre del cordero»)*.
 */
export function ingresosDeLaCuenta(eventos: TreasuryEvent[]): CobroDeUnMes[] {
  return agrupadoPorCuentaYMes(eventos, () => true);
}

function agrupadoPorCuentaYMes(
  eventos: TreasuryEvent[],
  cuenta: (ev: TreasuryEvent) => boolean
): CobroDeUnMes[] {
  const porClave = new Map<string, CobroDeUnMes>();

  for (const ev of eventos) {
    if (ev.type !== 'income' || !cuenta(ev)) continue;
    if (ev.descartado === true) continue;
    if (ev.accountId == null) continue;

    const fecha = ev.actualDate ?? ev.predictedDate;
    if (typeof fecha !== 'string' || fecha.length < 7) continue;
    const mes = fecha.slice(0, 7);

    // Manda lo COBRADO sobre lo previsto · una nómina prevista de 1.200 € que
    // entró por 1.150 € (una baja, un mes con menos variable) no llega al
    // mínimo, y esta cifra se presume ante un banco.
    const importe = Math.abs(ev.actualAmount ?? ev.amount);

    const clave = `${ev.accountId}|${mes}`;
    const previo = porClave.get(clave);

    porClave.set(clave, {
      cuentaId: ev.accountId,
      mes,
      importe: (previo?.importe ?? 0) + importe,
      // El mes solo está cerrado si está cobrado cuanto entró en él. Con una
      // nómina cobrada y otra por venir, el mes todavía puede crecer.
      estado: previo?.estado === 'abierto' || !yaSeCobro(ev) ? 'abierto' : 'cerrado',
    });
  }

  return [...porClave.values()].sort((a, b) => b.mes.localeCompare(a.mes));
}

/** Lo cobrado en una cuenta, por meses, del más reciente al más antiguo. */
export function cobrosDeLaCuenta(
  cobros: CobroDeUnMes[],
  cuentaId: number,
  opciones: { desde?: string; hasta?: string; soloCerrados?: boolean } = {}
): CobroDeUnMes[] {
  // La ventana viene en días (`YYYY-MM-DD`) y los meses en `YYYY-MM`: se
  // comparan por el mes de cada extremo, o el mes en que abre la ventana
  // quedaría fuera por empezar el día 4.
  const desde = opciones.desde?.slice(0, 7);
  const hasta = opciones.hasta?.slice(0, 7);

  return cobros
    .filter((c) => c.cuentaId === cuentaId)
    .filter((c) => (desde ? c.mes >= desde : true))
    .filter((c) => (hasta ? c.mes <= hasta : true))
    .filter((c) => (opciones.soloCerrados ? c.estado === 'cerrado' : true));
}
