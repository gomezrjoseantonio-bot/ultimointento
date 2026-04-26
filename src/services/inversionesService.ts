// src/services/inversionesService.ts
// ATLAS HORIZON: Investment positions service

import { initDB } from './db';
import { PosicionInversion, Aportacion } from '../types/inversiones';
import { calcularGananciaPerdidaFIFO } from './inversionesFiscalService';


function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function calculateTotalAportado(aportaciones: Aportacion[] = []): number {
  return aportaciones.reduce((sum, aportacion) => {
    const importe = Number(aportacion.importe || 0);
    if (!Number.isFinite(importe)) return sum;
    return aportacion.tipo === 'reembolso' ? sum - importe : sum + importe;
  }, 0);
}

function normalizePosicion(posicion: PosicionInversion): PosicionInversion {
  const aportaciones = Array.isArray(posicion.aportaciones) ? posicion.aportaciones : [];
  const totalFromAportaciones = calculateTotalAportado(aportaciones);
  const total_aportado = isFiniteNumber(posicion.total_aportado) ? posicion.total_aportado : totalFromAportaciones;
  const valor_actual = isFiniteNumber(posicion.valor_actual) ? posicion.valor_actual : 0;
  const rentabilidad_euros = valor_actual - total_aportado;
  const rentabilidad_porcentaje = total_aportado > 0
    ? (rentabilidad_euros / total_aportado) * 100
    : 0;

  return {
    ...posicion,
    aportaciones,
    valor_actual,
    total_aportado,
    rentabilidad_euros,
    rentabilidad_porcentaje,
  };
}

