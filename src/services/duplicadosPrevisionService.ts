// ============================================================================
// Tesorería V6 · FASE 0 · duplicación de previsiones · DIAGNÓSTICO
// ============================================================================
//
// Este fichero NO borra nada. Cuenta, agrupa y explica cuánto distorsionan los
// duplicados, que es el paso 1 que pide el plan: "reportar a Jose ANTES de
// borrar nada".
//
// Por qué hace falta una herramienta en vez de mirar el código: los datos viven
// en el IndexedDB del navegador de cada usuario. Desde el repositorio se puede
// razonar sobre quién PODRÍA duplicar, pero no sobre qué está duplicado de
// hecho — y el plan pide cifras, no sospechas.
//
// La clave de duplicado es la del propio plan: `sourceType` + `sourceId` +
// periodo + cuenta, más el importe. Dos previsiones con la misma clave son la
// misma previsión emitida dos veces.
// ============================================================================

import { initDB } from './db';
import type { TreasuryEvent } from './db';

/** Un grupo de previsiones que son la misma cosa repetida. */
export interface GrupoDuplicado {
  clave: string;
  sourceType: string;
  sourceId: string;
  periodo: string;
  cuentaId: number | null;
  importe: number;
  descripcion: string;
  /** Cuántas copias hay · 2 significa una de más. */
  copias: number;
  ids: number[];
  /** Cuánto suma lo que sobra · `importe × (copias − 1)`, con signo. */
  distorsion: number;
  /** Estados de las copias · manda si se puede limpiar o no. */
  estados: Array<'predicted' | 'confirmed' | 'executed' | 'descartado'>;
}

export interface InformeDuplicados {
  eventosTotales: number;
  /** Grupos con más de una copia. */
  grupos: GrupoDuplicado[];
  /** Previsiones de más · si el total es 252, cuántas sobran. */
  copiasSobrantes: number;
  /**
   * Cuánto se desvía el cierre por culpa de las copias, sumando con signo.
   * Es la cifra que contesta "¿mis números están mal, y cuánto?".
   */
  distorsionTotal: number;
  /** Sobrantes que se pueden limpiar sin riesgo · solo `predicted`. */
  limpiablesPredicted: number;
  /**
   * Sobrantes que NO se tocan: ya confirmados o conciliados. Pueden ser cargos
   * reales repetidos (el banco cobró dos veces de verdad), así que se listan
   * para revisión manual en vez de borrarse.
   */
  paraRevisionManual: GrupoDuplicado[];
}

function estadoDe(e: TreasuryEvent): GrupoDuplicado['estados'][number] {
  if (e.descartado) return 'descartado';
  if (e.status === 'executed') return 'executed';
  if (e.status === 'confirmed') return 'confirmed';
  return 'predicted';
}

/** Periodo de la previsión · el mes es la granularidad de un recurrente. */
function periodoDe(e: TreasuryEvent): string {
  return (e.predictedDate ?? '').slice(0, 7);
}

/**
 * Clave de duplicado.
 *
 * Incluye el IMPORTE a propósito: dos cargos del mismo origen y mes con
 * importes distintos pueden ser legítimos (una cuota partida, un ajuste), y
 * meterlos en el mismo saco daría falsos positivos justo en el informe que
 * decide qué se borra.
 */
export function claveDuplicado(e: TreasuryEvent): string | null {
  const periodo = periodoDe(e);
  if (!periodo) return null;
  const origen = e.sourceType ?? '';
  const id = e.sourceId != null ? String(e.sourceId) : '';
  // Sin origen no se puede afirmar que sea la misma previsión regenerada: un
  // alta a mano repetida es decisión del usuario, no un fallo del motor.
  if (!origen || !id) return null;
  const cuenta = e.accountId != null ? String(e.accountId) : 'sin-cuenta';
  const importe = Math.round(Math.abs(e.amount) * 100);
  return `${origen}:${id}:${periodo}:${cuenta}:${importe}`;
}

