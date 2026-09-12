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

/**
 * E3.1 · §7.1 · la ETIQUETA del banco no decide sola.
 *
 * «NOMINA GOMEZ RAMIREZ JOSE ANTONIO» y «Nomina recibida GOMEZ RAMIREZ JOSE
 * ANTONIO» los escribe el banco como nómina, pero el ordenante es el PROPIO
 * titular: es dinero suyo que cambia de cuenta, no un sueldo que entra. 21
 * casos en el corpus, 21 ingresos inventados que movían el patrimonio.
 *
 * Se exige que el nombre vaya DETRÁS de la etiqueta de nómina (no en cualquier
 * parte del texto) y que sea el titular con el mismo listón que la parte de una
 * transferencia. Una nómina de verdad trae el nombre de la EMPRESA, no el tuyo.
 */
const CABECERA_NOMINA = /\b(?:NOMINAS?|ABONO DE NOMINA|NOMINA RECIBIDA|SALARIO|HABERES)\b[ .:-]*(?:RECIBIDA|ABONO|DE|A FAVOR DE)?[ .:-]*(.+)$/;

export function esNominaDelPropioTitular(texto: string, nombres: string[]): boolean {
  if (nombres.length === 0) return false;
  const norm = normalizarTexto(texto);
  const m = CABECERA_NOMINA.exec(norm);
  if (!m) return false;
  const parte = m[1].replace(FIN_DE_LA_PARTE, '').trim();
  if (parte.length < 3) return false;
  return nombres.some((n) => palabrasEnComun(parte, n) >= PALABRAS_EN_LA_PARTE);
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
  return m.transferMetadata?.pairMovementId != null || m.naturaleza === 'movimiento_interno';
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

// ─── E3.1 · §7.1 · el CRUCE DE PATAS ────────────────────────────────────────
//
// Hasta aquí el traspaso se reconocía por el NOMBRE del titular o por el IBAN:
// si el banco no escribía ninguno de los dos, no había traspaso. El cruce mira
// el OTRO dato que siempre está: una salida en la cuenta A que es una entrada
// en la cuenta B a ±3 días por el mismo importe.
//
// Dos guardas, porque sin ellas esto convierte en traspaso cualquier
// coincidencia de importe:
//
//   · una de las dos patas tiene que OLER a traspaso (el nombre del titular,
//     «ahorro», «traspaso», «enviado por»). Dos alquileres de 400 € el mismo
//     día en dos cuentas NO son un traspaso;
//   · NUNCA sobre lo que el banco ya dice que es otra cosa: un recibo
//     domiciliado, un cajero, un alquiler. Ahí la coincidencia es casualidad.

/** Lo que huele a traspaso aunque el banco no diga el nombre de nadie. */
const HUELE_A_TRASPASO = /\b(?:AHORROS?|TRASPASO|TRASPASOS|ENVIADO POR|ENVIADA DESDE|ENTRE CUENTAS|A MI CUENTA)\b/;

/** Lo que NUNCA es un traspaso propio por mucho que los importes casen. */
const NO_ES_TRASPASO =
  /\b(?:RECIBO|ADEUDO|DOMICILIACION|CAJERO|REINTEGRO|RETIRADA|ALQUILER|RENTA|NOMINA|COMPRA|PAGO EN|TARJETA|COMISION|PRESTAMO|HIPOTECA)\b/;

function textoDe(m: Movement): string {
  return normalizarTexto(`${m.description ?? ''} ${m.counterparty ?? ''}`);
}

/** ¿Esta pata puede entrar en un cruce? · lo que el banco llama otra cosa, no. */
export function puedeCruzar(m: Movement): boolean {
  return !NO_ES_TRASPASO.test(textoDe(m));
}

/** ¿Esta pata HUELE a traspaso? · basta con que lo haga UNA de las dos. */
export function hueleATraspaso(m: Movement, nombres: string[]): boolean {
  const t = textoDe(m);
  if (HUELE_A_TRASPASO.test(t)) return true;
  return nombres.some((n) => palabrasEnComun(t, n) >= PALABRAS_EN_LA_PARTE);
}

/** Una pareja de patas cruzada · las dos se marcan, y cada una nombra a la otra. */
export interface PatasCruzadas {
  salida: Movement;
  entrada: Movement;
}

/**
 * Las parejas (salida en A ↔ entrada en B) de un conjunto de movimientos de
 * VARIAS cuentas propias. Cada movimiento entra en UNA pareja como mucho, y
 * solo se cruza cuando la pareja es ÚNICA: dos entradas candidatas para una
 * salida es una duda, y una duda no se resuelve inventando.
 */
export function cruzarPatas(
  movimientos: readonly Movement[],
  cuentasPropias: ReadonlySet<number>,
  nombres: string[],
): PatasCruzadas[] {
  const vivos = movimientos.filter(
    (m) => m.id != null && m.amount !== 0 && cuentasPropias.has(m.accountId) && !yaEmparejado(m) && puedeCruzar(m),
  );
  const salidas = vivos.filter((m) => m.amount < 0);
  const entradas = vivos.filter((m) => m.amount > 0);
  const usados = new Set<number>();
  const out: PatasCruzadas[] = [];

  for (const salida of salidas) {
    if (usados.has(salida.id as number)) continue;
    const t = dia(salida.date);
    const candidatas = entradas.filter(
      (e) =>
        !usados.has(e.id as number) &&
        e.accountId !== salida.accountId &&
        mismoImporte(e.amount, salida.amount) &&
        Math.abs(dia(e.date) - t) <= DIAS_ESPEJO * MS_DIA,
    );
    if (candidatas.length !== 1) continue;
    const entrada = candidatas[0];
    // Una de las dos tiene que oler a traspaso · si ninguna lo hace, la
    // coincidencia de importe no basta.
    if (!hueleATraspaso(salida, nombres) && !hueleATraspaso(entrada, nombres)) continue;
    usados.add(salida.id as number);
    usados.add(entrada.id as number);
    out.push({ salida, entrada });
  }
  return out;
}

/**
 * §7.1 · las cuentas que FALTAN · una pata cruzada cuya cuenta contraria no
 * está dada de alta significa que el usuario tiene una cuenta que ATLAS no
 * conoce. No se crea sola: se propone.
 */
export function cuentasQueFaltan(
  cruces: readonly PatasCruzadas[],
  cuentas: Account[],
): number[] {
  const conocidas = new Set(cuentas.filter((c) => c.id != null && !estaDeBaja(c)).map((c) => c.id as number));
  const faltan = new Set<number>();
  for (const { salida, entrada } of cruces) {
    if (!conocidas.has(salida.accountId)) faltan.add(salida.accountId);
    if (!conocidas.has(entrada.accountId)) faltan.add(entrada.accountId);
  }
  return Array.from(faltan);
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
  const texto = `${m.description ?? ''} ${m.counterparty ?? ''}`;
  return (
    !!cuentaPropiaPorIban(m, cuentas) ||
    laParteEsElTitular(texto, nombres) ||
    esNominaDelPropioTitular(texto, nombres)
  );
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

  // §7.1 · el CRUCE DE PATAS · se hace UNA vez sobre el lote entero + lo que ya
  // había en las demás cuentas, y deja un mapa movimiento → su pareja. Marca
  // las DOS patas: hasta E3.1 solo se marcaba la que traía el nombre.
  const cruzados = new Map<number, Movement>();
  for (const { salida, entrada } of cruzarPatas([...movimientos, ...otrosMovimientos], idsPropios, nombres)) {
    cruzados.set(salida.id as number, entrada);
    cruzados.set(entrada.id as number, salida);
  }

  for (const m of movimientos) {
    if (m.id == null || m.amount === 0) continue;
    const texto = `${m.description ?? ''} ${m.counterparty ?? ''}`;

    const porIban = cuentaPropiaPorIban(m, cuentas);
    const porTitular = !porIban && laParteEsElTitular(texto, nombres);
    // §7.1 · la etiqueta «nómina» del banco NO decide sola: si el ordenante
    // es el propio titular, es un traspaso y no un ingreso.
    const porNomina = !porIban && !porTitular && esNominaDelPropioTitular(texto, nombres);
    // §7.1 · el CRUCE · esta pata no dice nada por sí sola, pero su pareja al
    // otro lado sí, y el cruce ya las emparejó.
    const cruce = !porIban && !porTitular && !porNomina ? cruzados.get(m.id) : undefined;
    if (!porIban && !porTitular && !porNomina && !cruce) continue;

    const sentido = m.amount < 0 ? 'salida' : 'entrada';
    const espejo = espejoDe(m, otrosMovimientos, idsPropios) ?? cruce;
    // La cuenta contraria: la del IBAN, o la del espejo. Solo si sigue en uso:
    // a una cuenta de baja no se le escribe una pata nueva.
    const contraria =
      (porIban && !estaDeBaja(porIban) ? porIban : undefined) ??
      (espejo ? enUso.find((c) => c.id === espejo.accountId) : undefined);

    // §7.1 · el título DICE por qué, porque el usuario tiene que poder no
    // estar de acuerdo: una «nómina» que ATLAS convierte en traspaso sin
    // explicarse es una cifra que cambia sola.
    const titulo = porNomina
      ? contraria
        ? `Traspaso ${sentido === 'salida' ? 'a' : 'desde'} ${nombreDeCuenta(contraria)} · el banco lo llama nómina, pero el ordenante eres tú`
        : 'Traspaso entre tus cuentas · el banco lo llama nómina, pero el ordenante eres tú'
      : contraria
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
