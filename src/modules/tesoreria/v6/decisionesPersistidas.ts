// ============================================================================
// E1.3 · las decisiones de la sesión, persistidas en la línea
// ============================================================================
//
// Hasta E1.3 las decisiones (asignar, ignorar, traspaso, efectivo, crear…)
// vivían SOLO en la memoria de React (`decisionesDeSesion`). Cerrar la pestaña
// era perder todo el trabajo y dejar un lote a medias que nadie ofrecía retomar.
//
// Aquí cada decisión se guarda TAMBIÉN en la fila de `lineasExtracto` de su
// línea (`decision`), y al reabrir un lote a medias `DecisionesSesion` se
// reconstruye desde esas filas. La memoria de React sigue mandando en la UI
// reactiva; esto es su copia durable.
//
// Lo que NO hace (E1.5): tocar cuándo nace el movimiento. Importar sigue
// creando los movimientos; ignorar sigue sin sacarlos del saldo (§29: silenciar
// un recordatorio no es un estado de dinero) y sigue siendo reversible.
// ============================================================================

import { initDB } from '../../../services/db';
import type {
  DecisionDeLineaPersistida,
  ImportBatch,
  LineaExtractoPersistida,
} from '../../../services/db';
import { lineasDelLote } from '../../../services/lineasExtractoService';
import { decisionesVacias, type DecisionesSesion } from './extractoSesion';

export { lineasDelLote };

/**
 * La foto de las decisiones de UNA línea, sacada de `DecisionesSesion`.
 * `undefined` si el usuario no ha decidido nada sobre ella.
 *
 * Es la serialización directa de las siete estructuras, sin interpretar: así
 * `decisionesDesdeFilas(guardar(d)) ≡ d` para cualquier combinación.
 */
export function decisionDeLinea(
  d: DecisionesSesion,
  lineaId: number,
  ahora: string
): DecisionDeLineaPersistida | undefined {
  const asignadoA = d.asignados.get(lineaId);
  const traspasoA = d.aTraspaso.get(lineaId);
  const decision: DecisionDeLineaPersistida = {
    ...(asignadoA != null ? { asignadoA } : {}),
    ...(d.ignorados.has(lineaId) ? { ignorada: true as const } : {}),
    ...(d.creados.has(lineaId) ? { creada: true as const } : {}),
    ...(d.recuperados.has(lineaId) ? { recuperada: true as const } : {}),
    ...(d.aEfectivo.has(lineaId) ? { aEfectivo: true as const } : {}),
    ...(traspasoA != null ? { traspasoA } : {}),
    ...(d.desemparejados.has(lineaId) ? { desemparejada: true as const } : {}),
    decididaAt: ahora,
  };
  return Object.keys(decision).length > 1 ? decision : undefined;
}

/** ¿Son la misma decisión? · `decididaAt` no cuenta: es cuándo, no qué. */
export function mismaDecision(
  a: DecisionDeLineaPersistida | undefined,
  b: DecisionDeLineaPersistida | undefined
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.asignadoA === b.asignadoA &&
    a.ignorada === b.ignorada &&
    a.creada === b.creada &&
    a.recuperada === b.recuperada &&
    a.aEfectivo === b.aEfectivo &&
    a.traspasoA === b.traspasoA &&
    a.desemparejada === b.desemparejada
  );
}

/** Todas las lineaIds que aparecen en alguna de las siete estructuras. */
function lineaIdsDe(d: DecisionesSesion): Set<number> {
  const s = new Set<number>();
  for (const k of d.asignados.keys()) s.add(k);
  for (const k of d.ignorados) s.add(k);
  for (const k of d.creados) s.add(k);
  for (const k of d.recuperados) s.add(k);
  for (const k of d.aEfectivo) s.add(k);
  for (const k of d.aTraspaso.keys()) s.add(k);
  for (const k of d.desemparejados) s.add(k);
  return s;
}

export interface CambioDeDecision {
  lineaId: number;
  /** `undefined` = el usuario deshizo todo lo que había decidido sobre la línea. */
  decision: DecisionDeLineaPersistida | undefined;
}

/**
 * Qué líneas cambiaron de decisión entre dos estados de la sesión.
 *
 * Es lo que se persiste tras cada gesto: solo las líneas tocadas, con su foto
 * nueva. Un gesto en bloque (ignorar veintiocho) devuelve veintiocho cambios.
 */
export function cambiosDeDecision(
  antes: DecisionesSesion,
  despues: DecisionesSesion,
  ahora: string
): CambioDeDecision[] {
  const ids = new Set<number>([...lineaIdsDe(antes), ...lineaIdsDe(despues)]);
  const cambios: CambioDeDecision[] = [];
  for (const lineaId of ids) {
    const a = decisionDeLinea(antes, lineaId, ahora);
    const b = decisionDeLinea(despues, lineaId, ahora);
    if (!mismaDecision(a, b)) cambios.push({ lineaId, decision: b });
  }
  return cambios;
}

