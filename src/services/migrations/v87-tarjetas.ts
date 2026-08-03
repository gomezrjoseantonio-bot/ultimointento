// ============================================================================
// V87 · la tarjeta deja de ser una cuenta · docs/VOCABULARIO-dinero.md §3
// ============================================================================
//
// Una tarjeta no es un sitio donde hay dinero: es una forma de gastar el de una
// cuenta. Vivía como `Account.tipo = 'TARJETA_CREDITO'` con un `cardConfig`
// único, y de ahí salían tres imposibles: una cuenta no podía tener dos
// tarjetas —lo normal son dos—, no se distinguía el débito del crédito, y una
// de fuera quedaba anclada a un banco del que puede mudarse.
//
// Lo que hace esta migración y lo que NO:
//
//   · Por cada cuenta que era tarjeta NACE una `Tarjeta` de crédito, con su
//     cuenta de liquidación y su día de cargo.
//   · La cuenta NO se toca todavía. Sus movimientos son reales —compras
//     importadas de un extracto— y borrarlos sería perder dinero de la vista.
//     Que sobre una cuenta es molesto; que falte el dinero, no tiene arreglo.
//     Retirarle el tipo va en la PR que traiga el alta de tarjeta, para que no
//     haya un momento sin sitio donde crearlas.
//   · El ciclo se rellena con lo poco que había: `settlementDay` como día de
//     cargo, mensual, cobrando el mes siguiente. Es lo que se puede deducir de
//     un solo dato — el corte real habrá que decirlo a mano.
// ============================================================================

import type { IDBPDatabase } from 'idb';
import type { Tarjeta } from '../../types/tarjetas';

export interface ResultadoV87 {
  tarjetasCreadas: number;
}

/**
 * Da de alta una `Tarjeta` por cada cuenta que hoy es una tarjeta.
 *
 * Idempotente: la segunda pasada no encuentra ninguna cuenta con ese tipo, así
 * que no crea nada. Aun así se comprueba que no exista ya una tarjeta para esa
 * cuenta, por si una pasada anterior se quedó a medias.
 */
export async function migrarTarjetas(db: IDBPDatabase<any>): Promise<ResultadoV87> {
  const resultado: ResultadoV87 = { tarjetasCreadas: 0 };

  const cuentas = ((await db.getAll('accounts')) ?? []) as Array<Record<string, any>>;
  const eranTarjeta = cuentas.filter((c) => c?.tipo === 'TARJETA_CREDITO');
  if (eranTarjeta.length === 0) return resultado;

  const yaExisten = ((await db.getAll('tarjetas')) ?? []) as Tarjeta[];
  const conTarjeta = new Set(yaExisten.map((t) => t.alias));

  const ahora = new Date().toISOString();

  for (const cuenta of eranTarjeta) {
    const alias = cuenta.alias || cuenta.name || `Tarjeta ${cuenta.id}`;

    // Sin cuenta de liquidación no se puede crear la tarjeta: no sabríamos de
    // dónde sale el dinero. Se salta, y el usuario la dará de alta a mano.
    const cuentaLiquidacionId = cuenta.cardConfig?.chargeAccountId;

    if (cuentaLiquidacionId != null && !conTarjeta.has(alias)) {
      const diaCargo = Math.min(31, Math.max(1, cuenta.cardConfig?.settlementDay || 1));
      const tarjeta: Omit<Tarjeta, 'id'> = {
        alias,
        origen: 'banco',
        modalidad: 'credito',
        cuentaLiquidacionId,
        ciclo: {
          periodicidad: 'mensual',
          // Lo único que había era el día del cargo. El corte real —"del 25 al
          // 24"— no estaba guardado en ningún sitio, así que se asume el mes
          // natural y queda para que el usuario lo corrija.
          corte: 31,
          diaCargo,
          periodosHastaElCargo: 1,
        },
        activa: cuenta.activa !== false,
        createdAt: cuenta.createdAt || ahora,
        updatedAt: ahora,
      };
      await db.add('tarjetas', tarjeta as Tarjeta);
      conTarjeta.add(alias);
      resultado.tarjetasCreadas++;
    }
  }

  return resultado;
}
