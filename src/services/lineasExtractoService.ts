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

import type { ParsedMovement } from '../types/bankProfiles';
import type { DescarteLineaExtracto, LineaExtractoPersistida } from './db/types-movimientos';
import { generateLineHash } from '../utils/batchHashUtils';

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
    // E1.1 · todo lo que genera movimiento nace «resuelta» porque hoy el import
    // lo materializa; lo descartado no llegó a procesarse.
    estado: d.descarte ? 'sin_procesar' : 'resuelta',
    ...(d.descarte ? { descarte: d.descarte } : {}),
    movementIds: [...d.movementIds],
    createdAt: d.ahora,
    updatedAt: d.ahora,
  };
  return linea;
}
