import { EjercicioFiscal, initDB } from './db';
import { conciliarEjercicioFiscal } from './fiscalConciliationService';
import { cerrarEjercicio, getOrCreateEjercicio } from './ejercicioFiscalService';
import {
  crearSnapshotDeclaracion,
  crearSnapshotDeclaracionManual,
  ImportacionDeclaracionManualInput,
} from './snapshotDeclaracionService';

const EJERCICIOS_STORE = 'ejerciciosFiscales';

export interface IncoherenciaCierre {
  tipo: 'cobertura_punteo' | 'desviacion';
  severidad: 'warning' | 'critical';
  mensaje: string;
}

export interface RevisionCierreEjercicio {
  ejercicio: number;
  coberturaPunteo: number;
  totalDesviacion: number;
  totalEstimado: number;
  totalReal: number;
  incoherencias: IncoherenciaCierre[];
  puedeCerrar: boolean;
}

export interface CerrarEjercicioValidadoOptions {
  minCoberturaPunteo?: number;
  maxDesviacionAbsoluta?: number;
  forzarCierre?: boolean;
}

export async function revisarCierreEjercicio(
  ejercicio: number,
  opts: Omit<CerrarEjercicioValidadoOptions, 'forzarCierre'> = {}
): Promise<RevisionCierreEjercicio> {
  const minCoberturaPunteo = opts.minCoberturaPunteo ?? 70;
  const maxDesviacionAbsoluta = opts.maxDesviacionAbsoluta ?? 500;

  const conciliacion = await conciliarEjercicioFiscal(ejercicio);
  const incoherencias: IncoherenciaCierre[] = [];

  if (conciliacion.resumen.coberturaPunteo < minCoberturaPunteo) {
    incoherencias.push({
      tipo: 'cobertura_punteo',
      severidad: 'critical',
      mensaje: `Cobertura de punteo ${conciliacion.resumen.coberturaPunteo}% < mínimo ${minCoberturaPunteo}%`,
    });
  }

  if (Math.abs(conciliacion.resumen.totalDesviacion) > maxDesviacionAbsoluta) {
    incoherencias.push({
      tipo: 'desviacion',
      severidad: 'warning',
      mensaje: `Desviación absoluta ${Math.abs(conciliacion.resumen.totalDesviacion).toFixed(2)}€ > umbral ${maxDesviacionAbsoluta}€`,
    });
  }

  return {
    ejercicio,
    coberturaPunteo: conciliacion.resumen.coberturaPunteo,
    totalDesviacion: conciliacion.resumen.totalDesviacion,
    totalEstimado: conciliacion.resumen.totalEstimado,
    totalReal: conciliacion.resumen.totalReal,
    incoherencias,
    puedeCerrar: incoherencias.every((item) => item.severidad !== 'critical'),
  };
}

export async function cerrarEjercicioValidado(
  ejercicio: number,
  opts: CerrarEjercicioValidadoOptions = {}
): Promise<EjercicioFiscal> {
  const revision = await revisarCierreEjercicio(ejercicio, opts);
  if (!revision.puedeCerrar && !opts.forzarCierre) {
    throw new Error(
      `No se puede cerrar el ejercicio ${ejercicio}. Revisa incoherencias críticas o usa forzarCierre=true.`
    );
  }

  const cerrado = await cerrarEjercicio(ejercicio);
  const snapshot = await crearSnapshotDeclaracion(ejercicio, {
    origen: 'cierre_automatico',
    incluirCasillasAEAT: true,
  });

  const db = await initDB();
  const updated: EjercicioFiscal = {
    ...cerrado,
    snapshotId: snapshot.id,
    origen: cerrado.origen === 'importado' ? 'mixto' : cerrado.origen,
    updatedAt: new Date().toISOString(),
  };

  await db.put(EJERCICIOS_STORE, updated);
  return updated;
}

export async function importarDeclaracionEjercicio(
  ejercicio: number,
  input: ImportacionDeclaracionManualInput
): Promise<{ ejercicioFiscal: EjercicioFiscal; snapshotId?: number }> {
  const base = await getOrCreateEjercicio(ejercicio);
  const snapshot = await crearSnapshotDeclaracionManual(ejercicio, input);

  const updated: EjercicioFiscal = {
    ...base,
    estado: 'declarado',
    fechaCierre: base.fechaCierre ?? new Date().toISOString(),
    fechaDeclaracion: new Date().toISOString(),
    snapshotId: snapshot.id,
    origen: base.origen === 'calculado' ? 'mixto' : 'importado',
    updatedAt: new Date().toISOString(),
  };

  const db = await initDB();
  await db.put(EJERCICIOS_STORE, updated);

  return { ejercicioFiscal: updated, snapshotId: snapshot.id };
}
