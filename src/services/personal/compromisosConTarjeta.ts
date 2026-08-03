// ============================================================================
// Los gastos que pagan con una tarjeta · docs/VOCABULARIO-dinero.md §3.2
// ============================================================================
//
// `compromiso.cuentaCargo` es una COPIA de la cuenta de liquidación de la
// tarjeta, hecha el día que se guardó el gasto. Y una copia se queda vieja:
// re-domiciliar la Carrefour de Santander a Bankinter no tocaba los gastos ya
// guardados, así que sus cargos se seguían previendo en una cuenta de la que ya
// no sale el dinero.
//
// Aquí vive lo que hace verdad la frase «la tarjeta se muda y sus cargos se
// mudan con ella». En módulo aparte porque la dependencia va en un solo
// sentido: esto conoce los compromisos, los compromisos no conocen esto.
// ============================================================================

import {
  listarCompromisos,
  regenerarEventosCompromiso,
  regenerarRecibosDeTarjeta,
} from './compromisosRecurrentesService';
import { listarTarjetas } from '../tarjetasService';
import { pagaConCreditoAplazado } from './recibosDeTarjetaPrevistos';

/**
 * Regenera las previsiones de todos los gastos que pagan con esta tarjeta.
 *
 * Se llama al RE-DOMICILIARLA. Sin esto, cada gasto se quedaría previsto en la
 * cuenta anterior hasta que alguien lo abriera y volviera a guardarlo uno a uno
 * — y nadie abre un gasto que cree correcto.
 *
 * Devuelve cuántas previsiones se han vuelto a emitir.
 */
export async function regenerarCompromisosDeTarjeta(tarjetaId: number): Promise<number> {
  const [compromisos, tarjetas] = await Promise.all([
    listarCompromisos({ soloActivos: true }),
    listarTarjetas(),
  ]);
  const suyos = compromisos.filter((c) => c.tarjetaId === tarjetaId && c.id != null);

  let total = 0;
  for (const c of suyos) {
    // Los de crédito aplazado NO se regeneran uno a uno: no emiten previsión
    // propia, y cada llamada rehace el recibo entero. Con cinco gastos en la
    // misma tarjeta eso serían cinco barridos completos para el mismo
    // resultado. Su parte se rehace UNA vez, abajo.
    if (pagaConCreditoAplazado(c, tarjetas)) continue;
    total += await regenerarEventosCompromiso(c);
  }

  // El recibo cruza varios gastos, así que se rehace entero y una sola vez.
  return total + (await regenerarRecibosDeTarjeta());
}
