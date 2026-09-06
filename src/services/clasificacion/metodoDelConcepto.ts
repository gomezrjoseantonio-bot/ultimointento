// ============================================================================
// E2.4.2 · El método de pago que dice el texto del banco (eje 3)
// ============================================================================
//
// Regla dura 4: el método NUNCA es «otro» si el banco da señal, y casi siempre
// la da: «Recibo», «Adeudo», «Transferencia», «Bizum», «Compra», «Cheque»,
// «Cajero». Hasta E2.4.2 solo se detectaba Bizum (`lineaComoMovimiento`) y todo
// lo demás nacía sin método.
//
// Lo que decide, en ORDEN (el primero que casa gana):
//   · la liquidación de una tarjeta y la cuota de un préstamo son
//     DOMICILIACIÓN (regla 4 · el banco las carga solo), aunque digan «tarjeta»;
//   · Bizum, cheque y cajero/efectivo son inequívocos;
//   · «Compra», «Pago en», «Tarj.» → tarjeta;
//   · «Recibo», «Adeudo», «Domiciliación», «Cuota» → domiciliación;
//   · «Transferencia», «Traspaso», «Abono disposición», «Nómina» → transferencia
//     («PRESTAMOS ABONO DISPOSICIÓN» = transferencia/abono de entrada · regla 4);
//   · comisiones, remuneración, intereses → cargo/abono del propio banco.
//
// Revolut no escribe el método en el texto sino en la columna «Type»
// (TOPUP · CARD_PAYMENT · TRANSFER), que el importador guarda en `referencia`;
// por eso se mira también la referencia.
//
// `undefined` = el banco no dio señal. No se inventa (regla 8).
// ============================================================================

import type { MetodoPago } from '../catalogo/catalogoUnico';
import { tieneAlguna } from './palabras';

const LIQUIDACION_TARJETA = ['LIQUIDACION DE LAS TARJETAS', 'LIQUIDACION TARJETA', 'LIQUIDACION DE TARJETA', 'LIQUIDACION TARJETAS', 'RECIBO TARJETA'];
const CUOTA_PRESTAMO = ['LIQUIDACION PERIODICA PRESTAMO', 'PRESTAMOS ADEUDO CUOTA', 'ADEUDO CUOTA', 'CUOTA PRESTAMO', 'CUOTA DE PRESTAMO', 'CUOTA HIPOTECA', 'CUOTA DE HIPOTECA', 'CARGO CUOTA'];
const BIZUM = ['BIZUM'];
const CHEQUE = ['CHEQUE'];
const EFECTIVO = ['CAJERO', 'REINTEGRO', 'EFECTIVO', 'RETIRADA', 'DISPOSICION EFECTIVO', 'INGRESO EFECTIVO', 'ATM'];
const TARJETA = ['COMPRA', 'PAGO MOVIL', 'PAGO EN', 'TARJ', 'TARJETA', 'CARD PAYMENT', 'CARD_PAYMENT', 'TPV', 'PAGO CON TARJETA', 'CONTACTLESS'];
const DISPOSICION = ['ABONO DISPOSICION', 'DISPOSICION PRESTAMO', 'DISPOSICION DE PRESTAMO'];
// Un cargo que dice «préstamo» o «hipoteca» a secas es la cuota · el banco la carga solo.
const DOMICILIACION = ['RECIBO', 'ADEUDO', 'DOMICILIACION', 'DOMICILIADO', 'CUOTA', 'LIQUIDACION PERIODICA', 'PRESTAMO', 'PRESTAMOS', 'HIPOTECA'];
const TRANSFERENCIA = ['TRANSFERENCIA', 'TRANSF', 'TRASPASO', 'TRANSFER', 'TOPUP', 'TOP UP', 'ORDEN DE PAGO', 'ABONO DISPOSICION', 'DISPOSICION PRESTAMO', 'NOMINA', 'RECARGA'];
const CARGO_ABONO_BANCO = ['COMISION', 'COMISIONES', 'REMUN', 'REMUNERACION', 'INTERESES', 'LIQUIDACION INTERESES', 'MANTENIMIENTO CUENTA', 'CUOTA MANTENIMIENTO'];

/**
 * El método que dice el texto (y la referencia · Revolut «Type»).
 */
export function metodoDelConcepto(texto: string | null | undefined, referencia?: string | null): MetodoPago | undefined {
  const t = `${texto ?? ''} ${referencia ?? ''}`.trim();
  if (!t) return undefined;
  if (tieneAlguna(t, LIQUIDACION_TARJETA)) return 'domiciliacion';
  if (tieneAlguna(t, CUOTA_PRESTAMO)) return 'domiciliacion';
  // La disposición ANTES que «préstamo» a secas: es el capital que entra.
  if (tieneAlguna(t, DISPOSICION)) return 'transferencia';
  if (tieneAlguna(t, BIZUM)) return 'bizum';
  if (tieneAlguna(t, CHEQUE)) return 'cheque';
  if (tieneAlguna(t, EFECTIVO)) return 'efectivo';
  if (tieneAlguna(t, TARJETA)) return 'tarjeta';
  // Comisiones y remuneración antes que «domiciliación»: «COMISION MANTENIMIENTO»
  // no es un recibo, lo carga el propio banco.
  if (tieneAlguna(t, CARGO_ABONO_BANCO)) return 'cargo_abono_banco';
  if (tieneAlguna(t, DOMICILIACION)) return 'domiciliacion';
  if (tieneAlguna(t, TRANSFERENCIA)) return 'transferencia';
  return undefined;
}
