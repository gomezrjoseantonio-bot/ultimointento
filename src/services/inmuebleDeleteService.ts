// D-CRUD-ALTA · sub-tarea 3 · borrado en cascada de inmueble (Property local IDB).
//
// Responsabilidades:
//   - Recorrer todas las stores que referencian propertyId/inmuebleId
//   - Borrar en cascada lo derivado · CONSERVAR property_sales (histórico fiscal)
//   - Para los contratos asociados, llamar a deleteContractWithCascade para
//     que los treasuryEvents/presupuestoLineas vinculados al contrato se
//     limpien también
//   - Devolver un report con los conteos para mostrar al usuario antes y
//     después de confirmar el borrado.
//
// NOTA: inmuebleService.delete() (HTTP fantasma) se conserva sin tocar · NO
// tiene callers reales (verificado con grep duro).

import { initDB } from './db';
import {
  deleteContractWithCascade,
  previewDeleteContractCascade,
  type DeleteContractCascadeReport,
} from './contractService';

export interface DeleteInmuebleCascadeReport {
  contractsDeleted: number;
  contractsCascade: DeleteContractCascadeReport;
  gastosInmuebleDeleted: number;
  mejorasInmuebleDeleted: number;
  mueblesInmuebleDeleted: number;
  propertyDaysDeleted: number;
  valoracionesHistoricasDeleted: number;
  vinculosAccesorioDeleted: number;
  presupuestoLineasDeleted: number;
  documentsDeleted: number;
  treasuryEventsDeleted: number;
  propertySalesPreserved: number;
}

const emptyReport = (): DeleteInmuebleCascadeReport => ({
  contractsDeleted: 0,
  contractsCascade: {
    treasuryEventsPredictedDeleted: 0,
    treasuryEventsHistoricUnlinked: 0,
    presupuestoLineasDeleted: 0,
  },
  gastosInmuebleDeleted: 0,
  mejorasInmuebleDeleted: 0,
  mueblesInmuebleDeleted: 0,
  propertyDaysDeleted: 0,
  valoracionesHistoricasDeleted: 0,
  vinculosAccesorioDeleted: 0,
  presupuestoLineasDeleted: 0,
  documentsDeleted: 0,
  treasuryEventsDeleted: 0,
  propertySalesPreserved: 0,
});

const countWhere = async <T = unknown>(
  storeName: string,
  predicate: (row: T) => boolean,
): Promise<number> => {
  const db = await initDB();
  if (!db.objectStoreNames.contains(storeName)) return 0;
  const all = (await db.getAll(storeName as never)) as T[];
  return all.filter(predicate).length;
};

