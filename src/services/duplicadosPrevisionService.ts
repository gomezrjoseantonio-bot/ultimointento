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
import { eventosPasadosDePrestamo } from './prestamoEventosPlan';
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

  // Las previsiones de préstamo NO usan `sourceId`: se identifican por
  // `prestamoId` (+ `numeroCuota` cuando lo llevan). Sin este respaldo el
  // informe se saltaba los préstamos enteros — y son precisamente uno de los
  // orígenes que regenera el motor, así que el conteo saldría corto justo
  // donde importa.
  const origen = e.sourceType ?? (e.prestamoId != null ? 'prestamo' : '');
  const id =
    e.sourceId != null
      ? String(e.sourceId)
      : e.prestamoId != null
        ? `prestamo-${e.prestamoId}${e.numeroCuota != null ? `-c${e.numeroCuota}` : ''}`
        : '';

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
      sourceType: primera.sourceType ?? (primera.prestamoId != null ? 'prestamo' : ''),
      // El id que se enseña es el mismo que identifica la clave, para que el
      // informe y el grupo hablen de lo mismo también en los préstamos.
      sourceId:
        primera.sourceId != null
          ? String(primera.sourceId)
          : primera.prestamoId != null
            ? `prestamo-${primera.prestamoId}`
            : '',
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

/**
 * Borra las copias sobrantes · FASE 1 del plan.
 *
 * Dos reglas, y no son ceremonia:
 *
 * 1. Solo se borran previsiones en `predicted`. Una confirmada o conciliada
 *    puede ser un cargo REAL repetido —el banco cobró dos veces de verdad— y
 *    borrarla sería inventar que no pasó.
 * 2. De cada grupo queda siempre una. Si alguna copia ya está confirmada, esa
 *    es la que se queda y se van todas las previstas; si no hay ninguna firme,
 *    se conserva la más antigua.
 *
 * Es idempotente: la segunda pasada no borra nada porque no queda ninguna
 * `predicted` sobrante que quitar. Los grupos SIGUEN existiendo —una confirmada
 * y una conciliada del mismo cargo siguen siendo dos copias— pero ninguna de
 * ellas es candidata, así que la lista de borrado sale vacía.
 */
export async function limpiarDuplicados(): Promise<{
  borradas: number;
  correccionCierre: number;
  ids: number[];
}> {
  const db = await initDB();
  const eventos = ((await db.getAll('treasuryEvents')) ?? []) as TreasuryEvent[];

  const porClave = new Map<string, TreasuryEvent[]>();
  for (const e of eventos) {
    if (e.id == null) continue;
    const clave = claveDuplicado(e);
    if (!clave) continue;
    const arr = porClave.get(clave);
    if (arr) arr.push(e);
    else porClave.set(clave, [e]);
  }

  const aBorrar: TreasuryEvent[] = [];
  for (const copias of porClave.values()) {
    if (copias.length < 2) continue;
    const firmes = copias.filter((e) => estadoDe(e) !== 'predicted');
    const previstas = copias
      .filter((e) => estadoDe(e) === 'predicted')
      .sort((a, b) => (a.id as number) - (b.id as number));
    const conservar = firmes.length > 0 ? null : previstas[0];
    for (const e of previstas) if (e !== conservar) aBorrar.push(e);
  }

  if (aBorrar.length > 0) {
    const tx = db.transaction('treasuryEvents', 'readwrite');
    await Promise.all(aBorrar.map((e) => tx.store.delete(e.id as number)));
    await tx.done;
  }

  // Lo que sobraba desviaba el cierre; al quitarlo, se corrige al revés.
  const desviacion = aBorrar.reduce(
    (s, e) => s + Math.abs(e.amount) * (e.type === 'income' ? 1 : -1),
    0
  );

  return {
    borradas: aBorrar.length,
    correccionCierre: Math.round(-desviacion * 100) / 100,
    ids: aBorrar.map((e) => e.id as number),
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
 * justamente en el navegador de producción.
 *
 *     await atlasDiagnostico.duplicados()    → informe legible · SOLO LEE
 *     await atlasDiagnostico.duplicadosRaw() → el objeto · SOLO LEE
 *     await atlasDiagnostico.limpiar()       → ⚠ BORRA en IndexedDB
 *
 * `limpiar()` NO es de solo lectura: elimina previsiones. Es acotado —solo
 * `predicted` sobrantes, nunca lo confirmado ni lo conciliado, y siempre deja
 * una copia de cada grupo— pero borra, y borrar no se deshace. Por eso avisa
 * antes de tocar nada y cuenta exactamente qué se llevó.
 */
export function registrarDiagnosticoEnConsola(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  // Se FUSIONA en vez de sobrescribir: si otra herramienta ya colgó algo de
  // esta misma clave, reemplazar el objeto entero se la llevaría por delante.
  const previo = (w.atlasDiagnostico as Record<string, unknown>) ?? {};
  w.atlasDiagnostico = {
    ...previo,
    duplicados: async () => {
      const informe = await diagnosticarDuplicados();
      // eslint-disable-next-line no-console
      console.log(resumirInforme(informe));
      return informe;
    },
    duplicadosRaw: diagnosticarDuplicados,

    /**
     * Limpia los eventos de préstamo con fecha PASADA que sobran.
     *
     * El guardado de un préstamo reemitía su cuadro entero cada vez, así que
     * las cuotas y las disposiciones de años anteriores acabaron en la base.
     * Sobran estén como estén: en `predicted` ensucian "por confirmar", y en
     * `confirmed` inflan el saldo —la disposición de un préstamo de 78.500 €
     * contada otra vez sobre un saldo que ya la incluía—.
     *
     * Lo `executed` no se toca: está casado con un movimiento real del banco.
     */
    limpiarPrestamosPasados: async () => {
      const db = await initDB();
      const eventos = ((await db.getAll('treasuryEvents')) ?? []) as TreasuryEvent[];
      const hoy = new Date().toISOString().slice(0, 10);
      const ids = eventosPasadosDePrestamo(eventos, hoy);

      if (ids.length === 0) {
        console.log('No hay eventos de préstamo pasados que limpiar.');
        return { borrados: 0 };
      }

      console.warn(
        `Se van a BORRAR ${ids.length} eventos de préstamo con fecha pasada.\n` +
          'Son cuotas y disposiciones que el guardado reemitió de más · lo que de ' +
          'verdad ocurrió ya está en el saldo de la cuenta. No se toca nada futuro ' +
          'ni nada conciliado con el banco.'
      );

      const tx = db.transaction('treasuryEvents', 'readwrite');
      for (const id of ids) await tx.store.delete(id);
      await tx.done;

      console.log(`${ids.length} eventos borrados. Recarga la página.`);
      return { borrados: ids.length };
    },
    limpiar: async () => {
      // Se avisa ANTES de tocar nada: `duplicados()` solo lee, y quien llegue a
      // `limpiar()` desde ahí puede no haber reparado en que esta sí borra.
      console.warn(
        'atlasDiagnostico.limpiar() BORRA previsiones duplicadas de IndexedDB.\n' +
          'Solo las previstas sobrantes · nunca lo confirmado ni lo conciliado · ' +
          'siempre deja una copia de cada grupo. No se deshace.'
      );
      const r = await limpiarDuplicados();
      if (r.borradas === 0) {
        console.log('No hay duplicados que borrar.');
        return r;
      }
      console.log(
        `Borradas ${r.borradas} previsiones duplicadas · el cierre se corrige en ` +
          `${r.correccionCierre.toFixed(2)} €.\nRecarga la página para ver las cifras.`
      );
      return r;
    },
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
