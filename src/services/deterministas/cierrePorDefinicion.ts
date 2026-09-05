// E2.4 · Guardar lo reconocido contra una DEFINICIÓN · lo que escribe.
//
// `cierreDeterminista` cierra lo que casó contra un cuadro (préstamo, venta,
// inversión, nómina): deja el movimiento conciliado y anota el desglose en el
// origen. Lo reconocido contra una definición pide otra cosa, y en cada caso
// es exactamente lo que habría hecho el usuario a mano:
//
//   · RECURRENTE · la ficha · `gastoDesdeMovimiento` clasifica el movimiento y
//     escribe la fila fiscal, buscando antes la del recurrente en ese mes
//     (`origenIdRecurrente`) para no contarla dos veces (#1834).
//   · RENTA · el cobro del contrato · si el contrato tiene una previsión de
//     ese mes sin ejecutar (el mes en curso), se ejecuta ESA; si no (el
//     pasado), se registra el cobro como una previsión ya ejecutada apuntando
//     al movimiento, que es lo que deja el punteo manual. Así el cuadro de
//     cobros del contrato (§16.5 · `estadoCobroContratoService`) ve la renta
//     cobrada. El movimiento hereda piso y categoría `alquiler`.
//   · TRASPASO · según lo que se sepa: con cuenta al otro lado,
//     `convertirEnTraspaso` / `convertirEnEntradaDeTraspaso` (nace la pata
//     espejo, `source: 'manual'`); con la otra pata ya importada, se emparejan;
//     sin cuenta, se marca traspaso sin par. Nunca se inventa a dónde fue.
//
// Todo es repetible: un Guardar que falló a medias y se reintenta no escribe
// una segunda fila fiscal, un segundo cobro ni una segunda pata. La guarda es
// la misma que en `resolverPorRegla`: un movimiento que ya no era nuevo y ya
// está clasificado no se vuelve a resolver.

import type { initDB, Movement, TreasuryEvent } from '../db';
import type { OrigenDeterminista } from './tipos';
import { claveOrigenRecurrente, gastoDesdeMovimiento } from '../altaMovimientoService';
import {
  convertirEnEntradaDeTraspaso,
  convertirEnTraspaso,
  emparejarComoTraspaso,
  marcarComoTraspasoSinPar,
} from '../traspasoDesdeMovimiento';
import { RENT_SOURCE_TYPES } from '../../modules/inmuebles/utils/estadoCobroContratoService';
import { sinMarcaDeDescarte } from '../descarteDePrevision';

/**
 * La base tal como la devuelve `initDB` · solo el TIPO. Un `import type` sí
 * puede ir dentro de `typeof` en posición de tipo (TypeScript ≥ 3.8); el
 * valor `initDB` no se toca aquí: la base llega ya abierta desde el Guardar.
 */
type Base = Awaited<ReturnType<typeof initDB>>;

const MS_DIA = 86_400_000;
/** Una previsión de renta a menos de esto del cobro es la de ese mes. */
const DIAS_PARA_SER_LA_PREVISION_DEL_MES = 20;

