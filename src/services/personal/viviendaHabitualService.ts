// ============================================================================
// ATLAS Personal v1.1 · ViviendaHabitualService
// ============================================================================
//
// CRUD de la ficha `viviendaHabitual` + generación automática de eventos
// derivados directamente en `treasuryEvents` (NO via compromisoRecurrente ·
// la ficha vivienda es excepción al modelo · va directa).
//
// Decisiones aplicadas:
//   Regla #2 · NUNCA se da de alta el alquiler · cuota hipoteca · IBI ·
//              comunidad · seguro hogar de la vivienda habitual como
//              compromiso recurrente independiente.
//   Sección 6.5 · Si el usuario intenta crear un compromiso en conflicto ·
//                 ATLAS lo bloquea (ver `compromisosRecurrentesService`).
//
// La hipoteca lee la cuota actual de `prestamos` (Financiación) · si el
// préstamo cambia (revisión Euribor · amortización extra) · llama a
// `regenerarEventosVivienda` para refrescar los eventos posteriores.
// ============================================================================

import { initDB } from '../db';
import type { TreasuryEvent } from '../db';
import type {
  ViviendaHabitual,
  ViviendaHabitualData,
} from '../../types/viviendaHabitual';

const STORE_VIVIENDA = 'viviendaHabitual';
const STORE_TREASURY = 'treasuryEvents';
const STORE_PRESTAMOS = 'prestamos';

// Horizonte de proyección (24 meses)
const HORIZONTE_MESES = 24;

// ─── CRUD ──────────────────────────────────────────────────────────────────

export async function obtenerViviendaActiva(
  personalDataId: number,
): Promise<ViviendaHabitual | undefined> {
  const db = await initDB();
  const all = await db.getAll(STORE_VIVIENDA);
  return all.find((v) => v.personalDataId === personalDataId && v.activa);
}

export async function listarViviendas(
  personalDataId: number,
): Promise<ViviendaHabitual[]> {
  const db = await initDB();
  const all = await db.getAll(STORE_VIVIENDA);
  return all
    .filter((v) => v.personalDataId === personalDataId)
    .sort((a, b) => a.vigenciaDesde.localeCompare(b.vigenciaDesde));
}

export async function guardarVivienda(
  vivienda: Omit<ViviendaHabitual, 'id' | 'createdAt' | 'updatedAt'> & { id?: number },
): Promise<ViviendaHabitual> {
  const db = await initDB();
  const ahora = new Date().toISOString();

  let saved: ViviendaHabitual;
  if (vivienda.id != null) {
    const existente = await db.get(STORE_VIVIENDA, vivienda.id);
    if (!existente) throw new Error(`Vivienda ${vivienda.id} no existe`);
    saved = {
      ...existente,
      ...vivienda,
      id: vivienda.id,
      createdAt: existente.createdAt,
      updatedAt: ahora,
    };
    await db.put(STORE_VIVIENDA, saved);
  } else {
    const v: ViviendaHabitual = {
      ...vivienda,
      createdAt: ahora,
      updatedAt: ahora,
    };
    const id = (await db.add(STORE_VIVIENDA, v)) as number;
    saved = { ...v, id };
  }

  // Si la vivienda nueva es la activa, desactivar otras del mismo titular
  if (saved.activa) {
    const otras = await db.getAll(STORE_VIVIENDA);
    for (const o of otras) {
      if (o.id !== saved.id && o.personalDataId === saved.personalDataId && o.activa) {
        await db.put(STORE_VIVIENDA, { ...o, activa: false, updatedAt: ahora });
        if (o.id != null) await borrarEventosFuturosVivienda(o.id);
      }
    }
  }

  // Regenerar eventos
  await regenerarEventosVivienda(saved);

  return saved;
}

export async function eliminarVivienda(id: number): Promise<void> {
  const db = await initDB();
  await borrarEventosFuturosVivienda(id);
  await db.delete(STORE_VIVIENDA, id);
}

// ─── Generación de eventos derivados (sección 6.2 / 6.3 / 6.4) ─────────────

/**
 * Devuelve los eventos derivados de la ficha vivienda · mensual (alquiler ·
 * comunidad · cuota hipoteca) + anual (IBI · seguros). Función pura · no
 * escribe en BD.
 */
