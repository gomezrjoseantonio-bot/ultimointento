// ============================================================================
// Conciliar · los cuatro buckets · y la garantía de que nada se pierde
// ============================================================================
//
// Toda línea del banco cae en EXACTAMENTE uno de cuatro sitios. No hay un
// quinto, y no hay limbo: `bucketDeLinea` es total.
//
// Lo que esto retiró (FASE 1): los destinos «mes cerrado» y «mes anterior». No
// eran una clasificación, eran una papelera — se mandaban con las sin resolver
// a `consolidarSesion`, que entonces BORRABA su `Movement`. Ochenta y ocho
// movimientos reales del banco desaparecían al pulsar Guardar, apoyándose en un
// cierre de mes que nadie puede haber hecho. Tras E1.5 nada de eso existe:
// importar no crea movimientos, consolidar solo estampa la marca de guardado y
// lo sin resolver sigue siendo línea del extracto.
//
// ── Dos cuadres distintos, y no se mezclan ──────────────────────────────────
//
// El de ESTA fase es de LÍNEAS: 124 del banco = 124 colocadas. Que una línea
// esté sin clasificar no la saca del recuento.
//
// El del SALDO es otro y ya tiene dueño: `accountBalanceService` con la frontera
// de `openingBalanceDate`. Una línea sin clasificar no toca la caja, y eso no
// depende de en qué bucket esté.
// ============================================================================

import { veredictoEfectivo, type DecisionesSesion, type LineaExtracto } from './extractoSesion';

/**
 * Dónde va una línea. Cuatro, los del mockup.
 *
 * `personal` no es un veredicto fiscal escrito en pantalla: es solo el montón
 * donde se recoge lo que ya se sabe que no es de un inmueble, para que no
 * estorbe a lo que sí necesita una decisión.
 *
 * Quién decide que una línea es personal viene de FUERA (`personales`), y solo
 * por las dos vías que el brief admite: una regla que el usuario enseñó o la
 * marca de un recurrente. No entra la heurística — la regla de Amazon marca
 * gasto personal por leer una palabra en el texto, y dejarla contar sacaría la
 * línea de «te necesitan» sin que el usuario haya decidido nada.
 */
export type Bucket = 'resueltas' | 'te_necesitan' | 'personal' | 'ignorados';

/**
 * El bucket de una línea · función TOTAL.
 *
 * El `default` no es una precaución de estilo: es la red de seguridad del
 * invariante. Un veredicto que nadie previó —hoy o dentro de tres versiones—
 * cae en «te necesitan», que es el destino de lo no clasificado (§3.1). Así
 * nunca se pierde una línea y nunca se queda la pantalla muerta: lo peor que
 * pasa es que aparezca algo que no tocaba, y eso se ve y se mueve.
 */
