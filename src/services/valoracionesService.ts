// src/services/valoracionesService.ts
// ATLAS HORIZON: Monthly valuation service

import { initDB } from './db';
import type { ValoracionHistorica, ValoracionesMensuales, ValoracionInput, ActivoParaActualizar } from '../types/valoraciones';

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
        ultima_valoracion: ultima?.valor,
        fecha_ultima_valoracion: ultima?.fecha_valoracion,
      });
    }
    return result;
  },

  /** Obtener inversiones activas con su última valoración */
  async getInversionesParaActualizar(): Promise<ActivoParaActualizar[]> {
    const db = await initDB();
    const inversiones = await db.getAll('inversiones');
    const activas = inversiones.filter((i: any) => i.activo);
    const result: ActivoParaActualizar[] = [];

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
    return result;
  },

  // ── Valoraciones históricas ───────────────────────────────────────────────

  /** Obtener última valoración de un activo específico */
  async getUltimaValoracion(
    tipo: 'inmueble' | 'inversion',
    id: number
  ): Promise<ValoracionHistorica | undefined> {
    const db = await initDB();
    const all: ValoracionHistorica[] = await db.getAll('valoraciones_historicas');
    const filtered = all
      .filter((v) => v.tipo_activo === tipo && v.activo_id === id)
      .sort((a, b) => b.fecha_valoracion.localeCompare(a.fecha_valoracion));
    return filtered[0];
  },

  /** Obtener evolución temporal de un activo */
  async getEvolucionActivo(
    tipo: 'inmueble' | 'inversion',
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
   * Guardar valoraciones de un mes completo.
   * 1. Guarda cada valoración en valoraciones_historicas
   * 2. Actualiza valor_actual en inversiones
   * 3. Calcula totales y variación
   * 4. Guarda snapshot en valoraciones_mensuales
   */
  async guardarValoracionesMensual(
    fecha: string, // YYYY-MM
    valoraciones: ValoracionInput[]
  ): Promise<void> {
    const db = await initDB();
    const now = new Date().toISOString();
    const [anioStr, mesStr] = fecha.split('-');
    const anio = parseInt(anioStr, 10);
    const mes = parseInt(mesStr, 10);
    const fechaCierre = `${fecha}-01`;

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

      // Acumular totales
      if (v.tipo_activo === 'inmueble') {
        inmueblesTotal += v.valor;
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

    // Calcular variación respecto al mes anterior
    const anteriorFecha = this.mesAnterior(fecha);
    const anterior = await this.getSnapshotMensual(anteriorFecha);
    const variacionEuros = anterior
      ? patrimonioTotal - anterior.patrimonio_total
      : 0;
    const variacionPorcentaje =
      anterior && anterior.patrimonio_total > 0
        ? (variacionEuros / anterior.patrimonio_total) * 100
        : 0;

    // Guardar / actualizar snapshot mensual
    const snapshots: ValoracionesMensuales[] = await db.getAll('valoraciones_mensuales');
    const prevSnapshot = snapshots.find((s) => s.fecha_cierre === fechaCierre);

    const snapshot: ValoracionesMensuales = {
      anio,
      mes,
      fecha_cierre: fechaCierre,
      patrimonio_total: patrimonioTotal,
      inmuebles_total: inmueblesTotal,
      inversiones_total: inversionesTotal,
      variacion_euros: variacionEuros,
      variacion_porcentaje: variacionPorcentaje,
      total_valoraciones: valoraciones.length,
      created_at: prevSnapshot?.created_at ?? now,
    };

    if (prevSnapshot?.id !== undefined) {
      await db.put('valoraciones_mensuales', { ...snapshot, id: prevSnapshot.id });
    } else {
      await db.add('valoraciones_mensuales', snapshot);
    }
  },

  // ── Snapshots ─────────────────────────────────────────────────────────────

  /** Obtener snapshot de un mes específico (YYYY-MM) */
  async getSnapshotMensual(fecha: string): Promise<ValoracionesMensuales | undefined> {
    const db = await initDB();
    const fechaCierre = `${fecha}-01`;
    const all: ValoracionesMensuales[] = await db.getAll('valoraciones_mensuales');
    return all.find((s) => s.fecha_cierre === fechaCierre);
  },

  /** Obtener todos los snapshots ordenados cronológicamente */
  async getHistoricoCompleto(): Promise<ValoracionesMensuales[]> {
    const db = await initDB();
    const all: ValoracionesMensuales[] = await db.getAll('valoraciones_mensuales');
    return all.sort((a, b) => a.fecha_cierre.localeCompare(b.fecha_cierre));
  },

  // ── Importación ───────────────────────────────────────────────────────────

  /**
   * Importar valoraciones desde Excel (datos ya parseados).
   * Los datos se agrupan por mes y se guardan con origen='importacion'.
   */
  async importarHistorico(
    datos: Array<{
      fecha: string; // YYYY-MM
      tipo_activo: 'inmueble' | 'inversion';
      activo_nombre: string;
      valor: number;
    }>
  ): Promise<number> {
    const db = await initDB();
    const now = new Date().toISOString();

    // Cargar activos para mapear nombres a IDs
    const [properties, inversiones] = await Promise.all([
      db.getAll('properties'),
      db.getAll('inversiones'),
    ]);

    let importados = 0;

    for (const dato of datos) {
      // Buscar ID del activo por nombre (case-insensitive)
      let activoId: number | undefined;
      if (dato.tipo_activo === 'inmueble') {
        const prop = (properties as any[]).find(
          (p) =>
            (p.alias || p.address)?.toLowerCase() === dato.activo_nombre.toLowerCase()
        );
        activoId = prop?.id;
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
      importados++;
    }

    // Recalcular snapshots mensuales agrupando por fecha
    const mesesSet = new Set<string>();
    datos.forEach((d) => mesesSet.add(d.fecha));
    const meses: string[] = [];
    mesesSet.forEach((m) => meses.push(m));
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
          } else {
            const inv = (inversiones as any[]).find(
              (i) => i.nombre?.toLowerCase() === d.activo_nombre.toLowerCase()
            );
            activoId = inv?.id;
          }
          if (activoId === undefined) return null;
          return {
            tipo_activo: d.tipo_activo as 'inmueble' | 'inversion',
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
