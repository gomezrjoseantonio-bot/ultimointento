// ============================================================================
// PASO 3 · Migración al catálogo unificado · escribe `concepto` y realinea
// ============================================================================
//
// Hasta ahora un gasto guardaba CUATRO campos de clasificación —`tipoFamilia`,
// `subtipo`, `categoria` y `tipo`— copiados del catálogo de la pestaña en la
// que se creó y congelados desde entonces. Congelados es la palabra: si el
// catálogo cambiaba, o si el gasto se había creado en la pestaña «equivocada»,
// la clasificación se quedaba como estaba y nadie se enteraba.
//
// De ahí salió el gasto que abrió todo esto: un seguro de vida de ámbito
// PERSONAL con `categoria: 'inmueble.seguros'` y familia `seguros`, que no
// existe en el catálogo personal. Se cobraba todos los meses y no aparecía en
// ninguna pantalla donde poder tocarlo.
//
// Esta migración escribe `concepto` —el id del catálogo unificado— y REALINEA
// `categoria`, `bolsaPresupuesto` y `tipo` con la proyección que le corresponde
// a ese concepto en el ámbito del registro. A partir de aquí esos tres campos
// son derivados: se siguen guardando porque medio sistema los lee, pero ya no
// son una opinión independiente que pueda contradecir al concepto.
//
// ── Lo que NO hace ─────────────────────────────────────────────────────────
//
// No adivina. Si el par (`tipoFamilia`, `subtipo`) no se reconoce y el subtipo
// tampoco es unívoco en su ámbito, el registro se queda EXACTAMENTE como está y
// sale en el informe. Un concepto decide la casilla AEAT; inventar el más
// parecido contamina la declaración en silencio, que es peor que dejar cinco
// gastos marcados para revisar.
//
// No borra `tipoFamilia` ni `subtipo`: siguen ahí mientras quede código
// leyéndolos. Se retiran cuando no queden lectores, no antes.
//
// ── Por qué se puede reescribir de una pasada ──────────────────────────────
//
// Porque no hay nada confirmado que respetar: ninguna declaración importada,
// ninguna declarada, ningún gasto confirmado. Realinear `categoria` sobre datos
// ya declarados sería otra conversación —habría que congelar el pasado— y la
// migración tendría que saltarse los ejercicios cerrados.
//
// Idempotente: la segunda pasada calcula lo mismo y no encuentra nada que
// cambiar. El flag sólo evita releer la tabla en cada arranque.
// ============================================================================

import { initDB } from '../db';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';
import {
  resolverConcepto,
  resolverConceptoPorSubtipoUnico,
} from '../conceptos/mapaLegacy';
import { conceptoPorId, proyectar } from '../conceptos/catalogoConceptos';
import type { ProyeccionPersonal } from '../conceptos/catalogoConceptos';

const MIGRATION_KEY = 'migration_concepto_unificado_v1';

/** Cómo se llegó al concepto · el informe lo separa para poder auditarlo. */
export type ViaResolucion = 'par' | 'subtipo_unico' | 'ya_tenia';

export interface CambioConcepto {
  id: number;
  alias: string;
  ambito: 'personal' | 'inmueble';
  concepto: string;
  via: ViaResolucion;
  /** Campos derivados que NO cuadraban con la proyección · `antes → después`. */
  realineados: Record<string, { antes: unknown; despues: unknown }>;
}

export interface SinResolver {
  id: number;
  alias: string;
  ambito: 'personal' | 'inmueble';
  tipoFamilia?: string;
  subtipo?: string;
  categoria: string;
  /** Por qué no se pudo · para que el informe diga algo accionable. */
  motivo: 'par_desconocido' | 'subtipo_ambiguo' | 'concepto_no_aplica_al_ambito';
}

export interface ResultadoMigracionConcepto {
  revisados: number;
  /** Registros que ganaron `concepto` o a los que se les realineó algo. */
  cambios: CambioConcepto[];
  /** Registros intactos que necesitan que alguien los mire. */
  sinResolver: SinResolver[];
}

