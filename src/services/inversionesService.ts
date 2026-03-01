// src/services/inversionesService.ts
// ATLAS HORIZON: Investment positions service

import { initDB } from './db';
import { PosicionInversion, Aportacion } from '../types/inversiones';
import { calcularGananciaPerdidaFIFO } from './inversionesFiscalService';

export const inversionesService = {
  // Obtener todas las posiciones activas
  async getPosiciones(): Promise<PosicionInversion[]> {
    const db = await initDB();
    const posiciones = await db.getAll('inversiones');
    return posiciones.filter(p => p.activo);
  },

  // Obtener una posición por ID
  async getPosicion(id: number): Promise<PosicionInversion | undefined> {
    const db = await initDB();
    return db.get('inversiones', id);
  },

  // Crear nueva posición
  async createPosicion(posicion: Omit<PosicionInversion, 'id' | 'created_at' | 'updated_at'> & { importe_inicial?: number }): Promise<number> {
    const db = await initDB();
    const now = new Date().toISOString();
    const totalAportado = posicion.total_aportado ?? posicion.importe_inicial ?? posicion.valor_actual;
    const aportacionInicial: Aportacion = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      fecha: posicion.fecha_valoracion,
      importe: totalAportado,
      tipo: 'aportacion',
      notas: 'Aportación inicial',
    };
    const aportaciones = posicion.aportaciones?.length ? posicion.aportaciones : [aportacionInicial];
    const posicionAny = posicion as any;
    const newPosicion: any = {
      nombre: posicion.nombre,
      tipo: posicion.tipo,
      entidad: posicion.entidad,
      isin: posicion.isin,
      ticker: posicion.ticker,
      valor_actual: posicion.valor_actual,
      fecha_valoracion: posicion.fecha_valoracion,
      aportaciones,
      total_aportado: totalAportado,
      rentabilidad_euros: posicion.valor_actual - totalAportado,
      rentabilidad_porcentaje: totalAportado > 0
        ? ((posicion.valor_actual - totalAportado) / totalAportado) * 100
        : 0,
      notas: posicion.notas,
      activo: true,
      created_at: now,
      updated_at: now,
      // Extended fields
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
      const updated = {
        ...posicion,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      // Recalcular rentabilidad
      updated.rentabilidad_euros = updated.valor_actual - updated.total_aportado;
      updated.rentabilidad_porcentaje = updated.total_aportado > 0 
        ? (updated.rentabilidad_euros / updated.total_aportado) * 100 
        : 0;
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

      // Recalcular total aportado
      const total_aportado = aportaciones.reduce((sum, a) => {
        if (a.tipo === 'reembolso') return sum - a.importe;
        return sum + a.importe;
      }, 0);

      const updates: Partial<PosicionInversion> = { aportaciones, total_aportado };
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

  // Eliminar posición (soft delete)
  async deletePosicion(id: number): Promise<void> {
    await this.updatePosicion(id, { activo: false });
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
    const posiciones = await this.getPosiciones();
    
    const valor_total = posiciones.reduce((sum, p) => sum + p.valor_actual, 0);
    const total_aportado = posiciones.reduce((sum, p) => sum + p.total_aportado, 0);
    const rentabilidad_euros = valor_total - total_aportado;
    const rentabilidad_porcentaje = total_aportado > 0 
      ? (rentabilidad_euros / total_aportado) * 100 
      : 0;

    const por_tipo: Record<string, number> = {};
    posiciones.forEach(p => {
      por_tipo[p.tipo] = (por_tipo[p.tipo] || 0) + p.valor_actual;
    });

    return {
      valor_total,
      total_aportado,
      rentabilidad_euros,
      rentabilidad_porcentaje,
      num_posiciones: posiciones.length,
      por_tipo,
    };
  },

  // Generar rendimientos pendientes (delegado a rendimientosService)
  async generarRendimientos(): Promise<void> {
    const { rendimientosService } = await import('./rendimientosService');
    await rendimientosService.generarRendimientosPendientes();
  },
};
