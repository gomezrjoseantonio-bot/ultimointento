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
import { materializarLinea, type BaseParaMaterializar } from './materializarLinea';
import type { Movement } from './db';
import { createTransfer } from './treasuryTransferService';
import type { GastoInmueble, MejoraInmueble } from './db/types-inmuebles';
import { aceptaCierre, camposDeCierre } from './cierreLineaInmueble';
import { resolveCasillaAEAT, resolveGastoCategoria } from './treasuryConfirmationService';
import { deriveCategoryFromMovement, feedLearningRule } from './aplicarSugerencia';

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
  /** Concepto fino del catálogo unificado · el subtipo concreto (F2). */
  conceptoId?: string | null;
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
  /**
   * true si `tarjetaId` es una tarjeta de CRÉDITO: la compra no mueve la cuenta
   * el día que se hace (sale en el recibo), solo engorda el periodo de la
   * tarjeta. Lo decide quien llama (la ficha, que sabe la modalidad).
   */
  gastoTarjetaCredito?: boolean;
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
    ...(v.conceptoId ? { conceptoId: v.conceptoId } : {}),
    ...(v.inmuebleId != null ? { inmuebleId: String(v.inmuebleId) } : {}),
    ...(v.tarjetaId != null ? { tarjetaId: v.tarjetaId } : {}),
    // Una compra con tarjeta de crédito no mueve la cuenta hasta el recibo · se
    // marca para que el saldo la excluya y el periodo de la tarjeta la sume.
    ...(v.gastoTarjetaCredito ? { gastoTarjetaCredito: true } : {}),
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
 * E1.5 · el movimiento sobre el que trabaja la ficha · el que ya existe
 * (`movementId`) o el que NACE de la línea (`lineaId` · `materializarLinea`, a
 * mano). Con los dos, manda el movimiento.
 */
async function idDelMovimiento(
  db: Awaited<ReturnType<typeof initDB>>,
  params: { movementId?: number; lineaId?: number },
  ahora: string
): Promise<number> {
  if (params.movementId != null) return params.movementId;
  if (params.lineaId == null) throw new Error('Hace falta el movimiento o la línea del extracto.');
  const { movement } = await materializarLinea(db as unknown as BaseParaMaterializar, params.lineaId, ahora, 'a_mano');
  return movement.id as number;
}

