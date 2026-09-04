// ============================================================================
// E1.5-anclaje-saldo · anclar la apertura de la cuenta al saldo del banco
// ============================================================================
//
// La fórmula del saldo (hub `calculateAccountBalanceAtDate`) suma desde la
// apertura: `openingBalance` a `openingBalanceDate` + todo lo que se movió
// desde entonces. Si la cuenta se dio de alta con apertura 0 —lo normal, nadie
// teclea su saldo al crearla—, ATLAS parte de cero y el número no tiene nada
// que ver con el banco.
//
// Cuando el extracto trae columna de saldo, ATLAS puede proponer la apertura
// que haría cuadrar. DECISIÓN (Jose): se ancla por la línea MÁS RECIENTE del
// extracto —el usuario reconoce como bueno el saldo de hoy, no el de hace dos
// años— y ATLAS PROPONE, el usuario CONFIRMA (§9: el saldo del fichero puede
// llevar retenidos o ir por fecha valor; nunca se ancla a ciegas).
//
// Cómo se calcula la apertura propuesta · con el propio hub, para que no haya
// una segunda fórmula:
//   delta      = saldo del hub a la fecha del ancla con apertura 0 EN esa fecha
//                (= lo que ese día suma por sí mismo: movimientos, líneas
//                huérfanas y eventos comprometidos del día)
//   apertura   = saldoBanco − delta, con fecha de apertura = la del ancla
// Así, por construcción, hub(fecha del ancla) = saldoBanco. Lo anterior a esa
// fecha deja de sumar: ya está dentro del saldo que dice el banco.
//
// Nunca hacia atrás: si la cuenta tiene una apertura POSTERIOR a la última
// línea del extracto, el extracto es viejo y anclar a él borraría lo que hay
// entre medias. Se avisa y no se propone.
// ============================================================================

import { initDB, type Account, type Movement, type TreasuryEvent } from './db';
import type { LineaExtractoPersistida } from './db/types-lineasExtracto';
import {
  calculateAccountBalanceAtDate,
  leerLineasParaSaldo,
  type LineaParaSaldo,
} from './accountBalanceService';
import { cuentasService } from './cuentasService';

/** Lo que el banco afirma: a esta fecha, este saldo. */
export interface AnclaDelBanco {
  /** YYYY-MM-DD · la fecha de la línea más reciente con saldo. */
  fecha: string;
  /** El saldo del banco TRAS esa línea. */
  saldoBanco: number;
}

export interface PropuestaDeAnclaje extends AnclaDelBanco {
  /** Lo que ATLAS calcula hoy a esa misma fecha. */
  saldoAtlas: number;
  /** `saldoBanco − saldoAtlas` · 0 si cuadra. */
  descuadre: number;
  cuadra: boolean;
  /** La apertura que haría cuadrar, con fecha `fecha`. */
  aperturaPropuesta: number;
  aperturaActual: { saldo: number; fecha: string | null };
  /** `false` cuando la apertura actual es posterior al extracto · no se ancla hacia atrás. */
  aplicable: boolean;
}

const ES_DIA = /^\d{4}-\d{2}-\d{2}$/;

function soloDia(v: string | undefined): string | null {
  if (!v) return null;
  const d = v.includes('T') ? v.split('T')[0] : v;
  return ES_DIA.test(d) ? d : null;
}

function diaSiguiente(dia: string): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const redondea = (n: number): number => Math.round(n * 100) / 100;

/**
 * La línea MÁS RECIENTE del extracto que trae saldo · y su saldo.
 *
 * Entre varias del mismo día manda el orden del fichero: un banco lista de lo
 * más nuevo a lo más viejo (Santander) o al revés, y el saldo que vale es el
 * de la última operación del día. La dirección se deduce de la propia columna
 * de saldo (saldo tras la línea − su importe = saldo de la anterior), y si el
 * fichero no lo deja claro, de las fechas. `null` sin columna de saldo.
 */
export function lineaMasRecienteConSaldo(
  filas: ReadonlyArray<LineaExtractoPersistida>
): AnclaDelBanco | null {
  const conSaldo = filas
    .filter((f) => typeof f.saldo === 'number' && Number.isFinite(f.saldo) && ES_DIA.test(f.fechaOperacion))
    .slice()
    .sort((a, b) => (a.filaOriginal ?? a.id ?? 0) - (b.filaOriginal ?? b.id ?? 0));
  if (conSaldo.length === 0) return null;

  let fecha = conSaldo[0].fechaOperacion;
  for (const f of conSaldo) if (f.fechaOperacion > fecha) fecha = f.fechaOperacion;
  const delDia = conSaldo.filter((f) => f.fechaOperacion === fecha);
  if (delDia.length === 1) return { fecha, saldoBanco: delDia[0].saldo as number };

  const primera = conSaldo[0];
  const ultima = conSaldo[conSaldo.length - 1];
  const nuevoPrimero = esNuevoPrimero(conSaldo) ?? primera.fechaOperacion >= ultima.fechaOperacion;
  const elegida = nuevoPrimero ? delDia[0] : delDia[delDia.length - 1];
  return { fecha, saldoBanco: elegida.saldo as number };
}

