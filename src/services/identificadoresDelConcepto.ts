// ============================================================================
// E2.1 · Los identificadores que el banco escribe dentro del concepto
// ============================================================================
//
// Un recibo trae, mezclado con el texto, lo que de verdad identifica el
// contrato: el CUPS del suministro, el número de contrato del préstamo, el NIF
// del que cobra, el IBAN del que envía, los cuatro últimos de la tarjeta.
// Hasta E2.1 el aprendizaje los borraba como «ruido» (`removeVolatileTokens`
// tira todo número de cuatro o más cifras), y con ellos se iba la única pieza
// que distingue dos recibos de Iberdrola de dos pisos distintos.
//
// Aquí se extraen. Con dos reglas que no son de estilo:
//
//   · Se distingue IDENTIFICADOR ESTABLE de RUIDO VOLÁTIL. Un nº de recibo
//     («Adeudo nº 2026036000123456»), una referencia de compra
//     («Amazon Prime*Z12968TU5»), la fecha embebida («31/08/25») cambian cada
//     mes y NO son identificadores: siguen fuera. Solo entra lo que tiene forma
//     verificable (CUPS, IBAN con su dígito de control, NIF con su letra) o lo
//     que el banco etiqueta como contrato (CONTRATO / PÓLIZA / MANDATO /
//     PRÉSTAMO / CUOTA N.).
//   · No se inventa. Sin forma reconocible no hay identificador, y el texto
//     sigue el camino de siempre.
//
// Precedente: `documentAutoClassifyService.elegirCompromiso` (facturas OCR),
// que ya cruza por `cups` → `numeroContrato` → `nif`. El valor se normaliza
// igual que allí (`normId`: mayúsculas, sin espacios/puntos/guiones) para que
// E2.3 pueda comparar con `compromisosRecurrentes.cups` / `.numeroContrato`
// sin volver a transformar nada.
//
// Puro. No toca la base.
// ============================================================================

import type { Movement } from './db';

export type TipoIdentificador = 'cups' | 'iban' | 'nif' | 'contrato' | 'tarjeta';

export interface Identificador {
  tipo: TipoIdentificador;
  /** Normalizado · mayúsculas, sin espacios, puntos, guiones ni barras. */
  valor: string;
}

/** La misma normalización que `documentAutoClassifyService.normId`. */
export function normalizarIdentificador(s: string): string {
  return s.toUpperCase().replace(/[\s.\-/]/g, '');
}

/** «tipo:valor» · la forma en que un identificador entra en una clave. */
export function claveDeIdentificador(id: Identificador): string {
  return `${id.tipo}:${id.valor}`;
}

// ─── Validaciones · lo que se puede comprobar, se comprueba ─────────────────

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';

/** DNI (8 cifras + letra) o NIE (X/Y/Z + 7 cifras + letra) con la letra bien. */
export function esNifPersona(s: string): boolean {
  const m = /^([XYZ]?)(\d{7,8})([A-Z])$/.exec(s);
  if (!m) return false;
  const [, prefijo, cifras, letra] = m;
  if (prefijo && cifras.length !== 7) return false;
  if (!prefijo && cifras.length !== 8) return false;
  const numero = Number(`${{ X: '0', Y: '1', Z: '2', '': '' }[prefijo]}${cifras}`);
  return LETRAS_DNI[numero % 23] === letra;
}

/** CIF (letra + 7 cifras + control) con el control bien, sea cifra o letra. */
export function esCif(s: string): boolean {
  const m = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(s);
  if (!m) return false;
  const cifras = m[2];
  let suma = 0;
  for (let i = 0; i < 7; i++) {
    const d = Number(cifras[i]);
    if (i % 2 === 0) {
      // Posiciones impares (1ª, 3ª, 5ª, 7ª) · se doblan y se suman sus cifras.
      const doble = d * 2;
      suma += Math.floor(doble / 10) + (doble % 10);
    } else {
      suma += d;
    }
  }
  const control = (10 - (suma % 10)) % 10;
  return m[3] === String(control) || m[3] === 'JABCDEFGHI'[control];
}

