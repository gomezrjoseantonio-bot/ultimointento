/**
 * P0 · DUPLICACIÓN DE PREVISIONES · utilidad de recuento y limpieza.
 *
 * Prefijo `__` indica herramienta de desarrollo · NO importar desde código de
 * producción. Consumidores legítimos:
 *   - `src/pages/dev/PrevisionesDuplicadas.tsx` (página DEV-only)
 *   - tests
 *
 * Arreglar el código NO limpia lo ya duplicado. Este módulo hace las dos cosas
 * que pide el parte, en este orden y por separado:
 *
 *   1. CONTAR (`contarPrevisionesDuplicadas`) · solo lee. Agrupa por CLAVE DE
 *      ORIGEN (`origen | id | año-mes | cuenta`) y dice cuántas previsiones
 *      sobran y cuánto distorsionan los cierres, mes a mes.
 *   2. LIMPIAR (`limpiarPrevisionesDuplicadas`) · en seco por defecto. Solo
 *      retira `predicted` vivas sobrantes. Una duplicada ya confirmada o
 *      conciliada NO se borra a ciegas (puede ser un cargo real repetido): se
 *      lista aparte para revisión manual.
 *
 * El recuento es reproducible: mismo estado de la BD → mismo informe. Sirve
 * para verificar que, tras el arreglo, la basura no vuelve a crecer.
 */

import { initDB } from './db';
import type { TreasuryEvent } from './db';
import {
  claveOrigenPrevision,
  esPrevisionIntocable,
} from './personal/previsionesIdempotencia';

/** Qué se hace con cada evento de un grupo duplicado. */
export type DestinoPrevision =
  /** Se queda · es la previsión buena de esa clave. */
  | 'conservar'
  /** Sobra y es `predicted` viva · se puede retirar sin perder realidad. */
  | 'sobrante_limpiable'
  /** Sobra pero está confirmada/conciliada/descartada · revisión manual. */
  | 'sobrante_revision_manual';

export interface PrevisionDuplicada {
  id: number;
  predictedDate: string;
  amount: number;
  status: TreasuryEvent['status'];
  descartado: boolean;
  conciliado: boolean;
  description: string;
  destino: DestinoPrevision;
}

export interface GrupoDuplicado {
  /** `origen | sourceId | año-mes | cuenta`. */
  clave: string;
  sourceType: string;
  sourceId: string;
  periodo: string;
  accountId: string;
  /** Todos los importes del grupo coinciden al céntimo (duplicado exacto). */
  exacto: boolean;
  eventos: PrevisionDuplicada[];
  /** Nº de eventos que sobran (limpiables + revisión manual). */
  sobrantes: number;
  /** Suma de los importes sobrantes · lo que el grupo infla el cierre. */
  importeSobrante: number;
}

export interface ImpactoMes {
  /** `YYYY-MM`. */
  periodo: string;
  gruposAfectados: number;
  /** Suma de los importes sobrantes de ese mes (negativo = cierre inflado a la baja). */
  importeSobrante: number;
}

export interface ReportePrevisionesDuplicadas {
  generadoAt: string;
  /** Total de eventos automáticos examinados (los `manual` quedan fuera). */
  eventosExaminados: number;
  grupos: GrupoDuplicado[];
  /** Grupos cuyos importes coinciden al céntimo · duplicado exacto. */
  gruposExactos: number;
  /** Grupos con la misma clave pero importes distintos (gemelo de una confirmada). */
  gruposMismoPeriodo: number;
  /** Previsiones sobrantes que se pueden retirar (`predicted` vivas). */
  sobrantesLimpiables: number;
  /** Previsiones sobrantes confirmadas/conciliadas/descartadas · NO se tocan. */
  sobrantesRevisionManual: number;
  /** Distorsión total de los cierres (suma de importes sobrantes). */
  importeSobranteTotal: number;
  /** Distorsión desglosada por mes, ordenada por periodo. */
  impactoPorMes: ImpactoMes[];
}

