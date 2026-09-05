// E2.4 · Traspasos PROPIOS · el dinero que cambia de cuenta sin cambiar de dueño.
//
// 237 líneas del fichero real son «Transferencia De Gomez Ramirez Jose Antonio»
// o «Transferencia A Favor De Gomez Ramirez Jose Antonio»: el usuario moviendo
// dinero entre sus cuentas. Hoy cada una cae a «te necesitan» y, si no la toca,
// se cuenta como ingreso o gasto y el patrimonio se mueve sin motivo (§1).
//
// Se reconoce que el OTRO LADO es del propio usuario por dos señales, cada una
// concluyente por sí sola:
//   · el IBAN de una cuenta propia (`accounts.iban`) aparece en el texto;
//   · la PARTE de la transferencia (lo que va detrás de «DE» / «A FAVOR DE»)
//     es el titular: dos palabras del nombre, como `coincidenciaNombre`. Si el
//     banco no dice dónde empieza la parte, se exige que el texto entero lleve
//     TRES palabras del nombre, para que «PARA JOSE» no baste.
//
// Los bancos recortan las tildes a su manera —Sabadell escribe «Jos Antonio
// G mez Ram rez»—, así que el nombre del titular se compara también en esa
// versión rota (la letra acentuada, sustituida por un hueco).
//
// A QUÉ cuenta va: por el IBAN si viene; si no, por el movimiento ESPEJO que
// ya exista en otra cuenta propia (mismo importe, signo contrario, ±3 días,
// uno solo). Sin ninguna de las dos se marca como traspaso SIN pata al otro
// lado: se sabe lo que es, no se inventa a dónde fue.
//
// Puro. No toca la base.

import type { Movement } from '../db';
import type { Account } from '../db/types-contratos';
import type { OrigenDeterminista } from './tipos';
import { mismoImporte } from './igualdad';
import { normalizarTexto } from './texto';
import { identificadoresDeMovimiento, normalizarIdentificador } from '../identificadoresDelConcepto';
import { palabrasEnComun } from '../coincidenciaNombre';
import { estaDeBaja } from '../cuentasEnUso';
import { isTransferKey } from '../categoryCatalog';

const MS_DIA = 86_400_000;
/** El espejo puede llegar al otro banco hasta esto después (o antes). */
const DIAS_ESPEJO = 3;
/** Palabras del nombre que hacen falta cuando se sabe dónde empieza la parte. */
const PALABRAS_EN_LA_PARTE = 2;
/** …y cuando no se sabe, en el texto entero. */
const PALABRAS_EN_EL_TEXTO = 3;

/** Lo mínimo de una persona para saber si es ella · `PersonalData` lo cumple. */
export interface QuienEsElTitular {
  nombre?: string;
  apellidos?: string;
}

// ─── quién es el titular ────────────────────────────────────────────────────

/**
 * El nombre tal como lo escribe un banco que recorta tildes: «José» → «Jos »,
 * «Gómez» → «G mez». Se compara por palabras de tres letras o más, así que
 * «Jos» y «mez» cuentan igual que «Jose» y «Gomez» en la versión buena.
 */
function conLasTildesRotas(nombre: string): string {
  return nombre.normalize('NFD').replace(/[A-Za-z][\u0300-\u036f]+/g, ' ');
}

/**
 * Los nombres con los que el usuario puede aparecer en un extracto · los de
 * `personalData` y los titulares de sus cuentas, cada uno tal cual y con las
 * tildes rotas. Sin nombres no hay reconocimiento por parte; queda el IBAN.
 */
export function nombresDelTitular(personas: QuienEsElTitular[], cuentas: Account[]): string[] {
  const base = new Set<string>();
  for (const p of personas) {
    const completo = `${p.nombre ?? ''} ${p.apellidos ?? ''}`.trim();
    if (completo) base.add(completo);
  }
  for (const c of cuentas) {
    const t = c.titular?.nombre?.trim();
    if (t) base.add(t);
  }
  const out = new Set<string>();
  for (const n of base) {
    out.add(n);
    out.add(n.replace(/ñ/g, 'n').replace(/Ñ/g, 'N'));
    out.add(conLasTildesRotas(n));
  }
  return Array.from(out);
}

// ─── la parte de la transferencia ───────────────────────────────────────────

const CABECERA =
  /\b(?:TRANSFERENCIAS?|TRANSF|TRASPASO|TRANSFER|ORDEN DE PAGO|ABONO (?:POR )?TRANSFERENCIA)\b(?:\s+(?:INMEDIATA|RECIBIDA|EMITIDA|SEPA|PERIODICA|NACIONAL|INTERNA|ENTRE CUENTAS|INTERNACIONAL))*\s+(?:A FAVOR DE|RECIBIDA DE|EMITIDA A|ORDENANTE|BENEFICIARIO|DE|A|PARA)\s+(.+)$/;
const FIN_DE_LA_PARTE = /\s+(?:CONCEPTO|CONCEP|REF|REFERENCIA|IBAN|CTA|CUENTA|ES\d{2}\s?\d|N\s?\d|\d{6,}).*$/;

/**
 * Lo que va detrás de «DE» / «A FAVOR DE» en el texto del banco · `null` si
 * el texto no tiene esa forma. Sobre el texto NORMALIZADO (`normalizarTexto`).
 */
export function parteDeLaTransferencia(textoNormalizado: string): string | null {
  const m = CABECERA.exec(textoNormalizado);
  if (!m) return null;
  const parte = m[1].replace(FIN_DE_LA_PARTE, '').trim();
  return parte.length >= 3 ? parte : null;
}

