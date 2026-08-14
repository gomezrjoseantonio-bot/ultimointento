// Detección de meses cuyo cargo REAL ya está confirmado, para no reemitir su
// previsión al regenerar un gasto recurrente.
//
// El caso: un recibo domiciliado VARIABLE —el gas: previsto 30 €, real 13,38 €—
// cuyo cargo real ya entró por el extracto pero quedó SIN enlazar con su
// previsión. Al regenerar el compromiso se volvía a emitir el previsto, así que
// el saldo descontaba los dos (el real 13,38 confirmado + el previsto 30
// fantasma). Aquí se detecta ese cargo por proveedor + cuenta + mes.

import { initDB } from '../db';
import type { Movement, TreasuryEvent } from '../db';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';

const sinAcentos = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * Meses (por cuenta, clave `accountId|YYYY-MM`) en los que YA hay un cargo REAL
 * de este mismo recibo. Conservador:
 *   · solo mira las cuentas donde ESTE recibo proyecta;
 *   · solo cuenta GASTOS (importe < 0);
 *   · exige que el texto del movimiento contenga el proveedor (≥ 3 letras), como
 *     hace el emparejador;
 *   · solo afecta a meses CON cargo real (pasados o en curso) · los futuros, sin
 *     movimiento, se proyectan igual.
 * Sin proveedor reconocible no filtra nada (devuelve conjunto vacío).
 */
export async function mesesConCargoReal(
  compromiso: CompromisoRecurrente,
  eventos: Array<Omit<TreasuryEvent, 'id'>>,
): Promise<Set<string>> {
  const proveedor = sinAcentos(
    compromiso.proveedor?.nombre || compromiso.conceptoBancario || '',
  );
  if (proveedor.length < 3) return new Set();

  const cuentasDelRecibo = new Set(
    eventos.map((e) => e.accountId).filter((a): a is number => a != null),
  );
  if (cuentasDelRecibo.size === 0) return new Set();

  const db = await initDB();
  const movimientos = ((await db.getAll('movements')) ?? []) as Movement[];
  const cubiertos = new Set<string>();
  for (const m of movimientos) {
    if (m.accountId == null || !cuentasDelRecibo.has(m.accountId)) continue;
    if (!(m.amount < 0)) continue; // un recibo es un GASTO
    const texto = sinAcentos(
      `${m.providerName ?? ''} ${m.counterparty ?? ''} ${m.description ?? ''}`,
    );
    if (!texto.includes(proveedor)) continue;
    const mes = String(m.valueDate || m.date || '').slice(0, 7);
    if (mes) cubiertos.add(`${m.accountId}|${mes}`);
  }
  return cubiertos;
}

/** Filtra los eventos previstos cuyo mes ya tiene el cargo real confirmado. */
export function sinMesesYaCobrados<T extends Pick<TreasuryEvent, 'accountId' | 'predictedDate'>>(
  eventos: T[],
  cubiertos: Set<string>,
): T[] {
  if (cubiertos.size === 0) return eventos;
  return eventos.filter(
    (e) => !cubiertos.has(`${e.accountId}|${String(e.predictedDate).slice(0, 7)}`),
  );
}