/** Origen automático: lo generó un motor, no el usuario a mano. */
function esAutomatica(ev: TreasuryEvent): boolean {
  return ev.sourceId != null && ev.sourceType !== 'manual';
}

function céntimos(n: number): number {
  return Math.round((n ?? 0) * 100);
}

/**
 * Cuenta las previsiones duplicadas. NO borra nada.
 *
 * Criterio de duplicado: dos o más eventos automáticos con la MISMA clave de
 * origen (mismo origen, mismo id, mismo periodo, misma cuenta). Solo puede
 * haber una previsión viva por clave.
 */
export async function contarPrevisionesDuplicadas(): Promise<ReportePrevisionesDuplicadas> {
  const db = await initDB();
  const todos = (await db.getAll('treasuryEvents')) as TreasuryEvent[];
  const automaticas = todos.filter(esAutomatica);

  const porClave = new Map<string, TreasuryEvent[]>();
  for (const ev of automaticas) {
    const clave = claveOrigenPrevision(ev);
    const lista = porClave.get(clave);
    if (lista) lista.push(ev);
    else porClave.set(clave, [ev]);
  }

  const grupos: GrupoDuplicado[] = [];
  for (const [clave, eventos] of Array.from(porClave.entries())) {
    if (eventos.length < 2) continue;

    // Orden estable y reproducible: primero lo intocable (realidad bancaria y
    // decisiones del usuario), luego lo más antiguo. El primero se conserva.
    const ordenados = [...eventos].sort((a, b) => {
      const ia = esPrevisionIntocable(a) ? 0 : 1;
      const ib = esPrevisionIntocable(b) ? 0 : 1;
      if (ia !== ib) return ia - ib;
      return (a.id ?? 0) - (b.id ?? 0);
    });

    const detalle: PrevisionDuplicada[] = ordenados.map((ev, i) => {
      const intocable = esPrevisionIntocable(ev);
      let destino: DestinoPrevision;
      if (i === 0) destino = 'conservar';
      else destino = intocable ? 'sobrante_revision_manual' : 'sobrante_limpiable';
      return {
        id: ev.id as number,
        predictedDate: ev.predictedDate,
        amount: ev.amount,
        status: ev.status,
        descartado: ev.descartado === true,
        conciliado: ev.executedMovementId != null,
        description: ev.description,
        destino,
      };
    });

    const sobrantesDetalle = detalle.filter((d) => d.destino !== 'conservar');
    const importesDistintos = new Set(ordenados.map((e) => céntimos(e.amount)));
    const [, sourceId = '', periodo = '', accountId = ''] = clave.split('|');

    grupos.push({
      clave,
      sourceType: ordenados[0].sourceType,
      sourceId,
      periodo,
      accountId,
      exacto: importesDistintos.size === 1,
      eventos: detalle,
      sobrantes: sobrantesDetalle.length,
      importeSobrante: sobrantesDetalle.reduce((s, d) => s + d.amount, 0),
    });
  }

  grupos.sort((a, b) => (a.periodo === b.periodo ? a.clave.localeCompare(b.clave) : a.periodo.localeCompare(b.periodo)));

  const impacto = new Map<string, ImpactoMes>();
  for (const g of grupos) {
    const actual = impacto.get(g.periodo) ?? { periodo: g.periodo, gruposAfectados: 0, importeSobrante: 0 };
    actual.gruposAfectados += 1;
    actual.importeSobrante += g.importeSobrante;
    impacto.set(g.periodo, actual);
  }

  const contarDestino = (destino: DestinoPrevision) =>
    grupos.reduce((s, g) => s + g.eventos.filter((e) => e.destino === destino).length, 0);

  return {
    generadoAt: new Date().toISOString(),
    eventosExaminados: automaticas.length,
    grupos,
    gruposExactos: grupos.filter((g) => g.exacto).length,
    gruposMismoPeriodo: grupos.filter((g) => !g.exacto).length,
    sobrantesLimpiables: contarDestino('sobrante_limpiable'),
    sobrantesRevisionManual: contarDestino('sobrante_revision_manual'),
    importeSobranteTotal: grupos.reduce((s, g) => s + g.importeSobrante, 0),
    impactoPorMes: Array.from(impacto.values()).sort((a, b) => a.periodo.localeCompare(b.periodo)),
  };
}