export async function generarEventosVivienda(
  vivienda: ViviendaHabitual,
  hasta?: Date,
): Promise<Array<Omit<TreasuryEvent, 'id'>>> {
  const horizonteFin =
    hasta ||
    new Date(
      new Date().getFullYear(),
      new Date().getMonth() + HORIZONTE_MESES,
      28,
    );

  const eventos: Array<Omit<TreasuryEvent, 'id'>> = [];
  const data = vivienda.data;

  switch (data.tipo) {
    case 'inquilino':
      eventos.push(...generarEventosInquilino(vivienda, data, horizonteFin));
      break;
    case 'propietarioSinHipoteca':
      eventos.push(...generarEventosPropietario(vivienda, data, horizonteFin));
      break;
    case 'propietarioConHipoteca':
      eventos.push(...generarEventosPropietario(vivienda, data, horizonteFin));
      eventos.push(...(await generarEventosHipoteca(vivienda, data, horizonteFin)));
      break;
  }

  return eventos;
}

function generarEventosInquilino(
  vivienda: ViviendaHabitual,
  data: Extract<ViviendaHabitualData, { tipo: 'inquilino' }>,
  horizonteFin: Date,
): Array<Omit<TreasuryEvent, 'id'>> {
  const eventos: Array<Omit<TreasuryEvent, 'id'>> = [];
  const ahora = new Date().toISOString();
  const inicioContrato = new Date(data.contrato.vigenciaDesde);
  const finContrato = new Date(data.contrato.vigenciaHasta);

  const desde = inicioContrato.getTime() > Date.now() ? inicioContrato : new Date();
  const hasta = finContrato.getTime() < horizonteFin.getTime() ? finContrato : horizonteFin;

  let y = desde.getFullYear();
  let m = desde.getMonth();
  while (true) {
    const ultimoDia = new Date(y, m + 1, 0).getDate();
    const dia = Math.min(data.contrato.diaCobro, ultimoDia);
    const fecha = new Date(y, m, dia);
    if (fecha.getTime() > hasta.getTime()) break;
    if (fecha.getTime() >= desde.getTime() && fecha.getTime() >= inicioContrato.getTime()) {
      // Aplica revisión IPC si toca
      let importe = data.contrato.rentaMensual;
      if (data.contrato.revisionIPC.aplica && data.contrato.revisionIPC.mesRevision) {
        // No tenemos histórico de IPC · proyectamos sin subida (manual al recibir aviso)
      }
      eventos.push({
        type: 'expense',
        amount: -importe,
        predictedDate: fecha.toISOString(),
        description: `Alquiler vivienda habitual`,
        sourceType: 'contrato',
        sourceId: vivienda.id,
        año: fecha.getFullYear(),
        mes: fecha.getMonth() + 1,
        certeza: 'estimado',
        generadoPor: 'treasurySyncService',
        accountId: vivienda.data.cuentaCargo,
        paymentMethod: 'Transferencia',
        status: 'predicted',
        ambito: 'PERSONAL',
        categoryLabel: 'Alquiler vivienda habitual',
        categoryKey: 'vivienda.alquiler',
        providerName: data.contrato.arrendador.nombre,
        providerNif: data.contrato.arrendador.nif,
        counterparty: vivienda.data.tipo === 'inquilino' ? data.conceptoBancarioEsperado : '',
        createdAt: ahora,
        updatedAt: ahora,
      });
    }
    m++;
    if (m > 11) { m = 0; y++; }
    if (new Date(y, m, 1).getTime() > hasta.getTime()) break;
  }

  return eventos;
}

