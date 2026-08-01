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
 * §10 · la paleta que se ofrece al elegir el punto de una cuenta.
 *
 * Eran doce colores tomados de marcas de banco, y entre ellos había dos rojos
 * (Santander, Openbank) y cinco azules (claro, medio, marino, índigo, Revolut)
 * que a 8 píxeles no se distinguen. Eso rompía justo aquello para lo que sirve
 * el punto: separar de un vistazo dos cuentas del MISMO banco.
 *
 * Ocho tonos repartidos por el círculo cromático. Menos opciones, pero todas
 * sirven — y ocho caben en una fila sin que la rejilla se parta.
 */
export const PALETA_PUNTO: Array<{ token: string; nombre: string }> = [
  { token: 'var(--atlas-v5-punto-rojo)', nombre: 'Rojo' },
  { token: 'var(--atlas-v5-punto-naranja)', nombre: 'Naranja' },
  { token: 'var(--atlas-v5-punto-ambar)', nombre: 'Ámbar' },
  { token: 'var(--atlas-v5-punto-verde)', nombre: 'Verde' },
  { token: 'var(--atlas-v5-punto-turquesa)', nombre: 'Turquesa' },
  { token: 'var(--atlas-v5-punto-azul)', nombre: 'Azul' },
  { token: 'var(--atlas-v5-punto-violeta)', nombre: 'Violeta' },
  { token: 'var(--atlas-v5-punto-rosa)', nombre: 'Rosa' },
];

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
