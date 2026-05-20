// src/services/valoracionesService.ts
// ATLAS HORIZON: servicio polimórfico de valoraciones.
//
// V74 (T-VALORACIONES PR2): refactor interno · todas las funciones operan
// sobre el store nuevo `valoracionesActivos` (camelCase, fecha YYYY-MM-DD,
// activoId siempre string, soft delete, subtipoInversion opcional). La
// superficie pública legacy (`ValoracionHistorica`, `ValoracionInput`,
// `tipo_activo`, `fecha_valoracion`, etc.) se mantiene intacta para no
// romper los ~20 call-sites que viven en el codebase. Adapters internos
// mapean entre los dos shapes.
//
// API nueva (exports top-level) usa el shape `ValoracionActivo` del spec.
// API legacy (export `valoracionesService` objeto) sigue exponiendo lo
// mismo de antes con misma firma. Esto permite que PR7 migre los callers
// uno a uno sin presión de cierre atómico.

import { initDB } from './db';
import type {
  ValoracionHistorica,
  ValoracionesMensuales,
  ValoracionInput,
  ActivoParaActualizar,
} from '../types/valoraciones';
import type {
  ValoracionActivo,
  ValoracionInput as ValoracionInputV2,
  TipoActivoValoracion,
  SubtipoInversion,
  OrigenValoracion,
} from '../types/valoracionActivo';
import { validateValoracionInput } from '../types/valoracionActivo';

const STORE = 'valoracionesActivos' as const;

type TipoLegacy = 'inmueble' | 'inversion' | 'plan_pensiones';

// ── Helpers internos ───────────────────────────────────────────────────────

/** YYYY-MM → YYYY-MM-01 · YYYY-MM-DD pasa intacto. */
function fechaToISODay(s: string): string {
  return /^\d{4}-\d{2}$/.test(s) ? `${s}-01` : s;
}

/** YYYY-MM-DD → YYYY-MM · YYYY-MM pasa intacto. */
function fechaToMonth(s: string): string {
  return s.length >= 7 ? s.slice(0, 7) : s;
}

function mapOrigenNewToLegacy(
  o: OrigenValoracion,
): 'manual' | 'importacion' | 'api_externa' {
  if (o === 'import_csv' || o === 'import_pdf') return 'importacion';
  if (o === 'api_gestora') return 'api_externa';
  return 'manual';
}

function mapOrigenLegacyToNew(
  o: 'manual' | 'importacion' | 'api_externa' | string | undefined,
): OrigenValoracion {
  if (o === 'importacion') return 'import_csv';
  if (o === 'api_externa') return 'api_gestora';
  return 'manual';
}

/**
 * `true` si el `tipoActivo` v74 tiene equivalente en el shape legacy
 * (`'inmueble' | 'inversion' | 'plan_pensiones'`). Los tipos nuevos
 * `'deposito'` y `'otro'` se excluyen de toda salida legacy para evitar
 * que se reetiqueten silenciosamente como otro tipo (review Copilot
 * sobre `toLegacyShape`).
 */
function isLegacyTipo(t: TipoActivoValoracion): t is TipoLegacy {
  return t === 'inmueble' || t === 'inversion' || t === 'plan_pensiones';
}

/**
 * Convierte un registro nuevo `ValoracionActivo` al shape legacy
 * `ValoracionHistorica` para los callers que aún no han migrado.
 * Solo seguro para registros con `tipoActivo` legacy · usar tras
 * filtrar con `isLegacyTipo`. `activo_nombre` queda vacío si no se
 * hidrata aparte.
 */
function toLegacyShape(v: ValoracionActivo): ValoracionHistorica {
  return {
    id: v.id,
    // `as TipoLegacy` seguro · el caller debe filtrar con `isLegacyTipo`.
    tipo_activo: v.tipoActivo as TipoLegacy,
    activo_id: v.activoId as unknown as number, // legacy lo tipa number pero acepta string en runtime
    activo_nombre: (v as any).activoNombre ?? '',
    fecha_valoracion: fechaToMonth(v.fecha),
    valor: v.valor,
    origen: mapOrigenNewToLegacy(v.origen),
    notas: v.notas,
    created_at: v.createdAt,
    updated_at: v.updatedAt,
  };
}

/**
 * Lee todas las valoraciones del store (excluye soft-deleted por defecto).
 * Una única lectura · cache local por llamada.
 */
async function readAllActive(
  db: Awaited<ReturnType<typeof initDB>>,
): Promise<ValoracionActivo[]> {
  const all = (await (db as any).getAll(STORE)) as ValoracionActivo[];
  return all.filter((v) => !v.deletedAt);
}

/**
 * Resuelve `activoNombre` para una lista de valoraciones consultando los
 * stores de activo correspondientes (properties, inversiones, planesPensiones).
 * Idempotente · si ya viene rellenado se respeta.
 */