/**
 * `DecisionesSesion` reconstruida desde las filas persistidas de un lote.
 *
 * Es la inversa exacta de `decisionDeLinea`: lo que se guardó vuelve a las
 * mismas siete estructuras, y la sesión se ve como se dejó.
 */
export function decisionesDesdeFilas(
  filas: ReadonlyArray<Pick<LineaExtractoPersistida, 'id' | 'decision'>>
): DecisionesSesion {
  const d = decisionesVacias();
  for (const f of filas) {
    if (f.id == null || !f.decision) continue;
    const x = f.decision;
    if (x.asignadoA != null) d.asignados.set(f.id, x.asignadoA);
    if (x.ignorada) d.ignorados.add(f.id);
    if (x.creada) d.creados.add(f.id);
    if (x.recuperada) d.recuperados.add(f.id);
    if (x.aEfectivo) d.aEfectivo.add(f.id);
    if (x.traspasoA != null) d.aTraspaso.set(f.id, x.traspasoA);
    if (x.desemparejada) d.desemparejados.add(f.id);
  }
  return d;
}

/**
 * Lo que la decisión dice sobre la ATENCIÓN de la línea (§29).
 *
 * Ignorar = `silenciada`: se calla el recordatorio, la línea sigue sin
 * clasificar, sigue en el saldo y se puede clasificar después. Recuperar una
 * ignorada = `recordar`. Ninguna de las dos es un estado de dinero.
 */
export function atencionDe(
  decision: DecisionDeLineaPersistida | undefined
): LineaExtractoPersistida['atencion'] {
  if (!decision) return undefined;
  if (decision.ignorada) return 'silenciada';
  if (decision.recuperada) return 'recordar';
  return undefined;
}

/** Si el usuario resolvió la línea con la mano (asignar, crear, efectivo, traspaso). */
export function comoSeResolvioDe(
  decision: DecisionDeLineaPersistida | undefined
): LineaExtractoPersistida['comoSeResolvio'] {
  if (!decision) return undefined;
  if (decision.asignadoA != null || decision.creada || decision.aEfectivo || decision.traspasoA != null) {
    return 'a_mano';
  }
  return undefined;
}

/**
 * Persiste la decisión de UNA línea en su fila de `lineasExtracto`.
 *
 * `decision` a `undefined` borra la decisión (el usuario deshizo el gesto).
 * `estado`, `movementIds` y el crudo del banco NO se tocan: E1.3 no cambia
 * cuándo nace el movimiento ni qué cuenta en el saldo.
 */
export async function guardarDecisionDeLinea(
  lineaId: number,
  decision: DecisionDeLineaPersistida | undefined,
  ahora: string = new Date().toISOString()
): Promise<void> {
  const db = await initDB();
  const fila = (await db.get('lineasExtracto', lineaId)) as LineaExtractoPersistida | undefined;
  if (!fila) throw new Error(`E1.3 · la línea ${lineaId} no existe en lineasExtracto`);
  const { decision: _anterior, atencion: _at, comoSeResolvio: _c, ...resto } = fila;
  const atencion = atencionDe(decision);
  const comoSeResolvio = comoSeResolvioDe(decision);
  await db.put('lineasExtracto', {
    ...resto,
    ...(decision ? { decision } : {}),
    ...(atencion ? { atencion } : {}),
    ...(comoSeResolvio ? { comoSeResolvio } : {}),
    updatedAt: ahora,
  } as LineaExtractoPersistida);
}

/** Un lote sin guardar que se puede retomar. */
export interface LoteAMedias {
  importBatchId: string;
  filename: string;
  accountId: number;
  timestampImport: string;
  /** Líneas del lote que generaron movimiento (las que la sesión enseña). */
  lineas: number;
  /** De ellas, las que ya tienen una decisión persistida. */
  decididas: number;
}

/**
 * Los lotes que tienen líneas persistidas y NO se han guardado.
 *
 * Un batch anterior a V91 no tiene líneas y por tanto no se puede retomar
 * (no hay identidad de sesión): no sale en la lista. Ordenados del más
 * reciente al más antiguo.
 */
export async function lotesAMedias(): Promise<LoteAMedias[]> {
  const db = await initDB();
  const batches = ((await db.getAll('importBatches')) ?? []) as ImportBatch[];
  const out: LoteAMedias[] = [];
  for (const b of batches) {
    if (!b.id || b.consolidadoAt) continue;
    const filas = await lineasDelLote(db, b.id);
    const conMovimiento = filas.filter((f) => f.movementIds.length > 0);
    if (conMovimiento.length === 0) continue;
    out.push({
      importBatchId: b.id,
      filename: b.filename,
      accountId: b.accountId,
      timestampImport: b.timestampImport,
      lineas: conMovimiento.length,
      decididas: conMovimiento.filter((f) => f.decision != null).length,
    });
  }
  return out.sort((a, b) => (a.timestampImport < b.timestampImport ? 1 : -1));
}
