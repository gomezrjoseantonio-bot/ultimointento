// ============================================================================
// E1.3 · lo que el drawer lee y escribe para montar una sesión
// ============================================================================
//
// Sacado de `DrawerExtracto.tsx` para que el drawer no pase de 800 líneas
// (trinquete de salud). Aquí no hay UI: son las lecturas de la base con las que
// se construyen las líneas de una sesión (recién procesada o retomada), la
// lista de lotes a medias del Paso 1 y la escritura de cada gesto en su línea.
// ============================================================================

import { useEffect, useState } from 'react';
import type { Account, Movement, TreasuryEvent, LineaExtractoPersistida } from '../../../services/db';
import { initDB } from '../../../services/db';
import type { OrchestratorResult } from '../../../services/bankStatementOrchestrator';
import { getIgnoredLineHashes } from '../../../services/statementIgnoredLinesService';
import { confirmadosPorLineaExtracto } from '../../../services/conciliacionConfirmados';
import { propuestaDeAnclaje, type PropuestaDeAnclaje } from '../../../services/anclajeSaldoExtracto';
import { construirLineas, seOfrecePara, type LineaExtracto } from './extractoSesion';
import {
  guardarDecisionDeLinea,
  lineasDelLote,
  lotesAMedias,
  type CambioDeDecision,
  type LoteAMedias,
} from './decisionesPersistidas';

// Las escrituras van en fila, una detrás de otra: `guardarDecisionDeLinea` es
// leer la fila y volver a escribirla, y dos gestos seguidos sobre la misma
// línea (o un IndexedDB lento) podrían completarse fuera de orden y dejar
// persistida la decisión anterior. Con la cola, el orden de los gestos es el
// orden en la base. Un fallo no rompe la cola: se avisa y sigue la siguiente.
let cola: Promise<void> = Promise.resolve();

/**
 * E1.3 · cada gesto se persiste en la fila de su línea. Si falla, la sesión
 * sigue en memoria como siempre: perder la copia durable no puede parar al
 * usuario, y se avisa por consola para no esconderlo.
 */
export function persistirCambios(cambios: CambioDeDecision[]): void {
  for (const c of cambios) {
    cola = cola
      .then(() => guardarDecisionDeLinea(c.lineaId, c.decision))
      .catch((err) =>
        console.error('[DrawerExtracto] no se pudo persistir la decisión de la línea', c.lineaId, err),
      );
  }
}

/**
 * E1.3 · los lotes sin guardar que se pueden retomar · se enseñan en Paso 1.
 * Se leen cada vez que `activo` pasa a true; si la lectura falla, la lista sale
 * vacía y soltar un fichero funciona igual.
 */
export function useLotesAMedias(activo: boolean): LoteAMedias[] {
  const [aMedias, setAMedias] = useState<LoteAMedias[]>([]);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    lotesAMedias()
      .then((l) => { if (vivo) setAMedias(l); })
      .catch(() => { if (vivo) setAMedias([]); });
    return () => { vivo = false; };
  }, [activo]);
  return aMedias;
}

export interface SesionDelLote {
  /** Los previstos abiertos de la cuenta, para el panel de asignar. */
  previstos: TreasuryEvent[];
  lineas: LineaExtracto[];
  /** Las filas persistidas del lote (E1.1) · de ellas salen las decisiones (E1.3). */
  filas: LineaExtractoPersistida[];
  /**
   * E1.5-anclaje-saldo · lo que el banco dice del saldo frente a lo que ATLAS
   * calcula, y la apertura que haría cuadrar. `null` si el fichero no trae
   * columna de saldo. ATLAS propone; el usuario confirma al guardar.
   */
  anclaje: PropuestaDeAnclaje | null;
  /** Las filas del fichero descartadas por estar YA en ATLAS · para enseñar cuáles. */
  yaEstaban: LineaExtractoPersistida[];
}

/**
 * «Banc Sabadell · ****2715 · 102 líneas».
 *
 * Los cuatro últimos dígitos solo se enseñan si la cuenta los tiene: sin ellos
 * salían cuatro asteriscos sueltos, que no identifican nada y encima parecen un
 * dato que no se ha cargado.
 */
export function tituloDeLaSesion(cuenta: Account | null, cuantasLineas: number): string {
  const lineas = `${cuantasLineas} ${cuantasLineas === 1 ? 'línea' : 'líneas'}`;
  if (!cuenta) return lineas;
  const cuatro = cuenta.ultimosCuatro?.trim();
  return [cuenta.alias, cuatro ? `****${cuatro}` : null, lineas].filter(Boolean).join(' · ');
}

/**
 * Leer de la base lo que hace falta para montar la sesión de un lote · vale
 * para un fichero recién procesado y para un lote retomado (E1.3). Las
 * decisiones NO se tocan aquí: quien llama decide si parte de cero o carga
 * las persistidas.
 */
export async function leerSesionDelLote(res: OrchestratorResult, destino: Account): Promise<SesionDelLote> {
  const db = await initDB();
  const [todosMovs, todosEventos, ignoradasPrevias, filas] = await Promise.all([
    db.getAll('movements') as Promise<Movement[]>,
    db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
    getIgnoredLineHashes(destino.id as number),
    // E1.2 · las líneas persistidas de ESTE lote (E1.1): dan el `lineaId`.
    lineasDelLote(db, res.importBatchId),
  ]);
  // "Las dos cosas" · lo que ya anotaste a mano se conserva con el aval del
  // banco (D1), no duplica. E1.5 · por línea: el lote no tiene movimientos.
  const confirmados = confirmadosPorLineaExtracto(filas, todosMovs ?? [], destino.id as number);
  const previstos = (todosEventos ?? []).filter((e) => seOfrecePara(e, destino.id));
  // Si el cuadre con el banco no se puede calcular, la sesión sigue igual:
  // anclar es una propuesta, no una condición para conciliar.
  const anclaje = await propuestaDeAnclaje(db, destino, filas).catch((err) => {
    console.warn('[DrawerExtracto] no se pudo calcular el cuadre con el banco', err);
    return null;
  });
  return {
    previstos,
    lineas: construirLineas(filas, res.matchResult, previstos, ignoradasPrevias, confirmados),
    filas,
    anclaje,
    yaEstaban: filas.filter((f) => f.descarte === 'duplicada'),
  };
}
