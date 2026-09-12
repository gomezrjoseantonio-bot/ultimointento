// ============================================================================
// E1.1 · la línea de extracto, persistida
// ============================================================================
//
// Hasta E1.1 la «línea del banco» solo existía en memoria (`ParsedMovement`) y
// moría al insertar el `Movement`: `importBatches` guarda metadatos del lote,
// no las líneas (VERIFICACION-E1-preflight §2). Aquí se construye el registro
// que las persiste en el store `lineasExtracto`.
//
// Regla de oro (§16.1): lo crudo del banco es una COPIA FIEL. `conceptoLiteral`
// se guarda tal cual llegó, sin `trim` ni normalizar. Las huellas salen de él,
// cada una con su propia transformación (`hashMovement` recorta los extremos
// —`description.trim()`— y `hashLinea` normaliza entero), y por eso el literal
// no se toca aquí: si se alterase por el camino, un extracto solapado dejaría de
// reconocer sus propias líneas y duplicaría cargos.
//
// En E1.1 NADIE lee este store: el orquestador escribe la línea ADEMÁS del
// movimiento, con `estado: 'resuelta'` porque hoy todo se materializa al
// importar. Darle otro uso a `estado`/`comoSeResolvio` es de E1.2 en adelante.
// ============================================================================

import type { initDB } from './db';
import type { ParsedMovement } from '../types/bankProfiles';
import type { DescarteLineaExtracto, LineaExtractoPersistida } from './db/types-lineasExtracto';
import { generateLineHash } from '../utils/batchHashUtils';
import { identificadoresDeMovimiento } from './identificadoresDelConcepto';

/**
 * E3.1 · §7.1 · la HUELLA FUERTE · lo que el banco da y no se repite dentro de
 * una cuenta.
 *
 * `hashMovement` lleva el CONCEPTO dentro, y el concepto no es estable: el
 * mismo movimiento reexportado con un espacio distinto, o con la tilde
 * recortada de otra manera, da otra huella y entra dos veces. Cuatro de los
 * nueve ficheros del corpus eran reexportaciones solapadas.
 *
 * Dos formas, por orden:
 *   · el Nº DE MOVIMIENTO que el banco numera por cuenta (Unicaja: «Nº mov»).
 *     Es la clave del banco y no admite discusión;
 *   · si no lo trae, fecha + importe + SALDO. El saldo corrido es distinto en
 *     cada línea de una cuenta, así que dos cargos idénticos el mismo día (la
 *     comunidad de dos pisos) tienen saldos distintos y siguen siendo dos.
 *
 * `undefined` cuando el fichero no da ninguna de las dos: entonces manda
 * `hashMovement`, como hasta ahora.
 */
const CLAVES_NUMERO_MOVIMIENTO = ['nº mov', 'n mov', 'num mov', 'numero movimiento', 'nº movimiento', 'n movimiento'];

export function huellaFuerteDeFila(
  row: ParsedMovement,
  d: { accountId: number; fechaOperacion: string; importe: number },
): string | undefined {
  const numero = numeroDeMovimiento(row.rawData);
  if (numero) return `mov:${d.accountId}|${numero}`;
  if (typeof row.balance === 'number' && Number.isFinite(row.balance) && d.fechaOperacion) {
    return `saldo:${d.accountId}|${d.fechaOperacion}|${Math.round(d.importe * 100)}|${Math.round(row.balance * 100)}`;
  }
  return undefined;
}

/** El «Nº mov» de la fila cruda, mire el banco como lo mire. */
function numeroDeMovimiento(crudo: Record<string, unknown> | undefined): string | undefined {
  if (!crudo) return undefined;
  for (const [clave, valor] of Object.entries(crudo)) {
    const k = clave.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.:]/g, '').trim();
    if (!CLAVES_NUMERO_MOVIMIENTO.some((c) => k === c.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) continue;
    const v = String(valor ?? '').trim();
    if (v && /^[A-Za-z0-9-]{1,32}$/.test(v)) return v;
  }
  return undefined;
}

