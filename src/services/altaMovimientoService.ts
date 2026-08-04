// ============================================================================
// Tesorería V6 · alta de movimiento a mano ("Anotar") · y la derrama-mejora
// ============================================================================
//
// El hueco que cierra: la ficha de §4.5 sabía construir el movimiento y validar
// lo que hacía falta, pero no había quien lo escribiera — "Anotar" avisaba por
// consola y no guardaba nada.
//
// Dos caminos, y la diferencia es fiscal, no de forma:
//
//   · GASTO O INGRESO normal → un `Movement`. Nace `source: 'manual'`, que en el
//     modelo de punteo es CONFIRMADO ("tu palabra"), no conciliado: no hay
//     extracto detrás. Eso lo decide `punteoModel.estadoDeMovimiento` y aquí no
//     se toca.
//
//   · TRANSFERENCIA INTERNA → dos movimientos espejo, vía `createTransfer`. El
//     dinero no se va: cambia de cuenta. La externa —a un tercero— sí es un
//     solo apunte, y por eso la ficha las separa.
//
//   · DERRAMA que el usuario marca como MEJORA → NO es un gasto. Se capitaliza
//     y se amortiza a lo largo de los años, así que va a `mejorasInmueble` y no
//     lleva `categoryKey` de gasto. Guardarla como gasto deduciría este año algo
//     que Hacienda no deja deducir este año.
//
// Una mejora SIEMPRE necesita inmueble: es una obra sobre un activo concreto y
// sin él no hay nada que amortizar. Por eso se rechaza en vez de guardarla
// suelta.
// ============================================================================

import { initDB } from './db';
import type { Movement } from './db';
import { createTransfer } from './treasuryTransferService';
import type { MejoraInmueble } from './db/types-inmuebles';

export interface AltaMovimiento {
  tipo: 'gasto' | 'ingreso' | 'transferencia';
  concepto: string;
  /** Con signo · negativo gasto, positivo ingreso. */
  importe: number;
  fecha: string;
  cuentaId: number | null;
  inmuebleId?: number | null;
  categoryKey?: string | null;
  subtypeKey?: string | null;
  /** La derrama que el usuario marcó como mejora (§4.5 · D3). */
  esMejora?: boolean;
  /** Solo en transferencia · `null` = externa. */
  cuentaDestinoId?: number | null;
  /**
   * Con qué tarjeta se pagó · `null` limpia lo que hubiera (§3.5).
   *
   * Es lo único que permite atribuir el gasto de una tarjeta de DÉBITO: cobra
   * al momento, así que no hay recibo del que deducirlo.
   */
  tarjetaId?: number | null;
}

export class SinCuentaError extends Error {
  constructor() {
    super('Elige la cuenta donde ocurre el movimiento.');
    this.name = 'SinCuentaError';
  }
}

export class TraspasoALaMismaCuentaError extends Error {
  constructor() {
    super('Una transferencia interna va de una cuenta a OTRA: elige un destino distinto.');
    this.name = 'TraspasoALaMismaCuentaError';
  }
}

export class MejoraSinInmuebleError extends Error {
  constructor() {
    super('Una mejora se suma al valor de un inmueble: elige a cuál.');
    this.name = 'MejoraSinInmuebleError';
  }
}

export interface ResultadoAlta {
  movementId?: number;
  /** La otra pata · solo en una transferencia INTERNA. */
  movementIdDestino?: number;
  mejoraId?: number;
}

/**
 * Da de alta lo que el usuario acaba de anotar.
 *
 * Devuelve qué se escribió para que quien llame pueda decirlo con propiedad:
 * "movimiento anotado" y "mejora registrada" no son la misma frase.
 */
export async function altaMovimiento(v: AltaMovimiento): Promise<ResultadoAlta> {
  if (v.cuentaId == null) throw new SinCuentaError();

  if (v.esMejora) {
    if (v.inmuebleId == null) throw new MejoraSinInmuebleError();
    return { mejoraId: await altaMejora(v, v.inmuebleId) };
  }

  /**
   * Transferencia INTERNA · dos patas, no una.
   *
   * Externa e interna son cosas distintas y por eso la ficha las separa: a un
   * tercero el dinero se va y solo hay un apunte; entre cuentas propias el
   * dinero NO se va, cambia de sitio. Aquí llegaba `cuentaDestinoId` y se caía
   * por el camino —el servicio lo declaraba y no lo leía—, así que la interna
   * escribía la salida y nada en la cuenta destino: el dinero desaparecía de
   * una cuenta sin aparecer en la otra y el patrimonio bajaba solo.
   *
   * `createTransfer` es el primitivo que ya hacía esto bien en el modal de
   * conciliación: crea las dos patas espejo, las empareja por `pairEventId` y
   * las marca con `traspaso_salida`/`traspaso_entrada` — que es lo que luego
   * mira todo el mundo para NO contarlas como ingreso ni como gasto.
   *
   * `confirm: true` porque esto es "Anotar": lo que se apunta ya ha pasado.
   */
  if (v.tipo === 'transferencia' && v.cuentaDestinoId != null) {
    if (v.cuentaDestinoId === v.cuentaId) throw new TraspasoALaMismaCuentaError();
    const { originMovementId, targetMovementId } = await createTransfer({
      date: v.fecha.slice(0, 10),
      amount: Math.abs(v.importe),
      originAccountId: v.cuentaId,
      targetAccountId: v.cuentaDestinoId,
      concept: v.concepto,
      confirm: true,
    });
    return { movementId: originMovementId, movementIdDestino: targetMovementId };
  }

  return { movementId: await altaMovimientoNormal(v) };
}