export function bucketDeLinea(
  linea: LineaExtracto,
  decisiones: DecisionesSesion,
  /** Por `lineaId` (E1.5) · vienen de las sugerencias por línea. */
  personales?: ReadonlySet<number>,
  /** Por `lineaId` (E1.5) · viene del reconocedor por línea. */
  reconocidas?: ReadonlySet<number>,
  /** E2.2 · por `lineaId` · una regla aprendida con confianza la resuelve sola. */
  autoResueltas?: ReadonlySet<number>,
): Bucket {
  const veredicto = veredictoEfectivo(linea, decisiones);

  // Ignorar es del usuario y va antes que nada: si él apartó la línea, ahí se
  // queda aunque además la hubiera desemparejado.
  if (veredicto === 'ignorada') return 'ignorados';

  // «No es esto» · la corrección del usuario manda sobre las tres máquinas que
  // pueden sacar una línea de «te necesitan» (el emparejador, el reconocedor y
  // las reglas de personal). Va AQUÍ, antes del `case 'cuadra'`, y el orden no
  // es cosmético: puesto después, el veredicto automático volvería a ganar y el
  // «No es esto» no serviría justo sobre las líneas donde más falta hace.
  if (decisiones.desemparejados?.has(linea.lineaId)) return 'te_necesitan';

  switch (veredicto) {
    case 'cuadra':
      return 'resueltas';
    default:
      // FASE 2 · reconocida contra un libro del usuario (la cuota 7 de su
      // préstamo, el pago de su inversión). No casó con una previsión porque
      // para el pasado no hay previsiones que casar, pero está tan resuelta
      // como si hubiera casado: fecha e importe exactos contra un dato que
      // escribió él. Va antes que `personal` porque saber QUÉ es una línea
      // pesa más que saber de quién es.
      if (reconocidas?.has(linea.lineaId)) return 'resueltas';
      // E2.2 · una regla aprendida que ya se ha ganado la confianza
      // (`reglaResuelveSola`) la resuelve sola al Guardar. Va detrás del
      // reconocedor (una igualdad exacta pesa más que una regla) y delante de
      // «personal» (resolver pesa más que solo saber de quién es). El «No es
      // esto» de arriba la devuelve a «te necesitan» y penaliza la regla.
      if (autoResueltas?.has(linea.lineaId)) return 'resueltas';
      // El montón «personal» va DESPUÉS de los dos anteriores a propósito. Que
      // una línea sea tuya y no de un piso no la desconcilia ni la designora:
      // «resueltas» e «ignorados» son actos —uno del emparejador, otro del
      // usuario— y esto es solo de quién es el gasto.
      if (personales?.has(linea.lineaId)) return 'personal';
      // `resolver` y todo lo demás —incluidos los antiguos `mes_cerrado` y
      // `mes_anterior`, que ya no apartan— piden una decisión.
      return 'te_necesitan';
  }
}

export interface Cuadre {
  /** Las que trajo el fichero. */
  delBanco: number;
  /** Las que han caído en algún bucket. Debe ser igual. */
  colocadas: number;
  porBucket: Record<Bucket, number>;
  cuadra: boolean;
  /** Las que no cayeron en ninguno · siempre vacío mientras la función sea total. */
  huerfanas: number[];
}

/**
 * El recuento que la pantalla canta: «N del banco · N colocadas · ninguna se
 * pierde».
 *
 * `cuadra` es lo que decide si se puede guardar. Con `bucketDeLinea` total no
 * debería ser nunca `false`; se calcula igualmente porque un invariante que no
 * se comprueba no es un invariante, es una intención.
 */
export function cuadre(
  lineas: LineaExtracto[],
  decisiones: DecisionesSesion,
  personales?: ReadonlySet<number>,
  reconocidas?: ReadonlySet<number>,
  autoResueltas?: ReadonlySet<number>,
): Cuadre {
  const porBucket: Record<Bucket, number> = {
    resueltas: 0,
    te_necesitan: 0,
    personal: 0,
    ignorados: 0,
  };
  const huerfanas: number[] = [];

  for (const l of lineas) {
    const b = bucketDeLinea(l, decisiones, personales, reconocidas, autoResueltas);
    if (b in porBucket) porBucket[b] += 1;
    else huerfanas.push(l.lineaId);
  }

  const colocadas = Object.values(porBucket).reduce((a, n) => a + n, 0);
  return {
    delBanco: lineas.length,
    colocadas,
    porBucket,
    cuadra: colocadas === lineas.length && huerfanas.length === 0,
    huerfanas,
  };
}

/** Las líneas de un bucket · para pintar cada montón. */
export function lineasDelBucket(
  lineas: LineaExtracto[],
  decisiones: DecisionesSesion,
  bucket: Bucket,
  personales?: ReadonlySet<number>,
  reconocidas?: ReadonlySet<number>,
): LineaExtracto[] {
  return lineas.filter((l) => bucketDeLinea(l, decisiones, personales, reconocidas) === bucket);
}