export interface ResultadoLimpieza {
  /** `false` = ensayo en seco · no se ha tocado nada. */
  aplicado: boolean;
  /** Previsiones `predicted` vivas retiradas (o que se retirarían en seco). */
  retiradas: number;
  /** IDs retirados · para poder auditar después. */
  ids: number[];
  /** Duplicados confirmados/conciliados/descartados que quedan para revisión manual. */
  pendientesRevisionManual: number;
  reporte: ReportePrevisionesDuplicadas;
}

/**
 * Retira las previsiones duplicadas sobrantes. **En seco por defecto**: hay que
 * pasar `{ confirmar: true }` explícitamente para que borre.
 *
 * Solo toca `predicted` vivas. Las confirmadas, conciliadas y descartadas no se
 * borran nunca desde aquí: pueden corresponder a un cargo real repetido y salen
 * en `pendientesRevisionManual` para mirarlas una a una.
 */
export async function limpiarPrevisionesDuplicadas(
  opts: { confirmar?: boolean } = {},
): Promise<ResultadoLimpieza> {
  const reporte = await contarPrevisionesDuplicadas();
  const ids = reporte.grupos
    .flatMap((g) => g.eventos)
    .filter((e) => e.destino === 'sobrante_limpiable')
    .map((e) => e.id)
    .filter((id): id is number => id != null);

  if (!opts.confirmar) {
    return {
      aplicado: false,
      retiradas: ids.length,
      ids,
      pendientesRevisionManual: reporte.sobrantesRevisionManual,
      reporte,
    };
  }

  const db = await initDB();
  const tx = db.transaction('treasuryEvents', 'readwrite');
  const store = tx.objectStore('treasuryEvents');
  const retirados: number[] = [];
  for (const id of ids) {
    // Relectura dentro de la transacción · si algo lo confirmó entre el
    // recuento y el borrado, se respeta y no se toca.
    const ev = (await store.get(id)) as TreasuryEvent | undefined;
    if (!ev || esPrevisionIntocable(ev)) continue;
    await store.delete(id);
    retirados.push(id);
  }
  await tx.done;

  return {
    aplicado: true,
    retiradas: retirados.length,
    ids: retirados,
    pendientesRevisionManual: reporte.sobrantesRevisionManual,
    reporte,
  };
}

/** Resumen en texto plano · para pegar en un parte sin capturas. */
export function formatearReporte(r: ReportePrevisionesDuplicadas): string {
  const eur = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
  const lineas = [
    `Previsiones duplicadas · ${r.generadoAt}`,
    `Eventos automáticos examinados: ${r.eventosExaminados}`,
    `Grupos duplicados: ${r.grupos.length} (exactos ${r.gruposExactos} · mismo periodo con importe distinto ${r.gruposMismoPeriodo})`,
    `Sobrantes limpiables (predicted vivas): ${r.sobrantesLimpiables}`,
    `Sobrantes para revisión manual (confirmadas/conciliadas/descartadas): ${r.sobrantesRevisionManual}`,
    `Distorsión total de los cierres: ${eur(r.importeSobranteTotal)}`,
    '',
    'Impacto por mes:',
    ...r.impactoPorMes.map(
      (m) => `  ${m.periodo} · ${m.gruposAfectados} grupo(s) · ${eur(m.importeSobrante)}`,
    ),
  ];
  return lineas.join('\n');
}
