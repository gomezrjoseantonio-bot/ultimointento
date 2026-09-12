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

export type TipoIdentificador =
  | 'cups'
  | 'iban'
  | 'nif'
  | 'contrato'
  /** E3.1 · §7.2 · el mandato SEPA · un recurrente = un mandato. */
  | 'mandato'
  /** E3.1 · §7.2 · el NOMBRE del acreedor que el banco escribe al lado · lo que cruza el catálogo nacional. */
  | 'acreedor'
  | 'tarjeta';

export interface Identificador {
  tipo: TipoIdentificador;
  /** Normalizado · mayúsculas, sin espacios, puntos, guiones ni barras. */
  valor: string;
  /**
   * E3.1 · el texto TAL COMO lo escribió el banco, cuando el valor normalizado
   * ya no sirve para leerlo. Solo lo trae `acreedor` («BIP   DRIVE, S.A.»):
   * la clave sigue siendo `valor`, esto es para enseñarlo y para aprenderlo.
   */
  texto?: string;
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
  /\b(CONTRATO|POLIZA|MANDATO|PRESTAMOS?|HIPOTECA|CUOTA)\b([^\n]{0,60})/g;
const MAX_PALABRAS_SALTADAS = 3;
/**
 * Lo que el banco pega delante del número y no es el número · E3.1 añade el
 * GUION: «PRESTAMO 2103-7003-0500230959» y «MANDATO -145» se salvaban hoy por
 * accidente o no se salvaban, porque el guion rompía la forma de la palabra.
 */
const PREFIJO_NUMERO = /^(?:REF\.?|Nº|NUM\.?|N\.|:|-)+/;
/** Una fecha con guiones NO es un contrato · «31-08-25». */
const FECHA_CON_GUIONES = /^\d{1,2}-\d{1,2}-\d{2,4}$/;

/** El número que sigue a la etiqueta · `null` si no hay ninguno que valga. */
function numeroTrasEtiqueta(resto: string): { valor: string; fin: number } | null {
  const palabra = /\S+/g;
  const grupos: string[] = [];
  let saltadas = 0;
  let fin = 0;
  let m: RegExpExecArray | null;
  while ((m = palabra.exec(resto)) !== null) {
    const limpia = m[0].replace(PREFIJO_NUMERO, '').replace(/[,.;]+$/, '');
    // E3.1 · el guion DENTRO del número ya no lo descalifica («2103-7003-…»),
    // pero una fecha con guiones sigue fuera: cambia cada mes.
    const vale =
      /^[A-Z0-9][A-Z0-9-]{2,}$/.test(limpia) && /\d/.test(limpia) && !FECHA_CON_GUIONES.test(limpia);
    if (vale) {
      grupos.push(limpia);
      fin = m.index + m[0].length;
      continue;
    }
    if (grupos.length > 0) break; // el número se acabó
    // E3.1 · una palabra que era SOLO el prefijo («:», «-», «Nº») no cuenta
    // como palabra saltada: es puntuación, no una palabra por medio.
    if (limpia === '') continue;
    if (!/\d/.test(limpia) && saltadas < MAX_PALABRAS_SALTADAS) {
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


// ─── E3.1 · §7.2 · el mandato SEPA y el nombre del acreedor ─────────────────
//
// Tres bancos escriben el mandato de tres maneras y hasta E3.1 las tres se
// tiraban. Sin ancla, 131 movimientos del corpus caían a «sin clasificar»
// teniendo dentro lo único que los identifica.

/**
 * UNICAJA · bloque de emisor de DIECISÉIS caracteres (nombre recortado + código
 * del emisor), separador, y el mandato de DOCE cifras:
 *
 *   «FCC AQUALI447497 874010012213»   «DIGI SPAIN400245 001056800700»
 *   «Simyo     633782 822070552003»   «CCPP CL TE0146B7-006300000900»
 *
 * Da DOS cosas: el mandato (estable · separa dos recibos de la misma marca) y
 * el NOMBRE del emisor, que es la parte de letras del principio y es lo que
 * cruza el catálogo nacional.
 */
const UNICAJA_EMISOR_MANDATO = /(?:^|\s)([A-ZÑ][A-ZÑ0-9&./ ]{2,20}?)[ -]+(\d{12})(?=\s|$)/g;

/** La parte de LETRAS con la que arranca el bloque de emisor · «FCC AQUALI», «SIMYO». */
const NOMBRE_DEL_EMISOR = /^[A-ZÑ]{2,}(?:[ .&/-]+[A-ZÑ]{1,})*/;

/**
 * BBVA · «N 2025224000484178 BIP   DRIVE, S.A.» en Observaciones. El número es
 * el nº de ADEUDO y es VOLÁTIL (lleva dentro el día juliano: 2025·224), así que
 * NO entra como identificador. Lo que vale es el nombre del acreedor que va
 * detrás, y ése sí es estable.
 */
const BBVA_ADEUDO_ACREEDOR = /\bN\s+\d{12,22}\s+([A-ZÑ0-9][^\n]{2,60})/g;

/**
 * SANTANDER · «Recibo Segurcaixa, S.a. De Seguros Y Reaseguros Nº Recibo …».
 * El acreedor va pegado a RECIBO y se corta donde empieza lo que cambia cada
 * mes (el nº de recibo, la referencia del mandato). 130 recibos del corpus real.
 */
const SANTANDER_RECIBO_ACREEDOR = /\bRECIBO\s+(?!Nº)([A-ZÑ][^\n]{3,70})/g;
const FIN_DEL_ACREEDOR = /\s+(?:Nº|N\.|REF\.?|MANDATO|CUOTA|PLAZO|CUPS|POLIZA|CONTRATO|IBAN|CTA|CUENTA|CONCEPTO|\d{4,}).*$/;

/**
 * El nombre del acreedor, recortado de todo lo que cambia cada mes.
 *
 * Dos cortes, y el segundo importa: primero se quita la cola etiquetada (el nº
 * de recibo, la referencia, el mandato) y DESPUÉS se para en la primera palabra
 * que lleve una cifra. Sin eso, «RECIBO LUZ ENE2024 REF123456» dejaba
 * «LUZ ENE2024» como si fuera el nombre de alguien, y no lo es.
 */
function limpiarNombreAcreedor(bruto: string): string | null {
  const sinCola = bruto.replace(FIN_DEL_ACREEDOR, '');
  const palabras: string[] = [];
  for (const palabra of sinCola.split(/\s+/)) {
    if (/\d/.test(palabra)) break;
    if (palabra) palabras.push(palabra);
  }
  // El guion va el ÚLTIMO de la clase, sin escapar: escaparlo ahí dentro no
  // hace nada y `no-useless-escape` lo rechaza (y en CI eso tumba el build).
  const nombre = palabras.join(' ').replace(/[\s,.-]+$/, '').trim();
  // Con menos de cuatro letras no se identifica a nadie.
  return (nombre.match(/[A-ZÑ]/g) ?? []).length >= 4 ? nombre : null;
}

/** Un acreedor como identificador · la clave sin espacios, el texto tal cual. */
function acreedor(nombre: string): Identificador {
  return { tipo: 'acreedor', valor: normalizarIdentificador(nombre).replace(/[^A-Z0-9]/g, ''), texto: nombre };
}

/**
 * SABADELL · «Referencia 2» · el mandato del acreedor, que llega DESNUDO:
 * «SLMP023352742» (5 mandatos distintos de Wekiwi en el corpus, uno por piso)
 * o doce cifras sin etiqueta («236136614000»). Hoy no daba ancla ninguna.
 *
 * Se mira token a token y solo entra lo que tiene forma de mandato: hasta seis
 * letras delante, ocho cifras o más, diez caracteres o más en total. Un NIF
 * (con o sin su sufijo SEPA de tres cifras) NO entra: ya lo cogió el NIF.
 */
const TOKEN_MANDATO = /^[A-Z]{0,6}\d{8,}$/;

export function mandatosDeLaReferencia(referencia: string | null | undefined): Identificador[] {
  if (!referencia) return [];
  const out: Identificador[] = [];
  for (const bruto of preparar(referencia).split(/[\s,;|]+/)) {
    const v = normalizarIdentificador(bruto);
    if (v.length < 10 || v.length > 35 || !TOKEN_MANDATO.test(v)) continue;
    // El NIF del acreedor y su sufijo SEPA ya son un identificador propio.
    const posibleNif = v.replace(/\d{3}$/, '');
    if (esCif(v) || esNifPersona(v) || esCif(posibleNif) || esNifPersona(posibleNif)) continue;
    out.push({ tipo: 'mandato', valor: v });
  }
  return out;
}

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
    const numero = numeroTrasEtiqueta(m[2]);
    if (!numero) return null;
    // E3.1 · §7.2 · lo que el banco llama MANDATO es un mandato, no un
    // contrato: identifica el ADEUDO recurrente (una póliza, un suministro),
    // y con él dos recibos de la misma marca en dos pisos se separan solos.
    return {
      id: { tipo: m[1] === 'MANDATO' ? 'mandato' : 'contrato', valor: numero.valor },
      longitud: m[0].length - m[2].length + numero.fin,
    };
  });
  t = r.texto; salida.push(...r.encontrados);

  r = recoger(t, CONTRATO_FORMA_CUENTA, (m) => ({
    id: { tipo: 'contrato', valor: normalizarIdentificador(m[0]) },
  }));
  t = r.texto; salida.push(...r.encontrados);

  // E3.1 · Unicaja · el bloque de emisor da mandato Y nombre. Va DESPUÉS del
  // contrato para que «PRESTAMO 2103 4257 0500106068» no se lo lleve por
  // delante, y tapa lo que consume para que la tarjeta no lea sus cifras.
  const emisores: Identificador[] = [];
  r = recoger(t, UNICAJA_EMISOR_MANDATO, (m) => {
    const nombre = NOMBRE_DEL_EMISOR.exec(m[1].trim())?.[0]?.trim();
    if (nombre && (nombre.match(/[A-ZÑ]/g) ?? []).length >= 3) emisores.push(acreedor(nombre));
    return { id: { tipo: 'mandato', valor: m[2] } };
  });
  // El MANDATO antes que el nombre: es la clave, y el nombre solo la acompaña.
  t = r.texto; salida.push(...r.encontrados, ...emisores);

  // E3.1 · BBVA · el nº de adeudo es volátil y se tira; el acreedor que va
  // detrás es lo que identifica al que cobra.
  r = recoger(t, BBVA_ADEUDO_ACREEDOR, (m) => {
    const nombre = limpiarNombreAcreedor(m[1]);
    return nombre ? { id: acreedor(nombre) } : null;
  });
  t = r.texto; salida.push(...r.encontrados);

  // E3.1 · Santander · el acreedor va pegado a RECIBO.
  r = recoger(t, SANTANDER_RECIBO_ACREEDOR, (m) => {
    const nombre = limpiarNombreAcreedor(m[1]);
    return nombre ? { id: acreedor(nombre) } : null;
  });
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
  const porForma = [
    ...extraerIdentificadores(m.description),
    ...extraerIdentificadores(m.counterparty),
    ...extraerIdentificadores(m.reference),
  ];
  // E3.1 · §7.2 · la «Referencia 2» de Sabadell llega desnuda y no tiene forma
  // de nada salvo de mandato: se mira aparte, token a token, y SOLO en la
  // columna de referencia (en un concepto, doce cifras sueltas pueden ser
  // cualquier cosa). Lo que YA se reconoció por su forma no se cuenta otra vez
  // como mandato: el contrato de BBVA «0182-5322-27-0830842450» es un
  // contrato, y llamarlo además mandato es el mismo dato con dos nombres.
  const yaVistos = new Set(porForma.map((id) => id.valor));
  const todos = [...porForma, ...mandatosDeLaReferencia(m.reference).filter((id) => !yaVistos.has(id.valor))];
  return sinRepetir(todos).sort((a, b) =>
    claveDeIdentificador(a).localeCompare(claveDeIdentificador(b))
  );
}