/**
 * La mejora sale de una línea de extracto · el movimiento YA existe (o nace de
 * la línea, E1.5).
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
  /** El movimiento, si ya existe. */
  movementId?: number;
  /** E1.5 · o la LÍNEA del extracto · el movimiento nace aquí si aún no lo tenía. */
  lineaId?: number;
  inmuebleId: number;
  concepto: string;
  importe: number;
  fecha: string;
}): Promise<number> {
  const db = await initDB();
  const ahora = new Date().toISOString();
  const fecha = params.fecha.slice(0, 10);
  const movementId = await idDelMovimiento(db, params, ahora);

  const movimiento = (await db.get('movements', movementId)) as Movement | undefined;
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
    movimientoId: String(movementId),
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
    conceptoId: v.conceptoId ?? undefined,
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

// ============================================================================
// El fichero descubre un gasto de piso · su fila fiscal
// ============================================================================
//
// Hermano de `mejoraDesdeMovimiento`, y por el mismo motivo: un apunte del banco
// que el usuario clasifica tiene una consecuencia FISCAL, y escribir solo el
// `Movement` la pierde.
//
// Hasta ahora una derrama marcada como mejora sí se registraba, y un gasto
// corriente de un piso NO: `crearDesdeFicha` le ponía categoría e inmueble al
// movimiento y ahí acababa todo. El gasto quedaba impecable en Tesorería y no
// existía para la declaración — un deducible perdido sin que nadie avisara.
//
// ── Por qué no se reutiliza `confirmTreasuryEvent` ──────────────────────────
//
// Porque CREA el movimiento (`treasuryConfirmationService:371`), y aquí el
// movimiento ya existe: lo trajo el extracto. Pasar por ahí metería el mismo
// cargo dos veces en la cuenta. Lo que sí se reutiliza es `camposDeCierre`, que
// es la pieza que decide QUÉ escribe un cierre; así los tres caminos —punteo
// manual, línea que cuadra con su previsión, y esta— escriben lo mismo.
// ============================================================================

/** Qué pasó con la fila fiscal · el llamante decide qué contarle al usuario. */
export interface ResultadoGastoFiscal {
  resultado:
    /** No había fila y se ha creado. */
    | 'creada'
    /** Ya existía la del recurrente y se ha cerrado con el dato del banco. */
    | 'cerrada'
    /** Sin inmueble no hay nada que declarar · el movimiento se queda igual. */
    | 'sin_inmueble'
    /** La categoría no resuelve casilla · hay que elegirla antes de guardar. */
    | 'falta_casilla'
    /** El cargo aún no ha ocurrido · no se declara todavía. */
    | 'fecha_futura';
  lineaId?: number;
}

/**
 * Registra el gasto de inmueble que descubre una línea del extracto.
 *
 * Clasifica el movimiento SIEMPRE —eso el usuario ya lo ha decidido— y sobre la
 * fila fiscal aplica tres reglas, en este orden:
 *
 *   1. **Sin inmueble** no hay fila: un gasto personal no se declara aquí.
 *   2. **Fecha futura** no entra como hecho. El banco puede traer un cargo con
 *      fecha posterior a hoy; el apunte se queda —es un dato real y el saldo lo
 *      refleja— pero declararlo antes de que ocurra sería deducir un gasto que
 *      todavía no existe. Se mide contra la MISMA fecha que fija el ejercicio
 *      (la de cargo), o techo y ejercicio dirían cosas distintas.
 *   3. **Sin casilla no se guarda.** Nada cae a la 0106 por defecto: una casilla
 *      adivinada es un error en la declaración que nadie ve. Se devuelve
 *      `falta_casilla` para que la ficha la pida.
 *
 * Y antes de crear, BUSCA. Un recibo recurrente que el conciliador no supo
 * cuadrar acaba clasificándose a mano, pero su gasto ya tiene fila del mes
 * —`origen:'recurrente'`, sin `treasuryEventId`, escrita por
 * `operacionFiscalService`—. Crear otra lo contaría dos veces en la
 * declaración. Con `origenIdRecurrente` se encuentra y se cierra con el dato
 * real del banco, que es lo que había que hacer desde el principio.
 */
export async function gastoDesdeMovimiento(params: {
  /** El movimiento, si ya existe. */
  movementId?: number;
  /** E1.5 · o la LÍNEA del extracto · el movimiento nace aquí si aún no lo tenía. */
  lineaId?: number;
  inmuebleId?: number | null;
  concepto: string;
  /** Con signo, como lo trae el banco · la línea guarda magnitud. */
  importe: number;
  /** Fecha de CARGO · la que fija el ejercicio y contra la que mide el techo. */
  fecha: string;
  categoryKey?: string | null;
  subtypeKey?: string | null;
  /**
   * Clave `recurrente-<compromiso>-<año>-<mes>` cuando la línea se clasifica
   * como un gasto recurrente. Sin ella no se busca fila previa.
   */
  origenIdRecurrente?: string;
  /** Hoy, inyectable para poder fijar el techo en tests. */
  hoy?: string;
}): Promise<ResultadoGastoFiscal> {
  const db = await initDB();
  const ahora = new Date().toISOString();
  const fecha = params.fecha.slice(0, 10);
  const hoy = (params.hoy ?? new Date().toISOString()).slice(0, 10);
  const movementId = await idDelMovimiento(db, params, ahora);

  const movimiento = (await db.get('movements', movementId)) as Movement | undefined;

  // El movimiento se clasifica siempre · eso ya lo decidió el usuario, y vale
  // aunque la fila fiscal no llegue a escribirse.
  if (movimiento) {
    const clasificado = {
      ...movimiento,
      description: params.concepto || movimiento.description,
      ...(params.categoryKey !== undefined
        ? { categoryKey: params.categoryKey ?? undefined }
        : {}),
      ...(params.subtypeKey !== undefined
        ? { subtypeKey: params.subtypeKey ?? undefined }
        : {}),
      // `undefined` NO toca lo que hubiera; `null` limpia (la ficha usa esa misma
      // convención para categoría y subtipo).
      ...(params.inmuebleId !== undefined
        ? params.inmuebleId == null
          ? { inmuebleId: undefined }
          : { inmuebleId: String(params.inmuebleId), ambito: 'INMUEBLE' as const }
        : {}),
      updatedAt: ahora,
    } as Movement;
    await db.put('movements', clasificado);
    // E2.2 · clasificar por ficha ENSEÑA · la próxima línea igual llega con
    // esto propuesto, y a la tercera vez se resuelve sola (`reglaResuelveSola`).
    // Se aprende del texto ORIGINAL del banco, no del concepto que el usuario
    // escribió en la ficha: la regla tiene que casar con lo que traerá el
    // próximo extracto. Si lo que hace es reclasificar un movimiento que una
    // regla ya había resuelto, `createOrUpdateRule` lo cuenta como corrección.
    if (params.categoryKey) {
      await feedLearningRule(
        { ...clasificado, description: movimiento.description, counterparty: movimiento.counterparty },
        deriveCategoryFromMovement({
          ...clasificado,
          ...(params.inmuebleId == null ? { inmuebleId: undefined, ambito: 'PERSONAL' as const } : {}),
        })
      );
    }
  }

  if (params.inmuebleId == null) return { resultado: 'sin_inmueble' };
  if (fecha > hoy) return { resultado: 'fecha_futura' };

  // Sin casilla NO se guarda · ver regla 3.
  const casillaAEAT = resolveCasillaAEAT(params.categoryKey ?? undefined);
  if (!casillaAEAT) return { resultado: 'falta_casilla' };

  // Mina M6 · aquí va el id del MOVIMIENTO, nunca el de la línea.
  const cierre = camposDeCierre({
    id: movementId,
    amount: params.importe,
    date: fecha,
    valueDate: movimiento?.valueDate,
    accountId: movimiento?.accountId,
  });

  // ── ¿Ya hay fila de este gasto? · la del recurrente no lleva enlace ────────
  if (params.origenIdRecurrente) {
    let previa: GastoInmueble | undefined;
    try {
      const porOrigen = (await db.getAllFromIndex('gastosInmueble', 'origen-origenId', [
        'recurrente',
        params.origenIdRecurrente,
      ])) as GastoInmueble[];
      previa = porOrigen?.[0];
    } catch {
      // sin índice · se sigue por la vía de crear, que es el caso normal
    }
    if (previa?.id != null && aceptaCierre(previa)) {
      await db.put('gastosInmueble', {
        ...previa,
        ...cierre,
        concepto: params.concepto || previa.concepto,
        updatedAt: ahora,
      } as never);
      return { resultado: 'cerrada', lineaId: previa.id };
    }
  }

  const linea = {
    inmuebleId: params.inmuebleId,
    concepto: params.concepto,
    categoria: resolveGastoCategoria(params.categoryKey ?? undefined),
    casillaAEAT,
    // Nace de Tesorería, como el resto de lo que inyecta la conciliación.
    origen: 'tesoreria' as const,
    ...(params.categoryKey ? { categoryKey: params.categoryKey } : {}),
    ...(params.subtypeKey ? { subtypeKey: params.subtypeKey } : {}),
    ...cierre,
    createdAt: ahora,
    updatedAt: ahora,
  };

  const lineaId = Number(await db.add('gastosInmueble', linea as never));
  return { resultado: 'creada', lineaId };
}

/**
 * Qué contarle al usuario cuando la fila fiscal NO se escribe.
 *
 * Vive junto a la regla que produce el resultado y no en la pantalla: son la
 * explicación de una decisión del dominio, y separados divergen — la regla
 * cambia y el texto sigue diciendo lo de antes.
 */
export const AVISO_GASTO_FISCAL: Partial<
  Record<ResultadoGastoFiscal['resultado'], string>
> = {
  falta_casilla: 'Elige la categoría del gasto: sin ella no se sabe en qué casilla declararlo.',
  fecha_futura: 'El cargo tiene fecha futura: se guarda el apunte, pero no se declara hasta esa fecha.',
};

/**
 * De qué gasto recurrente es este cargo, en la forma que usa su fila fiscal.
 *
 * La ficha solo sabe inmueble y categoría —el compromiso no se elige a mano—,
 * así que esta es la traducción que permite a `gastoDesdeMovimiento` buscar la
 * fila del mes antes de crear otra. Sin ella la guarda de B19 quedaría escrita
 * y muerta.
 *
 * La clave la fija `operacionFiscalService` al emitir la línea del recurrente:
 * `recurrente-<compromiso>-<ejercicio>-<mes>`. Se construye igual aquí porque
 * es la MISMA fila que hay que encontrar; el día que cambie allí, este módulo
 * deja de encontrarla y el test de B19 se pone rojo, que es lo que se quiere.
 *
 * `undefined` cuando no hay inmueble, no hay categoría, o no hay compromiso vivo
 * que case: entonces no hay fila previa y se crea una nueva, que es el caso
 * normal de un gasto descubierto.
 */
export async function origenIdRecurrenteDelGasto(
  inmuebleId: number | null | undefined,
  categoryKey: string | null | undefined,
  fecha: string,
): Promise<string | undefined> {
  if (inmuebleId == null || !categoryKey) return undefined;
  const db = await initDB();
  const compromisos = (((await db.getAll('compromisosRecurrentes')) ?? []) as Array<{
    id?: number;
    inmuebleId?: number;
    categoria?: string;
    estado?: string;
  }>).filter(
    (c) =>
      c.id != null &&
      c.estado === 'activo' &&
      c.inmuebleId === inmuebleId &&
      c.categoria === categoryKey,
  );
  const c = compromisos[0];
  if (!c?.id) return undefined;

  const [año, mes] = fecha.slice(0, 10).split('-').map(Number);
  return `recurrente-${c.id}-${año}-${mes}`;
}
