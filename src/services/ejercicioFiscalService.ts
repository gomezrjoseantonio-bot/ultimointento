import { initDB, type EjercicioFiscal as DbEjercicioFiscal, type EstadoEjercicio as DbEstadoEjercicio } from './db';
import { calcularDeclaracionIRPF, type DeclaracionIRPF } from './irpfCalculationService';
import {
  createEmptyArrastresEjercicio,
  type ArrastresEjercicio,
  type DocumentoFiscal,
  type EjercicioFiscal,
  type EstadoEjercicio,
  type InformeCobertura,
  type InformeCoberturaLinea,
  type OrigenDeclaracion,
} from '../types/fiscal';

const STORE_NAME = 'ejerciciosFiscales';
const FISCAL_MIN_YEAR = 2010;

type LegacyOrigen = 'calculado' | 'importado' | 'mixto';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function cloneArrastres(arrastres?: ArrastresEjercicio): ArrastresEjercicio {
  return {
    porInmueble: [...(arrastres?.porInmueble ?? [])],
    porAnio: [...(arrastres?.porAnio ?? [])],
  };
}

function cloneDocumentos(documentos?: DocumentoFiscal[]): DocumentoFiscal[] {
  return [...(documentos ?? [])];
}

function validateEjercicio(ejercicio: number): void {
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(ejercicio) || ejercicio < FISCAL_MIN_YEAR || ejercicio > currentYear + 1) {
    throw new Error(`Año fiscal fuera del rango permitido (${FISCAL_MIN_YEAR} – ${currentYear + 1})`);
  }
}

function normalizeEstado(estado?: DbEstadoEjercicio): EstadoEjercicio {
  if (estado === 'vivo' || estado == null) {
    return 'en_curso';
  }
  return estado;
}

function legacyEstado(estado: EstadoEjercicio): DbEstadoEjercicio {
  return estado === 'en_curso' ? 'vivo' : estado;
}

function normalizeOrigen(dbEjercicio?: DbEjercicioFiscal): LegacyOrigen {
  if (dbEjercicio?.origen) {
    return dbEjercicio.origen;
  }
  if (dbEjercicio?.declaracionAeat) {
    return dbEjercicio.calculoAtlas ? 'mixto' : 'importado';
  }
  return 'calculado';
}

function normalizeDeclaracionOrigen(
  origen?: OrigenDeclaracion,
  dbEjercicio?: DbEjercicioFiscal,
): OrigenDeclaracion {
  if (origen) {
    return origen;
  }
  if (dbEjercicio?.declaracionAeat) {
    return dbEjercicio.origen === 'importado' ? 'pdf_importado' : 'manual';
  }
  return 'no_presentada';
}

function deriveResumen(declaracion?: DeclaracionIRPF): DbEjercicioFiscal['resumen'] | undefined {
  if (!declaracion) {
    return undefined;
  }

  return {
    baseImponibleGeneral: round2(declaracion.liquidacion?.baseImponibleGeneral ?? 0),
    baseImponibleAhorro: round2(declaracion.liquidacion?.baseImponibleAhorro ?? 0),
    cuotaIntegra: round2(declaracion.liquidacion?.cuotaIntegra ?? 0),
    deducciones: round2(declaracion.liquidacion?.deduccionesDobleImposicion ?? 0),
    retencionesYPagos: round2(declaracion.retenciones?.total ?? 0),
    resultado: round2(declaracion.resultado ?? 0),
  };
}

function toDomain(dbEjercicio?: DbEjercicioFiscal): EjercicioFiscal | undefined {
  if (!dbEjercicio) {
    return undefined;
  }

  return {
    id: dbEjercicio.id,
    ejercicio: dbEjercicio.ejercicio ?? dbEjercicio.año,
    estado: normalizeEstado(dbEjercicio.estado),
    calculoAtlas: dbEjercicio.calculoAtlas,
    calculoAtlasFecha: dbEjercicio.calculoAtlasFecha,
    declaracionAeat: dbEjercicio.declaracionAeat,
    declaracionAeatFecha: dbEjercicio.declaracionAeatFecha,
    declaracionAeatPdfRef: dbEjercicio.declaracionAeatPdfRef,
    declaracionAeatOrigen: normalizeDeclaracionOrigen(dbEjercicio.declaracionAeatOrigen, dbEjercicio),
    arrastresRecibidos: cloneArrastres(dbEjercicio.arrastresRecibidos),
    arrastresGenerados: cloneArrastres(dbEjercicio.arrastresGenerados),
    documentos: cloneDocumentos(dbEjercicio.documentos),
    createdAt: dbEjercicio.createdAt,
    updatedAt: dbEjercicio.updatedAt,
    cerradoAt: dbEjercicio.cerradoAt ?? dbEjercicio.fechaCierre,
    declaradoAt: dbEjercicio.declaradoAt ?? dbEjercicio.fechaDeclaracion,
  };
}