/** IBAN con el módulo 97 bien · sin separadores. */
export function esIban(s: string): boolean {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const reordenado = s.slice(4) + s.slice(0, 4);
  let resto = 0;
  for (const ch of reordenado) {
    const v = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) resto = (resto * 10 + Number(d)) % 97;
  }
  return resto === 1;
}

// ─── Extracción ─────────────────────────────────────────────────────────────

/** Sin tildes, en mayúsculas · los separadores se conservan para las formas. */
function preparar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/N[º°]/g, 'Nº');
}

/** CUPS · ES + 16 cifras + 2 letras de control (+ 1 cifra y 1 letra opcionales). */
const CUPS = /\bES\d{16}[A-Z]{2}(?:\d[A-Z])?\b/g;

/** IBAN · país + 2 cifras + hasta 30 alfanuméricos, en grupos de 4 con separador opcional. */
const IBAN = /\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]{4}){2,7}(?:[ -]?[A-Z0-9]{1,4})?\b/g;

/**
 * NIF/CIF/NIE · solo o pegado a un sufijo de 3 cifras (Sabadell escribe el
 * identificador del acreedor SEPA como «B67686782001»: CIF + 001).
 */
const NIF = /\b([XYZ]\d{7}[A-Z]|\d{8}[A-Z]|[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J])(?:\d{3})?\b/g;

/**
 * Nº de contrato etiquetado por el banco · CONTRATO / POLIZA / MANDATO /
 * PRESTAMO / HIPOTECA / CUOTA y, en los sesenta caracteres que siguen, el
 * número. Se leen las palabras: se saltan hasta tres sin cifras («ADEUDO
 * CUOTA»), se quita el «Nº» / «N.» / «NUM» pegado, y se toman las seguidas que
 * llevan cifras hasta la primera que no vale. La fecha embebida («31/08/25»)
 * no vale porque lleva barras; «CUOTA AGOSTO PLAN UNI SEGUR» no tiene cifras.
 */
const CONTRATO_ETIQUETADO =
  /\b(?:CONTRATO|POLIZA|MANDATO|PRESTAMOS?|HIPOTECA|CUOTA)\b([^\n]{0,60})/g;
const MAX_PALABRAS_SALTADAS = 3;
const PREFIJO_NUMERO = /^(?:REF\.?|Nº|NUM\.?|N\.|:)+/;

/** El número que sigue a la etiqueta · `null` si no hay ninguno que valga. */
function numeroTrasEtiqueta(resto: string): { valor: string; fin: number } | null {
  const palabra = /\S+/g;
  const grupos: string[] = [];
  let saltadas = 0;
  let fin = 0;
  let m: RegExpExecArray | null;
  while ((m = palabra.exec(resto)) !== null) {
    const limpia = m[0].replace(PREFIJO_NUMERO, '').replace(/[,.;]+$/, '');
    const vale = /^[A-Z0-9]{3,}$/.test(limpia) && /\d/.test(limpia);
    if (vale) {
      grupos.push(limpia);
      fin = m.index + m[0].length;
      continue;
    }
    if (grupos.length > 0) break; // el número se acabó
    if (!/\d/.test(limpia) && saltadas < MAX_PALABRAS_SALTADAS && limpia !== '') {
      saltadas++;
      continue;
    }
    break; // una fecha, una barra, demasiadas palabras · aquí no hay número
  }
  if (grupos.length === 0) return null;
  const valor = normalizarIdentificador(grupos.join(''));
  // Un contrato tiene cifras de sobra · «UNICAJA 0123» no es uno.
  if ((valor.match(/\d/g) ?? []).length < 5 || valor.length < 6) return null;
  return { valor, fin };
}

/**
 * Contrato con forma de cuenta · 4 cifras de entidad, 4 de oficina, 2-3 de
 * control opcionales y 7-10 de número, con separador. Es lo que BBVA pone en
 * `Movimiento` («0182-5322-27-0830842450»).
 */
const CONTRATO_FORMA_CUENTA = /\b\d{4}[ -]\d{4}[ -](?:\d{2,3}[ -])?\d{7,10}\b/g;

/** Los cuatro últimos de la tarjeta · «Revolut**9527*». */
const TARJETA = /\*+(\d{4})(?!\d)/g;

