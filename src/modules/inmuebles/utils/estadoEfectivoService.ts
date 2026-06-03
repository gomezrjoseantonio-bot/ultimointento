// REORG Contratos · Commit 3 · estado EFECTIVO calculado por fechas en runtime.
//
// El estado de un contrato (vigente/próximo/finalizado) NO se persiste ni se lee
// de `estadoContrato`: se calcula SIEMPRE a partir de `fechaInicio`/`fechaFin`.
// Esto resuelve de raíz el bug de producción (60 Rentila finalizados aparecían en
// Activos) y da auto-promoción: un contrato `proximo` pasa a `vigente` solo al
// releer cuando llega su `fechaInicio`, sin job nocturno.
//
// Reglas (spec § 1.1):
//   · `fechaFin` null o sentinel `2099-12-31` → nunca `finalizado` (sigue vigente)
//   · `fechaInicio === hoy` → `vigente` (no `proximo`)
//   · `fechaFin === hoy` → `vigente` (último día contado)
//   · cálculo en runtime · cacheado por sesión (WeakMap por identidad de objeto)

import type { Contract, Property } from '../../../services/db';
import { esFechaIndefinida } from './formatFechaFin';
import { parseIsoDateAsUTC } from '../../../utils/recurrenceDateUtils';

export type EstadoEfectivo = 'vigente' | 'proximo' | 'finalizado';

export type TabKey =
  | 'disponibilidad'
  | 'vigentes'
  | 'proximos'
  | 'historico'
  | 'analisis'
  | 'conciliar';

const MS_DIA = 1000 * 60 * 60 * 24;

/** Día UTC (medianoche) de una fecha cualquiera · para comparar contra fechas
 *  de contrato, que `parseIsoDateAsUTC` produce como medianoche UTC. */
const diaUTC = (d: Date): number =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

function computeEstadoEfectivo(contract: Contract, hoy: Date): EstadoEfectivo {
  const hoyUTC = diaUTC(hoy);

  // Fin · indefinido (null/''/2099) nunca finaliza.
  const finIndefinido = esFechaIndefinida(contract.fechaFin);
  const finMs = finIndefinido ? null : parseIsoDateAsUTC(contract.fechaFin).getTime();
  if (finMs != null && !Number.isNaN(finMs) && finMs < hoyUTC) return 'finalizado';

  // Inicio · si empieza en el futuro → próximo (inicio === hoy → vigente).
  const inicioMs = contract.fechaInicio
    ? parseIsoDateAsUTC(contract.fechaInicio).getTime()
    : NaN;
  if (!Number.isNaN(inicioMs) && inicioMs > hoyUTC) return 'proximo';

  return 'vigente';
}

// Caché por sesión · clave = identidad del Contract, invalidada al cambiar de día.
const cacheEstado = new WeakMap<Contract, { dayKey: number; estado: EstadoEfectivo }>();

/**
 * Estado efectivo del contrato a fecha `hoy` (default: hoy del sistema).
 *
 * Cuando `hoy` se omite, cachea el resultado por sesión (invalidado al cambiar
 * de día). Cuando se pasa `hoy` explícito (tests / cálculos deterministas) se
 * computa fresco sin tocar la caché.
 */
export function getEstadoEfectivo(contract: Contract, hoy?: Date): EstadoEfectivo {
  if (hoy) return computeEstadoEfectivo(contract, hoy);

  const ahora = new Date();
  const dayKey = diaUTC(ahora);
  const hit = cacheEstado.get(contract);
  if (hit && hit.dayKey === dayKey) return hit.estado;

  const estado = computeEstadoEfectivo(contract, ahora);
  cacheEstado.set(contract, { dayKey, estado });
  return estado;
}

/**
 * Días naturales hasta `fechaFin` (ceil). `null` si el fin es indefinido o
 * inválido. Puede ser negativo si ya venció — los consumidores deben filtrar
 * `>= 0` cuando proceda (el bug de "días negativos" venía de no hacerlo).
 */
export function diasHastaFin(contract: Contract, hoy: Date = new Date()): number | null {
  if (esFechaIndefinida(contract.fechaFin)) return null;
  const fin = parseIsoDateAsUTC(contract.fechaFin);
  if (Number.isNaN(fin.getTime())) return null;
  return Math.ceil((fin.getTime() - diaUTC(hoy)) / MS_DIA);
}

/** Filtra contratos por estado efectivo. */
export function filtrarPorEstadoEfectivo(
  contracts: Contract[],
  estado: EstadoEfectivo,
  hoy?: Date,
): Contract[] {
  return contracts.filter((c) => getEstadoEfectivo(c, hoy) === estado);
}

/**
 * Unidades arrendables totales de la cartera (spec § 2.2):
 *   · 1 por inmueble `piso_completo`
 *   · N por inmueble `por_habitaciones`/`mixto` (N = `explotacion.unidadesArrendables`
 *     si está definido, en su defecto `bedrooms`, mínimo 1)
 * Excluye inmuebles no activos (`state !== 'activo'`).
 */
export function calcularUnidadesArrendables(properties: Property[]): number {
  let total = 0;
  for (const p of properties) {
    if (p.id == null) continue;
    if (p.state && p.state !== 'activo') continue;
    const porHabitaciones =
      p.modoExplotacion === 'por_habitaciones' || p.modoExplotacion === 'mixto';
    if (porHabitaciones) {
      total += Math.max(1, p.explotacion?.unidadesArrendables ?? p.bedrooms ?? 1);
    } else {
      total += 1;
    }
  }
  return total;
}