export const inversionesService = {
  recalculatePosition(aportaciones: Aportacion[]): Partial<PosicionInversion> {
    const total_aportado = calculateTotalAportado(aportaciones);
    return {
      aportaciones,
      total_aportado,
    };
  },
  // Obtener todas las posiciones activas
  async getPosiciones(): Promise<PosicionInversion[]> {
    const db = await initDB();
    const posiciones = await db.getAll('inversiones');
    return posiciones
      .filter((p) => p.activo && !new Set(['plan_pensiones', 'plan-pensiones', 'plan_empleo']).has((p as any).tipo))
      .map((p) => normalizePosicion(p as PosicionInversion));
  },

  // Obtener todas las posiciones (activas + cerradas)
  async getAllPosiciones(): Promise<{
    activas: PosicionInversion[];
    cerradas: PosicionInversion[];
  }> {
    const db = await initDB();
    const todas = await db.getAll('inversiones');
    // plan_pensiones migrado a planesPensiones en V65 (TAREA 13)
    const TIPOS_PLAN_PENSIONES_ALL = new Set(['plan_pensiones', 'plan-pensiones', 'plan_empleo']);
    const todasFiltradas = todas.filter((p: any) => !TIPOS_PLAN_PENSIONES_ALL.has(p.tipo));
    return {
      activas: todasFiltradas.filter((p: any) => p.activo !== false).map((p: any) => normalizePosicion(p as PosicionInversion)),
      cerradas: todasFiltradas.filter((p: any) => p.activo === false).map((p: any) => normalizePosicion(p as PosicionInversion)),
    };
  },

  // Obtener una posición por ID
  async getPosicion(id: number): Promise<PosicionInversion | undefined> {
    const db = await initDB();
    const posicion = await db.get('inversiones', id);
    return posicion ? normalizePosicion(posicion as PosicionInversion) : undefined;
  },

  // Crear nueva posición
  async createPosicion(posicion: Omit<PosicionInversion, 'id' | 'created_at' | 'updated_at'> & { importe_inicial?: number }): Promise<number> {
    const db = await initDB();
    const now = new Date().toISOString();
    const valorActual = Number(posicion.valor_actual || 0);
    const totalAportado = Number(posicion.total_aportado ?? posicion.importe_inicial ?? valorActual);
    const aportacionInicial: Aportacion = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      fecha: posicion.fecha_compra || posicion.fecha_valoracion,
      importe: totalAportado,
      tipo: 'aportacion',
      notas: 'Aportación inicial',
      ...(posicion.cuenta_cargo_id !== undefined && { cuenta_cargo_id: posicion.cuenta_cargo_id }),
    };
    const aportaciones = posicion.aportaciones?.length ? posicion.aportaciones : [aportacionInicial];
    const posicionAny = posicion as any;
    const newPosicion: any = {
      nombre: posicion.nombre,
      tipo: posicion.tipo,
      entidad: posicion.entidad,
      isin: posicion.isin,
      ticker: posicion.ticker,
      valor_actual: valorActual,
      fecha_valoracion: posicion.fecha_valoracion,
      aportaciones,
      total_aportado: totalAportado,
      rentabilidad_euros: valorActual - totalAportado,
      rentabilidad_porcentaje: totalAportado > 0
        ? ((valorActual - totalAportado) / totalAportado) * 100
        : 0,
      notas: posicion.notas,
      activo: true,
      created_at: now,
      updated_at: now,
      // Extended fields
      ...(posicion.fecha_compra !== undefined && { fecha_compra: posicion.fecha_compra }),
      ...(posicion.cuenta_cargo_id !== undefined && { cuenta_cargo_id: posicion.cuenta_cargo_id }),
      ...(posicionAny.plan_aportaciones !== undefined && { plan_aportaciones: posicionAny.plan_aportaciones }),
      ...(posicionAny.plan_liquidacion !== undefined && { plan_liquidacion: posicionAny.plan_liquidacion }),
      ...(posicionAny.rendimiento !== undefined && { rendimiento: posicionAny.rendimiento }),
      ...(posicionAny.numero_participaciones !== undefined && { numero_participaciones: posicionAny.numero_participaciones }),
      ...(posicionAny.precio_medio_compra !== undefined && { precio_medio_compra: posicionAny.precio_medio_compra }),
      ...(posicionAny.dividendos !== undefined && { dividendos: posicionAny.dividendos }),
    };
    const id = await db.add('inversiones', newPosicion as PosicionInversion);
    return id as number;
  },

  // Actualizar posición
  async updatePosicion(id: number, updates: Partial<PosicionInversion>): Promise<void> {
    const db = await initDB();
    const posicion = await db.get('inversiones', id);
    if (posicion) {
      const merged = {
        ...posicion,
        ...updates,
        updated_at: new Date().toISOString(),
      } as PosicionInversion;
      const updated = normalizePosicion(merged);
      await db.put('inversiones', updated);
    }
  },

  // Añadir aportación
  async addAportacion(posicionId: number, aportacion: Omit<Aportacion, 'id'>): Promise<void> {
    const db = await initDB();
    const posicion = await db.get('inversiones', posicionId);
    if (posicion) {
      const newAportacionBase: Aportacion = {
        ...aportacion,
        id: Date.now() + Math.floor(Math.random() * 1000),
      };

      const newAportacion = newAportacionBase.tipo === 'reembolso'
        ? (() => {
            const { costeAdquisicion, gananciaOPerdida } = calcularGananciaPerdidaFIFO(posicion, newAportacionBase);
            return {
              ...newAportacionBase,
              coste_adquisicion_fifo: costeAdquisicion,
              ganancia_perdida: gananciaOPerdida,
            };
          })()
        : newAportacionBase;

      const aportaciones = [...posicion.aportaciones, newAportacion];
      const updates: Partial<PosicionInversion> = this.recalculatePosition(aportaciones);
      if (newAportacion.tipo === 'reembolso' && (newAportacion.unidades_vendidas ?? 0) > 0) {
        const numeroParticipaciones = (posicion as any).numero_participaciones as number | undefined;
        if (typeof numeroParticipaciones === 'number') {
          const restante = numeroParticipaciones - (newAportacion.unidades_vendidas ?? 0);
          if (restante <= 0) {
            updates.valor_actual = 0;
          }
        }
      }

      await this.updatePosicion(posicionId, updates);
    }
  },

  async updateAportacion(posicionId: number, aportacionId: number, aportacion: Omit<Aportacion, 'id'>): Promise<void> {
    const db = await initDB();
    const posicion = await db.get('inversiones', posicionId);
    if (!posicion) return;

    const aportacionesBase = (posicion.aportaciones || []).filter((a: Aportacion) => a.id !== aportacionId);
    const editedBase: Aportacion = { ...aportacion, id: aportacionId };
    const edited = editedBase.tipo === 'reembolso'
      ? (() => {
          const posicionPreview = { ...posicion, aportaciones: aportacionesBase } as PosicionInversion;
          const { costeAdquisicion, gananciaOPerdida } = calcularGananciaPerdidaFIFO(posicionPreview, editedBase);
          return {
            ...editedBase,
            coste_adquisicion_fifo: costeAdquisicion,
            ganancia_perdida: gananciaOPerdida,
          };
        })()
      : editedBase;

    const aportaciones = [...aportacionesBase, edited].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    );

    await this.updatePosicion(posicionId, this.recalculatePosition(aportaciones));
  },

  async deleteAportacion(posicionId: number, aportacionId: number): Promise<void> {
    const db = await initDB();
    const posicion = await db.get('inversiones', posicionId);
    if (!posicion) return;

    const aportaciones = (posicion.aportaciones || []).filter((a: Aportacion) => a.id !== aportacionId);
    await this.updatePosicion(posicionId, this.recalculatePosition(aportaciones));
  },

  // Eliminar posición (soft delete)
  async deletePosicion(id: number): Promise<void> {
    await this.updatePosicion(id, { activo: false });
  },

  // Eliminar posición permanentemente (hard delete con cascade)
  async purgarPosicion(id: number): Promise<void> {
    const db = await initDB();

    // Collect IDs to cascade: position id + all aportacion ids
    const pos = await db.get('inversiones', id);
    const aportacionIds: number[] = (pos?.aportaciones ?? [])
      .map((a: any) => a.id)
      .filter((aid: unknown): aid is number => typeof aid === 'number');
    const allSourceIds = new Set([id, ...aportacionIds]);

    // Delete related treasury events (inversion_* sourceTypes)
    const inversionSourceTypes = new Set([
      'inversion_compra', 'inversion_aportacion', 'inversion_rendimiento',
      'inversion_dividendo', 'inversion_liquidacion',
    ]);
    const allEvents: any[] = await db.getAll('treasuryEvents');
    for (const ev of allEvents) {
      if (inversionSourceTypes.has(ev.sourceType) && ev.sourceId != null && allSourceIds.has(ev.sourceId)) {
        await db.delete('treasuryEvents', ev.id);
      }
    }

    // Delete related historical valuations
    const allValoraciones: any[] = await db.getAll('valoraciones_historicas');
    for (const v of allValoraciones) {
      if (v.tipo_activo === 'inversion' && v.activo_id === id) {
        await db.delete('valoraciones_historicas', v.id);
      }
    }

    // Delete the position itself
    await db.delete('inversiones', id);
  },

  // Obtener resumen de cartera
  async getResumenCartera(): Promise<{
    valor_total: number;
    total_aportado: number;
    rentabilidad_euros: number;
    rentabilidad_porcentaje: number;
    num_posiciones: number;
    por_tipo: Record<string, number>;
  }> {
    const db = await initDB();
    const posiciones = await this.getPosiciones();

    // Sumar planes de pensión al total
    const planes = await db.getAll('planesPensionInversion');
    const valorPlanes = planes.reduce((s: number, p: any) => {
      const v = p.unidades ? p.unidades * (p.valorActual ?? 0) : (p.valorActual ?? 0);
      return s + v;
    }, 0);
    const aportadoPlanes = planes.reduce((s: number, p: any) => {
      const historial = p.historialAportaciones ?? {};
      return s + Object.values(historial).reduce((ss: number, row: any) =>
        ss + (row.total ?? (row.titular ?? 0) + (row.empresa ?? 0)), 0);
    }, 0);

    const valor_total = posiciones.reduce((sum, p) => sum + p.valor_actual, 0) + valorPlanes;
    const total_aportado = posiciones.reduce((sum, p) => sum + p.total_aportado, 0) + aportadoPlanes;
    const rentabilidad_euros = valor_total - total_aportado;
    const rentabilidad_porcentaje = total_aportado > 0
      ? (rentabilidad_euros / total_aportado) * 100
      : 0;

    const por_tipo: Record<string, number> = {};
    posiciones.forEach(p => {
      por_tipo[p.tipo] = (por_tipo[p.tipo] || 0) + p.valor_actual;
    });
    if (valorPlanes > 0) {
      por_tipo['plan_pensiones'] = (por_tipo['plan_pensiones'] || 0) + valorPlanes;
    }

    return {
      valor_total,
      total_aportado,
      rentabilidad_euros,
      rentabilidad_porcentaje,
      num_posiciones: posiciones.length + planes.length,
      por_tipo,
    };
  },

  // Generar rendimientos pendientes (delegado a rendimientosService)
  async generarRendimientos(): Promise<void> {
    const { rendimientosService } = await import('./rendimientosService');
    await rendimientosService.generarRendimientosPendientes();
  },
};