async function hydrateActivoNombres(
  items: ValoracionHistorica[],
  db: Awaited<ReturnType<typeof initDB>>,
): Promise<void> {
  const needsLookup = items.filter((it) => !it.activo_nombre);
  if (needsLookup.length === 0) return;

  const props = (await (db as any).getAll('properties')) as any[];
  const invs = (await (db as any).getAll('inversiones')) as any[];
  const planes = (await (db as any).getAll('planesPensiones')) as any[];

  const propMap = new Map(props.map((p) => [String(p.id), p.alias || p.address || '']));
  const invMap = new Map(invs.map((i) => [String(i.id), i.nombre || '']));
  const planMap = new Map(planes.map((p) => [String(p.id), p.nombre || '']));

  for (const it of needsLookup) {
    const key = String(it.activo_id);
    if (it.tipo_activo === 'inmueble') it.activo_nombre = propMap.get(key) || '';
    else if (it.tipo_activo === 'inversion') it.activo_nombre = invMap.get(key) || '';
    else if (it.tipo_activo === 'plan_pensiones') it.activo_nombre = planMap.get(key) || '';
  }
}

/** Resuelve currentValue desde `properties` con fallbacks anidados (legacy). */
const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveCurrentPropertyValue = (property: any): number => {
  return toNumber(
    property?.valor_actual
    ?? property?.currentValue
    ?? property?.marketValue
    ?? property?.estimatedValue
    ?? property?.valuation
    ?? property?.compra?.valor_actual
    ?? property?.acquisitionCosts?.currentValue
    ?? property?.acquisitionCosts?.price
    ?? property?.compra?.precio_compra
    ?? 0
  );
};

// ── Tipos públicos legacy ──────────────────────────────────────────────────

export interface AuditResult {
  tipo: TipoLegacy;
  total_valoraciones: number;
  huerfanas: number;
  ids_huerfanos: string[];
  propiedades_sin_valoracion: string[];
}

export interface ValoracionMatch {
  valor: number;
  fecha_valoracion: string;
  activo_nombre: string;
  matchedBy: 'id' | 'nombre';
}

export interface ValoracionMatcher {
  getByIdOrNombre(id: string | number, nombre: string): ValoracionMatch | undefined;
  totalValoraciones: number;
  matchesPorId: number;
  matchesPorNombre: number;
}

// ── API nueva (top-level exports) ──────────────────────────────────────────

/** Crear una nueva valoración. */
export async function create(input: ValoracionInputV2): Promise<number> {
  validateValoracionInput(input);
  const db = await initDB();
  const now = new Date().toISOString();
  const id = (await (db as any).add(STORE, {
    ...input,
    divisaOriginal: input.divisaOriginal ?? 'EUR',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })) as number;
  return id;
}

/** Actualizar campos mutables de una valoración. `activoId` y `tipoActivo` son inmutables. */
export async function update(
  id: number,
  patch: Partial<ValoracionInputV2>,
): Promise<void> {
  const db = await initDB();
  const existing = (await (db as any).get(STORE, id)) as ValoracionActivo | undefined;
  if (!existing) throw new Error(`Valoración ${id} no existe`);
  if (existing.deletedAt) throw new Error(`Valoración ${id} está borrada (soft delete)`);

  if (patch.activoId !== undefined && patch.activoId !== existing.activoId) {
    throw new Error('activoId es inmutable');
  }
  if (patch.tipoActivo !== undefined && patch.tipoActivo !== existing.tipoActivo) {
    throw new Error('tipoActivo es inmutable');
  }

  // Separamos los campos inmutables y montamos el patch sin ellos.
  const { activoId: _a, tipoActivo: _t, ...mutable } = patch;
  void _a;
  void _t;

  // Revalidar invariantes del schema v2 sobre el objeto resultante.
  // Patch parcial puede dejar la valoración inválida (fecha mal formada,
  // subtipoInversion en tipoActivo no-inversion, valor no finito).
  const merged = { ...existing, ...mutable };
  validateValoracionInput({
    activoId: merged.activoId,
    tipoActivo: merged.tipoActivo,
    subtipoInversion: merged.subtipoInversion,
    fecha: merged.fecha,
    valor: merged.valor,
    origen: merged.origen,
  });

  await (db as any).put(STORE, {
    ...merged,
    updatedAt: new Date().toISOString(),
  });
}

/** Soft delete · marca `deletedAt`. */
export async function softDelete(id: number): Promise<void> {
  const db = await initDB();
  const existing = (await (db as any).get(STORE, id)) as ValoracionActivo | undefined;
  if (!existing) throw new Error(`Valoración ${id} no existe`);
  const now = new Date().toISOString();
  await (db as any).put(STORE, { ...existing, deletedAt: now, updatedAt: now });
}

/** Restaurar una valoración soft-deleted. */
export async function restore(id: number): Promise<void> {
  const db = await initDB();
  const existing = (await (db as any).get(STORE, id)) as ValoracionActivo | undefined;
  if (!existing) throw new Error(`Valoración ${id} no existe`);
  await (db as any).put(STORE, {
    ...existing,
    deletedAt: null,
    updatedAt: new Date().toISOString(),
  });
}

/** Devuelve la valoración por id o null si no existe / está borrada. */
export async function getById(id: number): Promise<ValoracionActivo | null> {
  const db = await initDB();
  const v = (await (db as any).get(STORE, id)) as ValoracionActivo | undefined;
  if (!v || v.deletedAt) return null;
  return v;
}