/** ¿El otro lado de esta transferencia es el propio titular? */
export function laParteEsElTitular(texto: string, nombres: string[]): boolean {
  if (nombres.length === 0) return false;
  const norm = normalizarTexto(texto);
  const parte = parteDeLaTransferencia(norm);
  const minimo = parte ? PALABRAS_EN_LA_PARTE : PALABRAS_EN_EL_TEXTO;
  const contra = parte ?? norm;
  return nombres.some((n) => palabrasEnComun(contra, n) >= minimo);
}

// ─── a qué cuenta ───────────────────────────────────────────────────────────

/** La cuenta propia cuyo IBAN aparece en el texto · distinta de la del cargo. */
export function cuentaPropiaPorIban(m: Movement, cuentas: Account[]): Account | undefined {
  const ibans = identificadoresDeMovimiento(m)
    .filter((id) => id.tipo === 'iban')
    .map((id) => id.valor);
  if (ibans.length === 0) return undefined;
  const encontradas = cuentas.filter(
    (c) => c.id != null && c.id !== m.accountId && c.iban && ibans.includes(normalizarIdentificador(c.iban)),
  );
  return encontradas.length === 1 ? encontradas[0] : undefined;
}

function dia(iso: string): number {
  const [y, mo, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, mo - 1, d);
}

/** ¿Este movimiento ya es una pata de traspaso emparejada? */
function yaEmparejado(m: Movement): boolean {
  return m.transferMetadata?.pairMovementId != null || isTransferKey(m.categoryKey);
}

/**
 * El movimiento que ya existe en OTRA cuenta propia y es el otro lado de este:
 * misma magnitud, signo contrario, a ±3 días, sin pareja. Uno solo o ninguno.
 */
export function espejoDe(m: Movement, otros: Movement[], cuentasPropias: ReadonlySet<number>): Movement | undefined {
  const t = dia(m.date);
  const candidatos = otros.filter(
    (o) =>
      o.id != null &&
      o.id !== m.id &&
      o.accountId !== m.accountId &&
      cuentasPropias.has(o.accountId) &&
      Math.sign(o.amount) === -Math.sign(m.amount) &&
      mismoImporte(o.amount, m.amount) &&
      Math.abs(dia(o.date) - t) <= DIAS_ESPEJO * MS_DIA &&
      !yaEmparejado(o),
  );
  return candidatos.length === 1 ? candidatos[0] : undefined;
}

// ─── el reconocimiento ──────────────────────────────────────────────────────

/** Cómo se llama la cuenta en pantalla · alias, banco o el final del IBAN. */
export function nombreDeCuenta(c: Account): string {
  return c.alias?.trim() || c.banco?.name?.trim() || (c.iban ? `cuenta ···${c.iban.slice(-4)}` : 'otra cuenta tuya');
}

/**
 * ¿Merece la pena buscar espejos en `movements` para este lote? · para no
 * leer el store entero cuando ninguna línea parece un traspaso propio.
 */
export function pareceTraspasoPropio(m: Movement, cuentas: Account[], nombres: string[]): boolean {
  if (m.id == null || m.amount === 0) return false;
  return !!cuentaPropiaPorIban(m, cuentas) || laParteEsElTitular(`${m.description ?? ''} ${m.counterparty ?? ''}`, nombres);
}

/**
 * Reconoce las líneas que son un traspaso entre cuentas del propio usuario.
 *
 * `otrosMovimientos` son los que ya existen en las demás cuentas (para buscar
 * el espejo); puede venir vacío y entonces solo el IBAN dice a qué cuenta.
 */
export function traspasosPropios(
  movimientos: Movement[],
  cuentas: Account[],
  nombres: string[],
  otrosMovimientos: Movement[] = [],
): OrigenDeterminista[] {
  const out: OrigenDeterminista[] = [];
  const enUso = cuentas.filter((c) => c.id != null && !estaDeBaja(c));
  const idsPropios = new Set(cuentas.map((c) => c.id as number).filter((id) => id != null));
  if (idsPropios.size === 0) return out;

  for (const m of movimientos) {
    if (m.id == null || m.amount === 0) continue;
    const texto = `${m.description ?? ''} ${m.counterparty ?? ''}`;

    const porIban = cuentaPropiaPorIban(m, cuentas);
    const porTitular = !porIban && laParteEsElTitular(texto, nombres);
    if (!porIban && !porTitular) continue;

    const sentido = m.amount < 0 ? 'salida' : 'entrada';
    const espejo = espejoDe(m, otrosMovimientos, idsPropios);
    // La cuenta contraria: la del IBAN, o la del espejo. Solo si sigue en uso:
    // a una cuenta de baja no se le escribe una pata nueva.
    const contraria =
      (porIban && !estaDeBaja(porIban) ? porIban : undefined) ??
      (espejo ? enUso.find((c) => c.id === espejo.accountId) : undefined);

    const titulo = contraria
      ? `Traspaso ${sentido === 'salida' ? 'a' : 'desde'} ${nombreDeCuenta(contraria)}`
      : 'Traspaso entre tus cuentas';

    out.push({
      movementId: m.id,
      fuente: 'traspaso',
      origenId: contraria?.id != null ? String(contraria.id) : '',
      ...(espejo?.id != null ? { piezaId: String(espejo.id) } : {}),
      titulo,
      como: 'identidad',
      traspaso: {
        sentido,
        ...(contraria?.id != null ? { cuentaContrariaId: contraria.id } : {}),
        ...(espejo?.id != null && contraria ? { movimientoEspejoId: espejo.id } : {}),
      },
    });
  }

  return out;
}
