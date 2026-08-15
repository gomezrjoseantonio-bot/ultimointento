// ============================================================================
// Conciliar el extracto contra lo que YA tenías anotado (Confirmado)
// ============================================================================
//
// La secuencia es previsto → confirmado / conciliado. El emparejador de
// previstos (`movementMatchingService`) solo mira previsiones `predicted`, así
// que no ve un movimiento que el usuario anotó a mano —Confirmado, "sus ojos lo
// vieron"—. Resultado para quien hace "las dos cosas" (anota a mano Y sube el
// fichero): la línea del banco no cuadra con su confirmado, se duplica, y solo
// se puede ignorar.
//
// Aquí se cierra ese hueco: una línea del extracto que coincide con un
// confirmado que ya tenías es ESE mismo movimiento visto por el banco. Al
// guardar, el confirmado SUBE a Conciliado (evidencia más fuerte: hay extracto)
// y la línea duplicada no se materializa. No inventa nada: exige misma cuenta,
// mismo importe con su signo y la fecha cerca —el banco valora un día o dos
// distinto del que tú apuntaste—.
// ============================================================================

import type { Movement } from './db';

export interface MovimientoConfirmadoRef {
  id: number;
  descripcion: string;
  /** Con signo · negativo gasto, positivo ingreso. */
  importe: number;
  /** YYYY-MM-DD. */
  fecha: string;
}

export interface EmparejarConfirmadosOpts {
  /** Ventana de días entre la fecha del banco y la que anotaste. */
  ventanaDias?: number;
}

const VENTANA_DIAS_DEFECTO = 5;

/**
 * Un confirmado que puede casar con una línea del extracto.
 *
 * Solo lo anotado a mano ("tu palabra"): lo importado ya es del banco, lo
 * conciliado ya tiene su extracto, y una pata de traspaso o una compra a
 * crédito no son un cargo suelto de la cuenta que el extracto liste como tal.
 */
function esConfirmadoEmparejable(m: Movement): boolean {
  if (m.id == null) return false;
  if (m.source !== 'manual') return false;
  if (m.unifiedStatus === 'conciliado') return false;
  if (m.isOpeningBalance) return false;
  if (m.transferMetadata || m.is_transfer) return false;
  // Una compra a crédito no mueve la cuenta el día de la compra (sale en el
  // recibo), así que no le corresponde una línea del extracto de la cuenta.
  if (m.gastoTarjetaCredito) return false;
  return true;
}

function centimos(importe: number): number {
  return Math.round(importe * 100);
}

function soloFecha(valor: string | undefined): string {
  return (valor ?? '').slice(0, 10);
}

function diasEntre(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((ta - tb) / 86_400_000));
}

/**
 * Empareja líneas del extracto recién importadas con confirmados existentes.
 * Devuelve `importMovementId → confirmadoMovementId`.
 *
 * 1:1 · cada confirmado casa con UNA sola línea (la de fecha más cercana) y
 * cada línea con UN solo confirmado. Sin esto, dos cargos iguales del mismo día
 * podrían apuntar los dos al mismo confirmado y borrar de más.
 */
export function emparejarConfirmados(
  lineasImport: Movement[],
  confirmados: Movement[],
  opts: EmparejarConfirmadosOpts = {}
): Map<number, number> {
  const ventana = opts.ventanaDias ?? VENTANA_DIAS_DEFECTO;
  const elegibles = confirmados.filter(esConfirmadoEmparejable);

  // Todas las parejas posibles, con su distancia en días.
  const parejas: Array<{ lineaId: number; confirmadoId: number; dias: number }> = [];
  for (const linea of lineasImport) {
    if (linea.id == null) continue;
    const centsLinea = centimos(linea.amount);
    const fechaLinea = soloFecha(linea.date);
    for (const c of elegibles) {
      if (c.accountId !== linea.accountId) continue;
      if (centimos(c.amount) !== centsLinea) continue; // mismo importe Y signo
      const dias = diasEntre(fechaLinea, soloFecha(c.date));
      if (dias > ventana) continue;
      parejas.push({ lineaId: linea.id, confirmadoId: c.id!, dias });
    }
  }

  // La más cercana primero · a igualdad, orden estable por ids para no depender
  // del recorrido.
  parejas.sort(
    (a, b) => a.dias - b.dias || a.lineaId - b.lineaId || a.confirmadoId - b.confirmadoId
  );

  const resultado = new Map<number, number>();
  const confirmadosUsados = new Set<number>();
  for (const p of parejas) {
    if (resultado.has(p.lineaId)) continue;
    if (confirmadosUsados.has(p.confirmadoId)) continue;
    resultado.set(p.lineaId, p.confirmadoId);
    confirmadosUsados.add(p.confirmadoId);
  }
  return resultado;
}

/**
 * Lo que necesita la sesión de extracto para pintar el cuadre: por cada línea
 * del import, la referencia del confirmado con el que casa. Compone el
 * emparejamiento y busca los datos del confirmado, para que el drawer lo llame
 * en una línea sin conocer los detalles.
 */
export function confirmadosPorLinea(
  lineasImport: Movement[],
  movimientos: Movement[],
  accountId: number,
  opts?: EmparejarConfirmadosOpts
): Map<number, MovimientoConfirmadoRef> {
  const idsLote = new Set(lineasImport.map((m) => m.id).filter((id): id is number => id != null));
  // Los confirmados de ESTA cuenta, sin las propias líneas del lote.
  const confirmados = movimientos.filter(
    (m) => m.accountId === accountId && m.id != null && !idsLote.has(m.id)
  );
  const emparejados = emparejarConfirmados(lineasImport, confirmados, opts);

  const porId = new Map<number, Movement>();
  for (const m of confirmados) if (m.id != null) porId.set(m.id, m);

  const refs = new Map<number, MovimientoConfirmadoRef>();
  for (const [lineaId, confirmadoId] of emparejados) {
    const c = porId.get(confirmadoId);
    if (!c) continue;
    refs.set(lineaId, {
      id: confirmadoId,
      descripcion: c.description,
      importe: c.amount,
      fecha: soloFecha(c.date),
    });
  }
  return refs;
}