/** Serie completa de un activo, ordenada asc por fecha.
 *  Usa el índice `idx_activo_fecha` (v74) para evitar full-scan ·
 *  IndexedDB devuelve el rango ordenado por [activoId, fecha] ASC. */
export async function getSerie(
  activoId: string,
  options?: { desde?: string; hasta?: string; incluyeBorradas?: boolean },
): Promise<ValoracionActivo[]> {
  const db = await initDB();
  const desde = options?.desde ?? '0000-01-01';
  const hasta = options?.hasta ?? '9999-12-31';
  const range = IDBKeyRange.bound([activoId, desde], [activoId, hasta]);
  try {
    const fromIdx = (await (db as any).getAllFromIndex(
      STORE,
      'idx_activo_fecha',
      range,
    )) as ValoracionActivo[];
    return fromIdx
      .filter((v) => options?.incluyeBorradas || !v.deletedAt)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  } catch {
    // Fallback robusto · DB sin el índice (no debería ocurrir en v74+).
    const all = (await (db as any).getAll(STORE)) as ValoracionActivo[];
    return all
      .filter(
        (v) =>
          String(v.activoId) === activoId &&
          (options?.incluyeBorradas || !v.deletedAt) &&
          v.fecha >= desde &&
          v.fecha <= hasta,
      )
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }
}

/** Último valor del activo (la valoración no borrada más reciente). */
export async function getValorActual(activoId: string): Promise<number | null> {
  const serie = await getSerie(activoId);
  return serie.length === 0 ? null : serie[serie.length - 1].valor;
}

/** Valor del activo en (o inmediatamente antes de) una fecha YYYY-MM-DD. */
export async function getValorAFecha(
  activoId: string,
  fecha: string,
): Promise<number | null> {
  const serie = await getSerie(activoId, { hasta: fecha });
  return serie.length === 0 ? null : serie[serie.length - 1].valor;
}

/**
 * Upsert por fecha · si ya existen valoraciones activas del activo en esa
 * misma fecha, se soft-deletean TODAS con nota y se inserta la nueva.
 *
 * Defense in depth · datos legacy o bugs anteriores pueden haber dejado
 * múltiples valoraciones activas para (activoId, fecha) · este método
 * garantiza unicidad post-llamada.
 */
export async function upsertByDate(input: ValoracionInputV2): Promise<number> {
  validateValoracionInput(input);
  const db = await initDB();
  const all = (await (db as any).getAll(STORE)) as ValoracionActivo[];
  const activas = all.filter(
    (v) => String(v.activoId) === input.activoId && v.fecha === input.fecha && !v.deletedAt,
  );
  const now = new Date().toISOString();
  for (const activa of activas) {
    await (db as any).put(STORE, {
      ...activa,
      deletedAt: now,
      updatedAt: now,
      notas: (activa.notas ?? '') + ' · reemplazada por upsert',
    });
  }
  const id = (await (db as any).add(STORE, {
    ...input,
    divisaOriginal: input.divisaOriginal ?? 'EUR',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })) as number;
  return id;
}

/** Inserción bulk (importaciones). Una transacción atómica. */
export async function bulkInsert(inputs: ValoracionInputV2[]): Promise<number[]> {
  for (const input of inputs) validateValoracionInput(input);
  const db = await initDB();
  const tx = (db as any).transaction(STORE, 'readwrite');
  const store = tx.store ?? tx.objectStore(STORE);
  const now = new Date().toISOString();
  const ids: number[] = [];
  for (const input of inputs) {
    const id = (await store.add({
      ...input,
      divisaOriginal: input.divisaOriginal ?? 'EUR',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })) as number;
    ids.push(id);
  }
  await tx.done;
  return ids;
}

/** Patrimonio total a una fecha · suma la última valoración no borrada de cada activo. */
export async function getPatrimonioTotal(fecha?: string): Promise<number> {
  const db = await initDB();
  const all = (await (db as any).getAll(STORE)) as ValoracionActivo[];
  const last = new Map<string, ValoracionActivo>();
  for (const v of all) {
    if (v.deletedAt) continue;
    if (fecha && v.fecha > fecha) continue;
    const prev = last.get(String(v.activoId));
    if (!prev || prev.fecha < v.fecha) last.set(String(v.activoId), v);
  }
  let total = 0;
  for (const v of last.values()) total += v.valor;
  return total;
}

/** Patrimonio agrupado por tipo de activo a una fecha. */
export async function getPatrimonioPorTipo(
  fecha?: string,
): Promise<Record<TipoActivoValoracion, number>> {
  const db = await initDB();
  const all = (await (db as any).getAll(STORE)) as ValoracionActivo[];
  const last = new Map<string, ValoracionActivo>();
  for (const v of all) {
    if (v.deletedAt) continue;
    if (fecha && v.fecha > fecha) continue;
    const prev = last.get(String(v.activoId));
    if (!prev || prev.fecha < v.fecha) last.set(String(v.activoId), v);
  }
  const result: Record<TipoActivoValoracion, number> = {
    inmueble: 0,
    inversion: 0,
    plan_pensiones: 0,
    deposito: 0,
    otro: 0,
  };
  for (const v of last.values()) {
    result[v.tipoActivo] = (result[v.tipoActivo] ?? 0) + v.valor;
  }
  return result;
}

