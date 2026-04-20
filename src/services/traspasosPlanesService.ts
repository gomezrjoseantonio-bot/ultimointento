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
//   - Soporta planes en ambos stores: `planesPensionInversion` (store
//     dedicado) e `inversiones` (store legacy con `tipo=plan_pensiones`).
import { initDB } from './db';
import { planesInversionService } from './planesInversionService';
import type { PlanPensionInversion, PlanStore, TraspasoPlan } from '../types/personal';
import type { Aportacion, PosicionInversion } from '../types/inversiones';

export interface PlanRef {
  id: number;
  store: PlanStore;
}

export interface CreateTraspasoInput {
  personalDataId: number;
  planOrigen: PlanRef;
  planDestino: PlanRef;
  fecha: string;       // YYYY-MM-DD
  importe: number;     // si esTotal=true, se ignora y se usa el saldo actual del origen
  esTotal: boolean;
  unidadesTraspasadas?: number;
  notas?: string;
}

export interface TraspasoValidationError {
  field: 'planOrigen' | 'planDestino' | 'importe' | 'fecha' | 'general';
  message: string;
}

const mesKey = (fecha: string): string =>
  fecha.length >= 7 ? fecha.slice(0, 7) : String(new Date(fecha).getFullYear());

const PLAN_TIPOS_INV = new Set(['plan_pensiones', 'plan-pensiones', 'plan_empleo']);

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
      fuente: prev.fuente === 'manual' || prev.fuente === 'xml_aeat' ? prev.fuente : delta.fuente,
    },
  };
};

// ── Metadata extraction for a plan from either store ──────────────────────

interface PlanMeta {
  id: number;
  store: PlanStore;
  nombre: string;
  entidad?: string;
  saldo: number;
  esPlanPensiones: boolean;
}

async function readPlanMeta(ref: PlanRef): Promise<PlanMeta | null> {
  const db = await initDB();
  if (ref.store === 'planesPensionInversion') {
    const plan = await db.get('planesPensionInversion', ref.id);
    if (!plan) return null;
    return {
      id: ref.id,
      store: ref.store,
      nombre: plan.nombre,
      entidad: plan.entidad,
      saldo: plan.valorActual ?? 0,
      esPlanPensiones: plan.tipo === 'plan-pensiones',
    };
  }
  const inv = await db.get('inversiones', ref.id);
  if (!inv) return null;
  return {
    id: ref.id,
    store: ref.store,
    nombre: inv.nombre,
    entidad: inv.entidad,
    saldo: inv.valor_actual ?? 0,
    esPlanPensiones: PLAN_TIPOS_INV.has(inv.tipo),
  };
}

async function applyOutgoing(
  ref: PlanRef,
  importe: number,
  fecha: string,
  meta: PlanMeta
): Promise<void> {
  const db = await initDB();
  if (ref.store === 'planesPensionInversion') {
    const plan = await db.get('planesPensionInversion', ref.id);
    if (!plan) return;
    const historial = mergeHistorialEntry(plan, mesKey(fecha), {
      titular: -importe,
      total: -importe,
      fuente: 'traspaso_salida',
    });
    await planesInversionService.updatePlan(ref.id, {
      valorActual: Math.max(0, (plan.valorActual ?? 0) - importe),
      historialAportaciones: historial,
    });
    return;
  }

  // Store `inversiones`: registramos un reembolso con fuente 'traspaso_salida'
  const inv = await db.get('inversiones', ref.id) as PosicionInversion | undefined;
  if (!inv) return;
  const nextId = (inv.aportaciones ?? []).reduce((max, a) => Math.max(max, a.id ?? 0), 0) + 1;
  const aportacionSalida: Aportacion = {
    id: nextId,
    fecha,
    importe,
    tipo: 'reembolso',
    fuente: 'traspaso_salida',
    notas: `Traspaso a otro plan de pensiones`,
  };
  const nuevasAportaciones = [...(inv.aportaciones ?? []), aportacionSalida];
  const totalAportado = Math.max(0, (inv.total_aportado ?? 0) - importe);
  const nuevoValor = Math.max(0, (inv.valor_actual ?? 0) - importe);
  const rentabilidadEuros = nuevoValor - totalAportado;
  const rentabilidadPct = totalAportado > 0 ? (rentabilidadEuros / totalAportado) * 100 : 0;
  await db.put('inversiones', {
    ...inv,
    valor_actual: nuevoValor,
    fecha_valoracion: fecha,
    aportaciones: nuevasAportaciones,
    total_aportado: totalAportado,
    rentabilidad_euros: rentabilidadEuros,
    rentabilidad_porcentaje: rentabilidadPct,
    updated_at: new Date().toISOString(),
  });
  // meta is unused here; keep signature consistent with incoming
  void meta;
}