/** ¿El fichero lista lo más nuevo primero? · por la cadena de saldos. `null` si no se sabe. */
function esNuevoPrimero(filas: LineaExtractoPersistida[]): boolean | null {
  for (let i = 0; i + 1 < filas.length; i++) {
    const a = filas[i];
    const b = filas[i + 1];
    const sa = a.saldo as number;
    const sb = b.saldo as number;
    // Nuevo primero: el saldo de la siguiente (más vieja) es el de esta menos su importe.
    if (Math.abs(redondea(sa - a.importe) - sb) < 0.005) return true;
    // Viejo primero: el saldo de la siguiente (más nueva) es el de esta más el importe de la siguiente.
    if (Math.abs(redondea(sa + b.importe) - sb) < 0.005) return false;
  }
  return null;
}

/**
 * La propuesta · pura sobre lo que hay en la base. Usa el hub dos veces: para
 * lo que ATLAS calcula hoy y para lo que ese día suma por sí mismo.
 */
export function calcularAnclaje(p: {
  account: Account;
  ancla: AnclaDelBanco;
  treasuryEvents: TreasuryEvent[];
  movements: Movement[];
  lineas: LineaParaSaldo[];
}): PropuestaDeAnclaje {
  const { account, ancla, treasuryEvents, movements, lineas } = p;
  const cutoffDate = diaSiguiente(ancla.fecha);

  const saldoAtlas = redondea(
    calculateAccountBalanceAtDate({ account, cutoffDate, treasuryEvents, movements, lineas })
  );
  const delta = calculateAccountBalanceAtDate({
    account: { ...account, openingBalance: 0, openingBalanceDate: ancla.fecha },
    cutoffDate,
    treasuryEvents,
    movements,
    lineas,
  });

  const fechaApertura = soloDia(account.openingBalanceDate);
  const descuadre = redondea(ancla.saldoBanco - saldoAtlas);
  return {
    ...ancla,
    saldoAtlas,
    descuadre,
    cuadra: Math.abs(descuadre) < 0.005,
    aperturaPropuesta: redondea(ancla.saldoBanco - delta),
    aperturaActual: { saldo: account.openingBalance ?? 0, fecha: fechaApertura },
    aplicable: !(fechaApertura != null && fechaApertura > ancla.fecha),
  };
}

type Base = Awaited<ReturnType<typeof initDB>>;

async function loQueSumaLaCuenta(db: Base) {
  const [treasuryEvents, movements, lineas] = await Promise.all([
    db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
    db.getAll('movements') as Promise<Movement[]>,
    leerLineasParaSaldo(db),
  ]);
  return { treasuryEvents: treasuryEvents ?? [], movements: movements ?? [], lineas };
}

/**
 * La propuesta para la sesión de un extracto · `null` si el fichero no trae
 * columna de saldo (§9: entonces la apertura la pone el usuario a mano).
 */
export async function propuestaDeAnclaje(
  db: Base,
  account: Account,
  filas: ReadonlyArray<LineaExtractoPersistida>
): Promise<PropuestaDeAnclaje | null> {
  const ancla = lineaMasRecienteConSaldo(filas);
  if (!ancla) return null;
  return calcularAnclaje({ account, ancla, ...(await loQueSumaLaCuenta(db)) });
}

/**
 * Aplicar el anclaje · SOLO tras confirmarlo el usuario. Se recalcula sobre la
 * base de ese momento (al guardar ya han nacido los movimientos de la sesión;
 * el hub los cuenta igual que contaba las líneas). Devuelve la apertura
 * escrita, o `null` si no era aplicable.
 */
export async function aplicarAnclaje(
  accountId: number,
  ancla: AnclaDelBanco
): Promise<{ openingBalance: number; openingBalanceDate: string } | null> {
  const db = await initDB();
  const account = (await db.get('accounts', accountId)) as Account | undefined;
  if (!account) throw new Error('La cuenta ya no existe · no se puede anclar el saldo.');

  const propuesta = calcularAnclaje({ account, ancla, ...(await loQueSumaLaCuenta(db)) });
  if (!propuesta.aplicable) return null;

  const apertura = { openingBalance: propuesta.aperturaPropuesta, openingBalanceDate: ancla.fecha };
  try {
    await cuentasService.update(accountId, apertura);
  } catch (err) {
    // Solo si la caché del servicio de cuentas no conoce esta cuenta (se creó
    // por otro camino): la base es la verdad y es donde lee el hub. Cualquier
    // otro fallo sube, que esconderlo dejaría un estado a medias sin señal.
    if (!(err instanceof Error && /Cuenta no encontrada/.test(err.message))) throw err;
    await db.put('accounts', {
      ...account,
      ...apertura,
      balance: apertura.openingBalance,
      updatedAt: new Date().toISOString(),
    });
  }

  // El movimiento sintético de apertura, si lo hay, dice lo mismo que la cuenta.
  const movs = ((await db.getAll('movements')) ?? []) as Movement[];
  const deApertura = movs.find((m) => m.isOpeningBalance && m.accountId === accountId);
  if (deApertura) {
    await db.put('movements', {
      ...deApertura,
      amount: apertura.openingBalance,
      date: ancla.fecha,
      valueDate: ancla.fecha,
      balance: apertura.openingBalance,
      saldo: apertura.openingBalance,
      type: apertura.openingBalance >= 0 ? 'Ingreso' : 'Gasto',
      updatedAt: new Date().toISOString(),
    });
  }
  return apertura;
}