async function altaMovimientoNormal(v: AltaMovimiento): Promise<number> {
  const db = await initDB();
  const ahora = new Date().toISOString();
  const fecha = v.fecha.slice(0, 10);

  // El signo lo fija el tipo, no lo que venga en `importe`: la ficha ya lo
  // normaliza, pero este servicio también lo usan otros caminos.
  const magnitud = Math.abs(v.importe);
  const importe = v.tipo === 'ingreso' ? magnitud : -magnitud;

  const movimiento: Movement = {
    accountId: v.cuentaId!,
    date: fecha,
    valueDate: fecha,
    amount: importe,
    description: v.concepto,
    // `manual` y NO `import`: en el modelo de punteo eso es CONFIRMADO, no
    // conciliado. Conciliado significa "hay un extracto que lo respalda", y
    // aquí lo que hay es la palabra del usuario (§2 · punteoModel).
    source: 'manual',
    unifiedStatus: 'no_planificado',
    type:
      v.tipo === 'transferencia' ? 'Transferencia' : importe >= 0 ? 'Ingreso' : 'Gasto',
    origin: 'Manual',
    movementState: 'Confirmado',
    state: 'pending',
    status: 'pendiente',
    category: { tipo: importe >= 0 ? 'Ingresos' : 'Gastos' },
    tags: [],
    isAutoTagged: false,
    ambito: v.inmuebleId != null ? 'INMUEBLE' : 'PERSONAL',
    statusConciliacion: 'sin_match',
    ...(v.categoryKey ? { categoryKey: v.categoryKey } : {}),
    ...(v.subtypeKey ? { subtypeKey: v.subtypeKey } : {}),
    ...(v.inmuebleId != null ? { inmuebleId: String(v.inmuebleId) } : {}),
    ...(v.tarjetaId != null ? { tarjetaId: v.tarjetaId } : {}),
    createdAt: ahora,
    updatedAt: ahora,
  } as Movement;

  return (await db.add('movements', movimiento)) as number;
}

/**
 * Alta en `mejorasInmueble` · la derrama que resultó ser mejora (D3).
 *
 * `tipo: 'mejora'` y no `'reparacion'`: la pregunta de §4.5 es exactamente
 * conservación (deducible este año) vs. mejora (se amortiza), y quien llega
 * aquí ya respondió lo segundo.
 *
 * Sin `categoryKey`: una mejora no tiene casilla de gasto. La lleva el cuadro
 * de amortizaciones, no el de gastos deducibles.
 */
/**
 * La mejora sale de una línea de extracto · el movimiento YA existe.
 *
 * Aquí no hay nada que crear en `movements`: el dinero salió del banco y ese
 * apunte es realidad, no una elección. Lo que cambia es el TRATAMIENTO FISCAL,
 * así que el movimiento se queda —el saldo tiene que cuadrar con el extracto—
 * pero pierde su `categoryKey` de gasto, y la inversión se registra aparte.
 *
 * Borrar el movimiento sería peor de dos maneras: el saldo dejaría de casar con
 * el banco, y al reimportar el extracto volvería a aparecer.
 */
export async function mejoraDesdeMovimiento(params: {
  movementId: number;
  inmuebleId: number;
  concepto: string;
  importe: number;
  fecha: string;
}): Promise<number> {
  const db = await initDB();
  const ahora = new Date().toISOString();
  const fecha = params.fecha.slice(0, 10);

  const movimiento = (await db.get('movements', params.movementId)) as Movement | undefined;
  if (movimiento) {
    await db.put('movements', {
      ...movimiento,
      description: params.concepto || movimiento.description,
      // Sin key de gasto: lo que se deduce es la amortización, no el pago.
      categoryKey: undefined,
      subtypeKey: undefined,
      inmuebleId: String(params.inmuebleId),
      ambito: 'INMUEBLE',
      updatedAt: ahora,
    } as Movement);
  }

  const mejora: MejoraInmueble = {
    inmuebleId: params.inmuebleId,
    ejercicio: Number(fecha.slice(0, 4)),
    descripcion: params.concepto,
    tipo: 'mejora',
    importe: Math.abs(params.importe),
    fecha,
    // Queda enlazada al apunte bancario que la pagó · así se puede rastrear.
    movimientoId: String(params.movementId),
    estadoTesoreria: 'confirmed',
    createdAt: ahora,
    updatedAt: ahora,
  };

  return (await db.add('mejorasInmueble', mejora)) as number;
}