/** Patrimonio agrupado por subtipo de inversión (solo activos con `tipoActivo='inversion'`). */
export async function getPatrimonioPorSubtipoInversion(
  fecha?: string,
): Promise<Record<SubtipoInversion | 'sin_subtipo', number>> {
  const db = await initDB();
  const all = (await (db as any).getAll(STORE)) as ValoracionActivo[];
  const last = new Map<string, ValoracionActivo>();
  for (const v of all) {
    if (v.deletedAt) continue;
    if (v.tipoActivo !== 'inversion') continue;
    if (fecha && v.fecha > fecha) continue;
    const prev = last.get(String(v.activoId));
    if (!prev || prev.fecha < v.fecha) last.set(String(v.activoId), v);
  }
  const result: Record<SubtipoInversion | 'sin_subtipo', number> = {
    fondo: 0,
    accion: 0,
    etf: 0,
    crypto: 0,
    sin_subtipo: 0,
  };
  for (const v of last.values()) {
    const key = v.subtipoInversion ?? 'sin_subtipo';
    result[key] = (result[key] ?? 0) + v.valor;
  }
  return result;
}

/** Borrado en cascada de todas las valoraciones de un activo (hard delete, no soft). */
export async function deleteAllByActivo(activoId: string): Promise<number> {
  const db = await initDB();
  const all = (await (db as any).getAll(STORE)) as ValoracionActivo[];
  const ids = all.filter((v) => String(v.activoId) === activoId).map((v) => v.id);
  for (const id of ids) {
    await (db as any).delete(STORE, id);
  }
  return ids.length;
}

// ── API legacy (objeto `valoracionesService`) ──────────────────────────────