export interface DatosDeLinea {
  accountId: number;
  importBatchId: string;
  /** Día ISO del cargo, ya resuelto por el orquestador (`isoDate`). `''` si no había. */
  fechaOperacion: string;
  /** Día ISO de valor; cae a `fechaOperacion` cuando el banco no lo trae. */
  fechaValor: string;
  /** Con signo. Si el banco no traía un importe legible, `0` y `descarte: 'sin_importe'`. */
  importe: number;
  /** La huella con la que el orquestador deduplica entre importaciones. */
  hashMovement: string;
  /** Los movimientos que nacieron de esta línea · vacío si no nació ninguno. */
  movementIds: number[];
  /** Por qué NO nació un movimiento, cuando no nació. */
  descarte?: DescarteLineaExtracto;
  ahora: string;
}

/**
 * El registro de `lineasExtracto` para una fila del parser.
 *
 * Pura: no toca la base. Quien la llama decide cuándo persistirla.
 *
 * `hashLinea` se calcula con los MISMOS tres datos que `extractoSesion.construirLineas`
 * (`date` ISO, `amount`, `description`), para que la identidad de la línea aquí
 * y en la sesión del drawer sea la misma cadena.
 */
export function lineaDesdeFila(row: ParsedMovement, d: DatosDeLinea): LineaExtractoPersistida {
  const conceptoLiteral = row.description ?? '';
  const linea: LineaExtractoPersistida = {
    fechaOperacion: d.fechaOperacion,
    fechaValor: d.fechaValor,
    importe: d.importe,
    conceptoLiteral,
    ...(row.counterparty != null ? { contraparte: row.counterparty } : {}),
    ...(row.reference != null ? { referencia: row.reference } : {}),
    ...(typeof row.balance === 'number' ? { saldo: row.balance } : {}),
    ...(row.currency != null ? { divisa: row.currency } : {}),
    importBatchId: d.importBatchId,
    accountId: d.accountId,
    ...(row.originalRow != null ? { filaOriginal: row.originalRow } : {}),
    ...(row.rawData != null ? { datosCrudos: row.rawData } : {}),
    hashLinea: generateLineHash({ date: d.fechaOperacion, amount: d.importe, description: conceptoLiteral }),
    hashMovement: d.hashMovement,
    ...(() => {
      const huella = huellaFuerteDeFila(row, d);
      return huella ? { huellaFuerte: huella } : {};
    })(),
    // E3.1 · §9.5 · los identificadores se extraen UNA vez, aquí, y se guardan.
    // Antes cada lector los volvía a sacar del texto con la misma función pura.
    ...(() => {
      const ids = identificadoresDeMovimiento({
        description: conceptoLiteral,
        counterparty: row.counterparty,
        reference: row.reference,
      });
      return ids.length > 0 ? { identificadores: ids } : {};
    })(),
    // E1.5 · importar ya NO crea el movimiento: la línea nace PENDIENTE y
    // pasa a «resuelta» cuando el usuario (o el motor) la resuelve y nace su
    // movimiento (`materializarLinea`). Lo descartado no llegó a procesarse.
    estado: d.descarte ? 'sin_procesar' : 'pendiente',
    ...(d.descarte ? { descarte: d.descarte } : {}),
    movementIds: [...d.movementIds],
    createdAt: d.ahora,
    updatedAt: d.ahora,
  };
  return linea;
}

/**
 * Filas de `lineasExtracto` de un lote · por índice `importBatchId` cuando el
 * handle lo ofrece, con respaldo `getAll` + filtro (mocks de test, backups
 * parciales).
 */
export async function lineasDelLote(
  db: Awaited<ReturnType<typeof initDB>>,
  importBatchId: string
): Promise<LineaExtractoPersistida[]> {
  const porIndice = (db as { getAllFromIndex?: unknown }).getAllFromIndex;
  if (typeof porIndice === 'function') {
    return ((await db.getAllFromIndex('lineasExtracto', 'importBatchId', importBatchId)) ?? []) as LineaExtractoPersistida[];
  }
  const todas = ((await db.getAll('lineasExtracto')) ?? []) as LineaExtractoPersistida[];
  return todas.filter((l) => l.importBatchId === importBatchId);
}
