// ============================================================================
// El año 0 de los gastos recurrentes · poblar el pasado como PREVISTO
// ============================================================================
//
// El motor de recurrentes proyecta desde el día 1 del mes en curso hacia
// delante (`compromisosRecurrentesService.ts:584-588`), así que el pasado del
// ejercicio está vacío en tesorería: no hay nada que confirmar a mano ni contra
// lo que cuadrar el extracto cuando se sube.
//
// Esto lo rellena, del SUELO que calcula C0 (`sueloReconstruccion.ts`) hasta
// AYER. Hoy no es pasado: de hoy en adelante ya emite la vía viva, y emitir
// aquí lo mismo sería pisarse con ella.
//
// Lo generado nace PREVISTO, que es lo que lo hace seguro: un `predicted` no
// entra en el saldo (`accountBalanceService.ts:24-26`), así que reconstruir el
// pasado NO mueve el dinero de hoy. Solo pone trabajo sobre la mesa.
//
// Y solo AÑADE. La escritura va por `persistirPrevisionesCompromiso`, que salta
// las claves de origen ya ocupadas: un mes que ya tiene su previsión —o su
// confirmado, o su conciliado, o su descartado— no se toca ni se duplica.
// Nunca se borra nada desde aquí.
// ============================================================================

import type { CompromisoRecurrente } from '../types/compromisosRecurrentes';
import type { Account, TreasuryEvent } from './db';
import { initDB } from './db';
import { toISODateLocal } from '../utils/recurrenceDateUtils';
import { obtenerSueloReconstruccion } from './sueloReconstruccion';
import {
  listarCompromisos,
  generarEventosDesdeCompromiso,
} from './personal/compromisosRecurrentesService';
import { persistirPrevisionesCompromiso } from './personal/previsionesDelCompromiso';
import { tarjetaDelCompromiso } from './personal/recibosDeTarjetaPrevistos';
import { elMetodoDecideLaCuenta } from './cuentasPorMetodoPago';

/** Fecha local a medianoche · sin arrastrar la hora a las comparaciones. */
function aFecha(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d);
}

function elDiaAntes(iso: string): Date {
  const f = aFecha(iso);
  f.setDate(f.getDate() - 1);
  return f;
}

/**
 * De dónde a dónde se reconstruye este compromiso · `null` si no hay pasado.
 *
 * El suelo lo pone C0, pero un gasto que empezó DESPUÉS manda sobre él: uno
 * dado de alta el 24 de febrero no debe nada de enero. Y el techo es siempre
 * ayer.
 *
 * Devuelve `null` cuando la ventana se queda vacía o del revés, que es lo que
 * pasa con un gasto que empieza hoy o más adelante, con uno que terminó antes
 * del suelo, y el 1 de enero —donde ayer cae ya en el ejercicio anterior, por
 * debajo del suelo que la franja fijó—.
 */
export function ventanaDelPasado(
  compromiso: CompromisoRecurrente,
  suelo: string,
  hoy: string,
): { desde: Date; hasta: Date } | null {
  const hasta = elDiaAntes(hoy);
  const inicio = aFecha(compromiso.fechaInicio);
  const sueloFecha = aFecha(suelo);
  const desde = inicio.getTime() > sueloFecha.getTime() ? inicio : sueloFecha;

  if (desde.getTime() > hasta.getTime()) return null;

  // Un gasto que dejó de cobrarse antes de la ventana no tiene nada aquí. El
  // recorte fino por `fechaFin` lo hace el motor; esto solo evita pedirle un
  // rango que no puede tener nada.
  if (compromiso.fechaFin) {
    const fin = aFecha(compromiso.fechaFin);
    if (fin.getTime() < desde.getTime()) return null;
  }

  return { desde, hasta };
}

export interface ResultadoReconstruccion {
  /** Suelo aplicado · el que devolvió C0. */
  suelo: string;
  /** Techo aplicado · ayer. */
  hasta: string;
  compromisosVistos: number;
  eventosCreados: number;
  errores: Array<{ compromisoId: number; mensaje: string }>;
}

/**
 * Puebla el pasado del ejercicio con los cargos de los gastos recurrentes.
 *
 * Idempotente: ejecutarlo una vez o cinco deja el mismo resultado, porque la
 * escritura salta las claves de origen ocupadas. NO borra, NO reescribe y NO
 * toca el saldo.
 *
 * Un fallo en un compromiso no aborta el resto: se acumula y se sigue, igual
 * que en el bootstrap.
 */
export async function reconstruirRecurrentesDelPasado(
  hoy: string = toISODateLocal(new Date()),
): Promise<ResultadoReconstruccion> {
  const suelo = await obtenerSueloReconstruccion(hoy);
  const resultado: ResultadoReconstruccion = {
    suelo,
    hasta: toISODateLocal(elDiaAntes(hoy)),
    compromisosVistos: 0,
    eventosCreados: 0,
    errores: [],
  };

  const compromisos = await listarCompromisos({ soloActivos: true });

  // Las cuentas solo hacen falta cuando la forma de pago decide la cuenta
  // (efectivo, Bizum). Se leen una vez para todos en lugar de por gasto.
  const necesitaCuentas = compromisos.some((c) => elMetodoDecideLaCuenta(c.metodoPago));
  const cuentas: Account[] = necesitaCuentas
    ? (((await (await initDB()).getAll('accounts')) ?? []) as Account[])
    : [];

  for (const compromiso of compromisos) {
    if (compromiso.id == null) continue;
    resultado.compromisosVistos += 1;

    try {
      const ventana = ventanaDelPasado(compromiso, suelo, hoy);
      if (!ventana) continue;

      // Se llama al motor con la tarjeta y las cuentas, NO por
      // `generarEventosHistoricos`: esa las omite, y sin tarjeta `vaEnRecibo`
      // devuelve siempre false. Un gasto pagado con crédito aplazado saldría
      // aquí como cargo propio además de dentro del recibo de su tarjeta, que
      // es cobrarlo dos veces.
      const tarjeta = await tarjetaDelCompromiso(compromiso);
      const eventos: Array<Omit<TreasuryEvent, 'id'>> = generarEventosDesdeCompromiso(
        compromiso,
        ventana.hasta,
        ventana.desde,
        tarjeta,
        cuentas,
      );

      resultado.eventosCreados += await persistirPrevisionesCompromiso(
        compromiso.id,
        eventos,
      );
    } catch (err) {
      resultado.errores.push({
        compromisoId: compromiso.id,
        mensaje: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return resultado;
}