/** Tapa lo ya reconocido para que no lo vuelva a coger otra forma. */
function tapar(texto: string, desde: number, longitud: number): string {
  return texto.slice(0, desde) + ' '.repeat(longitud) + texto.slice(desde + longitud);
}

function recoger(
  texto: string,
  forma: RegExp,
  acepta: (m: RegExpExecArray) => { id: Identificador; longitud?: number } | null
): { texto: string; encontrados: Identificador[] } {
  const encontrados: Identificador[] = [];
  let t = texto;
  forma.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = forma.exec(t)) !== null) {
    const r = acepta(m);
    if (r) {
      encontrados.push(r.id);
      // Se tapa SOLO lo que se ha usado: si el contrato acaba antes de lo que
      // la forma abarcó, lo que sigue puede ser otra etiqueta.
      const longitud = r.longitud ?? m[0].length;
      t = tapar(t, m.index, longitud);
      forma.lastIndex = m.index + longitud;
    } else {
      // Rechazado · se sigue desde la letra siguiente, no desde el final de lo
      // abarcado: «PRESTAMOS ADEUDO CUOTA N.807…» falla en PRESTAMOS (sin
      // cifras) y tiene que llegar a CUOTA.
      forma.lastIndex = m.index + 1;
    }
  }
  return { texto: t, encontrados };
}

/**
 * Los identificadores estables de un texto del banco, en orden de fuerza:
 * CUPS, IBAN, NIF, contrato, tarjeta. Sin duplicados. Vacío si no hay ninguno.
 */
export function extraerIdentificadores(texto: string | null | undefined): Identificador[] {
  if (!texto) return [];
  let t = preparar(texto);
  const salida: Identificador[] = [];

  let r = recoger(t, CUPS, (m) => ({ id: { tipo: 'cups', valor: normalizarIdentificador(m[0]) } }));
  t = r.texto; salida.push(...r.encontrados);

  r = recoger(t, IBAN, (m) => {
    const v = normalizarIdentificador(m[0]);
    return esIban(v) ? { id: { tipo: 'iban', valor: v } } : null;
  });
  t = r.texto; salida.push(...r.encontrados);

  r = recoger(t, NIF, (m) => {
    const v = m[1];
    return esNifPersona(v) || esCif(v) ? { id: { tipo: 'nif', valor: v } } : null;
  });
  t = r.texto; salida.push(...r.encontrados);

  r = recoger(t, CONTRATO_ETIQUETADO, (m) => {
    const numero = numeroTrasEtiqueta(m[1]);
    if (!numero) return null;
    return {
      id: { tipo: 'contrato', valor: numero.valor },
      longitud: m[0].length - m[1].length + numero.fin,
    };
  });
  t = r.texto; salida.push(...r.encontrados);

  r = recoger(t, CONTRATO_FORMA_CUENTA, (m) => ({
    id: { tipo: 'contrato', valor: normalizarIdentificador(m[0]) },
  }));
  t = r.texto; salida.push(...r.encontrados);

  r = recoger(t, TARJETA, (m) => ({ id: { tipo: 'tarjeta', valor: m[1] } }));
  salida.push(...r.encontrados);

  return sinRepetir(salida);
}

function sinRepetir(ids: Identificador[]): Identificador[] {
  const vistos = new Set<string>();
  const out: Identificador[] = [];
  for (const id of ids) {
    const k = claveDeIdentificador(id);
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(id);
  }
  return out;
}

/**
 * Los identificadores de un movimiento · se miran el concepto, la contraparte
 * y la referencia, porque cada banco lo pone en una columna distinta: BBVA
 * lleva el contrato en `Movimiento` (→ `reference`), Sabadell el NIF del
 * acreedor en `Referencia 1`, Santander y Unicaja todo dentro del concepto.
 * Ordenados y sin repetir, para que la clave que salga sea siempre la misma.
 */
export function identificadoresDeMovimiento(
  m: Pick<Movement, 'description' | 'counterparty' | 'reference'>
): Identificador[] {
  const todos = [
    ...extraerIdentificadores(m.description),
    ...extraerIdentificadores(m.counterparty),
    ...extraerIdentificadores(m.reference),
  ];
  return sinRepetir(todos).sort((a, b) =>
    claveDeIdentificador(a).localeCompare(claveDeIdentificador(b))
  );
}