function toDbRecord(ejercicio: EjercicioFiscal, existing?: DbEjercicioFiscal): DbEjercicioFiscal {
  const origen = ejercicio.declaracionAeat
    ? (ejercicio.calculoAtlas ? 'mixto' : 'importado')
    : 'calculado';

  return {
    ...existing,
    id: ejercicio.id ?? existing?.id,
    año: ejercicio.ejercicio,
    ejercicio: ejercicio.ejercicio,
    estado: ejercicio.estado,
    origen,
    fechaCierre: ejercicio.cerradoAt,
    fechaDeclaracion: ejercicio.declaradoAt,
    snapshotId: existing?.snapshotId,
    resultadoEjercicioId: existing?.resultadoEjercicioId,
    calculoAtlas: ejercicio.calculoAtlas,
    calculoAtlasFecha: ejercicio.calculoAtlasFecha,
    declaracionAeat: ejercicio.declaracionAeat,
    declaracionAeatFecha: ejercicio.declaracionAeatFecha,
    declaracionAeatPdfRef: ejercicio.declaracionAeatPdfRef,
    declaracionAeatOrigen: ejercicio.declaracionAeatOrigen,
    arrastresRecibidos: cloneArrastres(ejercicio.arrastresRecibidos),
    arrastresGenerados: cloneArrastres(ejercicio.arrastresGenerados),
    documentos: cloneDocumentos(ejercicio.documentos),
    cerradoAt: ejercicio.cerradoAt,
    declaradoAt: ejercicio.declaradoAt,
    resumen: deriveResumen(ejercicio.declaracionAeat ?? ejercicio.calculoAtlas),
    createdAt: ejercicio.createdAt,
    updatedAt: ejercicio.updatedAt,
  };
}

async function findByEjercicio(ejercicio: number): Promise<DbEjercicioFiscal | undefined> {
  const db = await initDB();

  try {
    const byEjercicio = await db.getAllFromIndex(STORE_NAME, 'ejercicio', ejercicio);
    if (byEjercicio[0]) {
      return byEjercicio[0] as DbEjercicioFiscal;
    }
  } catch {
    // compat with older DBs before index creation
  }

  const legacy = await db.getAllFromIndex(STORE_NAME, 'año', ejercicio);
  return legacy[0] as DbEjercicioFiscal | undefined;
}

function assertEstadoActual(ejercicio: EjercicioFiscal, esperado: EstadoEjercicio, accion: string): void {
  if (ejercicio.estado !== esperado) {
    throw new Error(
      `No se puede ${accion} el ejercicio ${ejercicio.ejercicio} porque está en estado "${ejercicio.estado}" (se requiere "${esperado}").`,
    );
  }
}

function createNewEjercicio(ejercicio: number): EjercicioFiscal {
  const now = new Date().toISOString();
  return {
    ejercicio,
    estado: 'en_curso',
    declaracionAeatOrigen: 'no_presentada',
    arrastresRecibidos: createEmptyArrastresEjercicio(),
    arrastresGenerados: createEmptyArrastresEjercicio(),
    documentos: [],
    createdAt: now,
    updatedAt: now,
  };
}

