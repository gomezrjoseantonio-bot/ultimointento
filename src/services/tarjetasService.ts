// ============================================================================
// Tarjetas · alta, edición y baja · docs/VOCABULARIO-dinero.md §3
// ============================================================================
//
// Una tarjeta cuelga de una cuenta pero NO es una cuenta, así que tiene su
// propio sitio y su propio servicio. Las reglas de qué se puede guardar viven
// en `tarjetasReglas.ts`; aquí solo se escribe y se lee.
// ============================================================================

import { initDB } from './db';
import type { Account } from './db';
import type { Tarjeta } from '../types/tarjetas';
import { cuentasQuePuedenLiquidar, necesitaCiclo } from './tarjetasReglas';

export class CuentaDeLiquidacionInvalidaError extends Error {
  constructor() {
    super('El recibo de una tarjeta sale de una cuenta bancaria: ni del efectivo ni de otra tarjeta.');
    this.name = 'CuentaDeLiquidacionInvalidaError';
  }
}

export class TarjetaNoEncontradaError extends Error {
  constructor() {
    super('Esa tarjeta ya no existe.');
    this.name = 'TarjetaNoEncontradaError';
  }
}

export class TarjetaSinCicloError extends Error {
  constructor() {
    super('Una tarjeta de crédito necesita saber cuándo corta y cuándo cobra.');
    this.name = 'TarjetaSinCicloError';
  }
}

export type AltaTarjeta = Omit<Tarjeta, 'id' | 'createdAt' | 'updatedAt' | 'activa'> & {
  activa?: boolean;
};

/**
 * Comprueba lo que el vocabulario NO deja guardar.
 *
 * Se valida contra las cuentas de verdad y no contra un id suelto: una tarjeta
 * que se liquida en el colchón —o en otra tarjeta— es un imposible, y dejarlo
 * entrar convierte el recibo en un cargo que nunca podrá pagarse.
 */
function comprobar(v: AltaTarjeta, cuentas: Account[]): void {
  // Las cuentas BORRADAS no cuentan: una tarjeta domiciliada en una cuenta que
  // ya no existe deja un recibo que nadie puede pagar. Las inactivas sí valen —
  // una cuenta en pausa sigue siendo una cuenta, y bloquear la edición de una
  // tarjeta porque su banco esté aparcado sería un castigo sin motivo.
  const vivas = cuentas.filter((c) => c.status !== 'DELETED' && !(c as { deleted_at?: string }).deleted_at);
  const validas = cuentasQuePuedenLiquidar(vivas);
  if (!validas.some((c) => c.id === v.cuentaLiquidacionId)) {
    throw new CuentaDeLiquidacionInvalidaError();
  }
  if (necesitaCiclo(v) && !v.ciclo) throw new TarjetaSinCicloError();
}

export async function listarTarjetas(): Promise<Tarjeta[]> {
  const db = await initDB();
  return ((await db.getAll('tarjetas')) ?? []) as Tarjeta[];
}

/** Las tarjetas cuyo recibo paga esta cuenta · la lectura de todos los días. */
export async function tarjetasDeLaCuenta(cuentaId: number): Promise<Tarjeta[]> {
  const db = await initDB();
  return ((await db.getAllFromIndex('tarjetas', 'cuentaLiquidacionId', cuentaId)) ??
    []) as Tarjeta[];
}

export async function crearTarjeta(v: AltaTarjeta): Promise<number> {
  const db = await initDB();
  comprobar(v, ((await db.getAll('accounts')) ?? []) as Account[]);

  const ahora = new Date().toISOString();
  const tarjeta: Omit<Tarjeta, 'id'> = {
    ...v,
    // El débito no acumula nada: cobra al momento, así que un ciclo suyo sería
    // un dato que nadie mira y que al leerlo engañaría.
    ciclo: necesitaCiclo(v) ? v.ciclo : undefined,
    activa: v.activa ?? true,
    createdAt: ahora,
    updatedAt: ahora,
  };
  return (await db.add('tarjetas', tarjeta as Tarjeta)) as number;
}

/**
 * Corrige una tarjeta · incluida su domiciliación.
 *
 * Cambiar de cuenta es una operación NORMAL en una tarjeta de fuera (§3.2), y
 * por eso se hace aquí y no rehaciéndola: rehacerla perdería su historial de
 * gasto, que es lo que sostiene las bonificaciones y el rendimiento.
 *
 * Y no reescribe el pasado: los cargos ya cobrados se quedan en la cuenta donde
 * se cobraron. Ya ocurrieron.
 */
export async function actualizarTarjeta(
  id: number,
  cambios: Partial<AltaTarjeta>
): Promise<void> {
  const db = await initDB();
  const actual = (await db.get('tarjetas', id)) as Tarjeta | undefined;
  // Callarse aquí escondería el error: quien edita una tarjeta borrada se
  // quedaría creyendo que guardó, y no hay forma de distinguirlo de un éxito.
  if (!actual) throw new TarjetaNoEncontradaError();

  const siguiente = { ...actual, ...cambios } as Tarjeta;
  comprobar(siguiente, ((await db.getAll('accounts')) ?? []) as Account[]);

  await db.put('tarjetas', {
    ...siguiente,
    ciclo: necesitaCiclo(siguiente) ? siguiente.ciclo : undefined,
    updatedAt: new Date().toISOString(),
  });
}

export async function eliminarTarjeta(id: number): Promise<void> {
  const db = await initDB();
  await db.delete('tarjetas', id);
}
