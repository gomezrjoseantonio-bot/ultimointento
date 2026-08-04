// ============================================================================
// V88 · las cuentas que eran tarjeta se van · docs/VOCABULARIO-dinero.md §3
// ============================================================================
//
// V87 dejó a medias lo que §3 decidía. Creó la `Tarjeta` que faltaba y NO tocó
// la cuenta, porque no había dónde dar de alta una tarjeta y porque borrar
// movimientos era irreversible. Lo primero ya está resuelto —el alta de tarjeta
// vive en su propio sitio—, y lo segundo lo decide Jose, no el código.
//
// **Decisión de Jose (4 ago 2026): que se vayan, con sus movimientos.** El
// motivo es que ese gasto ya está contado por el otro lado: lo que sale de tu
// patrimonio no es cada compra con la tarjeta, es el recibo que el banco cobra
// en la cuenta corriente, y ese recibo sí está. Dejar las dos cosas contaba el
// mismo dinero dos veces.
//
// Esto BORRA, y borrar no se deshace. Por eso:
//
//   · Deja recibo · `ResultadoV88` dice qué se fue y cuánto, y quien la llama
//     lo guarda. Un borrado silencioso convierte una decisión en un misterio.
//   · No borra una cuenta de la que algo VIVO siga cobrando. Es un cinturón,
//     no una garantía: se comprueban las referencias que una cuenta de tarjeta
//     puede tener de verdad, no las treinta que existen en la aplicación.
//   · Desenlaza lo que se quede apuntando a un movimiento borrado. Un evento
//     con el id de un movimiento que ya no existe no es un cabo suelto
//     inofensivo: se lee como «esto ya se cobró».
// ============================================================================

import type { IDBPDatabase } from 'idb';

export interface CuentaBorrada {
  id: number;
  alias: string;
  movimientos: number;
}

export interface CuentaConservada {
  id: number;
  alias: string;
  /** Qué sigue cobrando de ella · por eso no se ha borrado. */
  porque: string;
}

export interface ResultadoV88 {
  borradas: CuentaBorrada[];
  conservadas: CuentaConservada[];
  movimientosBorrados: number;
  /** Eventos que apuntaban a un movimiento que ya no existe. */
  eventosDesenlazados: number;
}

type Fila = Record<string, any>;

const vacio = (): ResultadoV88 => ({
  borradas: [],
  conservadas: [],
  movimientosBorrados: 0,
  eventosDesenlazados: 0,
});

/**
 * Lee un almacén, tolerando que NO EXISTA y nada más.
 *
 * La lista de referencias que se comprueban abajo cruza módulos enteros
 * —préstamos, contratos—, y un almacén que falte en un esquema viejo no puede
 * tumbar el borrado. Pero eso se pregunta antes, por `objectStoreNames`: un
 * almacén que existe y aun así no se deja leer es otra cosa, y ahí el error
 * sube.
 *
 * La diferencia no es de estilo. Devolver `[]` ante cualquier fallo hacía dos
 * daños calladamente: la cuenta se borraría sin sus movimientos —huérfanos
 * apuntando a una cuenta que ya no existe, justo lo que esto quiere evitar— y
 * «nadie la usa» significaría en realidad «no he podido comprobarlo». Si algo
 * va mal se corta la migración entera: el flag no se marca y vuelve a
 * intentarse en la siguiente apertura, que es lo que hay que hacer cuando lo
 * que está en juego es un borrado.
 */
async function leer(db: IDBPDatabase<any>, store: string): Promise<Fila[]> {
  if (!db.objectStoreNames.contains(store)) return [];
  return ((await db.getAll(store as never)) ?? []) as Fila[];
}

/** Ids de cuenta comparados con la mano abierta · los datos viejos traen strings. */
const mismoId = (valor: unknown, id: number): boolean => {
  if (valor == null || valor === '') return false;
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) && n === id;
};

/**
 * Quién sigue cobrando de cada cuenta.
 *
 * Se miran los sitios donde una cuenta de tarjeta puede aparecer de verdad: una
 * tarjeta que se liquide en ella, otra cuenta que domicilie ahí su recibo, un
 * préstamo o un contrato de alquiler. No se recorre la aplicación entera
 * buscando campos que suenen a cuenta — eso sería adivinar por el nombre, y un
 * falso positivo aquí significa no borrar nada nunca.
 *
 * Las referencias que vienen de OTRA cuenta de tarjeta no cuentan: esa también
 * se va, así que no protege a nadie.
 */
