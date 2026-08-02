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
import { esPendiente, importeConSigno } from '../../../services/tesoreriaV6Metrics';

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
  /** Saldo tras aplicar todo lo pendiente · si es negativo, la cuenta se queda corta. */
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
  aliasInmueble?: (id: number | string) => string | undefined;
}): GrupoCuentaMovil[] {
  const { cuentas, eventos, saldoPorCuenta, aliasInmueble } = params;

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
    const saldoHoy = saldoPorCuenta.get(c.id) ?? 0;
    const saldoProyectado =
      Math.round((saldoHoy + pendientes.reduce((s, p) => s + p.importe, 0)) * 100) / 100;

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
