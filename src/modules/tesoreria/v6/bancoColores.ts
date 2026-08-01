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

/**
 * Color del punto, por orden de prioridad:
 *   1. el que eligió el usuario (§4.8 · guardado en keyval, aún sin UI)
 *   2. el de marca que ya venga en `banco.brand.color`
 *   3. el deducido del código de entidad del IBAN
 *   4. el deducido del nombre del banco
 *   5. neutro
 */
export function colorDeBanco(cuenta: Account, colorUsuario?: string | null): string {
  if (colorUsuario === 'sin-color') return SIN_COLOR;
  if (colorUsuario) return colorUsuario;

  const marca = cuenta.banco?.brand?.color;
  if (marca) return marca;

  const codigo = cuenta.banco?.code ?? cuenta.iban?.slice(4, 8);
  if (codigo && POR_CODIGO[codigo]) return POR_CODIGO[codigo];

  const nombre = (cuenta.banco?.name ?? cuenta.bank ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
  for (const [clave, color] of Object.entries(POR_NOMBRE)) {
    if (nombre.includes(clave)) return color;
  }

  return SIN_COLOR;
}
