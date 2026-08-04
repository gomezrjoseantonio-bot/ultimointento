// ============================================================================
// Los recibos domiciliados en una cuenta, mes a mes · VOCABULARIO §6 ter
// ============================================================================
//
// La tercera fuente de §6 ter, y la última que se puede mirar contra los
// movimientos: lo que queda —seguros, alarma— se prueba con una póliza o un
// contrato, no con un cargo.
//
// El banco pide «tener domiciliados al menos N recibos». Lo que cuenta es
// **cuántos distintos**, no cuántos cargos: tres recibos domiciliados son tres
// servicios, no el de la luz tres meses seguidos. Por eso se cuentan orígenes
// —el compromiso recurrente que los emite— y no eventos.
//
// El dato ya existe: un recibo domiciliado es un `TreasuryEvent` de gasto con
// `paymentMethod` de domiciliación y la cuenta que decide el método (§2, §3.2).
//
// Puro: no lee la base. Quien llame le pasa los eventos.
// ============================================================================

import type { TreasuryEvent } from '../db';
import { yaSeCobro } from '../gastoPorTarjeta';
import { metodoDeMovimiento } from '../metodoDePago';

/** Los recibos domiciliados en UNA cuenta y UN mes. */
export interface RecibosDeUnMes {
  cuentaId: number;
  /** El mes, `YYYY-MM`. */
  mes: string;
  /** Cuántos recibos DISTINTOS se cargaron · no cuántos cargos. */
  cuantos: number;
  /**
   * `cerrado` = todos sus cargos se cobraron y cuadraron contra el extracto.
   *
   * Igual que en la nómina: un mes con algo aún por cargar todavía puede
   * crecer, y darlo por cerrado diría que ese mes se quedó corto de recibos
   * cuando aún falta que pasen.
   */
  estado: 'cerrado' | 'abierto';
}

/** Lo que el banco reconoce como domiciliación · una sola traducción (§5). */
const DOMICILIADO = metodoDeMovimiento('domiciliacion');

/**
 * Qué recibo es este · lo que permite contar «distintos».
 *
 * El origen del cargo (`sourceId` del recurrente que lo emite) y no el evento:
 * doce cargos de la luz en un año son UN recibo domiciliado. Sin origen —un
 * apunte suelto— vale su propia descripción, que es lo único que lo distingue.
 */
function quienEsElRecibo(ev: TreasuryEvent): string {
  if (ev.sourceId != null) return `${ev.sourceType}:${ev.sourceId}`;
  return `desc:${ev.description}`;
}

/**
 * Los recibos domiciliados, agrupados por (cuenta · mes).
 *
 * Un cargo descartado no cuenta: el usuario dijo que no ocurre, así que ese
 * recibo no está domiciliado ese mes.
 */
export function recibosDomiciliados(eventos: TreasuryEvent[]): RecibosDeUnMes[] {
  const porClave = new Map<string, { cuentaId: number; mes: string; quienes: Set<string>; abierto: boolean }>();

  for (const ev of eventos) {
    if (ev.type !== 'expense' || ev.paymentMethod !== DOMICILIADO) continue;
    if (ev.descartado === true) continue;
    if (ev.accountId == null) continue;

    const fecha = ev.actualDate ?? ev.predictedDate;
    if (typeof fecha !== 'string' || fecha.length < 7) continue;
    const mes = fecha.slice(0, 7);

    const clave = `${ev.accountId}|${mes}`;
    const previo = porClave.get(clave) ?? {
      cuentaId: ev.accountId,
      mes,
      quienes: new Set<string>(),
      abierto: false,
    };

    previo.quienes.add(quienEsElRecibo(ev));
    previo.abierto = previo.abierto || !yaSeCobro(ev);
    porClave.set(clave, previo);
  }

  return [...porClave.values()]
    .map((m) => ({
      cuentaId: m.cuentaId,
      mes: m.mes,
      cuantos: m.quienes.size,
      estado: m.abierto ? ('abierto' as const) : ('cerrado' as const),
    }))
    .sort((a, b) => b.mes.localeCompare(a.mes));
}

/** Los meses de una cuenta, del más reciente al más antiguo. */
export function recibosDeLaCuenta(
  meses: RecibosDeUnMes[],
  cuentaId: number,
  opciones: { desde?: string; hasta?: string; soloCerrados?: boolean } = {}
): RecibosDeUnMes[] {
  // Por el MES de cada extremo · la ventana viene en días y el mes en que abre
  // se caería fuera entero por empezar el día 4.
  const desde = opciones.desde?.slice(0, 7);
  const hasta = opciones.hasta?.slice(0, 7);

  return meses
    .filter((m) => m.cuentaId === cuentaId)
    .filter((m) => (desde ? m.mes >= desde : true))
    .filter((m) => (hasta ? m.mes <= hasta : true))
    .filter((m) => (opciones.soloCerrados ? m.estado === 'cerrado' : true));
}
