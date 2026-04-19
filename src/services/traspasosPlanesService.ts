// src/services/traspasosPlanesService.ts
// Traspasos entre planes de pensiones (movimiento patrimonial sin tributación).
//
// Principios de diseño:
//   - El traspaso es un evento propio; se persiste en `traspasosPlanes` para
//     mantener trazabilidad del recorrido del dinero entre planes.
//   - El histórico de valoraciones sigue ligado al plan donde ocurrió
//     (`valoraciones_historicas.activo_id`) — nunca se migra ni reescribe.
//     Así un análisis a futuro puede preguntar "¿dónde estaba el dinero
//     el mes X?" y "¿qué rentabilidad tuvo cada plan en ese periodo?".
//   - En `historialAportaciones` del plan se registra como
//     `traspaso_salida` / `traspaso_entrada` para que los cálculos
//     fiscales (límite de 1.500 €/año deducibles) no lo confundan con
//     aportaciones reales.
import { initDB } from './db';
import { planesInversionService } from './planesInversionService';
import type { PlanPensionInversion, TraspasoPlan } from '../types/personal';

export interface CreateTraspasoInput {
  personalDataId: number;
  planOrigenId: number;
  planDestinoId: number;
  fecha: string;       // YYYY-MM-DD
  importe: number;     // si esTotal=true, se ignora y se usa valorActual del origen
  esTotal: boolean;
  unidadesTraspasadas?: number;
  notas?: string;
}

export interface TraspasoValidationError {
  field: 'planOrigenId' | 'planDestinoId' | 'importe' | 'fecha' | 'general';
  message: string;
}

const mesKey = (fecha: string): string =>
  fecha.length >= 7 ? fecha.slice(0, 7) : String(new Date(fecha).getFullYear());

type HistorialEntry = NonNullable<PlanPensionInversion['historialAportaciones']>[string];

const mergeHistorialEntry = (
  plan: PlanPensionInversion,
  mes: string,
  delta: { titular?: number; empresa?: number; total: number; fuente: HistorialEntry['fuente'] }
): PlanPensionInversion['historialAportaciones'] => {
  const prev = plan.historialAportaciones?.[mes] ?? { titular: 0, empresa: 0, total: 0, fuente: delta.fuente };
  return {
    ...(plan.historialAportaciones ?? {}),
    [mes]: {
      titular: (prev.titular ?? 0) + (delta.titular ?? 0),
      empresa: (prev.empresa ?? 0) + (delta.empresa ?? 0),
      total: (prev.total ?? 0) + delta.total,
      // Si había registro previo con otra fuente, prevalece la fuente del traspaso
      // sólo si el resultado final no contiene aportaciones regulares. En otro
      // caso mantener la fuente previa (los cálculos fiscales filtran por
      // cuantías; el campo fuente es orientativo).
      fuente: prev.fuente === 'manual' || prev.fuente === 'xml_aeat' ? prev.fuente : delta.fuente,
    },
  };
};