async function altaMejora(v: AltaMovimiento, inmuebleId: number): Promise<number> {
  const db = await initDB();
  const ahora = new Date().toISOString();
  const fecha = v.fecha.slice(0, 10);

  const mejora: MejoraInmueble = {
    inmuebleId,
    // El ejercicio sale de la FECHA del gasto, no del año en curso: una derrama
    // de diciembre anotada en enero amortiza desde el ejercicio en que se pagó.
    ejercicio: Number(fecha.slice(0, 4)),
    descripcion: v.concepto,
    tipo: 'mejora',
    importe: Math.abs(v.importe),
    fecha,
    estadoTesoreria: 'confirmed',
    createdAt: ahora,
    updatedAt: ahora,
  };

  return (await db.add('mejorasInmueble', mejora)) as number;
}

// ─── Corregir y borrar lo anotado a mano ────────────────────────────────────

/**
 * Qué movimientos se pueden tocar · SOLO los que escribió el usuario.
 *
 * Uno importado del extracto es realidad del banco: corregirlo o borrarlo
 * descuadraría el saldo contra el que se concilia, y al reimportar volvería a
 * aparecer. Uno nacido de confirmar una previsión tampoco: quien lo deshace es
 * el despunteo, que además devuelve la previsión a pendiente.
 *
 * Queda lo anotado a mano, que es de donde salen las equivocaciones que nadie
 * más puede arreglar.
 */
export function esMovimientoEditable(
  m: Pick<Movement, 'source' | 'reference' | 'transferMetadata'>
): boolean {
  if (m.source !== 'manual') return false;
  if (m.reference) return false;
  // Una transferencia interna son DOS apuntes espejo. Tocar uno solo dejaría
  // el otro colgado y el dinero duplicado o desaparecido, así que de momento
  // no se ofrece: mejor sin lápiz que con un lápiz que descuadra.
  if (m.transferMetadata) return false;
  return true;
}

export class MovimientoNoEditableError extends Error {
  constructor() {
    super('Solo se puede corregir lo que anotaste a mano.');
    this.name = 'MovimientoNoEditableError';
  }
}

async function movimientoEditable(movementId: number): Promise<Movement> {
  const db = await initDB();
  const m = (await db.get('movements', movementId)) as Movement | undefined;
  if (!m || !esMovimientoEditable(m)) throw new MovimientoNoEditableError();
  return m;
}

/**
 * Corrige un movimiento anotado a mano · en el sitio, sin crear otro.
 *
 * Se escriben los mismos campos que fija el alta y por el mismo criterio: el
 * signo lo manda el tipo y el ámbito lo manda el inmueble. `categoryKey` y
 * `subtypeKey` viajan aunque vengan vacíos —reclasificar a algo sin variante
 * tiene que BORRAR la anterior, no dejarla pegada.
 */
export async function editarMovimiento(movementId: number, v: AltaMovimiento): Promise<void> {
  const anterior = await movimientoEditable(movementId);
  if (v.cuentaId == null) throw new SinCuentaError();
  // Una transferencia INTERNA son dos apuntes espejo, y aquí solo hay uno
  // delante: crear la otra pata al editar dejaría un traspaso a medias, con el
  // dinero saliendo de una cuenta y sin entrar en ninguna.
  if (v.tipo === 'transferencia' && v.cuentaDestinoId != null) {
    throw new MovimientoNoEditableError();
  }

  const db = await initDB();
  const magnitud = Math.abs(v.importe);
  const importe = v.tipo === 'ingreso' ? magnitud : -magnitud;
  const fecha = v.fecha.slice(0, 10);

  await db.put('movements', {
    ...anterior,
    accountId: v.cuentaId,
    date: fecha,
    valueDate: fecha,
    amount: importe,
    description: v.concepto,
    // El tipo lo manda lo que ELIGIÓ el usuario, no el signo. Derivarlo solo
    // del importe convertía en gasto una transferencia externa —que sale en
    // negativo como cualquier cargo— y ya no había forma de volver.
    type: v.tipo === 'transferencia' ? 'Transferencia' : importe >= 0 ? 'Ingreso' : 'Gasto',
    category: { tipo: importe >= 0 ? 'Ingresos' : 'Gastos' },
    ambito: v.inmuebleId != null ? 'INMUEBLE' : 'PERSONAL',
    categoryKey: v.categoryKey ?? undefined,
    subtypeKey: v.subtypeKey ?? undefined,
    inmuebleId: v.inmuebleId != null ? String(v.inmuebleId) : undefined,
    // `undefined` NO borra: quien edite la ficha sin conocer la tarjeta —una
    // pantalla vieja, un flujo que no la pregunta— dejaría el movimiento sin
    // atribuir a su espalda. Solo un `null` explícito la quita.
    tarjetaId: v.tarjetaId === null ? undefined : (v.tarjetaId ?? anterior.tarjetaId),
    updatedAt: new Date().toISOString(),
  } as Movement);
}

/** Borra un movimiento anotado a mano · el resto no se toca. */
export async function eliminarMovimiento(movementId: number): Promise<void> {
  await movimientoEditable(movementId);
  const db = await initDB();
  await db.delete('movements', movementId);
}