function buildLegacyView(domain: EjercicioFiscal, existing?: DbEjercicioFiscal): DbEjercicioFiscal {
  return {
    ...(existing ?? {}),
    id: domain.id ?? existing?.id,
    año: domain.ejercicio,
    ejercicio: domain.ejercicio,
    estado: legacyEstado(domain.estado),
    origen: normalizeOrigen(existing),
    fechaCierre: domain.cerradoAt,
    fechaDeclaracion: domain.declaradoAt,
    snapshotId: existing?.snapshotId,
    resultadoEjercicioId: existing?.resultadoEjercicioId,
    resumen: deriveResumen(domain.declaracionAeat ?? domain.calculoAtlas),
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
    calculoAtlas: domain.calculoAtlas,
    calculoAtlasFecha: domain.calculoAtlasFecha,
    declaracionAeat: domain.declaracionAeat,
    declaracionAeatFecha: domain.declaracionAeatFecha,
    declaracionAeatPdfRef: domain.declaracionAeatPdfRef,
    declaracionAeatOrigen: domain.declaracionAeatOrigen,
    arrastresRecibidos: cloneArrastres(domain.arrastresRecibidos),
    arrastresGenerados: cloneArrastres(domain.arrastresGenerados),
    documentos: cloneDocumentos(domain.documentos),
    cerradoAt: domain.cerradoAt,
    declaradoAt: domain.declaradoAt,
  };
}


function hasValidEjercicioId(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id > 0;
}

function stripInvalidEjercicioId<T extends { id?: unknown }>(record: T): T {
  if (record.id == null || hasValidEjercicioId(record.id)) {
    return record;
  }

  const { id: _ignored, ...rest } = record as T & { id?: unknown };
  return rest as T;
}

async function putEjercicioRecord(record: DbEjercicioFiscal): Promise<void> {
  const db = await initDB();
  await db.put(STORE_NAME, stripInvalidEjercicioId(record));
}

class EjercicioFiscalService {
  async getEjercicio(ejercicio: number): Promise<EjercicioFiscal | undefined> {
    validateEjercicio(ejercicio);
    return toDomain(await findByEjercicio(ejercicio));
  }

  async getAll(): Promise<EjercicioFiscal[]> {
    const db = await initDB();
    const ejercicios = (await db.getAll(STORE_NAME)) as DbEjercicioFiscal[];
    return ejercicios
      .map((item) => toDomain(item))
      .filter((item): item is EjercicioFiscal => Boolean(item))
      .sort((a, b) => b.ejercicio - a.ejercicio);
  }

  async save(ejercicio: EjercicioFiscal): Promise<void> {
    validateEjercicio(ejercicio.ejercicio);
    const existing = await findByEjercicio(ejercicio.ejercicio);
    const record = toDbRecord(ejercicio, existing);
    if (hasValidEjercicioId(existing?.id) && !hasValidEjercicioId(record.id)) {
      record.id = existing.id;
    }
    await putEjercicioRecord(record);
  }

  async ensureEjercicio(ejercicio: number): Promise<EjercicioFiscal> {
    validateEjercicio(ejercicio);
    const existing = await this.getEjercicio(ejercicio);
    if (existing) {
      return existing;
    }

    const created = createNewEjercicio(ejercicio);
    await this.save(created);
    return (await this.getEjercicio(ejercicio)) as EjercicioFiscal;
  }

  async getEstado(ejercicio: number): Promise<EstadoEjercicio> {
    const existing = await this.ensureEjercicio(ejercicio);
    return existing.estado;
  }

  async cerrarEjercicio(ejercicio: number): Promise<void> {
    const current = await this.ensureEjercicio(ejercicio);
    assertEstadoActual(current, 'en_curso', 'cerrar');

    const now = new Date().toISOString();
    const calculoAtlas = current.calculoAtlas ?? await calcularDeclaracionIRPF(ejercicio);
    await this.save({
      ...current,
      estado: 'cerrado',
      calculoAtlas,
      calculoAtlasFecha: current.calculoAtlasFecha ?? now,
      cerradoAt: now,
      updatedAt: now,
    });
  }

  async declararEjercicio(
    ejercicio: number,
    datos: DeclaracionIRPF,
    origen: OrigenDeclaracion,
  ): Promise<void> {
    const current = await this.ensureEjercicio(ejercicio);
    if (current.estado === 'declarado') {
      throw new Error(`El ejercicio ${ejercicio} ya está declarado.`);
    }
    if (current.estado !== 'cerrado') {
      throw new Error(`No se puede declarar el ejercicio ${ejercicio} porque está en estado "${current.estado}". Primero debe cerrarse.`);
    }

    const now = new Date().toISOString();
    await this.save({
      ...current,
      estado: 'declarado',
      declaracionAeat: datos,
      declaracionAeatFecha: now,
      declaracionAeatOrigen: origen,
      calculoAtlas: current.calculoAtlas ?? datos,
      calculoAtlasFecha: current.calculoAtlasFecha ?? now,
      declaradoAt: now,
      updatedAt: now,
    });
  }