function generarEventosPropietario(
  vivienda: ViviendaHabitual,
  data: Extract<ViviendaHabitualData, { tipo: 'propietarioSinHipoteca' | 'propietarioConHipoteca' }>,
  horizonteFin: Date,
): Array<Omit<TreasuryEvent, 'id'>> {
  const eventos: Array<Omit<TreasuryEvent, 'id'>> = [];
  const ahora = new Date().toISOString();
  const desde = new Date();

  // Comunidad mensual
  if (data.comunidad) {
    let y = desde.getFullYear();
    let m = desde.getMonth();
    while (true) {
      const ultimoDia = new Date(y, m + 1, 0).getDate();
      const dia = Math.min(data.comunidad.diaCargo, ultimoDia);
      const fecha = new Date(y, m, dia);
      if (fecha.getTime() > horizonteFin.getTime()) break;
      if (fecha.getTime() >= desde.getTime()) {
        eventos.push({
          type: 'expense',
          amount: -data.comunidad.importe,
          predictedDate: fecha.toISOString(),
          description: 'Comunidad vivienda habitual',
          sourceType: 'gasto_recurrente',
          sourceId: vivienda.id,
          año: fecha.getFullYear(),
          mes: fecha.getMonth() + 1,
          certeza: 'estimado',
          generadoPor: 'treasurySyncService',
          accountId: data.cuentaCargo,
          paymentMethod: 'Domiciliado',
          status: 'predicted',
          ambito: 'PERSONAL',
          categoryLabel: 'Comunidad vivienda habitual',
          categoryKey: 'vivienda.comunidad',
          createdAt: ahora,
          updatedAt: ahora,
        });
      }
      m++;
      if (m > 11) { m = 0; y++; }
    }
  }

  // IBI · meses concretos
  if (data.ibi) {
    let y = desde.getFullYear();
    while (y <= horizonteFin.getFullYear()) {
      for (const mes1 of data.ibi.mesesPago) {
        const m0 = (mes1 - 1 + 12) % 12;
        const ultimoDia = new Date(y, m0 + 1, 0).getDate();
        const dia = Math.min(data.ibi.diaPago, ultimoDia);
        const fecha = new Date(y, m0, dia);
        if (fecha.getTime() < desde.getTime() || fecha.getTime() > horizonteFin.getTime()) continue;
        const importe =
          data.ibi.importesPorPago?.[mes1] ??
          data.ibi.importeAnual / data.ibi.mesesPago.length;
        eventos.push({
          type: 'expense',
          amount: -importe,
          predictedDate: fecha.toISOString(),
          description: 'IBI vivienda habitual',
          sourceType: 'gasto_recurrente',
          sourceId: vivienda.id,
          año: fecha.getFullYear(),
          mes: fecha.getMonth() + 1,
          certeza: 'estimado',
          generadoPor: 'treasurySyncService',
          accountId: data.cuentaCargo,
          paymentMethod: 'Domiciliado',
          status: 'predicted',
          ambito: 'PERSONAL',
          categoryLabel: 'IBI vivienda habitual',
          categoryKey: 'vivienda.ibi',
          createdAt: ahora,
          updatedAt: ahora,
        });
      }
      y++;
    }
  }

  // Seguros · anuales
  const seguros: Array<{ key: 'hogar' | 'vida'; data: typeof data.seguros.hogar; label: string }> = [
    { key: 'hogar', data: data.seguros.hogar, label: 'Seguro hogar vivienda habitual' },
    { key: 'vida', data: data.seguros.vida, label: 'Seguro vida vivienda habitual' },
  ];
  for (const s of seguros) {
    if (!s.data) continue;
    let y = desde.getFullYear();
    while (y <= horizonteFin.getFullYear()) {
      const m0 = (s.data.mesPago - 1 + 12) % 12;
      const ultimoDia = new Date(y, m0 + 1, 0).getDate();
      const dia = Math.min(s.data.diaPago, ultimoDia);
      const fecha = new Date(y, m0, dia);
      if (fecha.getTime() >= desde.getTime() && fecha.getTime() <= horizonteFin.getTime()) {
        eventos.push({
          type: 'expense',
          amount: -s.data.importeAnual,
          predictedDate: fecha.toISOString(),
          description: s.label,
          sourceType: 'gasto_recurrente',
          sourceId: vivienda.id,
          año: fecha.getFullYear(),
          mes: fecha.getMonth() + 1,
          certeza: 'estimado',
          generadoPor: 'treasurySyncService',
          accountId: data.cuentaCargo,
          paymentMethod: 'Domiciliado',
          status: 'predicted',
          ambito: 'PERSONAL',
          categoryLabel: s.label,
          categoryKey: 'vivienda.seguros',
          subtypeKey: s.key,
          createdAt: ahora,
          updatedAt: ahora,
        });
      }
      y++;
    }
  }

  return eventos;
}

