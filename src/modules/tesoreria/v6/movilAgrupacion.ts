// ============================================================================
// Tesorería V6 · §4.11 · móvil · pendientes agrupados por cuenta
// ============================================================================
//
// En escritorio la unidad de trabajo es la CUENTA: entras en una y confirmas
// dentro. En el móvil no hay sitio para ese rodeo, así que la pantalla es una
// sola lista con los pendientes de todas las cuentas, separados por cuenta y
// confirmables con el pulgar.
//
// El orden lo manda el pulgar, no la contabilidad: primero las cuentas que se
// quedan cortas —que son las que exigen una decisión— y dentro de cada una por
// fecha, que es como se leen los recibos.
// ============================================================================

import type { Account, TreasuryEvent } from '../../../services/db';
import { cierrePorCuenta, esPendiente, importeConSigno } from '../../../services/tesoreriaV6Metrics';

export interface PendienteMovil {
  eventoId: number;
  concepto: string;
  /** Segunda línea · inmueble, o lo que deje claro de qué va el cargo. */
  detalle: string;
  importe: number;
  fecha: string;
}

export interface GrupoCuentaMovil {
  cuenta: Account;
  pendientes: PendienteMovil[];
  /**
   * Cierre del mes proyectado de la cuenta (`cierrePorCuenta` · la función
   * canónica V9) · si es negativo, la cuenta se queda corta.
   */
  saldoProyectado: number;
  seQuedaCorta: boolean;
}

/**
 * Agrupa los pendientes por cuenta, ya ordenados para el pulgar.
 *
 * Las cuentas sin nada pendiente NO aparecen: la pantalla es una lista de cosas
 * que hacer, y una cuenta al día no es una cosa que hacer.
 */
export function agruparPendientesPorCuenta(params: {
  cuentas: Account[];
  eventos: TreasuryEvent[];
  saldoPorCuenta: Map<number, number>;
  year: number;
  month0: number;
  aliasInmueble?: (id: number | string) => string | undefined;
}): GrupoCuentaMovil[] {
  const { cuentas, eventos, saldoPorCuenta, year, month0, aliasInmueble } = params;

  // Los eventos crudos de cada cuenta · los pide `cierrePorCuenta`, que aplica
  // su propio filtro (el canónico, con traspasos internos fuera).
  const eventosPorCuenta = new Map<number, TreasuryEvent[]>();
  for (const e of eventos) {
    if (e.accountId == null) continue;
    const arr = eventosPorCuenta.get(e.accountId);
    if (arr) arr.push(e);
    else eventosPorCuenta.set(e.accountId, [e]);
  }

  const porCuenta = new Map<number, PendienteMovil[]>();
  for (const e of eventos) {
    if (!esPendiente(e) || e.id == null || e.accountId == null) continue;
    // §6.3 · también aquí manda QUIEN COBRA: en el móvil se puntea con el
    // extracto del banco abierto al lado, así que la fila tiene que decir lo
    // mismo que ese extracto. La categoría de ATLAS y el inmueble bajan al
    // subtítulo, igual que en el escritorio.
    const inmueble =
      e.inmuebleAlias ??
      (e.inmuebleId != null ? aliasInmueble?.(e.inmuebleId) : undefined) ??
      '';
    const categoria = e.proveedor && e.description !== e.proveedor ? e.description : '';
    const detalle = [categoria, inmueble].filter(Boolean).join(' · ');

    const item: PendienteMovil = {
      eventoId: e.id,
      concepto: e.proveedor || e.description,
      detalle,
      importe: importeConSigno(e),
      fecha: (e.predictedDate ?? '').slice(0, 10),
    };
    const arr = porCuenta.get(e.accountId);
    if (arr) arr.push(item);
    else porCuenta.set(e.accountId, [item]);
  }

  const grupos: GrupoCuentaMovil[] = [];
  for (const c of cuentas) {
    if (c.id == null) continue;
    const pendientes = porCuenta.get(c.id);
    if (!pendientes || pendientes.length === 0) continue;

    pendientes.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.eventoId - b.eventoId);
    // La función canónica de cierre (V9): antes se sumaban aquí TODOS los
    // pendientes, sin tope de mes y con las patas de los traspasos internos
    // dentro, y esta cifra podía discrepar del hero y del drawer.
    const saldoProyectado = cierrePorCuenta({
      saldoHoy: saldoPorCuenta.get(c.id) ?? 0,
      eventos: eventosPorCuenta.get(c.id) ?? [],
      year,
      month0,
    }).cierre;

    grupos.push({
      cuenta: c,
      pendientes,
      saldoProyectado,
      seQuedaCorta: saldoProyectado < 0,
    });
  }

  // Las cuentas que se quedan cortas van primero: son las únicas donde
  // confirmar o no cambia lo que el usuario tiene que hacer hoy. El resto
  // conserva el orden que el propio usuario dio a sus tarjetas (§4.2).
  //
  // Partición explícita y no `sort`: aunque desde ES2019 el orden es estable,
  // "conserva el orden del usuario" es un requisito, no un efecto secundario
  // afortunado del motor. Así se lee lo que hace y no depende de nada.
  const cortas = grupos.filter((g) => g.seQuedaCorta);
  const holgadas = grupos.filter((g) => !g.seQuedaCorta);
  return [...cortas, ...holgadas];
}

/** Cuántos pendientes hay en total · el contador de la cabecera. */
export function contarPendientes(grupos: GrupoCuentaMovil[]): number {
  return grupos.reduce((n, g) => n + g.pendientes.length, 0);
}