function dia(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** La huella común · conciliado por el motor, con el nombre legible al lado. */
async function dejarConciliado(db: Base, movementId: number, o: OrigenDeterminista, ahora: string): Promise<void> {
  const m = (await db.get('movements', movementId)) as Movement | undefined;
  if (!m) return;
  await db.put('movements', {
    ...m,
    descripcionPrevision: o.titulo,
    unifiedStatus: 'conciliado',
    statusConciliacion: 'match_automatico',
    updatedAt: ahora,
  } as Movement);
}

// ─── recurrente ─────────────────────────────────────────────────────────────

async function cerrarRecurrente(o: OrigenDeterminista, m: Movement): Promise<boolean> {
  const compromisoId = Number(o.origenId);
  const r = await gastoDesdeMovimiento({
    movementId: m.id as number,
    inmuebleId: o.inmuebleId ?? null,
    concepto: m.description,
    importe: m.amount,
    fecha: m.date,
    categoryKey: o.categoryKey ?? null,
    ...(Number.isFinite(compromisoId) && compromisoId > 0
      ? { origenIdRecurrente: claveOrigenRecurrente(compromisoId, m.date) }
      : {}),
  });
  // `recurrentesQueCuadran` ya no reconoce un gasto de inmueble sin casilla;
  // esto es la red por si cambia.
  return r.resultado !== 'falta_casilla';
}

// ─── renta ──────────────────────────────────────────────────────────────────

/** La previsión de renta de ESE contrato y ESE mes que aún no se ejecutó, si la hay. */
async function previsionDelMes(db: Base, contratoId: number, fecha: string): Promise<TreasuryEvent | undefined> {
  let eventos: TreasuryEvent[] = [];
  try {
    eventos = ((await db.getAll('treasuryEvents')) ?? []) as TreasuryEvent[];
  } catch {
    return undefined;
  }
  const t = dia(fecha);
  const cerca = eventos.filter(
    (e) =>
      e.id != null &&
      e.type === 'income' &&
      RENT_SOURCE_TYPES.has(e.sourceType) &&
      (String(e.sourceId) === String(contratoId) || e.contratoId === contratoId) &&
      e.status !== 'executed' &&
      !!e.predictedDate &&
      Math.abs(dia(e.predictedDate) - t) <= DIAS_PARA_SER_LA_PREVISION_DEL_MES * MS_DIA,
  );
  return cerca.length === 1 ? cerca[0] : undefined;
}

/** ¿Ya hay un cobro registrado de este contrato apuntando a este movimiento? */
async function cobroYaRegistrado(db: Base, contratoId: number, movementId: number): Promise<boolean> {
  try {
    const eventos = ((await db.getAll('treasuryEvents')) ?? []) as TreasuryEvent[];
    return eventos.some(
      (e) =>
        RENT_SOURCE_TYPES.has(e.sourceType) &&
        (String(e.sourceId) === String(contratoId) || e.contratoId === contratoId) &&
        e.executedMovementId === movementId,
    );
  } catch {
    return false;
  }
}

async function cerrarRenta(db: Base, o: OrigenDeterminista, m: Movement, ahora: string): Promise<boolean> {
  const renta = o.renta;
  if (!renta) return false;
  const movementId = m.id as number;

  if (!(await cobroYaRegistrado(db, renta.contratoId, movementId))) {
    const prevista = await previsionDelMes(db, renta.contratoId, m.date);
    const ejecutado = {
      status: 'executed' as const,
      executedMovementId: movementId,
      executedAt: ahora,
      actualDate: m.date,
      // MAGNITUD, como el punteo manual (`treasuryConfirmationService:509`).
      actualAmount: Math.abs(m.amount),
      updatedAt: ahora,
    };
    if (prevista) {
      // El mes en curso · la previsión existe y se ejecuta, como haría el
      // cuadre con previsto. Igual que él, deja de estar descartada.
      await db.put('treasuryEvents', { ...sinMarcaDeDescarte(prevista), ...ejecutado } as TreasuryEvent);
    } else {
      // El pasado · el cobro se registra ya ejecutado. No es una previsión
      // fabricada (#1821/#1824): apunta al movimiento real y con su importe.
      const cobro: Omit<TreasuryEvent, 'id'> = {
        type: 'income',
        amount: Math.abs(m.amount),
        predictedDate: m.date,
        description: `Renta – ${renta.inquilino}`,
        counterparty: renta.inquilino || undefined,
        sourceType: 'contrato',
        sourceId: renta.contratoId,
        contratoId: renta.contratoId,
        accountId: m.accountId,
        ...(o.inmuebleId != null && o.inmuebleId > 0 ? { inmuebleId: o.inmuebleId } : {}),
        categoryKey: o.categoryKey ?? 'alquiler',
        ambito: 'INMUEBLE',
        generadoPor: 'user',
        createdAt: ahora,
        ...ejecutado,
      } as unknown as Omit<TreasuryEvent, 'id'>;
      await db.add('treasuryEvents', cobro as TreasuryEvent);
    }
  }

  await db.put('movements', {
    ...m,
    categoryKey: o.categoryKey ?? 'alquiler',
    ambito: 'INMUEBLE',
    ...(o.inmuebleId != null ? { inmuebleId: String(o.inmuebleId) } : {}),
    updatedAt: ahora,
  } as Movement);
  return true;
}

// ─── traspaso ───────────────────────────────────────────────────────────────

async function cerrarTraspaso(o: OrigenDeterminista, m: Movement): Promise<boolean> {
  const t = o.traspaso;
  if (!t) return false;
  const movementId = m.id as number;

  if (t.movimientoEspejoId != null) {
    if (t.sentido === 'salida') await emparejarComoTraspaso(movementId, t.movimientoEspejoId);
    else await emparejarComoTraspaso(t.movimientoEspejoId, movementId);
    return true;
  }
  if (t.cuentaContrariaId != null) {
    if (t.sentido === 'salida') await convertirEnTraspaso(movementId, t.cuentaContrariaId);
    else await convertirEnEntradaDeTraspaso(movementId, t.cuentaContrariaId);
    return true;
  }
  await marcarComoTraspasoSinPar(movementId);
  return true;
}

// ─── la entrada ─────────────────────────────────────────────────────────────

/**
 * Aplica un reconocimiento contra definición sobre el movimiento que acaba de
 * nacer de la línea (`materializarLinea`). Devuelve `true` si quedó cerrado.
 *
 * `nuevo` viene de `materializarLinea`: si el movimiento ya existía y ya está
 * clasificado, este Guardar es un reintento y no se repite nada.
 */
export async function aplicarPorDefinicion(
  db: Base,
  o: OrigenDeterminista,
  movement: Movement,
  nuevo: boolean,
  ahora: string,
): Promise<boolean> {
  if (movement.id == null) return false;
  if (!nuevo && movement.unifiedStatus === 'conciliado') return true;

  // Ya clasificado pero sin conciliar: el Guardar anterior escribió la fila /
  // el cobro / la pata y falló justo antes de la huella. No se repite lo
  // escrito (segunda fila fiscal, segunda pata); solo falta la huella.
  const yaAplicado = !nuevo && !!movement.categoryKey;
  if (!yaAplicado) {
    let cerrado = false;
    if (o.fuente === 'recurrente') cerrado = await cerrarRecurrente(o, movement);
    else if (o.fuente === 'renta') cerrado = await cerrarRenta(db, o, movement, ahora);
    else if (o.fuente === 'traspaso') cerrado = await cerrarTraspaso(o, movement);
    if (!cerrado) return false;
  }

  await dejarConciliado(db, movement.id, o, ahora);
  return true;
}
