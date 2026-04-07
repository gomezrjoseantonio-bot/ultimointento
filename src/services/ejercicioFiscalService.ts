import { initDB, type EjercicioFiscal as DbEjercicioFiscal } from './db';
import {
  createEmptyArrastresEjercicio,
  type ArrastreManual,
  type ArrastresEjercicio,
  type ConceptoFiscalVinculable,
  type DeclaracionIRPF,
  type DocumentoFiscal,
  type EjercicioFiscal,
  type EstadoEjercicio,
  type InformeCoberturaDocumental,
  type LineaCoberturaDocumental,
  type OrigenDeclaracion,
} from '../types/fiscal';

const EJERCICIOS_STORE = 'ejerciciosFiscales';
const DOCUMENTOS_STORE = 'documentosFiscales';
const ARRASTRES_MANUAL_STORE = 'arrastresManual';
const FISCAL_MIN_YEAR = 2010;

type LegacyOrigen = 'calculado' | 'importado' | 'mixto';

function nowIso(): string {
  return new Date().toISOString();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function validateEjercicio(ejercicio: number): void {
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(ejercicio) || ejercicio < FISCAL_MIN_YEAR || ejercicio > currentYear + 1) {
    throw new Error(`Año fiscal fuera del rango permitido (${FISCAL_MIN_YEAR} – ${currentYear + 1})`);
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function normalizeArrastres(arrastres?: ArrastresEjercicio): ArrastresEjercicio {
  const gastos0105_0106 = arrastres?.gastos0105_0106 ?? arrastres?.porInmueble ?? [];
  const perdidasPatrimonialesAhorro = arrastres?.perdidasPatrimonialesAhorro ?? arrastres?.porAnio ?? [];
  const amortizacionesAcumuladas = arrastres?.amortizacionesAcumuladas ?? [];

  return {
    gastos0105_0106: clone(gastos0105_0106),
    perdidasPatrimonialesAhorro: clone(perdidasPatrimonialesAhorro),
    amortizacionesAcumuladas: clone(amortizacionesAcumuladas),
    porInmueble: clone(gastos0105_0106),
    porAnio: clone(perdidasPatrimonialesAhorro),
  };
}

function buildLegacyOrigen(ejercicio: EjercicioFiscal): LegacyOrigen {
  if (ejercicio.declaracionAeat) {
    return ejercicio.calculoAtlas ? 'mixto' : 'importado';
  }

  return 'calculado';
}

function resumenDesdeDeclaracion(declaracion?: DeclaracionIRPF): DbEjercicioFiscal['resumen'] | undefined {
  if (!declaracion) {
    return undefined;
  }

  return {
    baseImponibleGeneral: round2(declaracion.basesYCuotas.baseImponibleGeneral ?? 0),
    baseImponibleAhorro: round2(declaracion.basesYCuotas.baseImponibleAhorro ?? 0),
    cuotaIntegra: round2(declaracion.basesYCuotas.cuotaIntegra ?? 0),
    deducciones: round2((declaracion.basesYCuotas.cuotaIntegra ?? 0) - (declaracion.basesYCuotas.cuotaLiquida ?? 0)),
    retencionesYPagos: round2(declaracion.basesYCuotas.retencionesTotal ?? 0),
    resultado: round2(declaracion.basesYCuotas.resultadoDeclaracion ?? 0),
  };
}

function createEmptyEjercicio(ejercicio: number, estado: EstadoEjercicio = 'en_curso'): EjercicioFiscal {
  const now = nowIso();
  return {
    ejercicio,
    estado,
    declaracionAeatOrigen: 'no_presentada',
    arrastresRecibidos: createEmptyArrastresEjercicio(),
    arrastresGenerados: createEmptyArrastresEjercicio(),
    createdAt: now,
    updatedAt: now,
  };
}

function toDomain(record?: DbEjercicioFiscal): EjercicioFiscal | undefined {
  if (!record) {
    return undefined;
  }

  return {
    ejercicio: record.ejercicio ?? record.año ?? 0,
    estado: (() => {
      const st = record.estado;
      // Mapear estados GAP-3 al vocabulario del dominio UI (fiscal.ts)
      if (st === 'vivo' || st === 'pendiente_cierre') return 'en_curso';
      if (st === 'prescrito') return 'declarado';
      return st;
    })() as EstadoEjercicio,
    calculoAtlas: record.calculoAtlas ? clone(record.calculoAtlas) : undefined,
    calculoAtlasFecha: record.calculoAtlasFecha,
    declaracionAeat: record.declaracionAeat ? clone(record.declaracionAeat) : undefined,
    declaracionAeatFecha: record.declaracionAeatFecha,
    declaracionAeatPdfRef: record.declaracionAeatPdfRef,
    declaracionAeatOrigen: record.declaracionAeatOrigen ?? 'no_presentada',
    casillasRaw: record.casillasRaw ? clone(record.casillasRaw) : undefined,
    arrastresRecibidos: normalizeArrastres(record.arrastresRecibidos),
    arrastresGenerados: normalizeArrastres(record.arrastresGenerados),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    cerradoAt: record.cerradoAt ?? record.fechaCierre,
    declaradoAt: record.declaradoAt ?? record.fechaDeclaracion,
  };
}

function toDbRecord(ejercicio: EjercicioFiscal, existing?: DbEjercicioFiscal): DbEjercicioFiscal {
  return {
    ...existing,
    año: ejercicio.ejercicio,
    ejercicio: ejercicio.ejercicio,
    estado: ejercicio.estado,
    origen: buildLegacyOrigen(ejercicio),
    calculoAtlas: ejercicio.calculoAtlas ? clone(ejercicio.calculoAtlas) : undefined,
    calculoAtlasFecha: ejercicio.calculoAtlasFecha,
    declaracionAeat: ejercicio.declaracionAeat ? clone(ejercicio.declaracionAeat) : undefined,
    declaracionAeatFecha: ejercicio.declaracionAeatFecha,
    declaracionAeatPdfRef: ejercicio.declaracionAeatPdfRef,
    declaracionAeatOrigen: ejercicio.declaracionAeatOrigen,
    casillasRaw: ejercicio.casillasRaw ? clone(ejercicio.casillasRaw) : undefined,
    arrastresRecibidos: normalizeArrastres(ejercicio.arrastresRecibidos),
    arrastresGenerados: normalizeArrastres(ejercicio.arrastresGenerados),
    declaracionInmuebles: ejercicio.declaracionAeat?.inmuebles ?? ejercicio.calculoAtlas?.inmuebles,
    fechaCierre: ejercicio.cerradoAt,
    fechaDeclaracion: ejercicio.declaradoAt,
    cerradoAt: ejercicio.cerradoAt,
    declaradoAt: ejercicio.declaradoAt,
    resumen: resumenDesdeDeclaracion(ejercicio.declaracionAeat ?? ejercicio.calculoAtlas),
    createdAt: ejercicio.createdAt,
    updatedAt: ejercicio.updatedAt,
  };
}

async function getDbEjercicio(ejercicio: number): Promise<DbEjercicioFiscal | undefined> {
  const db = await initDB();
  const byKey = await db.get(EJERCICIOS_STORE, ejercicio);
  if (byKey) {
    return byKey as DbEjercicioFiscal;
  }

  try {
    const byIndex = await db.getFromIndex(EJERCICIOS_STORE, 'ejercicio', ejercicio);
    return byIndex as DbEjercicioFiscal | undefined;
  } catch {
    return undefined;
  }
}

function extraerArrastresDeDeclaracion(declaracion: DeclaracionIRPF, ejercicioOrigen: number): ArrastresEjercicio {
  return {
    gastos0105_0106: declaracion.inmuebles
      .filter((inmueble) => inmueble.arrastresGenerados > 0)
      .map((inmueble) => ({
        inmuebleId: inmueble.refCatastralPrincipal,
        referenciaCatastral: inmueble.referenciaCatastral,
        ejercicioOrigen,
        importeOriginal: round2(inmueble.arrastresGenerados),
        importeAplicado: 0,
        importePendiente: round2(inmueble.arrastresGenerados),
        caducaEjercicio: ejercicioOrigen + 4,
      })),
    perdidasPatrimonialesAhorro: (declaracion.gananciasPerdidas.perdidasPendientes ?? [])
      .filter((perdida) => perdida.importePendiente > 0)
      .map((perdida) => ({
        ejercicioOrigen: perdida.ejercicioOrigen,
        importeOriginal: round2(perdida.importeOriginal),
        importeAplicado: round2(perdida.importeAplicado),
        importePendiente: round2(perdida.importePendiente),
        caducaEjercicio: perdida.caducaEjercicio,
        origen: perdida.origen,
      })),
    amortizacionesAcumuladas: declaracion.inmuebles
      .filter((inmueble) => inmueble.amortizacionInmueble > 0)
      .map((inmueble) => ({
        inmuebleId: inmueble.refCatastralPrincipal,
        referenciaCatastral: inmueble.referenciaCatastral,
        amortizacionDeducida: round2(inmueble.amortizacionInmueble),
        amortizacionEstandar: round2(inmueble.baseAmortizacion ?? inmueble.amortizacionInmueble),
        amortizacionAplicada: round2(inmueble.amortizacionInmueble),
        ejercicioDesde: ejercicioOrigen,
        ejercicioHasta: ejercicioOrigen,
      })),
  };
}

function isArrastreManualActivo(arrastre: ArrastreManual, ejercicioDestino: number): boolean {
  if (arrastre.reemplazadoPorImportacion) {
    return false;
  }

  return ejercicioDestino <= arrastre.ejercicioOrigen + 4;
}

async function getArrastresManualesTotales(ejercicioDestino: number): Promise<ArrastresEjercicio> {
  const db = await initDB();
  const all = (await db.getAll(ARRASTRES_MANUAL_STORE)) as ArrastreManual[];
  const activos = all.filter((arrastre) => arrastre.ejercicioOrigen < ejercicioDestino && isArrastreManualActivo(arrastre, ejercicioDestino));

  return {
    gastos0105_0106: activos
      .filter((arrastre) => arrastre.tipo === 'gastos_0105_0106')
      .map((arrastre) => ({
        inmuebleId: arrastre.inmuebleId,
        referenciaCatastral: arrastre.referenciaCatastral ?? 'manual',
        ejercicioOrigen: arrastre.ejercicioOrigen,
        importeOriginal: round2(arrastre.importe),
        importeAplicado: 0,
        importePendiente: round2(arrastre.importe),
        caducaEjercicio: arrastre.ejercicioOrigen + 4,
      })),
    perdidasPatrimonialesAhorro: activos
      .filter((arrastre) => arrastre.tipo === 'perdidas_ahorro' || arrastre.tipo === 'perdidas_general')
      .map((arrastre) => ({
        ejercicioOrigen: arrastre.ejercicioOrigen,
        importeOriginal: round2(arrastre.importe),
        importeAplicado: 0,
        importePendiente: round2(arrastre.importe),
        caducaEjercicio: arrastre.ejercicioOrigen + 4,
        origen: arrastre.tipo,
        detalle: arrastre.detalle,
      })),
    amortizacionesAcumuladas: [],
  };
}

function mergeLine(
  current: LineaCoberturaDocumental | undefined,
  doc: DocumentoFiscal,
): LineaCoberturaDocumental {
  const documentos = [...(current?.documentos ?? []), doc];
  const importeDocumentado = round2((current?.importeDocumentado ?? 0) + Number(doc.importe ?? 0));
  const importeDeclarado = current?.importeDeclarado ?? 0;
  const diferencia = round2(Math.max(0, importeDeclarado - importeDocumentado));

  return {
    concepto: doc.concepto,
    descripcion: current?.descripcion ?? doc.descripcion ?? doc.concepto,
    inmuebleRef: current?.inmuebleRef ?? doc.inmuebleRef,
    importeDeclarado,
    importeDocumentado,
    diferencia,
    estado: diferencia <= 0 ? 'cubierto' : 'parcial',
    documentos,
  };
}

function collectDeclaredConcepts(declaracion?: DeclaracionIRPF): Array<Omit<LineaCoberturaDocumental, 'documentos' | 'estado' | 'importeDocumentado' | 'diferencia'>> {
  if (!declaracion) {
    return [];
  }

  const lineas: Array<Omit<LineaCoberturaDocumental, 'documentos' | 'estado' | 'importeDocumentado' | 'diferencia'>> = [];

  for (const inmueble of declaracion.inmuebles) {
    const inmuebleRef = inmueble.referenciaCatastral;
    const pushIfPositive = (concepto: ConceptoFiscalVinculable, descripcion: string, importe: number) => {
      if (importe > 0) {
        lineas.push({ concepto, descripcion, inmuebleRef, importeDeclarado: round2(importe) });
      }
    };

    pushIfPositive('ingresos_alquiler', 'Ingresos de alquiler', inmueble.ingresosIntegros);
    pushIfPositive('gastos_intereses', 'Intereses de financiación', inmueble.interesesFinanciacion);
    pushIfPositive('gastos_reparacion', 'Gastos de reparación', inmueble.gastosReparacion);
    pushIfPositive('gastos_comunidad', 'Gastos de comunidad', inmueble.gastosComunidad);
    pushIfPositive('gastos_servicios', 'Gastos de servicios', inmueble.gastosServicios);
    pushIfPositive('gastos_suministros', 'Gastos de suministros', inmueble.gastosSuministros);
    pushIfPositive('gastos_seguros', 'Gastos de seguros', inmueble.gastosSeguros);
    pushIfPositive('gastos_tributos', 'Gastos de tributos', inmueble.gastosTributos);
    pushIfPositive('amortizacion_muebles', 'Amortización de muebles', inmueble.amortizacionMuebles);
    pushIfPositive('amortizacion_inmueble', 'Amortización del inmueble', inmueble.amortizacionInmueble);
    pushIfPositive('mejoras', 'Mejoras del inmueble', inmueble.mejoras ?? 0);
    pushIfPositive('gastos_adquisicion', 'Gastos de adquisición', inmueble.gastosAdquisicion ?? 0);
  }

  if (declaracion.trabajo.retribucionesDinerarias > 0) {
    lineas.push({
      concepto: 'retribuciones_trabajo',
      descripcion: 'Retribuciones del trabajo',
      importeDeclarado: round2(declaracion.trabajo.retribucionesDinerarias),
    });
  }

  const ingresosActividad = round2(declaracion.actividades.reduce((sum, item) => sum + item.ingresos, 0));
  if (ingresosActividad > 0) {
    lineas.push({ concepto: 'ingresos_actividad', descripcion: 'Ingresos de actividad', importeDeclarado: ingresosActividad });
  }

  const gastosActividad = round2(declaracion.actividades.reduce((sum, item) => sum + item.gastos, 0));
  if (gastosActividad > 0) {
    lineas.push({ concepto: 'gastos_actividad', descripcion: 'Gastos de actividad', importeDeclarado: gastosActividad });
  }

  if (declaracion.capitalMobiliario.interesesCuentas > 0) {
    lineas.push({
      concepto: 'intereses_cuentas',
      descripcion: 'Intereses de cuentas',
      importeDeclarado: round2(declaracion.capitalMobiliario.interesesCuentas),
    });
  }

  if (declaracion.planPensiones.reduccionAplicada > 0) {
    lineas.push({
      concepto: 'aportaciones_pp',
      descripcion: 'Aportaciones a planes de pensiones',
      importeDeclarado: round2(declaracion.planPensiones.reduccionAplicada),
    });
  }

  return lineas;
}

class EjercicioFiscalService {
  async getEjercicio(ejercicio: number): Promise<EjercicioFiscal | undefined> {
    validateEjercicio(ejercicio);
    return toDomain(await getDbEjercicio(ejercicio));
  }

  async getAllEjercicios(): Promise<EjercicioFiscal[]> {
    const db = await initDB();
    const all = (await db.getAll(EJERCICIOS_STORE)) as DbEjercicioFiscal[];
    return all
      .map((item) => toDomain(item))
      .filter((item): item is EjercicioFiscal => Boolean(item))
      .sort((a, b) => b.ejercicio - a.ejercicio);
  }

  async saveEjercicio(ejercicio: EjercicioFiscal): Promise<void> {
    validateEjercicio(ejercicio.ejercicio);
    const db = await initDB();
    const existing = await getDbEjercicio(ejercicio.ejercicio);
    await db.put(EJERCICIOS_STORE, toDbRecord(ejercicio, existing));
  }

  async getOrCreateEjercicio(ejercicio: number, estadoDefault: EstadoEjercicio = 'en_curso'): Promise<EjercicioFiscal> {
    validateEjercicio(ejercicio);
    const existing = await this.getEjercicio(ejercicio);
    if (existing) {
      return existing;
    }

    const created = createEmptyEjercicio(ejercicio, estadoDefault);
    created.arrastresRecibidos = normalizeArrastres(await this.getArrastresParaEjercicio(ejercicio));
    await this.saveEjercicio(created);
    return created;
  }

  async cerrarEjercicio(ejercicio: number): Promise<EjercicioFiscal> {
    const current = await this.getOrCreateEjercicio(ejercicio);
    if (current.estado !== 'en_curso') {
      return current;
    }

    const updated: EjercicioFiscal = {
      ...current,
      estado: 'cerrado',
      cerradoAt: current.cerradoAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    await this.saveEjercicio(updated);
    return updated;
  }

  async declararEjercicio(
    ejercicio: number,
    datosAeat: DeclaracionIRPF,
    origen: OrigenDeclaracion,
    fechaPresentacion?: string,
    pdfRef?: string,
    casillasRaw?: Record<string, number | string>,
  ): Promise<EjercicioFiscal> {
    const current = await this.getOrCreateEjercicio(ejercicio);
    const fecha = fechaPresentacion ?? nowIso();
    const updated: EjercicioFiscal = {
      ...current,
      estado: 'declarado',
      declaracionAeat: clone(datosAeat),
      declaracionAeatFecha: fecha,
      declaracionAeatPdfRef: pdfRef,
      declaracionAeatOrigen: origen,
      casillasRaw: casillasRaw ? clone(casillasRaw) : current.casillasRaw,
      arrastresGenerados: extraerArrastresDeDeclaracion(datosAeat, ejercicio),
      cerradoAt: current.cerradoAt ?? fecha,
      declaradoAt: fecha,
      updatedAt: nowIso(),
    };

    await this.saveEjercicio(updated);
    await this.marcarArrastresReemplazados(ejercicio);
    return updated;
  }

  async guardarCalculoAtlas(ejercicio: number, calculo: DeclaracionIRPF): Promise<EjercicioFiscal> {
    const current = await this.getOrCreateEjercicio(ejercicio);
    if (current.estado === 'declarado' && current.declaracionAeat) {
      return current;
    }

    const updated: EjercicioFiscal = {
      ...current,
      calculoAtlas: clone(calculo),
      calculoAtlasFecha: nowIso(),
      arrastresGenerados: extraerArrastresDeDeclaracion(calculo, ejercicio),
      updatedAt: nowIso(),
    };
    await this.saveEjercicio(updated);
    return updated;
  }

  async getVerdadVigente(ejercicio: number): Promise<DeclaracionIRPF | undefined> {
    const current = await this.getEjercicio(ejercicio);
    if (!current) {
      return undefined;
    }

    return current.estado === 'declarado' && current.declaracionAeat
      ? clone(current.declaracionAeat)
      : current.calculoAtlas
        ? clone(current.calculoAtlas)
        : undefined;
  }

  async getTresVerdades(ejercicio: number): Promise<{ calculado?: DeclaracionIRPF; declarado?: DeclaracionIRPF; estado: EstadoEjercicio }> {
    const current = await this.getOrCreateEjercicio(ejercicio);
    return {
      calculado: current.calculoAtlas ? clone(current.calculoAtlas) : undefined,
      declarado: current.declaracionAeat ? clone(current.declaracionAeat) : undefined,
      estado: current.estado,
    };
  }

  async getArrastresParaEjercicio(ejercicio: number): Promise<ArrastresEjercicio> {
    validateEjercicio(ejercicio);
    const anterior = await this.getEjercicio(ejercicio - 1);
    if (anterior) {
      if (
        anterior.arrastresGenerados.gastos0105_0106.length
        || anterior.arrastresGenerados.perdidasPatrimonialesAhorro.length
        || anterior.arrastresGenerados.amortizacionesAcumuladas.length
      ) {
        return normalizeArrastres(anterior.arrastresGenerados);
      }

      if (anterior.declaracionAeat) {
        return extraerArrastresDeDeclaracion(anterior.declaracionAeat, ejercicio - 1);
      }

      if (anterior.calculoAtlas) {
        return extraerArrastresDeDeclaracion(anterior.calculoAtlas, ejercicio - 1);
      }
    }

    return normalizeArrastres(await getArrastresManualesTotales(ejercicio));
  }

  async addArrastreManual(arrastre: ArrastreManual): Promise<ArrastreManual> {
    const db = await initDB();
    const stored: ArrastreManual = {
      ...arrastre,
      reemplazadoPorImportacion: arrastre.reemplazadoPorImportacion ?? false,
      createdAt: arrastre.createdAt ?? nowIso(),
    };
    const id = await db.add(ARRASTRES_MANUAL_STORE, stored);
    return { ...stored, id: Number(id) };
  }

  async getArrastresManual(): Promise<ArrastreManual[]> {
    const db = await initDB();
    const all = (await db.getAll(ARRASTRES_MANUAL_STORE)) as ArrastreManual[];
    return all.sort((a, b) => b.ejercicioOrigen - a.ejercicioOrigen).map((item) => clone(item));
  }

  async marcarArrastresReemplazados(ejercicioOrigen: number): Promise<void> {
    const db = await initDB();
    const tx = db.transaction(ARRASTRES_MANUAL_STORE, 'readwrite');
    const store = tx.objectStore(ARRASTRES_MANUAL_STORE);
    const all = (await store.getAll()) as ArrastreManual[];

    await Promise.all(
      all
        .filter((item) => item.ejercicioOrigen === ejercicioOrigen && !item.reemplazadoPorImportacion)
        .map((item) => store.put({ ...item, reemplazadoPorImportacion: true })),
    );

    await tx.done;
  }

  async addDocumentoFiscal(doc: DocumentoFiscal): Promise<DocumentoFiscal> {
    const db = await initDB();
    const stored: DocumentoFiscal = {
      ...doc,
      fechaSubida: doc.fechaSubida ?? nowIso(),
    };
    const id = await db.add(DOCUMENTOS_STORE, stored);
    return { ...stored, id: Number(id) };
  }

  async getDocumentosFiscales(ejercicio: number): Promise<DocumentoFiscal[]> {
    const db = await initDB();
    const docs = (await db.getAllFromIndex(DOCUMENTOS_STORE, 'ejercicio', ejercicio)) as DocumentoFiscal[];
    return docs.sort((a, b) => a.fechaDocumento.localeCompare(b.fechaDocumento)).map((doc) => clone(doc));
  }

  async getDocumentosPorInmueble(ejercicio: number, inmuebleId: string): Promise<DocumentoFiscal[]> {
    const db = await initDB();
    const docs = (await db.getAllFromIndex(DOCUMENTOS_STORE, 'ejercicio-inmuebleId', [ejercicio, inmuebleId])) as DocumentoFiscal[];
    return docs.map((doc) => clone(doc));
  }

  async deleteDocumentoFiscal(id: number): Promise<void> {
    const db = await initDB();
    await db.delete(DOCUMENTOS_STORE, id);
  }

  async getCoberturaDocumental(ejercicio: number): Promise<InformeCoberturaDocumental> {
    const [verdadVigente, documentos] = await Promise.all([
      this.getVerdadVigente(ejercicio),
      this.getDocumentosFiscales(ejercicio),
    ]);

    const lineasMap = new Map<string, LineaCoberturaDocumental>();

    for (const declarada of collectDeclaredConcepts(verdadVigente)) {
      const key = `${declarada.concepto}::${declarada.inmuebleRef ?? 'global'}`;
      lineasMap.set(key, {
        ...declarada,
        importeDocumentado: 0,
        diferencia: round2(declarada.importeDeclarado),
        estado: 'sin_documentar',
        documentos: [],
      });
    }

    for (const documento of documentos) {
      const key = `${documento.concepto}::${documento.inmuebleRef ?? 'global'}`;
      const current = lineasMap.get(key);
      const merged = mergeLine(current, documento);
      if (!current) {
        merged.descripcion = documento.descripcion ?? documento.concepto;
        merged.inmuebleRef = documento.inmuebleRef;
        merged.importeDeclarado = 0;
        merged.diferencia = 0;
        merged.estado = 'cubierto';
      } else if (merged.importeDocumentado <= 0) {
        merged.estado = 'sin_documentar';
      } else if (merged.diferencia > 0) {
        merged.estado = 'parcial';
      } else {
        merged.estado = 'cubierto';
      }
      lineasMap.set(key, merged);
    }

    const lineas = Array.from(lineasMap.values()).sort((a, b) => a.concepto.localeCompare(b.concepto));
    const totalDeclarado = round2(lineas.reduce((sum, item) => sum + item.importeDeclarado, 0));
    const totalDocumentado = round2(lineas.reduce((sum, item) => sum + item.importeDocumentado, 0));
    const riesgoTotal = round2(lineas.reduce((sum, item) => sum + item.diferencia, 0));
    const nivelRiesgo: InformeCoberturaDocumental['nivelRiesgo'] = riesgoTotal > 5000 ? 'alto' : riesgoTotal > 1000 ? 'medio' : 'bajo';

    return {
      ejercicio,
      lineas,
      totalDeclarado,
      totalDocumentado,
      riesgoTotal,
      nivelRiesgo,
    };
  }

  async inicializarEjercicioActual(): Promise<EjercicioFiscal> {
    const currentYear = new Date().getFullYear();
    return this.getOrCreateEjercicio(currentYear, 'en_curso');
  }

  async verificarCierresAutomaticos(): Promise<EjercicioFiscal[]> {
    const currentYear = new Date().getFullYear();
    const ejercicios = await this.getAllEjercicios();
    const actualizados: EjercicioFiscal[] = [];

    for (const ejercicio of ejercicios) {
      if (ejercicio.ejercicio < currentYear && ejercicio.estado === 'en_curso') {
        const actualizado = {
          ...ejercicio,
          estado: 'cerrado' as const,
          cerradoAt: ejercicio.cerradoAt ?? nowIso(),
          updatedAt: nowIso(),
        };
        await this.saveEjercicio(actualizado);
        actualizados.push(actualizado);
      }
    }

    return actualizados;
  }
}

export const ejercicioFiscalService = new EjercicioFiscalService();

function toLegacyView(ejercicio: EjercicioFiscal): DbEjercicioFiscal {
  return toDbRecord(ejercicio);
}

export async function getEjercicio(ejercicio: number): Promise<DbEjercicioFiscal | undefined> {
  const found = await ejercicioFiscalService.getEjercicio(ejercicio);
  return found ? toLegacyView(found) : undefined;
}

export async function saveLegacyEjercicioRecord(record: DbEjercicioFiscal): Promise<DbEjercicioFiscal> {
  const ejercicio = record.ejercicio ?? record.año;
  if (typeof ejercicio !== 'number') {
    throw new Error('El registro legacy debe incluir ejercicio o año.');
  }

  const db = await initDB();
  await db.put(EJERCICIOS_STORE, {
    ...record,
    ejercicio,
    año: record.año ?? ejercicio,
    arrastresRecibidos: normalizeArrastres(record.arrastresRecibidos),
    arrastresGenerados: normalizeArrastres(record.arrastresGenerados),
  });

  return (await getEjercicio(ejercicio)) as DbEjercicioFiscal;
}

export async function getAllEjercicios(): Promise<EjercicioFiscal[]> {
  return ejercicioFiscalService.getAllEjercicios();
}

export async function saveEjercicio(ejercicio: EjercicioFiscal): Promise<void> {
  await ejercicioFiscalService.saveEjercicio(ejercicio);
}

export async function getOrCreateEjercicio(ejercicio: number, estadoDefault: EstadoEjercicio = 'en_curso'): Promise<DbEjercicioFiscal> {
  return toLegacyView(await ejercicioFiscalService.getOrCreateEjercicio(ejercicio, estadoDefault));
}

export async function cerrarEjercicio(ejercicio: number): Promise<DbEjercicioFiscal> {
  return toLegacyView(await ejercicioFiscalService.cerrarEjercicio(ejercicio));
}

export async function declararEjercicio(
  ejercicio: number,
  datosAeat?: DeclaracionIRPF,
  origen: OrigenDeclaracion = 'manual',
  fechaPresentacion?: string,
  pdfRef?: string,
  casillasRaw?: Record<string, number | string>,
): Promise<DbEjercicioFiscal> {
  const datos = datosAeat ?? (await ejercicioFiscalService.getVerdadVigente(ejercicio)) ?? createEmptyDeclaracion();
  return toLegacyView(await ejercicioFiscalService.declararEjercicio(ejercicio, datos, origen, fechaPresentacion, pdfRef, casillasRaw));
}

export async function guardarCalculoAtlas(ejercicio: number, calculo: DeclaracionIRPF): Promise<EjercicioFiscal> {
  return ejercicioFiscalService.guardarCalculoAtlas(ejercicio, calculo);
}

export async function addArrastreManual(arrastre: ArrastreManual): Promise<ArrastreManual> {
  return ejercicioFiscalService.addArrastreManual(arrastre);
}

export async function getArrastresManual(): Promise<ArrastreManual[]> {
  return ejercicioFiscalService.getArrastresManual();
}

export async function marcarArrastresReemplazados(ejercicioOrigen: number): Promise<void> {
  await ejercicioFiscalService.marcarArrastresReemplazados(ejercicioOrigen);
}

export async function addDocumentoFiscal(doc: DocumentoFiscal): Promise<DocumentoFiscal> {
  return ejercicioFiscalService.addDocumentoFiscal(doc);
}

export async function getDocumentosFiscales(ejercicio: number): Promise<DocumentoFiscal[]> {
  return ejercicioFiscalService.getDocumentosFiscales(ejercicio);
}

export async function getDocumentosPorInmueble(ejercicio: number, inmuebleId: string): Promise<DocumentoFiscal[]> {
  return ejercicioFiscalService.getDocumentosPorInmueble(ejercicio, inmuebleId);
}

export async function deleteDocumentoFiscal(id: number): Promise<void> {
  await ejercicioFiscalService.deleteDocumentoFiscal(id);
}

export async function getCoberturaDocumental(ejercicio: number): Promise<InformeCoberturaDocumental> {
  return ejercicioFiscalService.getCoberturaDocumental(ejercicio);
}

export async function inicializarEjercicioActual(): Promise<EjercicioFiscal> {
  return ejercicioFiscalService.inicializarEjercicioActual();
}

export async function verificarCierresAutomaticos(): Promise<EjercicioFiscal[]> {
  return ejercicioFiscalService.verificarCierresAutomaticos();
}

function createEmptyDeclaracion(): DeclaracionIRPF {
  return {
    trabajo: {
      retribucionesDinerarias: 0,
      retribucionEspecie: 0,
      ingresosACuenta: 0,
      contribucionesPPEmpresa: 0,
      totalIngresosIntegros: 0,
      cotizacionSS: 0,
      rendimientoNetoPrevio: 0,
      otrosGastosDeducibles: 0,
      rendimientoNeto: 0,
      rendimientoNetoReducido: 0,
      retencionesTrabajoTotal: 0,
    },
    inmuebles: [],
    actividades: [],
    capitalMobiliario: {
      interesesCuentas: 0,
      otrosRendimientos: 0,
      totalIngresosIntegros: 0,
      rendimientoNeto: 0,
      rendimientoNetoReducido: 0,
      retencionesCapital: 0,
    },
    gananciasPerdidas: {
      gananciasNoTransmision: 0,
      perdidasNoTransmision: 0,
      saldoNetoGeneral: 0,
      gananciasTransmision: 0,
      perdidasTransmision: 0,
      saldoNetoAhorro: 0,
      compensacionPerdidasAnteriores: 0,
      perdidasPendientes: [],
    },
    planPensiones: {
      aportacionesTrabajador: 0,
      contribucionesEmpresariales: 0,
      totalConDerecho: 0,
      reduccionAplicada: 0,
    },
    basesYCuotas: {
      baseImponibleGeneral: 0,
      baseImponibleAhorro: 0,
      baseLiquidableGeneral: 0,
      baseLiquidableAhorro: 0,
      cuotaIntegraEstatal: 0,
      cuotaIntegraAutonomica: 0,
      cuotaIntegra: 0,
      cuotaLiquidaEstatal: 0,
      cuotaLiquidaAutonomica: 0,
      cuotaLiquida: 0,
      cuotaResultante: 0,
      retencionesTotal: 0,
      cuotaDiferencial: 0,
      resultadoDeclaracion: 0,
    },
  };
}

export { createEmptyDeclaracion, extraerArrastresDeDeclaracion, getArrastresManualesTotales };