/** El concepto que le toca a un registro, y por qué camino se llegó. */
export function resolverParaCompromiso(
  c: CompromisoRecurrente,
): { concepto: string; via: ViaResolucion } | { motivo: SinResolver['motivo'] } {
  const yaTenia = c.concepto && conceptoPorId(c.concepto) ? c.concepto : undefined;
  const porPar = yaTenia ?? resolverConcepto(c.tipoFamilia, c.subtipo) ?? undefined;
  const via: ViaResolucion = yaTenia ? 'ya_tenia' : 'par';

  if (porPar) {
    // Un concepto que no sabe clasificarse en este ámbito NO se escribe: es el
    // caso del seguro de vida al revés, y taparlo lo repetiría.
    if (!proyectar(porPar, c.ambito)) return { motivo: 'concepto_no_aplica_al_ambito' };
    return { concepto: porPar, via };
  }

  const unico = resolverConceptoPorSubtipoUnico(c.subtipo, c.ambito);
  if (unico) return { concepto: unico, via: 'subtipo_unico' };

  return { motivo: c.subtipo ? 'subtipo_ambiguo' : 'par_desconocido' };
}

/**
 * Los campos derivados que ese concepto impone, ya comparados con lo guardado.
 *
 * Devuelve sólo lo que CAMBIA. Un registro cuyos cuatro campos ya cuadran no
 * genera escritura, que es lo que hace la migración idempotente sin depender del
 * flag.
 */
export function realinearDerivados(
  c: CompromisoRecurrente,
  conceptoId: string,
): { parche: Partial<CompromisoRecurrente>; realineados: CambioConcepto['realineados'] } {
  const concepto = conceptoPorId(conceptoId);
  const proyeccion = proyectar(conceptoId, c.ambito);
  const parche: Partial<CompromisoRecurrente> = {};
  const realineados: CambioConcepto['realineados'] = {};
  if (!concepto || !proyeccion) return { parche, realineados };

  const anotar = <K extends keyof CompromisoRecurrente>(
    campo: K,
    valor: CompromisoRecurrente[K],
  ) => {
    if (c[campo] === valor) return;
    realineados[campo as string] = { antes: c[campo], despues: valor };
    parche[campo] = valor;
  };

  if (c.concepto !== conceptoId) parche.concepto = conceptoId;
  anotar('categoria', proyeccion.categoria);
  anotar('tipo', concepto.tipoCompromiso);
  if (c.ambito === 'personal') {
    anotar('bolsaPresupuesto', (proyeccion as ProyeccionPersonal).bolsa);
  } else {
    // Un gasto de inmueble no entra en el 50/30/20 personal · su bolsa es la
    // suya, la lleve puesta o no de cuando se creó en la otra pestaña.
    anotar('bolsaPresupuesto', 'inmueble');
  }

  return { parche, realineados };
}

/** Escribe `concepto` y realinea los derivados. Devuelve qué se tocó. */
export async function migrarConceptoUnificado(): Promise<ResultadoMigracionConcepto> {
  const db = await initDB();
  const compromisos = ((await db.getAll('compromisosRecurrentes')) ??
    []) as CompromisoRecurrente[];

  const cambios: CambioConcepto[] = [];
  const sinResolver: SinResolver[] = [];
  const parches = new Map<number, Partial<CompromisoRecurrente>>();

  for (const c of compromisos) {
    if (c.id == null) continue;
    const r = resolverParaCompromiso(c);
    if ('motivo' in r) {
      sinResolver.push({
        id: c.id,
        alias: c.alias,
        ambito: c.ambito,
        tipoFamilia: c.tipoFamilia,
        subtipo: c.subtipo,
        categoria: c.categoria,
        motivo: r.motivo,
      });
      continue;
    }
    const { parche, realineados } = realinearDerivados(c, r.concepto);
    if (Object.keys(parche).length === 0) continue;
    parches.set(c.id, parche);
    cambios.push({
      id: c.id,
      alias: c.alias,
      ambito: c.ambito,
      concepto: r.concepto,
      via: r.via,
      realineados,
    });
  }

  // Se decide todo primero y se escribe en UNA transacción: si algo revienta a
  // medias no queda media tabla con la clasificación nueva y media con la vieja.
  if (parches.size > 0) {
    const ahora = new Date().toISOString();
    const tx = db.transaction('compromisosRecurrentes', 'readwrite');
    const store = tx.objectStore('compromisosRecurrentes');
    for (const c of compromisos) {
      const parche = c.id != null ? parches.get(c.id) : undefined;
      if (!parche) continue;
      await store.put({ ...c, ...parche, updatedAt: ahora });
    }
    await tx.done;
  }

  return { revisados: compromisos.length, cambios, sinResolver };
}

