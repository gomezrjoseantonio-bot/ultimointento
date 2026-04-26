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
//   - Soporta planes en ambos stores: `planesPensiones` (V65)
//     e `inversiones` (store legacy con `tipo=plan_pensiones`).
import { initDB } from './db';
import { inversionesService } from './inversionesService';
import { planesInversionService } from './planesInversionService';
import type { PlanStore, TraspasoPlan } from '../types/personal';
import type { Aportacion, PosicionInversion } from '../types/inversiones';

export interface PlanRef {
  id: number | string;
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

/** Tipos del store `inversiones` reconocidos como plan de pensiones. Incluye la
 *  forma canonical (`plan_pensiones`), la variante de plan empleo y la legacy
 *  con guión (`plan-pensiones`) usada en algunos importadores / datos antiguos. */
export const PLAN_PENSIONES_TIPOS_INVERSION: ReadonlySet<string> = new Set([
  'plan_pensiones',
  'plan-pensiones',
  'plan_empleo',
]);

const mesKey = (fecha: string): string =>
  fecha.length >= 7 ? fecha.slice(0, 7) : String(new Date(fecha).getFullYear());

const generateAportacionId = (): number => Date.now() + Math.floor(Math.random() * 1000);

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
  if (ref.store === 'planesPensiones') {
    const plan = await (db as any).get('planesPensiones', String(ref.id));
    if (!plan) return null;
    return {
      id: ref.id,
      store: ref.store,
      nombre: plan.nombre,
      entidad: plan.gestoraActual,
      saldo: plan.valorActual ?? 0,
      esPlanPensiones: true,
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
    esPlanPensiones: PLAN_PENSIONES_TIPOS_INVERSION.has(inv.tipo),
  };
}

async function updateInversionConAportacion(
  ref: PlanRef,
  nuevaAportacion: Aportacion,
  nuevoValor: number,
  fecha: string
): Promise<void> {
  const db = await initDB();
  const inv = await db.get('inversiones', ref.id) as PosicionInversion | undefined;
  if (!inv) throw new Error(`Posición ${ref.id} no encontrada en el store inversiones.`);
  const aportaciones = [...(inv.aportaciones ?? []), nuevaAportacion];
  // Delegamos la recomposición de `total_aportado` y normalización en
  // inversionesService para mantener los invariantes del store.
  await inversionesService.updatePosicion(ref.id, {
    ...inversionesService.recalculatePosition(aportaciones),
    valor_actual: nuevoValor,
    fecha_valoracion: fecha,
  });
}

async function applyOutgoing(ref: PlanRef, importe: number, fecha: string): Promise<void> {
  const db = await initDB();
  if (ref.store === 'planesPensiones') {
    const plan = await (db as any).get('planesPensiones', String(ref.id));
    if (!plan) throw new Error(`Plan ${ref.id} no encontrado en planesPensiones.`);
    await planesInversionService.updatePlan(String(ref.id), {
      valorActual: Math.max(0, (plan.valorActual ?? 0) - importe),
    });
    return;
  }

  // Store `inversiones`: registramos un reembolso con fuente 'traspaso_salida'
  const inv = await db.get('inversiones', ref.id) as PosicionInversion | undefined;
  if (!inv) throw new Error(`Posición ${ref.id} no encontrada en el store inversiones.`);
  const aportacionSalida: Aportacion = {
    id: generateAportacionId(),
    fecha,
    importe,
    tipo: 'reembolso',
    fuente: 'traspaso_salida',
    notas: 'Traspaso a otro plan de pensiones',
  };
  const nuevoValor = Math.max(0, (inv.valor_actual ?? 0) - importe);
  await updateInversionConAportacion(ref, aportacionSalida, nuevoValor, fecha);
}

async function applyIncoming(ref: PlanRef, importe: number, fecha: string): Promise<void> {
  const db = await initDB();
  if (ref.store === 'planesPensiones') {
    const plan = await (db as any).get('planesPensiones', String(ref.id));
    if (!plan) throw new Error(`Plan ${ref.id} no encontrado en planesPensiones.`);
    await planesInversionService.updatePlan(String(ref.id), {
      valorActual: (plan.valorActual ?? 0) + importe,
    });
    return;
  }

  const inv = await db.get('inversiones', ref.id) as PosicionInversion | undefined;
  if (!inv) throw new Error(`Posición ${ref.id} no encontrada en el store inversiones.`);
  const aportacionEntrada: Aportacion = {
    id: generateAportacionId(),
    fecha,
    importe,
    tipo: 'aportacion',
    fuente: 'traspaso_entrada',
    notas: 'Traspaso procedente de otro plan de pensiones',
  };
  const nuevoValor = (inv.valor_actual ?? 0) + importe;
  await updateInversionConAportacion(ref, aportacionEntrada, nuevoValor, fecha);
}

async function revertOutgoing(ref: PlanRef, importe: number, _fecha: string): Promise<void> {
  const db = await initDB();
  if (ref.store === 'planesPensiones') {
    const plan = await (db as any).get('planesPensiones', String(ref.id));
    if (!plan) throw new Error(`Plan ${ref.id} no encontrado en planesPensiones.`);
    await planesInversionService.updatePlan(String(ref.id), {
      valorActual: (plan.valorActual ?? 0) + importe,
    });
    return;
  }
  const inv = await db.get('inversiones', ref.id) as PosicionInversion | undefined;
  if (!inv) throw new Error(`Posición ${ref.id} no encontrada en el store inversiones.`);
  const aportaciones = (inv.aportaciones ?? []).filter(
    (a) => !(a.fuente === 'traspaso_salida' && a.fecha === fecha && Math.abs(a.importe - importe) < 0.005)
  );
  const nuevoValor = (inv.valor_actual ?? 0) + importe;
  await inversionesService.updatePosicion(ref.id, {
    ...inversionesService.recalculatePosition(aportaciones),
    valor_actual: nuevoValor,
  });
}

async function revertIncoming(ref: PlanRef, importe: number, _fecha: string): Promise<void> {
  const db = await initDB();
  if (ref.store === 'planesPensiones') {
    const plan = await (db as any).get('planesPensiones', String(ref.id));
    if (!plan) throw new Error(`Plan ${ref.id} no encontrado en planesPensiones.`);
    await planesInversionService.updatePlan(String(ref.id), {
      valorActual: Math.max(0, (plan.valorActual ?? 0) - importe),
    });
    return;
  }
  const inv = await db.get('inversiones', ref.id) as PosicionInversion | undefined;
  if (!inv) throw new Error(`Posición ${ref.id} no encontrada en el store inversiones.`);
  const aportaciones = (inv.aportaciones ?? []).filter(
    (a) => !(a.fuente === 'traspaso_entrada' && a.fecha === fecha && Math.abs(a.importe - importe) < 0.005)
  );
  const nuevoValor = Math.max(0, (inv.valor_actual ?? 0) - importe);
  await inversionesService.updatePosicion(ref.id, {
    ...inversionesService.recalculatePosition(aportaciones),
    valor_actual: nuevoValor,
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
   * Ejecuta un traspaso de forma atómica (best-effort):
   * 1) aplica salida, 2) aplica entrada, 3) persiste el evento.
   * Si (2) o (3) fallan, intenta revertir (1) para no dejar el origen modificado
   * sin traspaso registrado.
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

