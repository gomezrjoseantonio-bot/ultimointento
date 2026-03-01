import { initDB, EjercicioFiscal, EstadoEjercicio } from './db';
import { calcularDeclaracionIRPF } from './irpfCalculationService';

const STORE_NAME = 'ejerciciosFiscales';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function validateAño(año: number): void {
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(año) || año < 2020 || año > currentYear + 1) {
    throw new Error(`Año inválido: ${año}. Debe estar entre 2020 y ${currentYear + 1}.`);
  }
}

async function getEjercicioByAño(año: number): Promise<EjercicioFiscal | undefined> {
  const db = await initDB();
  const ejercicios = await db.getAllFromIndex(STORE_NAME, 'año', año);
  return ejercicios[0] as EjercicioFiscal | undefined;
}

async function saveEjercicio(ejercicio: EjercicioFiscal): Promise<EjercicioFiscal> {
  const db = await initDB();
  await db.put(STORE_NAME, ejercicio);
  return ejercicio;
}

function assertEstadoActual(ejercicio: EjercicioFiscal, esperado: EstadoEjercicio, accion: string): void {
  if (ejercicio.estado !== esperado) {
    throw new Error(`No se puede ${accion} el ejercicio ${ejercicio.año} porque está en estado "${ejercicio.estado}" (se requiere "${esperado}").`);
  }
}

export async function getEjercicio(año: number): Promise<EjercicioFiscal | undefined> {
  validateAño(año);
  const ejercicio = await getEjercicioByAño(año);
  console.log(`[ejercicioFiscalService] getEjercicio(${año}) → ${ejercicio ? 'encontrado' : 'no existe'}`);
  return ejercicio;
}

export async function getOrCreateEjercicio(año: number): Promise<EjercicioFiscal> {
  validateAño(año);

  const existing = await getEjercicioByAño(año);
  if (existing) {
    console.log(`[ejercicioFiscalService] getOrCreateEjercicio(${año}) → existente id=${existing.id}`);
    return existing;
  }

  const now = new Date().toISOString();
  const db = await initDB();
  const id = await db.add(STORE_NAME, {
    año,
    estado: 'vivo',
    origen: 'calculado',
    createdAt: now,
    updatedAt: now,
  });

  const created: EjercicioFiscal = {
    id: typeof id === 'number' ? id : undefined,
    año,
    estado: 'vivo',
    origen: 'calculado',
    createdAt: now,
    updatedAt: now,
  };

  console.log(`[ejercicioFiscalService] getOrCreateEjercicio(${año}) → creado id=${created.id}`);
  return created;
}

export async function getAllEjercicios(): Promise<EjercicioFiscal[]> {
  const db = await initDB();
  const ejercicios = (await db.getAll(STORE_NAME)) as EjercicioFiscal[];
  return ejercicios.sort((a, b) => b.año - a.año);
}

export async function updateResumen(año: number): Promise<EjercicioFiscal> {
  const ejercicio = await getOrCreateEjercicio(año);
  assertEstadoActual(ejercicio, 'vivo', 'actualizar el resumen de');

  const declaracion = await calcularDeclaracionIRPF(año);
  const now = new Date().toISOString();

  const updated: EjercicioFiscal = {
    ...ejercicio,
    resumen: {
      baseImponibleGeneral: round2(declaracion.liquidacion.baseImponibleGeneral),
      baseImponibleAhorro: round2(declaracion.liquidacion.baseImponibleAhorro),
      cuotaIntegra: round2(declaracion.liquidacion.cuotaIntegra),
      deducciones: round2(declaracion.liquidacion.deduccionesDobleImposicion),
      retencionesYPagos: round2(declaracion.retenciones.total),
      resultado: round2(declaracion.resultado),
    },
    updatedAt: now,
  };

  await saveEjercicio(updated);
  console.log(`[ejercicioFiscalService] updateResumen(${año}) → OK`);
  return updated;
}

export async function cerrarEjercicio(año: number): Promise<EjercicioFiscal> {
  const existente = await getOrCreateEjercicio(año);
  assertEstadoActual(existente, 'vivo', 'cerrar');

  const conResumen = await updateResumen(año);
  const now = new Date().toISOString();
  const updated: EjercicioFiscal = {
    ...conResumen,
    estado: 'cerrado',
    fechaCierre: now,
    updatedAt: now,
  };

  await saveEjercicio(updated);
  console.log(`[ejercicioFiscalService] cerrarEjercicio(${año}) → cerrado`);
  return updated;
}

export async function reabrirEjercicio(año: number): Promise<EjercicioFiscal> {
  const ejercicio = await getOrCreateEjercicio(año);
  assertEstadoActual(ejercicio, 'cerrado', 'reabrir');

  const now = new Date().toISOString();
  const updated: EjercicioFiscal = {
    ...ejercicio,
    estado: 'vivo',
    fechaCierre: undefined,
    updatedAt: now,
  };

  await saveEjercicio(updated);
  console.log(`[ejercicioFiscalService] reabrirEjercicio(${año}) → vivo`);
  return updated;
}

export async function declararEjercicio(año: number): Promise<EjercicioFiscal> {
  const ejercicio = await getEjercicio(año);
  if (!ejercicio) {
    throw new Error(`No se encontró el ejercicio ${año}.`);
  }
  if (ejercicio.estado !== 'cerrado') {
    throw new Error(`No se puede declarar el ejercicio ${año} porque está en estado "${ejercicio.estado}". Primero debe cerrarse.`);
  }

  const now = new Date().toISOString();
  const updated: EjercicioFiscal = {
    ...ejercicio,
    estado: 'declarado',
    fechaDeclaracion: now,
    updatedAt: now,
  };

  await saveEjercicio(updated);
  console.log(`[ejercicioFiscalService] declararEjercicio(${año}) → declarado`);
  return updated;
}

export async function updateNotas(año: number, notas: string): Promise<EjercicioFiscal> {
  const ejercicio = await getEjercicio(año);
  if (!ejercicio) {
    throw new Error(`No existe un ejercicio fiscal para el año ${año}. No se pueden actualizar notas de un ejercicio inexistente.`);
  }
  const updated: EjercicioFiscal = {
    ...ejercicio,
    notas,
    updatedAt: new Date().toISOString(),
  };

  await saveEjercicio(updated);
  return updated;
}

export async function deleteEjercicio(año: number): Promise<void> {
  const ejercicio = await getEjercicio(año);
  if (!ejercicio) {
    return;
  }

  if (ejercicio.estado !== 'vivo') {
    throw new Error(`No se puede borrar el ejercicio ${año} porque está en estado "${ejercicio.estado}".`);
  }

  if (ejercicio.snapshotId) {
    throw new Error(`No se puede borrar el ejercicio ${año} porque tiene snapshotId asociado (${ejercicio.snapshotId}).`);
  }

  if (ejercicio.id == null) {
    console.error(`[ejercicioFiscalService] deleteEjercicio(${año}) → id ausente`);
    throw new Error(`No se puede borrar el ejercicio ${año} porque no tiene id.`);
  }

  const db = await initDB();
  await db.delete(STORE_NAME, ejercicio.id);
  console.log(`[ejercicioFiscalService] deleteEjercicio(${año}) → borrado`);
}