async function quienLaUsa(
  db: IDBPDatabase<any>,
  cuentas: Fila[],
  idsQueSeVan: Set<number>
): Promise<Map<number, string>> {
  const usos = new Map<number, string>();
  const anotar = (id: unknown, porque: string) => {
    const n = typeof id === 'number' ? id : Number(id);
    if (!Number.isFinite(n) || !idsQueSeVan.has(n) || usos.has(n)) return;
    usos.set(n, porque);
  };

  for (const t of await leer(db, 'tarjetas')) {
    anotar(t.cuentaLiquidacionId, `la tarjeta «${t.alias ?? 'sin alias'}» se liquida en ella`);
  }

  for (const c of cuentas) {
    if (idsQueSeVan.has(Number(c.id))) continue;
    anotar(c.cardConfig?.chargeAccountId, `la cuenta «${c.alias ?? 'sin alias'}» carga su recibo ahí`);
  }

  for (const p of await leer(db, 'prestamos')) {
    anotar(p.cuentaCargoId, `el préstamo «${p.nombre ?? p.alias ?? 'sin nombre'}» se cobra ahí`);
  }

  for (const c of await leer(db, 'contracts')) {
    anotar(c.cuentaCobroId, 'un contrato cobra ahí la renta');
  }

  return usos;
}

/**
 * Borra las cuentas que eran tarjeta, con lo que colgaba de ellas.
 *
 * Incluye las que estaban borradas en blando: si el usuario ya las había
 * quitado de la vista, dejar sus movimientos dentro no conserva nada, solo
 * esconde el mismo dinero contado dos veces.
 *
 * Idempotente por construcción: en la segunda pasada ya no queda ninguna cuenta
 * de ese tipo, así que no hay nada que borrar.
 */
export async function borrarCuentasDeTarjeta(db: IDBPDatabase<any>): Promise<ResultadoV88> {
  const cuentas = await leer(db, 'accounts');
  const sonTarjeta = cuentas.filter((c) => c?.tipo === 'TARJETA_CREDITO' && c?.id != null);
  if (sonTarjeta.length === 0) return vacio();

  const resultado = vacio();
  const idsQueSeVan = new Set(sonTarjeta.map((c) => Number(c.id)));
  const usos = await quienLaUsa(db, cuentas, idsQueSeVan);

  // Los movimientos se leen enteros y se filtran a mano en vez de ir por el
  // índice `accountId`: los datos importados hace tiempo traen el id como
  // cadena, y el índice no los encontraría. Es una pasada de más una sola vez,
  // a cambio de no dejarse movimientos dentro de una cuenta que ya no existe.
  const movimientos = await leer(db, 'movements');
  const lotes = await leer(db, 'importBatches');
  const eventos = await leer(db, 'treasuryEvents');

  const movimientosBorrados = new Set<number>();

  for (const cuenta of sonTarjeta) {
    const id = Number(cuenta.id);
    const alias = cuenta.alias || cuenta.name || `Cuenta ${id}`;

    const porque = usos.get(id);
    if (porque) {
      resultado.conservadas.push({ id, alias, porque });
      continue;
    }

    const suyos = movimientos.filter((m) => mismoId(m.accountId, id));
    for (const m of suyos) {
      if (m.id == null) continue;
      await db.delete('movements' as never, m.id);
      movimientosBorrados.add(Number(m.id));
    }

    for (const lote of lotes.filter((l) => mismoId(l.accountId, id))) {
      if (lote.id != null) await db.delete('importBatches' as never, lote.id);
    }

    for (const ev of eventos.filter((e) => mismoId(e.accountId, id))) {
      if (ev.id != null) await db.delete('treasuryEvents' as never, ev.id);
    }

    await db.delete('accounts' as never, cuenta.id);

    resultado.borradas.push({ id, alias, movimientos: suyos.length });
    resultado.movimientosBorrados += suyos.length;
  }

  if (movimientosBorrados.size > 0) {
    resultado.eventosDesenlazados = await desenlazar(db, movimientosBorrados);
  }

  return resultado;
}

/**
 * Quita de los eventos supervivientes el enlace a un movimiento que ya no está.
 *
 * `executedMovementId` y `movementId` son los dos caminos por los que un evento
 * dice «esto ya pasó, y este es el apunte que lo prueba». Dejarlos apuntando al
 * vacío es peor que borrarlos: el evento se sigue leyendo como cobrado, pero el
 * apunte que lo probaba no aparece por ninguna parte. Al soltar el enlace vuelve
 * a estar previsto, que es lo que de verdad es.
 */
async function desenlazar(db: IDBPDatabase<any>, borrados: Set<number>): Promise<number> {
  const eventos = await leer(db, 'treasuryEvents');
  let tocados = 0;

  for (const ev of eventos) {
    const perdioEjecutado = ev.executedMovementId != null && borrados.has(Number(ev.executedMovementId));
    const perdioEnlace = ev.movementId != null && borrados.has(Number(ev.movementId));
    if (!perdioEjecutado && !perdioEnlace) continue;

    const limpio = { ...ev };
    if (perdioEjecutado) delete limpio.executedMovementId;
    if (perdioEnlace) delete limpio.movementId;
    // Sin apunte que lo pruebe, un evento «ejecutado» afirma algo que ya no
    // consta en ningún sitio.
    if (limpio.status === 'executed' || limpio.status === 'confirmed') limpio.status = 'predicted';

    await db.put('treasuryEvents' as never, limpio);
    tocados++;
  }

  return tocados;
}