    await applyOutgoing(input.planOrigen, importe, input.fecha);

    // A partir de aquí, cualquier fallo debe intentar revertir la salida.
    try {
      await applyIncoming(input.planDestino, importe, input.fecha);

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
      try {
        const db = await initDB();
        const id = await db.add('traspasosPlanes', record);
        return { ...record, id: id as number };
      } catch (persistErr) {
        // Revertir entrada y salida si no pudimos persistir el evento
        try { await revertIncoming(input.planDestino, importe, input.fecha); } catch { /* noop */ }
        try { await revertOutgoing(input.planOrigen, importe, input.fecha); } catch { /* noop */ }
        throw persistErr;
      }
    } catch (incomingErr) {
      try { await revertOutgoing(input.planOrigen, importe, input.fecha); } catch { /* noop */ }
      throw incomingErr;
    }
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
          const origenMatch = t.planOrigenId === ref.id && (t.planOrigenStore ?? 'planesPensiones') === ref.store;
          const destinoMatch = t.planDestinoId === ref.id && (t.planDestinoStore ?? 'planesPensiones') === ref.store;
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
      store: traspaso.planOrigenStore ?? 'planesPensiones',
    };
    const destinoRef: PlanRef = {
      id: traspaso.planDestinoId,
      store: traspaso.planDestinoStore ?? 'planesPensiones',
    };

    await revertOutgoing(origenRef, traspaso.importe, traspaso.fecha);
    await revertIncoming(destinoRef, traspaso.importe, traspaso.fecha);
    await db.delete('traspasosPlanes', id);
  },
};
