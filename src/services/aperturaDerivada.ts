// ============================================================================
// §31 · la apertura de una cuenta NO se inventa · se DERIVA del extracto
// ============================================================================
//
// El modelo anterior (E1.5-anclaje-saldo) preguntaba «fecha y saldo de
// apertura» y anclaba por la línea MÁS RECIENTE del extracto. Las dos mitades
// estaban mal:
//
//   · Nadie sabe cuánto tenía el día que abrió la cuenta. Se pone 0 y el saldo
//     de ATLAS no tiene nada que ver con el del banco (caso real: apertura a
//     mano «1 ene 2025 = 0 €», ATLAS calculaba −2.045 y el banco decía 2.635).
//   · Anclar hacia delante TIRA historia: la apertura se plantaba en la última
//     línea del fichero y todo lo anterior dejaba de contar.
//
// El modelo correcto · la apertura es EL PUNTO MÁS ANTIGUO DEL QUE ATLAS TIENE
// DATO, y se mueve sola hacia atrás según llegan extractos:
//
//   1. Crear cuenta → «¿cuánto tienes HOY?» · fecha = hoy. Punto de partida
//      provisional, y un dato que el usuario SÍ sabe (CuentaWizard).
//   2. Extracto reciente → confirma o ajusta ese saldo de hoy. La fecha de
//      apertura no se mueve; cambia el importe (modo `ajuste`).
//   3. Extracto ANTIGUO → la apertura RETROCEDE hasta la línea más antigua del
//      fichero, con el saldo REAL del banco (modo `retroceso`). Sustituye al
//      saldo provisional. El usuario no inventa nada.
//
// ── La regla de cálculo (§31) ───────────────────────────────────────────────
//
// El saldo que trae una línea del extracto es el saldo DESPUÉS de esa línea.
// La apertura es el saldo con el que se LLEGA a la primera línea:
//
//        apertura = saldo de la línea más antigua − importe de esa línea
//
// NO el saldo de la línea tal cual: eso contaría su importe dos veces (una
// dentro del saldo de apertura y otra al sumar la propia línea).
//
// ── Coherencia con §9 y §30 ─────────────────────────────────────────────────
//
// El saldo del fichero NO es fiable a ciegas (retenidos, fecha valor): ATLAS
// PROPONE y el usuario CONFIRMA. Aquí no se escribe nada; escribir es
// `aplicarApertura`, y solo la llama el drawer cuando el usuario marca la
// casilla. Y el aviso de descuadre (§20 · «el banco dice X, ATLAS calcula Y,
// diferencia Z») se mantiene: se calcula sobre la línea más RECIENTE, que es
// donde el usuario reconoce el número.
// ============================================================================

import { initDB, type Account, type Movement, type TreasuryEvent } from './db';
import type { LineaExtractoPersistida } from './db/types-lineasExtracto';
import {
  calculateAccountBalanceAtDate,
  leerLineasParaSaldo,
  type LineaParaSaldo,
} from './accountBalanceService';
import { cuentasService } from './cuentasService';

/** La línea más RECIENTE con saldo · lo que el banco afirma «a día de hoy». */
export interface ExtremoReciente {
  /** YYYY-MM-DD. */
  fecha: string;
  /** El saldo del banco TRAS esa línea. */
  saldoBanco: number;
}

/** La línea más ANTIGUA con saldo · de ella se DERIVA la apertura. */
export interface ExtremoAntiguo extends ExtremoReciente {
  /** Su importe con signo · la apertura es `saldoBanco − importe`. */
  importe: number;
}

/** Los dos extremos del fichero · todo lo que hace falta para proponer. */
export interface ExtremosDelExtracto {
  masReciente: ExtremoReciente;
  masAntigua: ExtremoAntiguo;
}

/**
 * `retroceso` · el fichero empieza ANTES de la apertura actual: la apertura se
 * mueve a la línea más antigua con el saldo derivado del banco.
 * `ajuste` · el fichero es posterior a la apertura: la fecha no se toca y se
 * corrige el importe para cuadrar con el banco.
 */
export type ModoApertura = 'retroceso' | 'ajuste';

export interface Apertura {
  saldo: number;
  /** YYYY-MM-DD. */
  fecha: string;
}

export interface PropuestaDeApertura {
  /** Los extremos con los que se calculó · lo que necesita `aplicarApertura`. */
  extremos: ExtremosDelExtracto;