export const valoracionesService = {
  /** Inmuebles activos con su última valoración (shape legacy).
   *  Precomputa el mapa de últimas valoraciones en 1 sola lectura
   *  (en lugar de N llamadas a `getUltimaValoracion` que hacían
   *  `getAll` + sort + hydrate por cada inmueble · review Copilot). */
  async getInmueblesParaActualizar(): Promise<ActivoParaActualizar[]> {
    const db = await initDB();
    const [properties, ultimasMap] = await Promise.all([
      (db as any).getAll('properties') as Promise<any[]>,
      this.getMapValoracionesMasRecientes('inmueble'),
    ]);
    const activos = properties.filter((p: any) => p.state === 'activo');
    return activos.map((prop: any) => {
      const ultima = ultimasMap.get(String(prop.id));
      return {
        id: prop.id as number,
        nombre: prop.alias || prop.address,
        tipo: 'inmueble' as const,
        ultima_valoracion: ultima?.valor ?? resolveCurrentPropertyValue(prop),
        fecha_ultima_valoracion: ultima?.fecha_valoracion,
      };
    });
  },

  /** Inversiones activas + planes de pensiones con su última valoración (legacy).
   *  Precomputa los 2 mapas de últimas valoraciones (inversion +
   *  plan_pensiones) en 2 lecturas en lugar de N+M llamadas a
   *  `getUltimaValoracion` · review Copilot. */
  async getInversionesParaActualizar(): Promise<ActivoParaActualizar[]> {
    const db = await initDB();
    const result: ActivoParaActualizar[] = [];

    const [inversiones, mapInv] = await Promise.all([
      (db as any).getAll('inversiones') as Promise<any[]>,
      this.getMapValoracionesMasRecientes('inversion'),
    ]);
    const activas = inversiones.filter((i: any) => i.activo);
    for (const inv of activas) {
      const ultima = mapInv.get(String(inv.id));
      result.push({
        id: inv.id as number,
        nombre: inv.nombre,
        tipo: 'inversion',
        ultima_valoracion: ultima?.valor ?? inv.valor_actual,
        fecha_ultima_valoracion: ultima?.fecha_valoracion,
      });
    }

    try {
      const [planes, mapPlanes] = await Promise.all([
        (db as any).getAll('planesPensiones') as Promise<any[]>,
        this.getMapValoracionesMasRecientes('plan_pensiones'),
      ]);
      for (const plan of planes) {
        if (plan.estado === 'rescatado_total') continue;
        const ultima = mapPlanes.get(String(plan.id));
        result.push({
          id: plan.id as any,
          nombre: plan.nombre + (plan.gestoraActual ? ` (${plan.gestoraActual})` : ''),
          tipo: 'plan_pensiones',
          ultima_valoracion: ultima?.valor ?? plan.valorActual ?? 0,
          fecha_ultima_valoracion: ultima?.fecha_valoracion,
        });
      }
    } catch {
      /* store puede no existir en DBs muy antiguas */
    }

    return result;
  },

  /** Última valoración (legacy alias). */
  async getUltimaValoracion(
    tipo: TipoLegacy,
    id: number | string,
  ): Promise<ValoracionHistorica | undefined> {
    return this.getValoracionMasReciente(tipo, id);
  },

  /** Valoración más reciente por tipo+id (legacy). */
  async getValoracionMasReciente(
    tipo: TipoLegacy,
    id: number | string,
  ): Promise<ValoracionHistorica | undefined> {
    const db = await initDB();
    const all = await readAllActive(db);
    const idStr = String(id);
    const filtered = all
      .filter((v) => v.tipoActivo === tipo && String(v.activoId) === idStr)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (filtered.length === 0) return undefined;
    const legacy = toLegacyShape(filtered[0]);
    await hydrateActivoNombres([legacy], db);
    return legacy;
  },

  /** Todas las valoraciones del store (legacy shape · excluye borradas y tipos no-legacy). */
  async getAllValoraciones(): Promise<ValoracionHistorica[]> {
    const db = await initDB();
    const all = await readAllActive(db);
    const legacy = all.filter((v) => isLegacyTipo(v.tipoActivo)).map(toLegacyShape);
    await hydrateActivoNombres(legacy, db);
    return legacy;
  },

  /** Mapa activoId(string) → última valoración (valor + fecha_valoracion).
   *  Comparación interna por `v.fecha` (YYYY-MM-DD) para determinismo con
   *  granularidad v74 (múltiples valoraciones del mismo mes) · review
   *  Copilot. La fecha se trunca a YYYY-MM solo al exponer. */
  async getMapValoracionesMasRecientes(
    tipo: TipoLegacy,
  ): Promise<Map<string, { valor: number; fecha_valoracion: string }>> {
    const db = await initDB();
    const all = await readAllActive(db);
    type Internal = { valor: number; fecha: string };
    const internal = new Map<string, Internal>();
    for (const v of all) {
      if (v.tipoActivo !== tipo) continue;
      const key = String(v.activoId);
      const existing = internal.get(key);
      if (!existing || v.fecha > existing.fecha) {
        internal.set(key, { valor: v.valor, fecha: v.fecha });
      }
    }
    const out = new Map<string, { valor: number; fecha_valoracion: string }>();
    for (const [k, { valor, fecha }] of internal) {
      out.set(k, { valor, fecha_valoracion: fechaToMonth(fecha) });
    }
    return out;
  },

  /** Matcher robusto que cae back a matching por nombre normalizado (legacy). */
  async getMapValoracionesMasRecientesConMatchingPorNombre(
    tipo: TipoLegacy,
  ): Promise<ValoracionMatcher> {
    const db = await initDB();
    const all = await readAllActive(db);
    const filtered = all.filter((v) => v.tipoActivo === tipo);

    // Resolver activo_nombre desde los stores fuente para el matching por nombre.
    const props = (await (db as any).getAll('properties')) as any[];
    const invs = (await (db as any).getAll('inversiones')) as any[];
    const planes = (await (db as any).getAll('planesPensiones')) as any[];
    const propMap = new Map(props.map((p) => [String(p.id), p.alias || p.address || '']));
    const invMap = new Map(invs.map((i) => [String(i.id), i.nombre || '']));
    const planMap = new Map(planes.map((p) => [String(p.id), p.nombre || '']));
    const resolveNombre = (v: ValoracionActivo): string => {
      const key = String(v.activoId);
      if (v.tipoActivo === 'inmueble') return propMap.get(key) || '';
      if (v.tipoActivo === 'inversion') return invMap.get(key) || '';
      if (v.tipoActivo === 'plan_pensiones') return planMap.get(key) || '';
      return '';
    };

    type RawMatch = { valor: number; fecha_valoracion: string; activo_nombre: string };
    // Internamente comparamos por `fecha` completa (YYYY-MM-DD) para
    // determinismo · solo truncamos a YYYY-MM al exponer (review Copilot).
    type Internal = RawMatch & { fechaFull: string };
    const byIdInt = new Map<string, Internal>();
    const byNombreInt = new Map<string, Internal>();

    for (const v of filtered) {
      const nombre = resolveNombre(v);
      const candidato: Internal = {
        valor: v.valor,
        fecha_valoracion: fechaToMonth(v.fecha),
        fechaFull: v.fecha,
        activo_nombre: nombre,
      };
      const keyId = String(v.activoId);
      const existingId = byIdInt.get(keyId);
      if (!existingId || candidato.fechaFull > existingId.fechaFull) {
        byIdInt.set(keyId, candidato);
      }
      const keyNombre = nombre.toLowerCase().trim();
      if (keyNombre) {
        const existingNombre = byNombreInt.get(keyNombre);
        if (!existingNombre || candidato.fechaFull > existingNombre.fechaFull) {
          byNombreInt.set(keyNombre, candidato);
        }
      }
    }

    const byId = new Map<string, RawMatch>();
    const byNombre = new Map<string, RawMatch>();
    for (const [k, { fechaFull: _ff, ...rest }] of byIdInt) {
      void _ff;
      byId.set(k, rest);
    }
    for (const [k, { fechaFull: _ff, ...rest }] of byNombreInt) {
      void _ff;
      byNombre.set(k, rest);
    }

    return {
      getByIdOrNombre(id: string | number, nombre: string): ValoracionMatch | undefined {
        const idResult = byId.get(String(id));
        if (idResult) return { ...idResult, matchedBy: 'id' };
        const keyNombre = String(nombre || '').toLowerCase().trim();
        if (!keyNombre) return undefined;
        const nombreResult = byNombre.get(keyNombre);
        if (!nombreResult) return undefined;
        return { ...nombreResult, matchedBy: 'nombre' };
      },
      totalValoraciones: filtered.length,
      matchesPorId: byId.size,
      matchesPorNombre: byNombre.size,
    };
  },

  /** Audit · valoraciones huérfanas + activos sin valoración (legacy). */
  async auditMatching(tipo: TipoLegacy): Promise<AuditResult> {
    const db = await initDB();
    const all = await readAllActive(db);
    const filtered = all.filter((v) => v.tipoActivo === tipo);

    const activoIds = new Set<string>();
    try {
      if (tipo === 'inmueble') {
        const properties = (await (db as any).getAll('properties')) as any[];
        properties.forEach((p) => activoIds.add(String(p.id)));
      } else if (tipo === 'inversion') {
        const inversiones = (await (db as any).getAll('inversiones')) as any[];
        inversiones.forEach((i) => activoIds.add(String(i.id)));
      } else {
        const planes = (await (db as any).getAll('planesPensiones')) as any[];
        planes.forEach((p) => activoIds.add(String(p.id)));
      }
    } catch {
      /* Store puede no existir en DBs antiguas */
    }

    const huerfanasSet = new Set<string>();
    for (const v of filtered) {
      if (!activoIds.has(String(v.activoId))) {
        huerfanasSet.add(String(v.activoId));
      }
    }

    const activosConValoracion = new Set(filtered.map((v) => String(v.activoId)));
    const sinValoracion = [...activoIds].filter((id) => !activosConValoracion.has(id));

    return {
      tipo,
      total_valoraciones: filtered.length,
      huerfanas: huerfanasSet.size,
      ids_huerfanos: [...huerfanasSet],
      propiedades_sin_valoracion: sinValoracion,
    };
  },

  /** Última valoración hasta un mes objetivo inclusive (legacy). */
  async getUltimaValoracionHastaMes(
    tipo: TipoLegacy,
    id: number | string,
    fechaMes: string, // YYYY-MM
  ): Promise<ValoracionHistorica | undefined> {
    const db = await initDB();
    const all = await readAllActive(db);
    const idStr = String(id);
    const filtered = all
      .filter(
        (v) =>
          v.tipoActivo === tipo &&
          String(v.activoId) === idStr &&
          fechaToMonth(v.fecha) <= fechaMes,
      )
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (filtered.length === 0) return undefined;
    const legacy = toLegacyShape(filtered[0]);
    await hydrateActivoNombres([legacy], db);
    return legacy;
  },

  /** Evolución completa de un activo (ordenada asc por fecha · legacy). */
  async getEvolucionActivo(
    tipo: TipoLegacy,
    id: number | string,
  ): Promise<ValoracionHistorica[]> {
    const db = await initDB();
    const all = await readAllActive(db);
    const idStr = String(id);
    const filtered = all
      .filter((v) => v.tipoActivo === tipo && String(v.activoId) === idStr)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    const legacy = filtered.map(toLegacyShape);
    await hydrateActivoNombres(legacy, db);
    return legacy;
  },

  /**
   * Guardar la valoración de un activo para un mes dado (legacy).
   * Internamente hace upsert idempotente sobre la fecha YYYY-MM-01.
   * Mantiene la firma legacy: `(fecha: YYYY-MM, valoracion: ValoracionInput)`.
   */
  async guardarValoracionActivo(
    fecha: string, // YYYY-MM o YYYY-MM-DD
    valoracion: ValoracionInput,
  ): Promise<void> {
    const fechaISO = fechaToISODay(fecha);
    const activoId = String(valoracion.activo_id);
    const tipoActivo = valoracion.tipo_activo as TipoActivoValoracion;
    const db = await initDB();
    const all = (await (db as any).getAll(STORE)) as ValoracionActivo[];
    const fechaMes = fechaToMonth(fechaISO);
    const prev = all.find(
      (v) =>
        !v.deletedAt &&
        v.tipoActivo === tipoActivo &&
        String(v.activoId) === activoId &&
        fechaToMonth(v.fecha) === fechaMes,
    );
    const now = new Date().toISOString();
    const record: ValoracionActivo & { activoNombre?: string } = {
      id: prev?.id ?? 0,
      activoId,
      tipoActivo,
      fecha: fechaISO,
      valor: valoracion.valor,
      divisaOriginal: 'EUR',
      origen: 'manual',
      notas: valoracion.notas,
      activoNombre: valoracion.activo_nombre,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
    };
    if (prev?.id !== undefined) {
      await (db as any).put(STORE, { ...record, id: prev.id });
    } else {
      const { id: _omitId, ...toAdd } = record;
      void _omitId;
      await (db as any).add(STORE, toAdd);
    }
  },

  /**
   * Guardar valoraciones de un mes completo (legacy).
   * Replica el comportamiento original · actualiza también `valorActual` de
   * planesPensiones y `valor_actual` de inversiones.
   */
  async guardarValoracionesMensual(
    fecha: string, // YYYY-MM
    valoraciones: ValoracionInput[],
  ): Promise<void> {
    const db = await initDB();
    const now = new Date().toISOString();
    for (const v of valoraciones) {
      await this.guardarValoracionActivo(fecha, v);
      if (v.tipo_activo === 'plan_pensiones') {
        const plan = await (db as any).get('planesPensiones', String(v.activo_id));
        if (plan) {
          await (db as any).put('planesPensiones', {
            ...plan,
            valorActual: v.valor,
            fechaActualizacion: now,
          });
        }
      } else if (v.tipo_activo === 'inversion') {
        const inv = await (db as any).get('inversiones', v.activo_id);
        if (inv) {
          await (db as any).put('inversiones', {
            ...inv,
            valor_actual: v.valor,
            updated_at: now,
          });
        }
      }
    }
  },

  // ── Snapshots ────────────────────────────────────────────────────────────
  /** V62: store `valoraciones_mensuales` retirado · derivable. */
  async getSnapshotMensual(_fecha: string): Promise<ValoracionesMensuales | undefined> {
    return undefined;
  },
  async getHistoricoCompleto(): Promise<ValoracionesMensuales[]> {
    return [];
  },

  // ── Importación ──────────────────────────────────────────────────────────

  /**
   * Importar valoraciones desde array parseado (legacy).
   * Mantiene firma + comportamiento del importador original.
   */
  async importarHistorico(
    datos: Array<{
      fecha: string; // YYYY-MM
      tipo_activo: TipoLegacy;
      activo_nombre: string;
      valor: number;
    }>,
  ): Promise<number> {
    const db = await initDB();
    const now = new Date().toISOString();

    const [properties, inversiones, planes] = await Promise.all([
      (db as any).getAll('properties') as Promise<any[]>,
      (db as any).getAll('inversiones') as Promise<any[]>,
      (db as any).getAll('planesPensiones') as Promise<any[]>,
    ]);

    const PLAN_TIPOS_INV = new Set(['plan_pensiones', 'plan-pensiones']);
    const inversionesPlan = inversiones.filter((i: any) => PLAN_TIPOS_INV.has(i.tipo));

    const matchPlanByNombre = (
      nombre: string,
    ): { id: string | number; store: 'planesPensiones' | 'inversiones' } | undefined => {
      const lower = nombre.toLowerCase();
      const p = planes.find((p: any) => {
        if (!p.nombre) return false;
        const n = (p.nombre as string).toLowerCase();
        if (lower === n) return true;
        if (p.gestoraActual) return lower === `${n} (${(p.gestoraActual as string).toLowerCase()})`;
        return false;
      });
      if (p) return { id: p.id, store: 'planesPensiones' };
      const inv = inversionesPlan.find((i: any) => {
        if (!i.nombre) return false;
        const n = (i.nombre as string).toLowerCase();
        if (lower === n) return true;
        if (i.entidad) return lower === `${n} (${(i.entidad as string).toLowerCase()})`;
        return false;
      });
      if (inv) return { id: inv.id, store: 'inversiones' };
      return undefined;
    };

    let importados = 0;
    const latestFechaPorPlan = new Map<
      string,
      { fecha: string; valor: number; id: string | number; store: 'planesPensiones' | 'inversiones' }
    >();

    for (const dato of datos) {
      let activoId: number | string | undefined;
      if (dato.tipo_activo === 'inmueble') {
        const prop = properties.find(
          (p: any) =>
            (p.alias || p.address)?.toLowerCase() === dato.activo_nombre.toLowerCase(),
        );
        activoId = prop?.id;
      } else if (dato.tipo_activo === 'plan_pensiones') {
        activoId = matchPlanByNombre(dato.activo_nombre)?.id;
      } else {
        const inv = inversiones.find(
          (i: any) => i.nombre?.toLowerCase() === dato.activo_nombre.toLowerCase(),
        );
        activoId = inv?.id;
      }

      if (activoId === undefined) continue;

      const fechaISO = fechaToISODay(dato.fecha);
      const all = (await (db as any).getAll(STORE)) as ValoracionActivo[];
      const fechaMes = fechaToMonth(fechaISO);
      const prev = all.find(
        (v) =>
          !v.deletedAt &&
          v.tipoActivo === dato.tipo_activo &&
          String(v.activoId) === String(activoId) &&
          fechaToMonth(v.fecha) === fechaMes,
      );

      const record: ValoracionActivo & { activoNombre?: string } = {
        id: prev?.id ?? 0,
        activoId: String(activoId),
        tipoActivo: dato.tipo_activo,
        fecha: fechaISO,
        valor: dato.valor,
        divisaOriginal: 'EUR',
        origen: 'import_csv',
        activoNombre: dato.activo_nombre,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
      };
      if (prev?.id !== undefined) {
        await (db as any).put(STORE, { ...record, id: prev.id });
      } else {
        const { id: _omitId, ...toAdd } = record;
        void _omitId;
        await (db as any).add(STORE, toAdd);
      }

      if (dato.tipo_activo === 'plan_pensiones' && activoId !== undefined) {
        const planMatch = matchPlanByNombre(dato.activo_nombre);
        const store = planMatch?.store ?? 'planesPensiones';
        const compositeKey = `${store}|${activoId}`;
        const current = latestFechaPorPlan.get(compositeKey);
        if (!current || dato.fecha > current.fecha) {
          latestFechaPorPlan.set(compositeKey, {
            fecha: dato.fecha,
            valor: dato.valor,
            id: activoId,
            store,
          });
        }
      }
      importados++;
    }

    // Replicar side-effects de guardarValoracionesMensual sobre planes/inversiones
    // (sin re-escribir las valoraciones · ya están en el store).
    const mesesSet = new Set<string>();
    datos.forEach((d) => mesesSet.add(d.fecha));
    const meses = [...mesesSet].sort();
    for (const mes of meses) {
      const datosMes = datos.filter((d) => d.fecha === mes);
      for (const d of datosMes) {
        let activoId: number | string | undefined;
        if (d.tipo_activo === 'inmueble') {
          const prop = properties.find(
            (p: any) =>
              (p.alias || p.address)?.toLowerCase() === d.activo_nombre.toLowerCase(),
          );
          activoId = prop?.id;
        } else if (d.tipo_activo === 'plan_pensiones') {
          activoId = matchPlanByNombre(d.activo_nombre)?.id;
        } else {
          const inv = inversiones.find(
            (i: any) => i.nombre?.toLowerCase() === d.activo_nombre.toLowerCase(),
          );
          activoId = inv?.id;
        }
        if (activoId === undefined) continue;
        if (d.tipo_activo === 'plan_pensiones') {
          const plan = await (db as any).get('planesPensiones', String(activoId));
          if (plan) {
            await (db as any).put('planesPensiones', {
              ...plan,
              valorActual: d.valor,
              fechaActualizacion: now,
            });
          }
        } else if (d.tipo_activo === 'inversion') {
          const inv = await (db as any).get('inversiones', activoId);
          if (inv) {
            await (db as any).put('inversiones', { ...inv, valor_actual: d.valor, updated_at: now });
          }
        }
      }
    }

    // Actualizar `valorActual` de cada plan con la valoración más reciente importada.
    const nowFinal = new Date().toISOString();
    for (const [, { valor, id, store }] of latestFechaPorPlan) {
      const plan = await (db as any).get(store, store === 'planesPensiones' ? String(id) : id);
      if (plan) {
        await (db as any).put(store, {
          ...plan,
          valorActual: valor,
          fechaActualizacion: nowFinal,
        });
      }
    }

    return importados;
  },

  // ── Helpers ──────────────────────────────────────────────────────────────

  mesAnterior(fecha: string): string {
    const [anio, mes] = fecha.split('-').map(Number);
    const d = new Date(anio, mes - 2, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  },

  // ── D-CRUD-ALTA sub-tarea 6 · CRUD individual (legacy) ──────────────────

  async listarValoraciones(filtro?: {
    tipo_activo?: TipoLegacy;
    activo_id?: number | string;
  }): Promise<ValoracionHistorica[]> {
    const db = await initDB();
    const all = await readAllActive(db);
    const filtered = all.filter((v) => {
      // Excluir tipos no-legacy ('deposito'|'otro') del output legacy.
      if (!isLegacyTipo(v.tipoActivo)) return false;
      if (filtro?.tipo_activo && v.tipoActivo !== filtro.tipo_activo) return false;
      if (filtro?.activo_id !== undefined && String(v.activoId) !== String(filtro.activo_id)) {
        return false;
      }
      return true;
    });
    const legacy = filtered.map(toLegacyShape);
    await hydrateActivoNombres(legacy, db);
    return legacy;
  },

  async actualizarValoracion(
    id: number,
    updates: Partial<Pick<ValoracionHistorica, 'valor' | 'fecha_valoracion' | 'notas' | 'origen'>>,
  ): Promise<ValoracionHistorica> {
    const db = await initDB();
    const existing = (await (db as any).get(STORE, id)) as ValoracionActivo | undefined;
    if (!existing) throw new Error('Valoración no encontrada');

    const patch: Partial<ValoracionInputV2> = {};
    if (updates.valor !== undefined) patch.valor = updates.valor;
    if (updates.fecha_valoracion !== undefined) {
      patch.fecha = fechaToISODay(updates.fecha_valoracion);
    }
    if (updates.notas !== undefined) patch.notas = updates.notas;
    if (updates.origen !== undefined) patch.origen = mapOrigenLegacyToNew(updates.origen);

    await update(id, patch);

    const updated = (await (db as any).get(STORE, id)) as ValoracionActivo;
    const legacy = toLegacyShape(updated);
    await hydrateActivoNombres([legacy], db);
    return legacy;
  },

  async eliminarValoracion(id: number): Promise<void> {
    const db = await initDB();
    await (db as any).delete(STORE, id);
  },
};