export const previewDeleteInmuebleCascade = async (
  inmuebleId: number,
): Promise<DeleteInmuebleCascadeReport> => {
  const db = await initDB();
  const idStr = String(inmuebleId);
  const report = emptyReport();

  // Contratos · iteramos para pedir preview de cada uno (suma cascadas)
  if (db.objectStoreNames.contains('contracts')) {
    const allContracts = await db.getAll('contracts');
    const matching = allContracts.filter(
      (c) => (c as { propertyId?: number }).propertyId === inmuebleId,
    );
    report.contractsDeleted = matching.length;
    for (const c of matching) {
      const cid = (c as { id?: number }).id;
      if (cid == null) continue;
      const sub = await previewDeleteContractCascade(cid);
      report.contractsCascade.treasuryEventsPredictedDeleted += sub.treasuryEventsPredictedDeleted;
      report.contractsCascade.treasuryEventsHistoricUnlinked += sub.treasuryEventsHistoricUnlinked;
      report.contractsCascade.presupuestoLineasDeleted += sub.presupuestoLineasDeleted;
    }
  }

  report.gastosInmuebleDeleted = await countWhere<{ inmuebleId?: number }>(
    'gastosInmueble',
    (g) => g.inmuebleId === inmuebleId,
  );
  report.mejorasInmuebleDeleted = await countWhere<{ inmuebleId?: number }>(
    'mejorasInmueble',
    (m) => m.inmuebleId === inmuebleId,
  );
  report.mueblesInmuebleDeleted = await countWhere<{ inmuebleId?: number }>(
    'mueblesInmueble',
    (m) => m.inmuebleId === inmuebleId,
  );
  report.propertyDaysDeleted = await countWhere<{ propertyId?: number }>(
    'propertyDays',
    (p) => p.propertyId === inmuebleId,
  );
  report.valoracionesHistoricasDeleted = await countWhere<{
    tipoActivo?: string;
    activoId?: string;
    deletedAt?: string | null;
  }>(
    'valoracionesActivos',
    (v) =>
      v.tipoActivo === 'inmueble' &&
      String(v.activoId) === idStr &&
      !v.deletedAt,
  );
  report.vinculosAccesorioDeleted = await countWhere<{
    inmueblePrincipalId?: number;
    inmuebleAccesorioId?: number;
  }>(
    'vinculosAccesorio',
    (v) =>
      v.inmueblePrincipalId === inmuebleId ||
      v.inmuebleAccesorioId === inmuebleId,
  );
  // presupuestoLineas.inmuebleId es UUID (string)
  report.presupuestoLineasDeleted = await countWhere<{ inmuebleId?: string }>(
    'presupuestoLineas',
    (l) => l.inmuebleId === idStr,
  );
  report.documentsDeleted = await countWhere<{
    metadata?: { entityType?: string; entityId?: number | string };
  }>(
    'documents',
    (d) =>
      d.metadata?.entityType === 'property' &&
      (d.metadata.entityId === inmuebleId || String(d.metadata.entityId) === idStr),
  );
  report.treasuryEventsDeleted = await countWhere<{ inmuebleId?: number }>(
    'treasuryEvents',
    (e) => e.inmuebleId === inmuebleId,
  );
  report.propertySalesPreserved = await countWhere<{ propertyId?: number }>(
    'property_sales',
    (s) => s.propertyId === inmuebleId,
  );

  return report;
};

const deleteAllMatching = async <T extends { id?: number | string }>(
  storeName: string,
  predicate: (row: T) => boolean,
): Promise<number> => {
  const db = await initDB();
  if (!db.objectStoreNames.contains(storeName)) return 0;
  const all = (await db.getAll(storeName as never)) as T[];
  const matching = all.filter(predicate);
  let n = 0;
  for (const row of matching) {
    if (row.id == null) continue;
    await db.delete(storeName as never, row.id as never);
    n += 1;
  }
  return n;
};