  async getVerdadVigente(ejercicio: number): Promise<DeclaracionIRPF | undefined> {
    const current = await this.getEjercicio(ejercicio);
    if (!current) {
      return undefined;
    }
    if (current.declaracionAeat) {
      return current.declaracionAeat;
    }
    return current.calculoAtlas;
  }

  async getArrastresParaEjercicio(ejercicio: number): Promise<ArrastresEjercicio> {
    validateEjercicio(ejercicio);
    const anterior = await this.getEjercicio(ejercicio - 1);
    if (!anterior) {
      return createEmptyArrastresEjercicio();
    }

    if (anterior.arrastresGenerados.porAnio.length || anterior.arrastresGenerados.porInmueble.length) {
      return cloneArrastres(anterior.arrastresGenerados);
    }

    if (anterior.arrastresRecibidos.porAnio.length || anterior.arrastresRecibidos.porInmueble.length) {
      return cloneArrastres(anterior.arrastresRecibidos);
    }

    return createEmptyArrastresEjercicio();
  }

  async addDocumento(ejercicio: number, doc: DocumentoFiscal): Promise<void> {
    const current = await this.ensureEjercicio(ejercicio);
    const now = new Date().toISOString();
    const documento: DocumentoFiscal = {
      ...doc,
      id: doc.id ?? `${ejercicio}-${Date.now()}`,
      ejercicio,
      fechaSubida: doc.fechaSubida ?? now,
      estado: doc.estado ?? 'documentado',
    };

    await this.save({
      ...current,
      documentos: [...current.documentos.filter((item) => item.id !== documento.id), documento],
      updatedAt: now,
    });
  }

  async getDocumentos(ejercicio: number): Promise<DocumentoFiscal[]> {
    const current = await this.ensureEjercicio(ejercicio);
    return cloneDocumentos(current.documentos);
  }

  async getCoberturaDocumental(ejercicio: number): Promise<InformeCobertura> {
    const documentos = await this.getDocumentos(ejercicio);
    const byConcept = new Map<string, DocumentoFiscal[]>();

    for (const documento of documentos) {
      const key = documento.conceptoFiscal || 'sin_concepto';
      const current = byConcept.get(key) ?? [];
      current.push(documento);
      byConcept.set(key, current);
    }

    const lineas: InformeCoberturaLinea[] = Array.from(byConcept.entries()).map(([conceptoFiscal, docs]) => {
      const importeDeclarado = round2(docs.reduce((sum, doc) => sum + Number(doc.importeDeclarado ?? doc.importe ?? 0), 0));
      const importeDocumentado = round2(docs.reduce((sum, doc) => sum + Number(doc.importe ?? 0), 0));
      const importePendiente = round2(Math.max(0, importeDeclarado - importeDocumentado));
      const estado: InformeCoberturaLinea['estado'] = importePendiente <= 0
        ? 'completo'
        : importeDocumentado > 0
          ? 'parcial'
          : 'sin_documentar';

      return {
        conceptoFiscal,
        importeDeclarado,
        importeDocumentado,
        importePendiente,
        documentos: docs,
        estado,
      };
    });

    const totalImporteDeclarado = round2(lineas.reduce((sum, linea) => sum + linea.importeDeclarado, 0));
    const totalImporteDocumentado = round2(lineas.reduce((sum, linea) => sum + linea.importeDocumentado, 0));
    const totalImportePendiente = round2(lineas.reduce((sum, linea) => sum + linea.importePendiente, 0));
    const porcentajeCobertura = totalImporteDeclarado > 0
      ? round2((totalImporteDocumentado / totalImporteDeclarado) * 100)
      : (documentos.length > 0 ? 100 : 0);

    const riesgo = totalImportePendiente > 10000
      ? 'alto'
      : totalImportePendiente > 1000
        ? 'medio'
        : 'bajo';

    return {
      ejercicio,
      totalDocumentos: documentos.length,
      totalConceptos: lineas.length,
      totalImporteDeclarado,
      totalImporteDocumentado,
      totalImportePendiente,
      porcentajeCobertura,
      riesgo,
      lineas,
    };
  }
}