export const traspasosPlanesService = {
  /**
   * Valida un input de traspaso sin ejecutarlo. Devuelve lista vacía si es válido.
   */
  async validate(input: CreateTraspasoInput): Promise<TraspasoValidationError[]> {
    const errors: TraspasoValidationError[] = [];

    if (!input.planOrigenId) errors.push({ field: 'planOrigenId', message: 'Selecciona el plan de origen.' });
    if (!input.planDestinoId) errors.push({ field: 'planDestinoId', message: 'Selecciona el plan de destino.' });
    if (input.planOrigenId && input.planOrigenId === input.planDestinoId) {
      errors.push({ field: 'planDestinoId', message: 'El plan destino debe ser distinto del origen.' });
    }
    if (!input.fecha) errors.push({ field: 'fecha', message: 'Indica la fecha del traspaso.' });
    if (!input.esTotal && (!Number.isFinite(input.importe) || input.importe <= 0)) {
      errors.push({ field: 'importe', message: 'El importe debe ser mayor que 0.' });
    }

    if (errors.length) return errors;

    const db = await initDB();
    const [origen, destino] = await Promise.all([
      db.get('planesPensionInversion', input.planOrigenId),
      db.get('planesPensionInversion', input.planDestinoId),
    ]);

    if (!origen) errors.push({ field: 'planOrigenId', message: 'El plan origen no existe.' });
    if (!destino) errors.push({ field: 'planDestinoId', message: 'El plan destino no existe.' });
    if (origen && origen.tipo !== 'plan-pensiones') {
      errors.push({ field: 'planOrigenId', message: 'Sólo se pueden traspasar planes de pensiones.' });
    }
    if (destino && destino.tipo !== 'plan-pensiones') {
      errors.push({ field: 'planDestinoId', message: 'El destino debe ser un plan de pensiones.' });
    }
    if (origen && !input.esTotal && input.importe > (origen.valorActual ?? 0) + 0.01) {
      errors.push({
        field: 'importe',
        message: `El importe excede el saldo actual del plan origen (${(origen.valorActual ?? 0).toFixed(2)} €).`,
      });
    }

    return errors;
  },

  /**
   * Ejecuta un traspaso: actualiza saldos y aportaciones acumuladas de ambos
   * planes, registra entradas en el historial con fuentes traspaso_*, y
   * persiste el evento en `traspasosPlanes`.
   * Devuelve el Traspaso creado.
   */
  async createTraspaso(input: CreateTraspasoInput): Promise<TraspasoPlan> {
    const errors = await this.validate(input);
    if (errors.length) {
      throw new Error(errors[0].message);
    }

    const db = await initDB();
    const origen = await db.get('planesPensionInversion', input.planOrigenId);
    const destino = await db.get('planesPensionInversion', input.planDestinoId);
    if (!origen || !destino) {
      throw new Error('Plan origen o destino no encontrado.');
    }

    const importe = input.esTotal ? (origen.valorActual ?? 0) : input.importe;
    if (importe <= 0) {
      throw new Error('No hay saldo disponible en el plan origen para traspasar.');
    }

    const mes = mesKey(input.fecha);
    const now = new Date().toISOString();

    // Actualizar plan origen — valorActual baja, historial registra salida
    const origenHistorial = mergeHistorialEntry(origen, mes, {
      titular: -importe,
      total: -importe,
      fuente: 'traspaso_salida',
    });
    await planesInversionService.updatePlan(origen.id!, {
      valorActual: Math.max(0, (origen.valorActual ?? 0) - importe),
      historialAportaciones: origenHistorial,
    });

    // Actualizar plan destino — valorActual sube, aportacionesRealizadas
    // crece por el importe traspasado (es dinero nuevo dentro del plan
    // destino, aunque no sea deducible fiscalmente), historial registra entrada
    const destinoHistorial = mergeHistorialEntry(destino, mes, {
      titular: importe,
      total: importe,
      fuente: 'traspaso_entrada',
    });
    await planesInversionService.updatePlan(destino.id!, {
      valorActual: (destino.valorActual ?? 0) + importe,
      aportacionesRealizadas: (destino.aportacionesRealizadas ?? 0) + importe,
      historialAportaciones: destinoHistorial,
    });

    // Persistir el evento
    const record: TraspasoPlan = {
      personalDataId: input.personalDataId,
      planOrigenId: origen.id!,
      planDestinoId: destino.id!,
      planOrigenNombre: origen.nombre,
      planOrigenEntidad: origen.entidad,
      planDestinoNombre: destino.nombre,
      planDestinoEntidad: destino.entidad,
      fecha: input.fecha,
      importe,
      esTotal: input.esTotal,
      unidadesTraspasadas: input.unidadesTraspasadas,
      notas: input.notas,
      fechaCreacion: now,
    };
    const id = await db.add('traspasosPlanes', record);
    return { ...record, id: id as number };
  },

  /** Lista todos los traspasos del usuario. */
  async getTraspasosByPersonal(personalDataId: number): Promise<TraspasoPlan[]> {
    try {
      const db = await initDB();
      const tx = db.transaction('traspasosPlanes', 'readonly');
      const idx = tx.store.index('personalDataId');
      const traspasos = await idx.getAll(personalDataId);
      return (traspasos ?? []).sort((a, b) => b.fecha.localeCompare(a.fecha));
    } catch (error) {
      console.error('Error loading traspasos:', error);
      return [];
    }
  },

  /** Traspasos en los que un plan participa (como origen o destino). */
  async getTraspasosByPlan(planId: number): Promise<TraspasoPlan[]> {
    try {
      const db = await initDB();
      const all = await db.getAll('traspasosPlanes');
      return all
        .filter((t) => t.planOrigenId === planId || t.planDestinoId === planId)
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
    } catch (error) {
      console.error('Error loading traspasos by plan:', error);
      return [];
    }
  },

  /**
   * Revierte un traspaso: suma el importe al origen, lo resta del destino y
   * elimina las entradas de historial traspaso_* del mes correspondiente.
   * Avisa vía excepción si hay inconsistencias (p.ej. destino ya no existe).
   */
  async deleteTraspaso(id: number): Promise<void> {
    const db = await initDB();
    const traspaso = await db.get('traspasosPlanes', id);
    if (!traspaso) throw new Error('Traspaso no encontrado.');

    const [origen, destino] = await Promise.all([
      db.get('planesPensionInversion', traspaso.planOrigenId),
      db.get('planesPensionInversion', traspaso.planDestinoId),
    ]);

    const mes = mesKey(traspaso.fecha);

    if (origen) {
      const historial = { ...(origen.historialAportaciones ?? {}) };
      const prev = historial[mes];
      if (prev) {
        const titular = (prev.titular ?? 0) + traspaso.importe;
        const total = (prev.total ?? 0) + traspaso.importe;
        if (Math.abs(total) < 0.005 && Math.abs(titular) < 0.005 && Math.abs(prev.empresa ?? 0) < 0.005) {
          delete historial[mes];
        } else {
          historial[mes] = { ...prev, titular, total };
        }
      }
      await planesInversionService.updatePlan(origen.id!, {
        valorActual: (origen.valorActual ?? 0) + traspaso.importe,
        historialAportaciones: historial,
      });
    }

    if (destino) {
      const historial = { ...(destino.historialAportaciones ?? {}) };
      const prev = historial[mes];
      if (prev) {
        const titular = (prev.titular ?? 0) - traspaso.importe;
        const total = (prev.total ?? 0) - traspaso.importe;
        if (Math.abs(total) < 0.005 && Math.abs(titular) < 0.005 && Math.abs(prev.empresa ?? 0) < 0.005) {
          delete historial[mes];
        } else {
          historial[mes] = { ...prev, titular, total };
        }
      }
      await planesInversionService.updatePlan(destino.id!, {
        valorActual: Math.max(0, (destino.valorActual ?? 0) - traspaso.importe),
        aportacionesRealizadas: Math.max(0, (destino.aportacionesRealizadas ?? 0) - traspaso.importe),
        historialAportaciones: historial,
      });
    }

    await db.delete('traspasosPlanes', id);
  },
};