/** Agrupa y cuenta · función pura, para poder probarla sin base de datos. */
export function analizarDuplicados(eventos: TreasuryEvent[]): InformeDuplicados {
  const porClave = new Map<string, TreasuryEvent[]>();

  for (const e of eventos) {
    if (e.id == null) continue;
    const clave = claveDuplicado(e);
    if (!clave) continue;
    const arr = porClave.get(clave);
    if (arr) arr.push(e);
    else porClave.set(clave, [e]);
  }

  const grupos: GrupoDuplicado[] = [];
  for (const [clave, copias] of porClave) {
    if (copias.length < 2) continue;
    const primera = copias[0];
    const signo = primera.type === 'income' ? 1 : -1;
    const importe = Math.abs(primera.amount) * signo;

    grupos.push({
      clave,
      sourceType: primera.sourceType ?? '',
      sourceId: String(primera.sourceId ?? ''),
      periodo: periodoDe(primera),
      cuentaId: primera.accountId ?? null,
      importe,
      descripcion: primera.description,
      copias: copias.length,
      ids: copias.map((c) => c.id as number),
      distorsion: Math.round(importe * (copias.length - 1) * 100) / 100,
      estados: copias.map(estadoDe),
    });
  }

  // Lo más dañino primero: por cuánto distorsiona, no por cuántas copias.
  grupos.sort((a, b) => Math.abs(b.distorsion) - Math.abs(a.distorsion));

  let copiasSobrantes = 0;
  let distorsionTotal = 0;
  let limpiablesPredicted = 0;
  const paraRevisionManual: GrupoDuplicado[] = [];

  for (const g of grupos) {
    copiasSobrantes += g.copias - 1;
    distorsionTotal += g.distorsion;
    // Las copias limpiables son las `predicted` que sobran: si el grupo tiene
    // una confirmada, esa se queda y las predicted sobrantes se van.
    const predicted = g.estados.filter((s) => s === 'predicted').length;
    const noPredicted = g.copias - predicted;
    limpiablesPredicted += noPredicted > 0 ? predicted : Math.max(0, predicted - 1);
    if (noPredicted > 1) paraRevisionManual.push(g);
  }

  return {
    eventosTotales: eventos.length,
    grupos,
    copiasSobrantes,
    distorsionTotal: Math.round(distorsionTotal * 100) / 100,
    limpiablesPredicted,
    paraRevisionManual,
  };
}

/** Lee la base y analiza · no escribe nada. */
export async function diagnosticarDuplicados(): Promise<InformeDuplicados> {
  const db = await initDB();
  const eventos = ((await db.getAll('treasuryEvents')) ?? []) as TreasuryEvent[];
  return analizarDuplicados(eventos);
}

/**
 * Deja el diagnóstico a mano en la consola del navegador.
 *
 * Las páginas `/dev/*` están apagadas en producción
 * (`REACT_APP_ENABLE_DEV_PAGES`), y los datos que hay que contar están
 * justamente en el navegador de producción. Esto es de SOLO LECTURA —no borra
 * ni escribe nada— así que puede estar siempre disponible sin riesgo.
 *
 *     await atlasDiagnostico.duplicados()   → informe legible por consola
 *     await atlasDiagnostico.duplicadosRaw() → el objeto, para inspeccionarlo
 */
export function registrarDiagnosticoEnConsola(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as Record<string, unknown>).atlasDiagnostico = {
    duplicados: async () => {
      const informe = await diagnosticarDuplicados();
      // eslint-disable-next-line no-console
      console.log(resumirInforme(informe));
      return informe;
    },
    duplicadosRaw: diagnosticarDuplicados,
  };
}

/**
 * Resumen en texto plano · pensado para copiar y pegar en un mensaje.
 *
 * El informe tiene que poder viajar: quien mira los datos (el navegador de
 * Jose) y quien decide el arreglo no son el mismo sitio.
 */
export function resumirInforme(inf: InformeDuplicados): string {
  const l: string[] = [];
  l.push(`Previsiones en total: ${inf.eventosTotales}`);
  l.push(`Grupos duplicados: ${inf.grupos.length}`);
  l.push(`Copias de más: ${inf.copiasSobrantes}`);
  l.push(`Distorsión en el cierre: ${inf.distorsionTotal.toFixed(2)} €`);
  l.push(`Limpiables sin riesgo (predicted): ${inf.limpiablesPredicted}`);
  l.push(`Para revisión manual (confirmadas/conciliadas repetidas): ${inf.paraRevisionManual.length}`);

  if (inf.grupos.length > 0) {
    l.push('');
    l.push('Los 10 que más distorsionan:');
    for (const g of inf.grupos.slice(0, 10)) {
      l.push(
        `  ${g.copias}× ${g.sourceType}:${g.sourceId} · ${g.periodo} · ` +
          `${g.importe.toFixed(2)} € · sobra ${g.distorsion.toFixed(2)} € · ` +
          `[${g.estados.join(', ')}] · ${g.descripcion}`
      );
    }
  }

  // Qué origen duplica más · es lo que señala al generador culpable.
  const porOrigen = new Map<string, number>();
  for (const g of inf.grupos) {
    porOrigen.set(g.sourceType, (porOrigen.get(g.sourceType) ?? 0) + (g.copias - 1));
  }
  if (porOrigen.size > 0) {
    l.push('');
    l.push('Copias de más por origen (señala al generador):');
    for (const [origen, n] of [...porOrigen].sort((a, b) => b[1] - a[1])) {
      l.push(`  ${origen}: ${n}`);
    }
  }

  return l.join('\n');
}