export const ejercicioFiscalService = new EjercicioFiscalService();

export async function getEjercicio(año: number): Promise<DbEjercicioFiscal | undefined> {
  validateEjercicio(año);
  const domain = await ejercicioFiscalService.getEjercicio(año);
  const existing = await findByEjercicio(año);
  return domain ? buildLegacyView(domain, existing) : undefined;
}

export async function getOrCreateEjercicio(año: number): Promise<DbEjercicioFiscal> {
  const domain = await ejercicioFiscalService.ensureEjercicio(año);
  const existing = await findByEjercicio(año);
  return buildLegacyView(domain, existing);
}

export async function getAllEjercicios(): Promise<DbEjercicioFiscal[]> {
  const all = await ejercicioFiscalService.getAll();
  return Promise.all(
    all.map(async (ejercicio) => buildLegacyView(ejercicio, await findByEjercicio(ejercicio.ejercicio))),
  );
}

export async function updateResumen(año: number): Promise<DbEjercicioFiscal> {
  const current = await ejercicioFiscalService.ensureEjercicio(año);
  if (current.estado !== 'en_curso') {
    throw new Error(`No se puede actualizar el resumen de el ejercicio ${año} porque está en estado "${current.estado}" (se requiere "en_curso").`);
  }

  const declaracion = await calcularDeclaracionIRPF(año);
  const now = new Date().toISOString();
  await ejercicioFiscalService.save({
    ...current,
    calculoAtlas: declaracion,
    calculoAtlasFecha: now,
    updatedAt: now,
  });

  return (await getEjercicio(año)) as DbEjercicioFiscal;
}

export async function cerrarEjercicio(año: number): Promise<DbEjercicioFiscal> {
  await ejercicioFiscalService.cerrarEjercicio(año);
  return (await getEjercicio(año)) as DbEjercicioFiscal;
}

export async function reabrirEjercicio(año: number): Promise<DbEjercicioFiscal> {
  const current = await ejercicioFiscalService.ensureEjercicio(año);
  if (current.estado !== 'cerrado') {
    throw new Error(`No se puede reabrir el ejercicio ${año} porque está en estado "${current.estado}" (se requiere "cerrado").`);
  }

  const now = new Date().toISOString();
  await ejercicioFiscalService.save({
    ...current,
    estado: 'en_curso',
    cerradoAt: undefined,
    updatedAt: now,
  });

  return (await getEjercicio(año)) as DbEjercicioFiscal;
}

export async function declararEjercicio(año: number): Promise<DbEjercicioFiscal> {
  const current = await ejercicioFiscalService.ensureEjercicio(año);
  const datos = current.calculoAtlas ?? await calcularDeclaracionIRPF(año);
  await ejercicioFiscalService.declararEjercicio(año, datos, 'manual');
  return (await getEjercicio(año)) as DbEjercicioFiscal;
}

export async function updateNotas(año: number, notas: string): Promise<DbEjercicioFiscal> {
  const existing = await findByEjercicio(año);
  if (!existing) {
    throw new Error(`No existe un ejercicio fiscal para el año ${año}. No se pueden actualizar notas de un ejercicio inexistente.`);
  }

  const now = new Date().toISOString();
  await (await initDB()).put(STORE_NAME, {
    ...existing,
    notas,
    updatedAt: now,
  });

  return (await getEjercicio(año)) as DbEjercicioFiscal;
}

export async function deleteEjercicio(año: number): Promise<void> {
  const existing = await findByEjercicio(año);
  if (!existing) {
    return;
  }

  if (normalizeEstado(existing.estado) !== 'en_curso') {
    throw new Error(`No se puede borrar el ejercicio ${año} porque está en estado "${normalizeEstado(existing.estado)}".`);
  }

  if (existing.snapshotId) {
    throw new Error(`No se puede borrar el ejercicio ${año} porque tiene snapshotId asociado (${existing.snapshotId}).`);
  }

  if (existing.id == null) {
    throw new Error(`No se puede borrar el ejercicio ${año} porque no tiene id.`);
  }

  await (await initDB()).delete(STORE_NAME, existing.id);
}

export async function saveLegacyEjercicioRecord(record: DbEjercicioFiscal): Promise<void> {
  await putEjercicioRecord(record);
}