async function applyIncoming(
  ref: PlanRef,
  importe: number,
  fecha: string,
  meta: PlanMeta
): Promise<void> {
  const db = await initDB();
  if (ref.store === 'planesPensionInversion') {
    const plan = await db.get('planesPensionInversion', ref.id);
    if (!plan) return;
    const historial = mergeHistorialEntry(plan, mesKey(fecha), {
      titular: importe,
      total: importe,
      fuente: 'traspaso_entrada',
    });
    await planesInversionService.updatePlan(ref.id, {
      valorActual: (plan.valorActual ?? 0) + importe,
      aportacionesRealizadas: (plan.aportacionesRealizadas ?? 0) + importe,
      historialAportaciones: historial,
    });
    return;
  }

  const inv = await db.get('inversiones', ref.id) as PosicionInversion | undefined;
  if (!inv) return;
  const nextId = (inv.aportaciones ?? []).reduce((max, a) => Math.max(max, a.id ?? 0), 0) + 1;
  const aportacionEntrada: Aportacion = {
    id: nextId,
    fecha,
    importe,
    tipo: 'aportacion',
    fuente: 'traspaso_entrada',
    notas: `Traspaso procedente de otro plan de pensiones`,
  };
  const nuevasAportaciones = [...(inv.aportaciones ?? []), aportacionEntrada];
  const totalAportado = (inv.total_aportado ?? 0) + importe;
  const nuevoValor = (inv.valor_actual ?? 0) + importe;
  const rentabilidadEuros = nuevoValor - totalAportado;
  const rentabilidadPct = totalAportado > 0 ? (rentabilidadEuros / totalAportado) * 100 : 0;
  await db.put('inversiones', {
    ...inv,
    valor_actual: nuevoValor,
    fecha_valoracion: fecha,
    aportaciones: nuevasAportaciones,
    total_aportado: totalAportado,
    rentabilidad_euros: rentabilidadEuros,
    rentabilidad_porcentaje: rentabilidadPct,
    updated_at: new Date().toISOString(),
  });
  void meta;
}

async function revertOutgoing(ref: PlanRef, importe: number, fecha: string): Promise<void> {
  const db = await initDB();
  if (ref.store === 'planesPensionInversion') {
    const plan = await db.get('planesPensionInversion', ref.id);
    if (!plan) return;
    const historial = { ...(plan.historialAportaciones ?? {}) };
    const mes = mesKey(fecha);
    const prev = historial[mes];
    if (prev) {
      const titular = (prev.titular ?? 0) + importe;
      const total = (prev.total ?? 0) + importe;
      if (Math.abs(total) < 0.005 && Math.abs(titular) < 0.005 && Math.abs(prev.empresa ?? 0) < 0.005) {
        delete historial[mes];
      } else {
        historial[mes] = { ...prev, titular, total };
      }
    }
    await planesInversionService.updatePlan(ref.id, {
      valorActual: (plan.valorActual ?? 0) + importe,
      historialAportaciones: historial,
    });
    return;
  }
  const inv = await db.get('inversiones', ref.id) as PosicionInversion | undefined;
  if (!inv) return;
  const aportaciones = (inv.aportaciones ?? []).filter(
    (a) => !(a.fuente === 'traspaso_salida' && a.fecha === fecha && Math.abs(a.importe - importe) < 0.005)
  );
  const totalAportado = (inv.total_aportado ?? 0) + importe;
  const nuevoValor = (inv.valor_actual ?? 0) + importe;
  const rentabilidadEuros = nuevoValor - totalAportado;
  const rentabilidadPct = totalAportado > 0 ? (rentabilidadEuros / totalAportado) * 100 : 0;
  await db.put('inversiones', {
    ...inv,
    valor_actual: nuevoValor,
    aportaciones,
    total_aportado: totalAportado,
    rentabilidad_euros: rentabilidadEuros,
    rentabilidad_porcentaje: rentabilidadPct,
    updated_at: new Date().toISOString(),
  });
}