// ─── Arrastre de la 0108 ────────────────────────────────────────────────────

export interface ResultadoFix0108 {
  revisados: number;
  corregidos: number;
}

/**
 * Reescribe la casilla `0108` de las líneas fiscales ya guardadas.
 *
 * `servicio_inmueble` la declaraba como casilla de gasto, y la 0108 del Modelo
 * 100 es el «exceso a deducir en los 4 años siguientes», el arrastre de la
 * 0107. Como no pertenece al juego `AEATBox`, `mapBoxToFiscalType` devolvía
 * `undefined` y esos gastos llegaban a la declaración sin tipo fiscal. El
 * catálogo ya está arreglado (paso 2), pero eso no toca lo que está escrito.
 *
 * Va a la 0112, «servicios personales», que es a donde `CATEGORIA_A_CASILLA`
 * mandaba estos mismos gastos cuando llegaban por el otro camino.
 */
export async function fixCasilla0108(): Promise<ResultadoFix0108> {
  const db = await initDB();
  const gastos = (await db.getAll('gastosInmueble')) ?? [];
  const malos = gastos.filter((g: { casillaAEAT?: string }) => g.casillaAEAT === '0108');

  if (malos.length > 0) {
    const ahora = new Date().toISOString();
    const tx = db.transaction('gastosInmueble', 'readwrite');
    const store = tx.objectStore('gastosInmueble');
    for (const g of malos) {
      await store.put({ ...g, casillaAEAT: '0112', updatedAt: ahora });
    }
    await tx.done;
  }

  return { revisados: gastos.length, corregidos: malos.length };
}

// ─── Arranque ───────────────────────────────────────────────────────────────

/** `localStorage` puede no existir o estar bloqueado (iframes, modo privado). */
function leerFlag(clave: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribirFlag(clave: string, valor: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(clave, valor);
  } catch {
    // Sin flag volverá a correr · es idempotente, así que no pasa nada. Lo que
    // no puede es tumbar el arranque por no poder anotarlo.
  }
}

export async function runMigrationIfNeeded(): Promise<void> {
  if (leerFlag(MIGRATION_KEY)) return;
  try {
    const r = await migrarConceptoUnificado();
    const casillas = await fixCasilla0108();
    if (r.cambios.length > 0 || r.sinResolver.length > 0 || casillas.corregidos > 0) {
      // eslint-disable-next-line no-console
      console.info(
        `[Migración] conceptoUnificado: ${r.cambios.length} de ${r.revisados} gasto(s) migrado(s)` +
          (r.sinResolver.length > 0 ? ` · ${r.sinResolver.length} sin resolver` : '') +
          (casillas.corregidos > 0 ? ` · ${casillas.corregidos} línea(s) 0108 → 0112` : ''),
        { cambios: r.cambios, sinResolver: r.sinResolver },
      );
    }
    escribirFlag(MIGRATION_KEY, 'done');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[Migración] conceptoUnificado falló:', e);
  }
}
