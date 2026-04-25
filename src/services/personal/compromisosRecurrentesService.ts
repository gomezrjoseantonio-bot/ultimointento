// ============================================================================
// ATLAS Personal v1.1 · CompromisosRecurrentesService
// ============================================================================
//
// CRUD del catálogo `compromisosRecurrentes` + generación automática de
// eventos en `treasuryEvents` (regla de oro #1 · cada compromiso se da de
// alta UNA vez · genera N eventos automáticamente).
//
// Decisiones aplicadas:
//   G-01 · Schema único con discriminador `ambito` (personal | inmueble)
//   G-08 · Aprendizaje: las reglas de conciliación viven en otro store
//   Regla #2 · viviendaHabitual genera derivados aparte (NO via este service)
// ============================================================================

import { initDB } from '../db';
import type { TreasuryEvent } from '../db';
import type {
  CompromisoRecurrente,
  PatronRecurrente,
  ImporteEvento,
  ValidationResult,
} from '../../types/compromisosRecurrentes';
import {
  expandirPatron,
  calcularImporte,
  aplicarVariacion,
} from './patronCalendario';

const STORE_COMPROMISOS = 'compromisosRecurrentes';
const STORE_TREASURY = 'treasuryEvents';
const STORE_VIVIENDA = 'viviendaHabitual';

// Horizonte de proyección por defecto (24 meses · sección 3.2)
const HORIZONTE_MESES_DEFECTO = 24;

// ─── CRUD ──────────────────────────────────────────────────────────────────

export async function listarCompromisos(
  filtro?: { ambito?: 'personal' | 'inmueble'; personalDataId?: number; inmuebleId?: number; soloActivos?: boolean },
): Promise<CompromisoRecurrente[]> {
  const db = await initDB();
  const all = await db.getAll(STORE_COMPROMISOS);
  return all.filter((c) => {
    if (filtro?.ambito && c.ambito !== filtro.ambito) return false;
    if (filtro?.personalDataId !== undefined && c.personalDataId !== filtro.personalDataId) return false;
    if (filtro?.inmuebleId !== undefined && c.inmuebleId !== filtro.inmuebleId) return false;
    if (filtro?.soloActivos && c.estado !== 'activo') return false;
    return true;
  });
}

export async function obtenerCompromiso(id: number): Promise<CompromisoRecurrente | undefined> {
  const db = await initDB();
  return db.get(STORE_COMPROMISOS, id);
}