export const deleteInmuebleWithCascade = async (
  inmuebleId: number,
): Promise<DeleteInmuebleCascadeReport> => {
  const db = await initDB();
  const idStr = String(inmuebleId);
  const report = emptyReport();

  // 1. Contratos · usar el cascade dedicado para que purguen sus dependencias.
  //    Se hace fuera de una única transacción global porque deleteContractWithCascade
  //    abre la suya propia (treasuryEvents+presupuestoLineas+contracts).
  if (db.objectStoreNames.contains('contracts')) {
    const allContracts = await db.getAll('contracts');
    const matching = allContracts.filter(
      (c) => (c as { propertyId?: number }).propertyId === inmuebleId,
    );
    for (const c of matching) {
      const cid = (c as { id?: number }).id;
      if (cid == null) continue;
      const sub = await deleteContractWithCascade(cid);
      report.contractsDeleted += 1;
      report.contractsCascade.treasuryEventsPredictedDeleted += sub.treasuryEventsPredictedDeleted;
      report.contractsCascade.treasuryEventsHistoricUnlinked += sub.treasuryEventsHistoricUnlinked;
      report.contractsCascade.presupuestoLineasDeleted += sub.presupuestoLineasDeleted;
    }
  }

  // 2. Resto de stores derivadas · borrado en cascada
  report.gastosInmuebleDeleted = await deleteAllMatching<{
    id?: number;
    inmuebleId?: number;
  }>('gastosInmueble', (g) => g.inmuebleId === inmuebleId);

  report.mejorasInmuebleDeleted = await deleteAllMatching<{
    id?: number;
    inmuebleId?: number;
  }>('mejorasInmueble', (m) => m.inmuebleId === inmuebleId);

  report.mueblesInmuebleDeleted = await deleteAllMatching<{
    id?: number;
    inmuebleId?: number;
  }>('mueblesInmueble', (m) => m.inmuebleId === inmuebleId);

  report.propertyDaysDeleted = await deleteAllMatching<{
    id?: number;
    propertyId?: number;
  }>('propertyDays', (p) => p.propertyId === inmuebleId);

  report.valoracionesHistoricasDeleted = await deleteAllMatching<{
    id?: number;
    tipoActivo?: string;
    activoId?: string;
  }>(
    'valoracionesActivos',
    (v) =>
      v.tipoActivo === 'inmueble' &&
      String(v.activoId) === idStr,
  );

  report.vinculosAccesorioDeleted = await deleteAllMatching<{
    id?: number;
    inmueblePrincipalId?: number;
    inmuebleAccesorioId?: number;
  }>(
    'vinculosAccesorio',
    (v) =>
      v.inmueblePrincipalId === inmuebleId ||
      v.inmuebleAccesorioId === inmuebleId,
  );

  report.presupuestoLineasDeleted = await deleteAllMatching<{
    id?: string;
    inmuebleId?: string;
  }>('presupuestoLineas', (l) => l.inmuebleId === idStr);

  report.documentsDeleted = await deleteAllMatching<{
    id?: number;
    metadata?: { entityType?: string; entityId?: number | string };
  }>(
    'documents',
    (d) =>
      d.metadata?.entityType === 'property' &&
      (d.metadata.entityId === inmuebleId || String(d.metadata.entityId) === idStr),
  );

  report.treasuryEventsDeleted = await deleteAllMatching<{
    id?: number;
    inmuebleId?: number;
  }>('treasuryEvents', (e) => e.inmuebleId === inmuebleId);

  // 3. property_sales · CONSERVAR (histórico fiscal · spec sub-tarea 3)
  report.propertySalesPreserved = await countWhere<{ propertyId?: number }>(
    'property_sales',
    (s) => s.propertyId === inmuebleId,
  );

  // 4. Finalmente · el inmueble en sí
  await db.delete('properties', inmuebleId);

  return report;
};

export const summarizeCascadeReport = (
  report: DeleteInmuebleCascadeReport,
): string[] => {
  const items: string[] = [];
  if (report.contractsDeleted > 0) {
    const sub = report.contractsCascade;
    const subParts: string[] = [];
    if (sub.treasuryEventsPredictedDeleted > 0) subParts.push(`${sub.treasuryEventsPredictedDeleted} eventos previstos`);
    if (sub.treasuryEventsHistoricUnlinked > 0) subParts.push(`${sub.treasuryEventsHistoricUnlinked} eventos históricos desvinculados`);
    if (sub.presupuestoLineasDeleted > 0) subParts.push(`${sub.presupuestoLineasDeleted} líneas de presupuesto`);
    const subText = subParts.length > 0 ? ` (incl. ${subParts.join(' · ')})` : '';
    items.push(`${report.contractsDeleted} contrato(s)${subText}`);
  }
  if (report.gastosInmuebleDeleted > 0) items.push(`${report.gastosInmuebleDeleted} gasto(s)`);
  if (report.mejorasInmuebleDeleted > 0) items.push(`${report.mejorasInmuebleDeleted} mejora(s)`);
  if (report.mueblesInmuebleDeleted > 0) items.push(`${report.mueblesInmuebleDeleted} mueble(s)`);
  if (report.propertyDaysDeleted > 0) items.push(`${report.propertyDaysDeleted} registro(s) días`);
  if (report.valoracionesHistoricasDeleted > 0) items.push(`${report.valoracionesHistoricasDeleted} valoración(es)`);
  if (report.vinculosAccesorioDeleted > 0) items.push(`${report.vinculosAccesorioDeleted} vínculo(s) accesorio`);
  if (report.presupuestoLineasDeleted > 0) items.push(`${report.presupuestoLineasDeleted} línea(s) presupuesto`);
  if (report.documentsDeleted > 0) items.push(`${report.documentsDeleted} documento(s)`);
  if (report.treasuryEventsDeleted > 0) items.push(`${report.treasuryEventsDeleted} evento(s) tesorería`);
  if (report.propertySalesPreserved > 0) items.push(`${report.propertySalesPreserved} venta(s) histórica(s) CONSERVADAS`);
  return items;
};