async function generarEventosHipoteca(
  vivienda: ViviendaHabitual,
  data: Extract<ViviendaHabitualData, { tipo: 'propietarioConHipoteca' }>,
  horizonteFin: Date,
): Promise<Array<Omit<TreasuryEvent, 'id'>>> {
  const eventos: Array<Omit<TreasuryEvent, 'id'>> = [];
  const ahora = new Date().toISOString();
  const desde = new Date();

  // Lee la cuota actual del préstamo (cuadro de amortización en `prestamos`)
  let cuotaMensual = 0;
  let prestamoData: any = null;
  try {
    const db = await initDB();
    if (db.objectStoreNames.contains(STORE_PRESTAMOS)) {
      const idNum =
        typeof data.hipoteca.prestamoId === 'string'
          ? parseInt(data.hipoteca.prestamoId, 10)
          : data.hipoteca.prestamoId;
      const prestamo = await db.get(STORE_PRESTAMOS, idNum);
      prestamoData = prestamo;
      // Best-effort · busca un campo de cuota en estructuras conocidas
      if (prestamo) {
        cuotaMensual =
          prestamo.cuotaMensual ??
          prestamo.cuotaActual ??
          prestamo.cuota ??
          0;
      }
    }
  } catch (err) {
    console.warn('[viviendaHabitualService] no se pudo leer cuota de préstamo:', err);
  }

  if (cuotaMensual <= 0) {
    // Si no podemos leer la cuota · no generamos eventos · evita ruido
    return [];
  }

  let y = desde.getFullYear();
  let m = desde.getMonth();
  // Día 1 del mes por defecto (el cuadro de amortización suele cargar a mes vencido)
  const diaCuota = 1;
  while (true) {
    const fecha = new Date(y, m, diaCuota);
    if (fecha.getTime() > horizonteFin.getTime()) break;
    if (fecha.getTime() >= desde.getTime()) {
      eventos.push({
        type: 'expense',
        amount: -cuotaMensual,
        predictedDate: fecha.toISOString(),
        description: 'Cuota hipoteca vivienda habitual',
        sourceType: 'hipoteca',
        sourceId: vivienda.id,
        prestamoId: String(data.hipoteca.prestamoId),
        año: fecha.getFullYear(),
        mes: fecha.getMonth() + 1,
        certeza: 'estimado',
        generadoPor: 'treasurySyncService',
        accountId: data.cuentaCargo,
        paymentMethod: 'Domiciliado',
        status: 'predicted',
        ambito: 'PERSONAL',
        categoryLabel: 'Cuota hipoteca vivienda habitual',
        categoryKey: 'vivienda.hipoteca',
        providerName: prestamoData?.entidad ?? prestamoData?.banco ?? 'Banco hipoteca',
        createdAt: ahora,
        updatedAt: ahora,
      });
    }
    m++;
    if (m > 11) { m = 0; y++; }
  }

  return eventos;
}

// ─── Sincronización con `treasuryEvents` ───────────────────────────────────

/**
 * Borra los eventos previstos derivados de la vivienda. Confirmados/ejecutados
 * se respetan.
 */
export async function borrarEventosFuturosVivienda(viviendaId: number): Promise<void> {
  const db = await initDB();
  const tx = db.transaction(STORE_TREASURY, 'readwrite');
  const store = tx.objectStore(STORE_TREASURY);
  // No tenemos índice por sourceId+ambito · iteramos sobre el index sourceId
  const idx = store.index('sourceId');
  let cursor = await idx.openCursor(IDBKeyRange.only(viviendaId));
  while (cursor) {
    const ev = cursor.value as TreasuryEvent;
    const esViviendaDerivado =
      (ev.sourceType === 'gasto_recurrente' ||
        ev.sourceType === 'contrato' ||
        ev.sourceType === 'hipoteca') &&
      (ev.categoryKey === 'vivienda.alquiler' ||
        ev.categoryKey === 'vivienda.hipoteca' ||
        ev.categoryKey === 'vivienda.comunidad' ||
        ev.categoryKey === 'vivienda.ibi' ||
        ev.categoryKey === 'vivienda.seguros');
    if (esViviendaDerivado && ev.status === 'predicted') {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function regenerarEventosVivienda(
  vivienda: ViviendaHabitual,
): Promise<number> {
  if (!vivienda.id) {
    throw new Error('regenerarEventosVivienda requiere vivienda.id');
  }
  await borrarEventosFuturosVivienda(vivienda.id);
  if (!vivienda.activa) return 0;

  const eventos = await generarEventosVivienda(vivienda);
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