export async function crearCompromiso(
  datos: Omit<CompromisoRecurrente, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<CompromisoRecurrente> {
  // Validar invariantes (regla #2 + sección 6.5)
  const validacion = await puedeCrearCompromiso(datos);
  if (!validacion.ok) {
    throw new Error(`No se puede crear compromiso: ${validacion.motivo}`);
  }

  const db = await initDB();
  const ahora = new Date().toISOString();
  const compromiso: CompromisoRecurrente = {
    ...datos,
    createdAt: ahora,
    updatedAt: ahora,
  };
  const id = await db.add(STORE_COMPROMISOS, compromiso);
  const creado = { ...compromiso, id: id as number };

  // Genera eventos en treasuryEvents (regla #1)
  if (creado.estado === 'activo') {
    await regenerarEventosCompromiso(creado);
  }

  return creado;
}

export async function actualizarCompromiso(
  id: number,
  cambios: Partial<Omit<CompromisoRecurrente, 'id' | 'createdAt'>>,
): Promise<CompromisoRecurrente> {
  const db = await initDB();
  const existente = await db.get(STORE_COMPROMISOS, id);
  if (!existente) throw new Error(`Compromiso ${id} no existe`);

  // Si está bloqueado por origen (derivado), solo permitir cambios desde el origen
  if (existente.derivadoDe?.bloqueado) {
    throw new Error(
      `Compromiso bloqueado · editar desde origen (${existente.derivadoDe.fuente})`,
    );
  }

  const actualizado: CompromisoRecurrente = {
    ...existente,
    ...cambios,
    id,
    createdAt: existente.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await db.put(STORE_COMPROMISOS, actualizado);

  // Re-genera eventos solo si cambia algo que afecta a la proyección
  await borrarEventosFuturosCompromiso(id);
  if (actualizado.estado === 'activo') {
    await regenerarEventosCompromiso(actualizado);
  }

  return actualizado;
}

export async function eliminarCompromiso(id: number): Promise<void> {
  const db = await initDB();
  const existente = await db.get(STORE_COMPROMISOS, id);
  if (!existente) return;
  if (existente.derivadoDe?.bloqueado) {
    throw new Error('Compromiso bloqueado · eliminar desde origen');
  }
  await borrarEventosFuturosCompromiso(id);
  await db.delete(STORE_COMPROMISOS, id);
}

// ─── Validación de creación (sección 6.5) ──────────────────────────────────

/**
 * Aplica las restricciones de no-duplicación contra `viviendaHabitual` y
 * contra los compromisos derivados de inmuebles de inversión.
 *
 * Los tipos `vivienda.alquiler` y `vivienda.hipoteca` ya NO existen como
 * `TipoCompromiso` (TypeScript bloquea su creación). Aquí validamos los que
 * sí existen pero pueden chocar con derivados (seguro hogar · IBI ·
 * comunidad).
 */
export async function puedeCrearCompromiso(
  nuevo: Partial<CompromisoRecurrente>,
): Promise<ValidationResult> {
  // 1. Validar campos mínimos del discriminador
  if (!nuevo.ambito) {
    return { ok: false, motivo: 'Falta `ambito` (personal | inmueble)' };
  }
  if (nuevo.ambito === 'inmueble' && !nuevo.inmuebleId) {
    return { ok: false, motivo: 'Falta `inmuebleId` para ambito=inmueble' };
  }
  if (nuevo.ambito === 'personal' && !nuevo.personalDataId) {
    return { ok: false, motivo: 'Falta `personalDataId` para ambito=personal' };
  }

  // 2. Si es personal, validar que no choque con derivados de viviendaHabitual
  if (nuevo.ambito === 'personal') {
    const db = await initDB();
    const viviendas = await db.getAll(STORE_VIVIENDA);
    const vh = viviendas.find(
      (v) => v.personalDataId === nuevo.personalDataId && v.activa,
    );
    if (vh) {
      const data = vh.data;

      // Seguro hogar de vivienda habitual ya gestionado en ficha vivienda
      if (
        nuevo.tipo === 'seguro' &&
        nuevo.subtipo === 'hogar' &&
        data.tipo !== 'inquilino' &&
        data.seguros?.hogar
      ) {
        return {
          ok: false,
          motivo: 'Seguro hogar de vivienda habitual gestionado en ficha vivienda',
          redirigirA: 'viviendaHabitual',
        };
      }

      // Comunidad de vivienda habitual
      if (
        nuevo.tipo === 'comunidad' &&
        data.tipo !== 'inquilino' &&
        data.comunidad
      ) {
        return {
          ok: false,
          motivo: 'Comunidad de vivienda habitual gestionada en ficha vivienda',
          redirigirA: 'viviendaHabitual',
        };
      }

      // IBI de vivienda habitual
      if (
        nuevo.categoria === 'vivienda.ibi' &&
        data.tipo !== 'inquilino' &&
        data.ibi
      ) {
        return {
          ok: false,
          motivo: 'IBI de vivienda habitual gestionado en ficha vivienda',
          redirigirA: 'viviendaHabitual',
        };
      }

      // Renta alquiler vivienda habitual NO debe ir aquí
      if (nuevo.categoria === 'vivienda.alquiler' && data.tipo === 'inquilino') {
        return {
          ok: false,
          motivo: 'Renta de vivienda habitual gestionada en ficha vivienda',
          redirigirA: 'viviendaHabitual',
        };
      }

      // Hipoteca vivienda habitual NO debe ir aquí
      if (nuevo.categoria === 'vivienda.hipoteca' && data.tipo === 'propietarioConHipoteca') {
        return {
          ok: false,
          motivo: 'Hipoteca de vivienda habitual gestionada desde Financiación',
          redirigirA: 'viviendaHabitual',
        };
      }
    }
  }

  // 3. Si es inmueble, validar que no choque con `gastosInmueble` reales
  //    Esta validación es laxa · los gastos reales viven en otro store y
  //    el OPEX/compromiso es la previsión. Solo bloqueamos categorías
  //    explícitamente personales.
  if (nuevo.ambito === 'inmueble') {
    const categoriasNoPermitidas: Array<typeof nuevo.categoria> = [
      'ahorro.aporteFondo',
      'ahorro.aportePension',
      'ahorro.amortizacionExtra',
      'ahorro.cuentaTarget',
      'ahorro.cajaLiquida',
      'obligaciones.irpfPagar',
      'obligaciones.irpfFraccionamiento',
      'obligaciones.m130',
      'obligaciones.reta',
    ];
    if (nuevo.categoria && categoriasNoPermitidas.includes(nuevo.categoria)) {
      return {
        ok: false,
        motivo: `Categoría ${nuevo.categoria} no aplica a ambito=inmueble`,
      };
    }
  }

  return { ok: true };
}

// ─── Generación de eventos (sección 3.2) ───────────────────────────────────

/**
 * Genera los `TreasuryEvent` proyectados desde un compromiso, hasta el
 * horizonte indicado (24 meses por defecto).
 *
 * NO escribe en BD · esta función es pura · útil para tests y para
 * `regenerarEventosCompromiso`.
 */
export function generarEventosDesdeCompromiso(
  compromiso: CompromisoRecurrente,
  hasta?: Date,
): Array<Omit<TreasuryEvent, 'id'>> {
  const fechaInicio = new Date(compromiso.fechaInicio);
  const horizonteFin =
    hasta ||
    new Date(
      new Date().getFullYear(),
      new Date().getMonth() + HORIZONTE_MESES_DEFECTO,
      28,
    );

  // Si hay fechaFin · cap horizonteFin
  let fechaTope = horizonteFin;
  if (compromiso.fechaFin) {
    const fin = new Date(compromiso.fechaFin);
    if (fin.getTime() < horizonteFin.getTime()) fechaTope = fin;
  }

  // Las fechas se proyectan desde HOY · no desde el inicio del compromiso
  // (los eventos pasados ya están confirmados por extracto bancario)
  const hoy = new Date();
  const desdeProyeccion = hoy.getTime() > fechaInicio.getTime() ? hoy : fechaInicio;
  const isoDesde = desdeProyeccion.toISOString().slice(0, 10);
  const isoHasta = fechaTope.toISOString().slice(0, 10);

  const fechas = expandirPatron(compromiso.patron, isoDesde, isoHasta);
  const ahora = new Date().toISOString();

  return fechas.map((fecha) => {
    const importeBruto = calcularImporte(compromiso.importe, fecha);
    const importeAjustado = aplicarVariacion(
      importeBruto,
      compromiso.variacion,
      fechaInicio,
      fecha,
    );

    // Pago = negativo · cobro = positivo. Categorías de ingreso son raras
    // en compromisos (la mayoría son pagos).
    const esIngreso = false;
    const importeFinal = esIngreso ? importeAjustado : -importeAjustado;

    const evento: Omit<TreasuryEvent, 'id'> = {
      type: 'expense',
      amount: importeFinal,
      predictedDate: fecha.toISOString(),
      description: compromiso.alias,
      sourceType: 'gasto_recurrente',
      sourceId: compromiso.id,
      año: fecha.getFullYear(),
      mes: fecha.getMonth() + 1,
      certeza: 'estimado',
      generadoPor: 'treasurySyncService',
      accountId: compromiso.cuentaCargo,
      paymentMethod: paymentMethodFromCompromiso(compromiso.metodoPago),
      status: 'predicted',
      ambito: compromiso.ambito === 'inmueble' ? 'INMUEBLE' : 'PERSONAL',
      inmuebleId: compromiso.ambito === 'inmueble' ? compromiso.inmuebleId : undefined,
      categoryLabel: compromiso.alias,
      categoryKey: compromiso.categoria,
      subtypeKey: compromiso.subtipo,
      providerName: compromiso.proveedor.nombre,
      providerNif: compromiso.proveedor.nif,
      counterparty: compromiso.conceptoBancario,
      createdAt: ahora,
      updatedAt: ahora,
    };
    return evento;
  });
}

function paymentMethodFromCompromiso(
  m: CompromisoRecurrente['metodoPago'],
): TreasuryEvent['paymentMethod'] {
  switch (m) {
    case 'domiciliacion': return 'Domiciliado';
    case 'transferencia': return 'Transferencia';
    case 'tarjeta':       return 'TPV';
    case 'efectivo':      return 'Efectivo';
  }
}

// ─── Sincronización con `treasuryEvents` ───────────────────────────────────

/**
 * Borra los eventos previstos (status='predicted') del compromiso indicado.
 * Los eventos confirmados/ejecutados se respetan (representan realidad
 * bancaria).
 */
export async function borrarEventosFuturosCompromiso(compromisoId: number): Promise<void> {
  const db = await initDB();
  const tx = db.transaction(STORE_TREASURY, 'readwrite');
  const store = tx.objectStore(STORE_TREASURY);
  const idx = store.index('sourceId');
  let cursor = await idx.openCursor(IDBKeyRange.only(compromisoId));
  while (cursor) {
    const ev = cursor.value as TreasuryEvent;
    if (
      (ev.sourceType === 'gasto_recurrente' || ev.sourceType === 'opex_rule') &&
      ev.status === 'predicted'
    ) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

/**
 * Regenera los eventos previstos (status='predicted') del compromiso. Los
 * confirmados/ejecutados se respetan.
 */
export async function regenerarEventosCompromiso(
  compromiso: CompromisoRecurrente,
): Promise<number> {
  if (!compromiso.id) {
    throw new Error('regenerarEventosCompromiso requiere compromiso.id');
  }
  await borrarEventosFuturosCompromiso(compromiso.id);
  const eventos = generarEventosDesdeCompromiso(compromiso);
  if (eventos.length === 0) return 0;

  const db = await initDB();
  const tx = db.transaction(STORE_TREASURY, 'readwrite');
  const store = tx.objectStore(STORE_TREASURY);
  for (const ev of eventos) {
    await store.add(ev as TreasuryEvent);
  }
  await tx.done;
  return eventos.length;
}

/**
 * Regenera eventos para todos los compromisos activos. Útil tras cambios de
 * configuración global (ej. ampliación del horizonte).
 */
export async function regenerarTodosLosEventos(): Promise<{ compromisos: number; eventos: number }> {
  const compromisos = await listarCompromisos({ soloActivos: true });
  let total = 0;
  for (const c of compromisos) {
    total += await regenerarEventosCompromiso(c);
  }
  return { compromisos: compromisos.length, eventos: total };
}

// ─── Re-exports útiles ─────────────────────────────────────────────────────

export { expandirPatron, calcularImporte, aplicarVariacion } from './patronCalendario';
export type { PatronRecurrente, ImporteEvento };