async function revertIncoming(ref: PlanRef, importe: number, fecha: string): Promise<void> {
  const db = await initDB();
  if (ref.store === 'planesPensionInversion') {
    const plan = await db.get('planesPensionInversion', ref.id);
    if (!plan) return;
    const historial = { ...(plan.historialAportaciones ?? {}) };
    const mes = mesKey(fecha);
    const prev = historial[mes];
    if (prev) {
      const titular = (prev.titular ?? 0) - importe;
      const total = (prev.total ?? 0) - importe;
      if (Math.abs(total) < 0.005 && Math.abs(titular) < 0.005 && Math.abs(prev.empresa ?? 0) < 0.005) {
        delete historial[mes];
      } else {
        historial[mes] = { ...prev, titular, total };
      }
    }
    await planesInversionService.updatePlan(ref.id, {
      valorActual: Math.max(0, (plan.valorActual ?? 0) - importe),
      aportacionesRealizadas: Math.max(0, (plan.aportacionesRealizadas ?? 0) - importe),
      historialAportaciones: historial,
    });
    return;
  }
  const inv = await db.get('inversiones', ref.id) as PosicionInversion | undefined;
  if (!inv) return;
  const aportaciones = (inv.aportaciones ?? []).filter(
    (a) => !(a.fuente === 'traspaso_entrada' && a.fecha === fecha && Math.abs(a.importe - importe) < 0.005)
  );
  const totalAportado = Math.max(0, (inv.total_aportado ?? 0) - importe);
  const nuevoValor = Math.max(0, (inv.valor_actual ?? 0) - importe);
  const rentabilidadEuros = nuevoValor - totalAportado;
  const rentabilidadPct = totalAportado > 0 ? (rentabilidadEuros / totalAportado) * 100 : 0;
  await db.put('inversiones', {
    ...inv,
    valor_actual: nuevoValor,
    aportaciones,
    total_aportado: totalAportado,
    rentabilidad_euros: rentabilidadEuros,
    rentabilidad_porcentaje: rentabilidadPct,
    updated_at: new Date().toISOString(),
  });
}

