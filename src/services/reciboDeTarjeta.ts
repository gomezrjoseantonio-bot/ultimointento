// ============================================================================
// El recibo de una tarjeta de crédito · VOCABULARIO §3.2 y §6 bis
// ============================================================================
//
// Las compras de un periodo NO mueven el saldo el día de la compra: se cobran
// todas juntas el día de cargo, en la cuenta de liquidación. Eso es un solo
// apunte por periodo, y es lo que hay que prever.
//
// Lo que había antes agrupaba por MES NATURAL y con un único `settlementDay`,
// atado además a que la tarjeta fuese una cuenta. Con eso, una compra del 26
// con corte el 24 caía en el recibo equivocado —un mes antes— y una tarjeta de
// corte semanal era directamente inexpresable.
//
// Cálculo puro: no lee ni escribe la base. Quien llame decide qué hacer con el
// resultado.
// ============================================================================

import type { Tarjeta } from '../types/tarjetas';
import { corteQueLeToca, cuandoSeCobra } from './tarjetasReglas';

/** Una compra hecha con la tarjeta · lo mínimo para colocarla en su periodo. */
export interface CompraDeTarjeta {
  fecha: string;
  /** Magnitud del gasto · el signo lo pone quien pinte el recibo. */
  importe: number;
}

export interface ReciboDeTarjeta {
  tarjetaId: number;
  cuentaLiquidacionId: number;
  /** Cuándo cerró el periodo · identifica el recibo. */
  fechaCorte: string;
  /** Cuándo sale el dinero de la cuenta · AQUÍ va la previsión. */
  fechaCargo: string;
  importe: number;
  /** Cuántas compras lo componen · para poder explicarlo. */
  compras: number;
}

/**
 * Agrupa las compras en un recibo por periodo.
 *
 * Cada compra va al periodo que le toca **por su fecha** (§3.4), no por su mes
 * natural. Con corte semanal salen varios recibos al mes, que es justo lo que
 * el modelo anterior no podía representar.
 *
 * Un importe de 0 no genera recibo: un cargo de 0 € en tesorería es ruido.
 */
export function recibosDeTarjeta(
  tarjeta: Tarjeta & { id: number },
  compras: CompraDeTarjeta[]
): ReciboDeTarjeta[] {
  // El débito no acumula: cada compra ya movió el saldo el día que se hizo.
  if (tarjeta.modalidad !== 'credito' || !tarjeta.ciclo) return [];

  const porPeriodo = new Map<string, { importe: number; compras: number }>();
  for (const compra of compras) {
    const magnitud = Math.abs(compra.importe);
    if (magnitud === 0) continue;
    const corte = corteQueLeToca(tarjeta.ciclo, compra.fecha);
    const acumulado = porPeriodo.get(corte) ?? { importe: 0, compras: 0 };
    acumulado.importe += magnitud;
    acumulado.compras += 1;
    porPeriodo.set(corte, acumulado);
  }

  return Array.from(porPeriodo.entries())
    .map(([fechaCorte, { importe, compras: n }]) => ({
      tarjetaId: tarjeta.id,
      cuentaLiquidacionId: tarjeta.cuentaLiquidacionId,
      fechaCorte,
      fechaCargo: cuandoSeCobra(tarjeta.ciclo!, fechaCorte),
      // Dos decimales · sumar céntimos en coma flotante deja 149.99999999998.
      importe: Math.round(importe * 100) / 100,
      compras: n,
    }))
    .sort((a, b) => a.fechaCorte.localeCompare(b.fechaCorte));
}
