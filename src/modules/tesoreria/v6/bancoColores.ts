// Color del punto de banco (Tesorería V6 · §4.2 · §4.8).
//
// §5 excluye expresamente los colores de MARCA de "cero hex hardcoded": son
// identidad de un tercero, no semántica del producto. Aun así los hex NO viven
// aquí sino en `design-system/v5/tokens.css`, que es la paleta canónica; este
// fichero solo mapea banco → token.
//
// El punto de banco es la ÚNICA identidad cromática de la tarjeta; el ámbar de
// aviso es la única nota de color. Los números nunca se colorean.

import type { Account } from '../../../services/db';

/** Colores corporativos por código de entidad (4 primeros dígitos del IBAN ES). */
const POR_CODIGO: Record<string, string> = {
  '0049': 'var(--atlas-v5-bank-santander)', // Santander
  '0075': 'var(--atlas-v5-bank-sabadell)', // Sabadell
  '0081': 'var(--atlas-v5-bank-sabadell)', // Sabadell
  '0182': 'var(--atlas-v5-bank-bbva)', // BBVA
  '2100': 'var(--atlas-v5-bank-caixabank)', // CaixaBank
  '2080': 'var(--atlas-v5-bank-abanca)', // Abanca
  '2103': 'var(--atlas-v5-bank-unicaja)', // Unicaja
  '3058': 'var(--atlas-v5-bank-cajamar)', // Cajamar
  '2095': 'var(--atlas-v5-bank-kutxabank)', // Kutxabank
  '1465': 'var(--atlas-v5-bank-ing)', // ING
};

const POR_NOMBRE: Record<string, string> = {
  santander: 'var(--atlas-v5-bank-santander)',
  sabadell: 'var(--atlas-v5-bank-sabadell)',
  bbva: 'var(--atlas-v5-bank-bbva)',
  caixabank: 'var(--atlas-v5-bank-caixabank)',
  lacaixa: 'var(--atlas-v5-bank-caixabank)',
  abanca: 'var(--atlas-v5-bank-abanca)',
  unicaja: 'var(--atlas-v5-bank-unicaja)',
  cajamar: 'var(--atlas-v5-bank-cajamar)',
  kutxabank: 'var(--atlas-v5-bank-kutxabank)',
  ing: 'var(--atlas-v5-bank-ing)',
  revolut: 'var(--atlas-v5-bank-revolut)',
  openbank: 'var(--atlas-v5-bank-openbank)',
  bankinter: 'var(--atlas-v5-bank-bankinter)',
};

/** Neutro cuando no se reconoce el banco o el usuario eligió "Sin color". */
export const SIN_COLOR = 'var(--atlas-v5-ink-5)';

/** Valor que se persiste cuando el usuario elige expresamente no tener color. */
export const CLAVE_SIN_COLOR = 'sin-color';

/**
 * Paleta del selector de §4.8.
 *
 * Son los mismos tokens de marca que usa el punto por defecto, ofrecidos como
 * rejilla para que el usuario pueda distinguir a ojo dos cuentas del mismo
 * banco — que es el caso que el color automático no resuelve.
 */
/**
 * §10 · la paleta del punto de cuenta · rejilla completa, como la de Excel.
 *
 * Antes era una lista corta de colores de marca de banco: entre ellos había dos
 * rojos y cinco azules que a 8 píxeles no se distinguen, y encima limitaba la
 * elección a los bancos que ATLAS conoce. El punto es del USUARIO —sirve para
 * que reconozca sus cuentas de un vistazo— así que la elección es suya.
 *
 * Los colores viven en `tokens.css`, con el resto de la paleta; aquí solo se
 * arma la rejilla que los ordena. Se generó allí en HSL para que cada columna
 * comparta tono y cada fila luminosidad por construcción y no por haberlo
 * escrito bien cincuenta y seis veces.
 */

/** Columnas · un tono cada una, repartidos por el círculo desde el rojo. */
const TONOS = [
  'rojo', 'naranja', 'ambar', 'lima', 'verde',
  'turquesa', 'celeste', 'azul', 'violeta', 'rosa',
] as const;

/** Filas · de más clara a más oscura. */
const NIVELES = ['muy claro', 'claro', 'medio', 'oscuro', 'muy oscuro'];

export interface MuestraColor {
  /** Valor CSS que se guarda en `Account.colorPunto`. */
  token: string;
  /** Nombre legible · lo lee el lector de pantalla. */
  nombre: string;
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** La rejilla · filas de luminosidad × columnas de tono. */
export const REJILLA_PUNTO: MuestraColor[][] = NIVELES.map((nivel, fila) =>
  TONOS.map((tono) => ({
    token: `var(--atlas-v5-punto-${tono}-${fila + 1})`,
    nombre: `${capitalizar(tono)} ${nivel}`,
  }))
);

/**
 * Fila de grises · aparte de la rejilla.
 *
 * Un punto gris es una elección legítima —"esta cuenta no quiero que cante"— y
 * en una rejilla de matices no cabe: el gris no tiene tono, así que no le
 * corresponde ninguna columna.
 */
export const GRISES_PUNTO: MuestraColor[] = [
  'Negro', 'Gris muy oscuro', 'Gris oscuro', 'Gris medio', 'Gris claro', 'Blanco',
].map((nombre, i) => ({ token: `var(--atlas-v5-punto-gris-${i + 1})`, nombre }));


/**
 * Color del punto, por orden de prioridad:
 *   1. el que eligió el usuario (§4.8 · `Account.colorPunto`)
 *   2. el de marca que ya venga en `banco.brand.color`
 *   3. el deducido del código de entidad del IBAN
 *   4. el deducido del nombre del banco
 *   5. neutro
 */
export function colorDeBanco(cuenta: Account, colorUsuario?: string | null): string {
  // El del usuario manda · lo elige en §4.8 y se guarda en `Account.colorPunto`.
  // El parámetro sigue existiendo para quien ya lo tenga a mano y se ahorre la
  // lectura, pero por defecto se toma de la propia cuenta.
  const elegido = colorUsuario ?? cuenta.colorPunto;
  if (elegido === CLAVE_SIN_COLOR) return SIN_COLOR;
  if (elegido) return elegido;
  return colorAutomatico(cuenta);
}

/**
 * El color que ATLAS deduce del banco, IGNORANDO lo que haya elegido el
 * usuario. Separado a propósito: `colorDeBanco` responde "qué pinto", y esto
 * responde "qué propondría si no hubieras elegido nada" — que es lo que el
 * selector de §4.8 necesita para marcar la opción por defecto. Mezclarlos hacía
 * que la ficha propusiera como sugerencia la elección previa del propio usuario.
 */
export function colorAutomatico(cuenta: Account): string {
  const marca = cuenta.banco?.brand?.color;
  if (marca) return marca;

  const codigo = cuenta.banco?.code ?? cuenta.iban?.slice(4, 8);
  if (codigo && POR_CODIGO[codigo]) return POR_CODIGO[codigo];

  const nombre = (cuenta.banco?.name ?? cuenta.bank ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
  for (const [clave, color] of Object.entries(POR_NOMBRE)) {
    if (nombre.includes(clave)) return color;
  }

  return SIN_COLOR;
}

/**
 * Color que el selector propone por defecto · `null` si no hay banco
 * reconocible, porque ahí no hay sugerencia honesta que marcar.
 */
export function colorSugerido(cuenta: Account): string | null {
  const auto = colorAutomatico(cuenta);
  return auto === SIN_COLOR ? null : auto;
}