export const traspasosPlanesService = {
  /** Valida un input de traspaso sin ejecutarlo. */
  async validate(input: CreateTraspasoInput): Promise<TraspasoValidationError[]> {
    const errors: TraspasoValidationError[] = [];

    if (!input.planOrigen?.id) errors.push({ field: 'planOrigen', message: 'Selecciona el plan de origen.' });
    if (!input.planDestino?.id) errors.push({ field: 'planDestino', message: 'Selecciona el plan de destino.' });
    if (
      input.planOrigen?.id === input.planDestino?.id &&
      input.planOrigen?.store === input.planDestino?.store
    ) {
      errors.push({ field: 'planDestino', message: 'El plan destino debe ser distinto del origen.' });
    }
    if (!input.fecha) errors.push({ field: 'fecha', message: 'Indica la fecha del traspaso.' });
    if (!input.esTotal && (!Number.isFinite(input.importe) || input.importe <= 0)) {
      errors.push({ field: 'importe', message: 'El importe debe ser mayor que 0.' });
    }

    if (errors.length) return errors;

    const [origen, destino] = await Promise.all([
      readPlanMeta(input.planOrigen),
      readPlanMeta(input.planDestino),
    ]);

    if (!origen) errors.push({ field: 'planOrigen', message: 'El plan origen no existe.' });
    if (!destino) errors.push({ field: 'planDestino', message: 'El plan destino no existe.' });
    if (origen && !origen.esPlanPensiones) {
      errors.push({ field: 'planOrigen', message: 'Sólo se pueden traspasar planes de pensiones.' });
    }
    if (destino && !destino.esPlanPensiones) {
      errors.push({ field: 'planDestino', message: 'El destino debe ser un plan de pensiones.' });
    }
    if (origen && !input.esTotal && input.importe > origen.saldo + 0.01) {
      errors.push({
        field: 'importe',
        message: `El importe excede el saldo actual del plan origen (${origen.saldo.toFixed(2)} €).`,
      });
    }

    return errors;
  },

  /**
   * Ejecuta un traspaso: actualiza saldos y aportaciones de ambos planes y
   * persiste el evento en `traspasosPlanes`.
   */
  async createTraspaso(input: CreateTraspasoInput): Promise<TraspasoPlan> {
    const errors = await this.validate(input);
    if (errors.length) {
      throw new Error(errors[0].message);
    }

    const [origen, destino] = await Promise.all([
      readPlanMeta(input.planOrigen),
      readPlanMeta(input.planDestino),
    ]);
    if (!origen || !destino) throw new Error('Plan origen o destino no encontrado.');

    const importe = input.esTotal ? origen.saldo : input.importe;
    if (importe <= 0) {
      throw new Error('No hay saldo disponible en el plan origen para traspasar.');
    }

    await applyOutgoing(input.planOrigen, importe, input.fecha, origen);
    await applyIncoming(input.planDestino, importe, input.fecha, destino);

    const now = new Date().toISOString();
    const record: TraspasoPlan = {
      personalDataId: input.personalDataId,
      planOrigenId: origen.id,
      planDestinoId: destino.id,
      planOrigenStore: origen.store,
      planDestinoStore: destino.store,
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
    const db = await initDB();
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

  /** Traspasos en los que un plan participa (por id+store). */
  async getTraspasosByPlan(ref: PlanRef): Promise<TraspasoPlan[]> {
    try {
      const db = await initDB();
      const all = await db.getAll('traspasosPlanes');
      return all
        .filter((t) => {
          const origenMatch = t.planOrigenId === ref.id && (t.planOrigenStore ?? 'planesPensionInversion') === ref.store;
          const destinoMatch = t.planDestinoId === ref.id && (t.planDestinoStore ?? 'planesPensionInversion') === ref.store;
          return origenMatch || destinoMatch;
        })
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
    } catch (error) {
      console.error('Error loading traspasos by plan:', error);
      return [];
    }
  },

  /** Revierte un traspaso: restaura saldos y elimina el evento. */
  async deleteTraspaso(id: number): Promise<void> {
    const db = await initDB();
    const traspaso = await db.get('traspasosPlanes', id);
    if (!traspaso) throw new Error('Traspaso no encontrado.');

    const origenRef: PlanRef = {
      id: traspaso.planOrigenId,
      store: traspaso.planOrigenStore ?? 'planesPensionInversion',
    };
    const destinoRef: PlanRef = {
      id: traspaso.planDestinoId,
      store: traspaso.planDestinoStore ?? 'planesPensionInversion',
    };

    await revertOutgoing(origenRef, traspaso.importe, traspaso.fecha);
    await revertIncoming(destinoRef, traspaso.importe, traspaso.fecha);
    await db.delete('traspasosPlanes', id);
  },
};
