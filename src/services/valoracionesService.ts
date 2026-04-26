// src/services/valoracionesService.ts
// ATLAS HORIZON: Monthly valuation service

import { initDB } from './db';
import type { ValoracionHistorica, ValoracionesMensuales, ValoracionInput, ActivoParaActualizar } from '../types/valoraciones';

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

export const valoracionesService = {
  // ── Activos ──────────────────────────────────────────────────────────────

  /** Obtener inmuebles activos con su última valoración */
  async getInmueblesParaActualizar(): Promise<ActivoParaActualizar[]> {
    const db = await initDB();
    const properties = await db.getAll('properties');
    const activos = properties.filter((p: any) => p.state === 'activo');
    const result: ActivoParaActualizar[] = [];

    for (const prop of activos) {
      const ultima = await this.getUltimaValoracion('inmueble', prop.id as number);
      result.push({
        id: prop.id as number,
        nombre: prop.alias || prop.address,
        tipo: 'inmueble',
        ultima_valoracion: ultima?.valor ?? resolveCurrentPropertyValue(prop),
        fecha_ultima_valoracion: ultima?.fecha_valoracion,
      });
    }
    return result;
  },

  /** Obtener inversiones activas + planes de pensiones con su última valoración */
  async getInversionesParaActualizar(): Promise<ActivoParaActualizar[]> {
    const db = await initDB();
    const result: ActivoParaActualizar[] = [];

    // Inversiones regulares
    const inversiones = await db.getAll('inversiones');
    const activas = inversiones.filter((i: any) => i.activo);
    for (const inv of activas) {
      const ultima = await this.getUltimaValoracion('inversion', inv.id as number);
      result.push({
        id: inv.id as number,
        nombre: inv.nombre,
        tipo: 'inversion',
        ultima_valoracion: ultima?.valor ?? inv.valor_actual,
        fecha_ultima_valoracion: ultima?.fecha_valoracion,
      });
    }

    // Planes de pensiones (solo tipo 'plan-pensiones', no inversiones ni acciones)
    const planes: any[] = await db.getAll('planesPensionInversion');
    for (const plan of planes) {
      if (plan.esHistorico || plan.tipo !== 'plan-pensiones') continue;
      const ultima = await this.getUltimaValoracion('plan_pensiones', plan.id as number);
      result.push({
        id: plan.id as number,
        nombre: plan.nombre + (plan.entidad ? ` (${plan.entidad})` : ''),
        tipo: 'plan_pensiones',
        ultima_valoracion: ultima?.valor ?? plan.valorActual,
        fecha_ultima_valoracion: ultima?.fecha_valoracion,
      });
    }

    // Planes de pensiones en el nuevo store V65 (TAREA 13)
    try {
      const planesNuevos: any[] = await (db as any).getAll('planesPensiones');
      for (const plan of planesNuevos) {
        if (plan.estado === 'rescatado_total') continue;
        const ultima = await this.getUltimaValoracion('plan_pensiones', plan.id as any);
        result.push({
          id: plan.id as any,
          nombre: plan.nombre + (plan.gestoraActual ? ` (${plan.gestoraActual})` : ''),
          tipo: 'plan_pensiones',
          ultima_valoracion: ultima?.valor ?? plan.valorActual ?? 0,
          fecha_ultima_valoracion: ultima?.fecha_valoracion,
        });
      }
    } catch { /* store puede no existir en DBs muy antiguas */ }

    return result;
  },

  // ── Valoraciones históricas ───────────────────────────────────────────────

  /** Obtener última valoración de un activo específico */
  async getUltimaValoracion(
    tipo: 'inmueble' | 'inversion' | 'plan_pensiones',
    id: number
  ): Promise<ValoracionHistorica | undefined> {
    const db = await initDB();
    const all: ValoracionHistorica[] = await db.getAll('valoraciones_historicas');
    const filtered = all
      .filter((v) => v.tipo_activo === tipo && v.activo_id === id)
      .sort((a, b) => b.fecha_valoracion.localeCompare(a.fecha_valoracion));
    return filtered[0];
  },

  /** Obtener última valoración hasta un mes objetivo (inclusive, YYYY-MM) */
  async getUltimaValoracionHastaMes(
    tipo: 'inmueble' | 'inversion' | 'plan_pensiones',
    id: number,
    fechaMes: string
  ): Promise<ValoracionHistorica | undefined> {
    const db = await initDB();
    const all: ValoracionHistorica[] = await db.getAll('valoraciones_historicas');
    const filtered = all
      .filter((v) => v.tipo_activo === tipo && v.activo_id === id && String(v.fecha_valoracion).slice(0, 7) <= fechaMes)
      .sort((a, b) => String(b.fecha_valoracion).localeCompare(String(a.fecha_valoracion)));
    return filtered[0];
  },

  async getEvolucionActivo(
    tipo: 'inmueble' | 'inversion' | 'plan_pensiones',
    id: number
  ): Promise<ValoracionHistorica[]> {
    const db = await initDB();
    const all: ValoracionHistorica[] = await db.getAll('valoraciones_historicas');
    return all
      .filter((v) => v.tipo_activo === tipo && v.activo_id === id)
      .sort((a, b) => a.fecha_valoracion.localeCompare(b.fecha_valoracion));
  },

  // ── Guardar valoraciones ──────────────────────────────────────────────────

  /**
   * Guardar la valoración de un único activo para un mes dado.
   * Solo escribe en valoraciones_historicas — no recalcula snapshots mensuales.
   * Usar para actualizaciones puntuales desde formularios.
   */
  async guardarValoracionActivo(
    fecha: string, // YYYY-MM
    valoracion: ValoracionInput
  ): Promise<void> {
    const db = await initDB();
    const now = new Date().toISOString();

    // Use composite index to avoid full-table scan
    const tx = db.transaction('valoraciones_historicas', 'readwrite');
    const existing = await tx.store
      .index('tipo-activo-fecha')
      .getAll([valoracion.tipo_activo, valoracion.activo_id, fecha]);
    const prev = existing[0] as ValoracionHistorica | undefined;

    const record: ValoracionHistorica = {
      tipo_activo: valoracion.tipo_activo,
      activo_id: valoracion.activo_id,
      activo_nombre: valoracion.activo_nombre,
      fecha_valoracion: fecha,
      valor: valoracion.valor,
      origen: 'manual',
      notas: valoracion.notas,
      created_at: prev?.created_at ?? now,
      updated_at: now,
    };

    if (prev?.id !== undefined) {
      await tx.store.put({ ...record, id: prev.id });
    } else {
      await tx.store.add(record);
    }
    await tx.done;
  },

  /**
   * Guardar valoraciones de un mes completo.
   * 1. Guarda cada valoración en valoraciones_historicas
   * 2. Actualiza valor_actual en inversiones / valorActual en planesPensionInversion
   * 3. Calcula totales y variación
   * 4. Guarda snapshot en valoraciones_mensuales
   */
  async guardarValoracionesMensual(
    fecha: string, // YYYY-MM
    valoraciones: ValoracionInput[]
  ): Promise<void> {
    const db = await initDB();
    const now = new Date().toISOString();

    let inmueblesTotal = 0;
    let inversionesTotal = 0;

    // Guardar cada valoración individual
    for (const v of valoraciones) {
      const existing: ValoracionHistorica[] = await db.getAll('valoraciones_historicas');
      const prev = existing.find(
        (e) =>
          e.tipo_activo === v.tipo_activo &&
          e.activo_id === v.activo_id &&
          e.fecha_valoracion === fecha
      );

      const record: ValoracionHistorica = {
        tipo_activo: v.tipo_activo,
        activo_id: v.activo_id,
        activo_nombre: v.activo_nombre,
        fecha_valoracion: fecha,
        valor: v.valor,
        origen: 'manual',
        notas: v.notas,
        created_at: prev?.created_at ?? now,
        updated_at: now,
      };

      if (prev?.id !== undefined) {
        await db.put('valoraciones_historicas', { ...record, id: prev.id });
      } else {
        await db.add('valoraciones_historicas', record);
      }

      // Acumular totales y actualizar store del activo
      if (v.tipo_activo === 'inmueble') {
        inmueblesTotal += v.valor;
      } else if (v.tipo_activo === 'plan_pensiones') {
        inversionesTotal += v.valor;
        const plan = await db.get('planesPensionInversion', v.activo_id);
        if (plan) {
          await db.put('planesPensionInversion', {
            ...plan,
            valorActual: v.valor,
            fechaActualizacion: now,
          });
        }
      } else {
        inversionesTotal += v.valor;
        // Actualizar valor_actual en inversiones
        const inv = await db.get('inversiones', v.activo_id);
        if (inv) {
          await db.put('inversiones', {
            ...inv,
            valor_actual: v.valor,
            updated_at: now,
          });
        }
      }
    }

    const patrimonioTotal = inmueblesTotal + inversionesTotal;

    // Calcular variación respecto al mes anterior (informativo, no persistido)
    const anteriorFecha = this.mesAnterior(fecha);
    const anterior = await this.getSnapshotMensual(anteriorFecha);
    void anterior;
    void patrimonioTotal;

    // V62: valoraciones_mensuales store removed (derivable from valoraciones_historicas)
    // Snapshot saving now a no-op
  },

  // ── Snapshots ─────────────────────────────────────────────────────────────

  /** Obtener snapshot de un mes específico (YYYY-MM) */
  async getSnapshotMensual(_fecha: string): Promise<ValoracionesMensuales | undefined> {
    // V62: store removed
    return undefined;
  },

  /** Obtener todos los snapshots ordenados cronológicamente */
  async getHistoricoCompleto(): Promise<ValoracionesMensuales[]> {
    // V62: store removed · could derive from valoraciones_historicas
    return [];
  },

  // ── Importación ───────────────────────────────────────────────────────────

  /**
   * Importar valoraciones desde Excel (datos ya parseados).
   * Los datos se agrupan por mes y se guardan con origen='importacion'.
   * Soporta tipo_activo: 'inmueble', 'inversion', 'plan_pensiones'.
   */
  async importarHistorico(
    datos: Array<{
      fecha: string; // YYYY-MM
      tipo_activo: 'inmueble' | 'inversion' | 'plan_pensiones';
      activo_nombre: string;
      valor: number;
    }>
  ): Promise<number> {
    const db = await initDB();
    const now = new Date().toISOString();

    // Cargar activos para mapear nombres a IDs
    const [properties, inversiones, planes] = await Promise.all([
      db.getAll('properties'),
      db.getAll('inversiones'),
      db.getAll('planesPensionInversion'),
    ]);

    // Plans can live in planesPensionInversion OR in inversiones (with tipo plan_pensiones/plan-pensiones).
    // Search both stores so users whose data predates the dedicated store are not blocked.
    const PLAN_TIPOS_INV = new Set(['plan_pensiones', 'plan-pensiones']);
    const inversionesPlan = (inversiones as any[]).filter((i: any) => PLAN_TIPOS_INV.has(i.tipo));

    const matchPlanByNombre = (nombre: string): { id: number; store: 'planesPensionInversion' | 'inversiones' } | undefined => {
      const lower = nombre.toLowerCase();
      // 1. Search planesPensionInversion (new dedicated store)
      const p = (planes as any[]).find((p: any) => {
        if (!p.nombre) return false;
        const n = (p.nombre as string).toLowerCase();
        if (lower === n) return true;
        if (p.entidad) return lower === `${n} (${(p.entidad as string).toLowerCase()})`;
        return false;
      });
      if (p) return { id: p.id, store: 'planesPensionInversion' };
      // 2. Fallback: search inversiones with plan tipo (legacy data) — mirror entidad logic
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
    // Use composite key store|id to avoid ID collisions across stores (both are auto-increment)
    const latestFechaPorPlan = new Map<string, { fecha: string; valor: number; id: number; store: 'planesPensionInversion' | 'inversiones' }>();

    for (const dato of datos) {
      // Buscar ID del activo por nombre (case-insensitive)
      let activoId: number | undefined;
      if (dato.tipo_activo === 'inmueble') {
        const prop = (properties as any[]).find(
          (p) =>
            (p.alias || p.address)?.toLowerCase() === dato.activo_nombre.toLowerCase()
        );
        activoId = prop?.id;
      } else if (dato.tipo_activo === 'plan_pensiones') {
        activoId = matchPlanByNombre(dato.activo_nombre)?.id;
      } else {
        const inv = (inversiones as any[]).find(
          (i) => i.nombre?.toLowerCase() === dato.activo_nombre.toLowerCase()
        );
        activoId = inv?.id;
      }

      if (activoId === undefined) continue;

      const existing: ValoracionHistorica[] = await db.getAll('valoraciones_historicas');
      const prev = existing.find(
        (e) =>
          e.tipo_activo === dato.tipo_activo &&
          e.activo_id === activoId &&
          e.fecha_valoracion === dato.fecha
      );

      const record: ValoracionHistorica = {
        tipo_activo: dato.tipo_activo,
        activo_id: activoId,
        activo_nombre: dato.activo_nombre,
        fecha_valoracion: dato.fecha,
        valor: dato.valor,
        origen: 'importacion',
        created_at: prev?.created_at ?? now,
        updated_at: now,
      };

      if (prev?.id !== undefined) {
        await db.put('valoraciones_historicas', { ...record, id: prev.id });
      } else {
        await db.add('valoraciones_historicas', record);
      }

      // Acumular la fecha+valor más reciente por plan (sin DB round-trip por fila)
      if (dato.tipo_activo === 'plan_pensiones' && activoId !== undefined) {
        const planMatch = matchPlanByNombre(dato.activo_nombre);
        const store = planMatch?.store ?? 'planesPensionInversion';
        const compositeKey = `${store}|${activoId}`;
        const current = latestFechaPorPlan.get(compositeKey);
        if (!current || dato.fecha > current.fecha) {
          latestFechaPorPlan.set(compositeKey, { fecha: dato.fecha, valor: dato.valor, id: activoId, store });
        }
      }

      importados++;
    }

    // Recalcular snapshots mensuales agrupando por fecha.
    // IMPORTANTE: procesamos los meses en orden cronológico porque
    // `guardarValoracionesMensual` reescribe `valorActual` del plan con el valor del mes
    // procesado; si lo hiciéramos en otro orden, valorActual podría quedar desactualizado.
    const mesesSet = new Set<string>();
    datos.forEach((d) => mesesSet.add(d.fecha));
    const meses = [...mesesSet].sort();

    for (const mes of meses) {
      const datosMes = datos.filter((d) => d.fecha === mes);
      const inputs = datosMes
        .map((d) => {
          let activoId: number | undefined;
          if (d.tipo_activo === 'inmueble') {
            const prop = (properties as any[]).find(
              (p) =>
                (p.alias || p.address)?.toLowerCase() === d.activo_nombre.toLowerCase()
            );
            activoId = prop?.id;
          } else if (d.tipo_activo === 'plan_pensiones') {
            activoId = matchPlanByNombre(d.activo_nombre)?.id;
          } else {
            const inv = (inversiones as any[]).find(
              (i) => i.nombre?.toLowerCase() === d.activo_nombre.toLowerCase()
            );
            activoId = inv?.id;
          }
          if (activoId === undefined) return null;
          return {
            tipo_activo: d.tipo_activo as 'inmueble' | 'inversion' | 'plan_pensiones',
            activo_id: activoId,
            activo_nombre: d.activo_nombre,
            valor: d.valor,
          };
        })
        .filter((x): x is ValoracionInput => x !== null);

      if (inputs.length > 0) {
        await this.guardarValoracionesMensual(mes, inputs);
      }
    }

    // Actualizar `valorActual` de cada plan con la valoración más reciente importada.
    // Se hace al final para que este valor tenga prioridad sobre los escritos intermedios
    // de `guardarValoracionesMensual` y para cubrir planes legacy almacenados en `inversiones`
    // (store que `guardarValoracionesMensual` no toca para tipo_activo=plan_pensiones).
    const nowFinal = new Date().toISOString();
    for (const [, { valor, id, store }] of latestFechaPorPlan) {
      const plan = await db.get(store, id);
      if (plan) {
        await db.put(store, {
          ...plan,
          valorActual: valor,
          fechaActualizacion: nowFinal,
        });
      }
    }

    return importados;
  },

  // ── Helpers ───────────────────────────────────────────────────────────────

  mesAnterior(fecha: string): string {
    const [anio, mes] = fecha.split('-').map(Number);
    const d = new Date(anio, mes - 2, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  },
};