  // ── El cuadre (§20) · siempre por la línea más reciente ──────────────────
  /** YYYY-MM-DD de la línea más reciente. */
  fecha: string;
  /** El saldo del banco a esa fecha. */
  saldoBanco: number;
  /** Lo que ATLAS calcula HOY a esa misma fecha. */
  saldoAtlas: number;
  /** `saldoBanco − saldoAtlas` · 0 si cuadra. */
  descuadre: number;
  cuadra: boolean;

  // ── La propuesta ─────────────────────────────────────────────────────────
  modo: ModoApertura;
  /** La apertura que ATLAS propone · nada se escribe sin confirmar. */
  apertura: Apertura;
  aperturaActual: { saldo: number; fecha: string | null };
  /** `false` cuando la apertura ya ES la propuesta · no hay nada que ofrecer. */
  proponer: boolean;
  /** Lo que ATLAS calcularía a `fecha` si se aplica la propuesta. */
  saldoAtlasTrasAplicar: number;
  /** ¿Aplicarla deja a ATLAS y al banco diciendo lo mismo? */
  cuadraTrasAplicar: boolean;
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

const MISMO_EURO = 0.005;

/**
 * Los dos extremos del fichero con columna de saldo · `null` si no la trae
 * (§9: entonces la apertura la sigue poniendo el usuario a mano).
 *
 * Entre varias líneas del MISMO día manda el orden del fichero: un banco lista
 * de lo más nuevo a lo más viejo (Santander) o al revés, y el saldo que vale
 * es el de la última operación del día en un extremo y el de la primera en el
 * otro. La dirección se deduce de la propia columna de saldo (saldo tras la
 * línea − su importe = saldo de la anterior) y, si el fichero no lo deja
 * claro, de las fechas.
 */
export function extremosConSaldo(
  filas: ReadonlyArray<LineaExtractoPersistida>
): ExtremosDelExtracto | null {
  const conSaldo = filas
    .filter((f) => typeof f.saldo === 'number' && Number.isFinite(f.saldo) && ES_DIA.test(f.fechaOperacion))
    .slice()
    .sort((a, b) => (a.filaOriginal ?? a.id ?? 0) - (b.filaOriginal ?? b.id ?? 0));
  if (conSaldo.length === 0) return null;

  let fechaMax = conSaldo[0].fechaOperacion;
  let fechaMin = conSaldo[0].fechaOperacion;
  for (const f of conSaldo) {
    if (f.fechaOperacion > fechaMax) fechaMax = f.fechaOperacion;
    if (f.fechaOperacion < fechaMin) fechaMin = f.fechaOperacion;
  }

  const primera = conSaldo[0];
  const ultima = conSaldo[conSaldo.length - 1];
  const nuevoPrimero = esNuevoPrimero(conSaldo) ?? primera.fechaOperacion >= ultima.fechaOperacion;

  const delMax = conSaldo.filter((f) => f.fechaOperacion === fechaMax);
  const delMin = conSaldo.filter((f) => f.fechaOperacion === fechaMin);
  // La ÚLTIMA operación del día más reciente y la PRIMERA del día más antiguo.
  const reciente = nuevoPrimero ? delMax[0] : delMax[delMax.length - 1];
  const antigua = nuevoPrimero ? delMin[delMin.length - 1] : delMin[0];

  return {
    masReciente: { fecha: fechaMax, saldoBanco: reciente.saldo as number },
    masAntigua: { fecha: fechaMin, saldoBanco: antigua.saldo as number, importe: antigua.importe },
  };
}

/** La línea más reciente con saldo · el ancla del aviso de descuadre. */
export function lineaMasRecienteConSaldo(
  filas: ReadonlyArray<LineaExtractoPersistida>
): ExtremoReciente | null {
  return extremosConSaldo(filas)?.masReciente ?? null;
}

/** ¿El fichero lista lo más nuevo primero? · por la cadena de saldos. `null` si no se sabe. */
function esNuevoPrimero(filas: LineaExtractoPersistida[]): boolean | null {
  for (let i = 0; i + 1 < filas.length; i++) {
    const a = filas[i];
    const b = filas[i + 1];
    const sa = a.saldo as number;
    const sb = b.saldo as number;
    // Nuevo primero: el saldo de la siguiente (más vieja) es el de esta menos su importe.
    if (Math.abs(redondea(sa - a.importe) - sb) < MISMO_EURO) return true;
    // Viejo primero: el saldo de la siguiente (más nueva) es el de esta más el importe de la siguiente.
    if (Math.abs(redondea(sa + b.importe) - sb) < MISMO_EURO) return false;
  }
  return null;
}

/**
 * La propuesta · pura sobre lo que hay en la base. No escribe nada.
 *
 * `retroceso` cuando el fichero empieza antes de la apertura actual (o la
 * cuenta no tiene fecha de apertura, y entonces el fichero ES lo más antiguo
 * que ATLAS conoce): la apertura pasa a la línea más antigua con el saldo
 * DERIVADO (§31 · saldo − importe).
 *
 * `ajuste` en el resto: el fichero cae dentro de lo que ATLAS ya cubría, así
 * que la fecha de apertura se respeta —moverla hacia delante tiraría
 * historia— y solo se corrige el importe con el descuadre, que es exactamente
 * lo que hace falta para que la línea más reciente cuadre con el banco.
 */
export function calcularApertura(p: {
  account: Account;
  extremos: ExtremosDelExtracto;
  treasuryEvents: TreasuryEvent[];
  movements: Movement[];
  lineas: LineaParaSaldo[];
}): PropuestaDeApertura {
  const { account, extremos, treasuryEvents, movements, lineas } = p;
  const cutoffDate = diaSiguiente(extremos.masReciente.fecha);
  const saldoA = (a: Account): number =>
    redondea(calculateAccountBalanceAtDate({ account: a, cutoffDate, treasuryEvents, movements, lineas }));

  const saldoBanco = extremos.masReciente.saldoBanco;
  const saldoAtlas = saldoA(account);
  const descuadre = redondea(saldoBanco - saldoAtlas);

  const fechaApertura = soloDia(account.openingBalanceDate);
  const saldoApertura = account.openingBalance ?? 0;
  const retrocede = fechaApertura == null || extremos.masAntigua.fecha < fechaApertura;

  const apertura: Apertura = retrocede
    ? {
        // §31 · el saldo con el que se LLEGA a la línea más antigua.
        fecha: extremos.masAntigua.fecha,
        saldo: redondea(extremos.masAntigua.saldoBanco - extremos.masAntigua.importe),
      }
    : {
        // La frontera no se mueve, así que corregir el importe con el
        // descuadre deja el saldo de ATLAS clavado en el del banco.
        fecha: fechaApertura as string,
        saldo: redondea(saldoApertura + descuadre),
      };

  const saldoAtlasTrasAplicar = saldoA({
    ...account,
    openingBalance: apertura.saldo,
    openingBalanceDate: apertura.fecha,
  });

  return {
    extremos,
    fecha: extremos.masReciente.fecha,
    saldoBanco,
    saldoAtlas,
    descuadre,
    cuadra: Math.abs(descuadre) < MISMO_EURO,
    modo: retrocede ? 'retroceso' : 'ajuste',
    apertura,
    aperturaActual: { saldo: saldoApertura, fecha: fechaApertura },
    proponer: !(apertura.fecha === fechaApertura && Math.abs(apertura.saldo - saldoApertura) < MISMO_EURO),
    saldoAtlasTrasAplicar,
    cuadraTrasAplicar: Math.abs(redondea(saldoBanco - saldoAtlasTrasAplicar)) < MISMO_EURO,
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
export async function propuestaDeApertura(
  db: Base,
  account: Account,
  filas: ReadonlyArray<LineaExtractoPersistida>
): Promise<PropuestaDeApertura | null> {
  const extremos = extremosConSaldo(filas);
  if (!extremos) return null;
  return calcularApertura({ account, extremos, ...(await loQueSumaLaCuenta(db)) });
}

/**
 * Aplicar la apertura · SOLO tras confirmarla el usuario. Se recalcula sobre
 * la base de ese momento (al guardar ya han nacido los movimientos de la
 * sesión; el hub los cuenta igual que contaba las líneas). Devuelve la
 * apertura escrita, o `null` si ya no había nada que proponer.
 */
export async function aplicarApertura(
  accountId: number,
  extremos: ExtremosDelExtracto
): Promise<{ openingBalance: number; openingBalanceDate: string } | null> {
  const db = await initDB();
  const account = (await db.get('accounts', accountId)) as Account | undefined;
  if (!account) throw new Error('La cuenta ya no existe · no se puede fijar su apertura.');

  const propuesta = calcularApertura({ account, extremos, ...(await loQueSumaLaCuenta(db)) });
  if (!propuesta.proponer) return null;

  const apertura = {
    openingBalance: propuesta.apertura.saldo,
    openingBalanceDate: propuesta.apertura.fecha,
  };
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
      date: apertura.openingBalanceDate,
      valueDate: apertura.openingBalanceDate,
      balance: apertura.openingBalance,
      saldo: apertura.openingBalance,
      type: apertura.openingBalance >= 0 ? 'Ingreso' : 'Gasto',
      updatedAt: new Date().toISOString(),
    });
  }
  return apertura;
}
