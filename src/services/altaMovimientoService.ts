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
}

export class SinCuentaError extends Error {
  constructor() {
    super('Elige la cuenta donde ocurre el movimiento.');
    this.name = 'SinCuentaError';
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
