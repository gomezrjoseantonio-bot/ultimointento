import {
  ArrastreIRPF,
  EjercicioFiscal,
  OrigenEjercicio,
  PerdidaPatrimonialAhorro,
  Property,
  ResultadoEjercicio,
  SnapshotDeclaracion,
  TipoArrastre,
  initDB,
} from './db';
import { calcularDeclaracionIRPF } from './irpfCalculationService';
import { crearSnapshotDeclaracion, crearSnapshotDeclaracionManual } from './snapshotDeclaracionService';
import { getOrCreateEjercicio, saveLegacyEjercicioRecord } from './ejercicioFiscalService';
import { crearArrastreFiscal } from './arrastresFiscalesService';
import type { DatosActivosExtraidos, InmuebleParsedFromPDF } from './declaracionFromCasillasService';

const EJERCICIOS_STORE = 'ejerciciosFiscales';
const RESULTADOS_STORE = 'resultadosEjercicio';
const ARRASTRES_STORE = 'arrastresIRPF';

type DeclaracionIRPF = Awaited<ReturnType<typeof calcularDeclaracionIRPF>>;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeRefCatastral(value?: string): string | undefined {
  return value?.replace(/\s+/g, '').trim() || undefined;
}

function resolveArrastreTipo(tipo: 'gastos_0105_0106' | 'perdidas_patrimoniales_ahorro' | TipoArrastre): TipoArrastre {
  if (tipo === 'gastos_0105_0106') {
    return 'exceso_gastos_0105_0106';
  }
  return tipo;
}

async function getArrastresMetadata(ejercicio: number): Promise<ResultadoEjercicio['arrastres']> {
  const db = await initDB();
  const all = (await db.getAll(ARRASTRES_STORE)) as ArrastreIRPF[];

  return {
    generados: all
      .filter((x) => x.ejercicioOrigen === ejercicio)
      .map((x) => ({
        arrastreId: x.id,
        tipo: x.tipo,
        importe: x.importeOriginal,
        ejercicioCaducidad: x.ejercicioCaducidad,
      })),
    aplicados: all
      .filter((x) => x.aplicaciones.some((a) => a.ejercicio === ejercicio))
      .flatMap((x) =>
        x.aplicaciones
          .filter((a) => a.ejercicio === ejercicio)
          .map((a) => ({
            arrastreId: x.id,
            tipo: x.tipo,
            importe: a.importe,
            ejercicioOrigen: x.ejercicioOrigen,
          })),
      ),
  };
}

function buildResultadoFromDeclaracion(
  ejercicio: number,
  declaracion: DeclaracionIRPF,
  arrastres: ResultadoEjercicio['arrastres'],
  origen: ResultadoEjercicio['origen'],
  estadoEjercicio: EjercicioFiscal['estado'],
  origenDatos: OrigenEjercicio,
  validadoContraDatosReales: boolean,
  notasRevision?: string,
): ResultadoEjercicio {
  const now = new Date().toISOString();

  const ingresosTrabajo = Number(declaracion?.baseGeneral?.rendimientosTrabajo?.salarioBrutoAnual ?? 0)
    + Number(declaracion?.baseGeneral?.rendimientosTrabajo?.especieAnual ?? 0);
  const ingresosAutonomo = Number(declaracion?.baseGeneral?.rendimientosAutonomo?.ingresos ?? 0);
  const ingresosInmuebles = (declaracion?.baseGeneral?.rendimientosInmuebles ?? []).reduce(
    (sum, inmueble) => sum + Number(inmueble?.ingresosIntegros ?? 0),
    0,
  );
  const ingresosAhorro = Number(declaracion?.baseAhorro?.capitalMobiliario?.total ?? 0)
    + Number(declaracion?.baseAhorro?.gananciasYPerdidas?.plusvalias ?? 0);

  const gastosAutonomo = Number(declaracion?.baseGeneral?.rendimientosAutonomo?.gastos ?? 0)
    + Number(declaracion?.baseGeneral?.rendimientosAutonomo?.cuotaSS ?? 0);
  const gastosInmuebles = (declaracion?.baseGeneral?.rendimientosInmuebles ?? []).reduce(
    (sum, inmueble) => sum + Number(inmueble?.gastosDeducibles ?? 0),
    0,
  );

  const amortizacion = (declaracion?.baseGeneral?.rendimientosInmuebles ?? []).reduce(
    (sum, inmueble) => sum + Number(inmueble?.amortizacion ?? 0),
    0,
  );

  const ingresos = ingresosTrabajo + ingresosAutonomo + ingresosInmuebles + ingresosAhorro;
  const gastos = gastosAutonomo + gastosInmuebles;

  return {
    ejercicio,
    origen,
    estadoEjercicio,
    fechaGeneracion: now,
    resumen: {
      ingresosIntegros: round2(ingresos),
      gastosDeducibles: round2(gastos),
      amortizacion: round2(amortizacion),
      reducciones: round2(declaracion?.reducciones?.total ?? 0),
      baseImponibleGeneral: round2(declaracion?.liquidacion?.baseImponibleGeneral ?? 0),
      baseImponibleAhorro: round2(declaracion?.liquidacion?.baseImponibleAhorro ?? 0),
      cuotaIntegra: round2(declaracion?.liquidacion?.cuotaIntegra ?? 0),
      cuotaLiquida: round2(declaracion?.liquidacion?.cuotaLiquida ?? 0),
      deducciones: round2(declaracion?.liquidacion?.deduccionesDobleImposicion ?? 0),
      retencionesYPagosCuenta: round2(declaracion?.retenciones?.total ?? 0),
      resultado: round2(declaracion?.resultado ?? 0),
      tipoEfectivo: round2(declaracion?.tipoEfectivo ?? 0),
    },
    moneda: 'EUR',
    arrastres,
    metadatos: {
      validadoContraDatosReales,
      notasRevision,
      origenDatos,
      generadoPor: 'sistema',
    },
    createdAt: now,
    updatedAt: now,
  };
}

async function saveResultado(resultado: ResultadoEjercicio): Promise<ResultadoEjercicio> {
  const db = await initDB();
  const id = await db.add(RESULTADOS_STORE, resultado);
  return { ...resultado, id: typeof id === 'number' ? id : undefined };
}

async function findPropertyByRefCatastral(refCatastral: string): Promise<Property | undefined> {
  const normalizedRef = normalizeRefCatastral(refCatastral);
  if (!normalizedRef) return undefined;

  const db = await initDB();
  const properties = (await db.getAll('properties')) as Property[];

  return properties.find((property) => {
    const candidates = [
      property.cadastralReference,
      (property as unknown as { refCatastral?: string }).refCatastral,
      property.fiscalData?.accessoryData?.cadastralReference,
    ].map(normalizeRefCatastral);

    return candidates.includes(normalizedRef);
  });
}

async function crearArrastreSiNoExiste(input: {
  ejercicioOrigen: number;
  tipo: TipoArrastre;
  importe: number;
  ejercicioCaducidad?: number;
  inmuebleId?: number;
}): Promise<ArrastreIRPF> {
  const db = await initDB();
  const candidatos = (await db.getAllFromIndex('arrastresIRPF', 'ejercicioOrigen', input.ejercicioOrigen)) as ArrastreIRPF[];
  const existente = candidatos.find((arrastre) =>
    arrastre.tipo === input.tipo
    && round2(arrastre.importeOriginal) === round2(input.importe)
    && (arrastre.ejercicioCaducidad ?? null) === (input.ejercicioCaducidad ?? null)
    && (arrastre.inmuebleId ?? null) === (input.inmuebleId ?? null),
  );

  if (existente) {
    return existente;
  }

  return crearArrastreFiscal(input);
}

async function crearPerdidaPatrimonialSiNoExiste(input: {
  ejercicioOrigen: number;
  importePendiente: number;
}): Promise<void> {
  const db = await initDB();
  const existentes = (await db.getAllFromIndex(
    'perdidasPatrimonialesAhorro',
    'ejercicioOrigen',
    input.ejercicioOrigen,
  )) as PerdidaPatrimonialAhorro[];

  const yaExiste = existentes.some((item) => round2(item.importePendiente) === round2(input.importePendiente));
  if (yaExiste) {
    return;
  }

  const now = new Date().toISOString();
  await db.add('perdidasPatrimonialesAhorro', {
    ejercicioOrigen: input.ejercicioOrigen,
    ejercicioCaducidad: input.ejercicioOrigen + 4,
    importeOriginal: input.importePendiente,
    importeAplicado: 0,
    importePendiente: input.importePendiente,
    tipoOrigen: 'importado',
    estado: 'pendiente',
    aplicaciones: [],
    createdAt: now,
    updatedAt: now,
  } as PerdidaPatrimonialAhorro);
}

async function procesarDatosActivos(
  ejercicio: number,
  datos: DatosActivosExtraidos,
  arrastresExistentes: ArrastreIRPF[] = [],
): Promise<number[]> {
  const db = await initDB();
  const generatedIds: number[] = arrastresExistentes
    .map((arrastre) => arrastre.id)
    .filter((id): id is number => typeof id === 'number');

  for (const arrastre of datos.arrastresGastos) {
    const property = await findPropertyByRefCatastral(arrastre.inmuebleRefCatastral);
    const existente = arrastresExistentes.find((item) =>
      item.tipo === 'exceso_gastos_0105_0106'
      && round2(item.importeOriginal) === round2(arrastre.importeArrastrable)
      && item.inmuebleId === property?.id,
    );

    const record = existente ?? await crearArrastreSiNoExiste({
      ejercicioOrigen: arrastre.ejercicioOrigen,
      tipo: 'exceso_gastos_0105_0106',
      importe: arrastre.importeArrastrable,
      ejercicioCaducidad: arrastre.ejercicioOrigen + 4,
      inmuebleId: property?.id,
    });

    if (typeof record.id === 'number' && !generatedIds.includes(record.id)) {
      generatedIds.push(record.id);
    }
  }

  for (const perdida of datos.perdidasPendientes) {
    await crearPerdidaPatrimonialSiNoExiste({
      ejercicioOrigen: perdida.ejercicioOrigen,
      importePendiente: perdida.importePendiente,
    });
  }

  const properties = (await db.getAll('properties')) as Property[];
  for (const inmueble of datos.inmueblesDatos) {
    const normalizedRef = normalizeRefCatastral(inmueble.refCatastral);
    if (!normalizedRef) continue;

    const property = properties.find((item) => {
      const candidates = [
        item.cadastralReference,
        (item as unknown as { refCatastral?: string }).refCatastral,
        item.fiscalData?.accessoryData?.cadastralReference,
      ].map(normalizeRefCatastral);
      return candidates.includes(normalizedRef);
    });

    if (!property) continue;

    const fiscalData = property.fiscalData ?? {};
    const aeatAmortization = property.aeatAmortization ?? {
      acquisitionType: 'onerosa' as const,
      firstAcquisitionDate: property.purchaseDate,
      cadastralValue: 0,
      constructionCadastralValue: 0,
      constructionPercentage: 0,
    };

    const updatesNeeded = !fiscalData.cadastralValue || !fiscalData.constructionCadastralValue || !fiscalData.constructionPercentage;
    const amortizationNeedsUpdate = !aeatAmortization.cadastralValue || !aeatAmortization.constructionCadastralValue || !aeatAmortization.constructionPercentage;

    if (!updatesNeeded && !amortizationNeedsUpdate) {
      continue;
    }

    await db.put('properties', {
      ...property,
      fiscalData: {
        ...fiscalData,
        cadastralValue: fiscalData.cadastralValue || inmueble.valorCatastral || undefined,
        constructionCadastralValue: fiscalData.constructionCadastralValue || inmueble.valorCatastralConstruccion || undefined,
        constructionPercentage: fiscalData.constructionPercentage || inmueble.porcentajeConstruccion || undefined,
      },
      aeatAmortization: {
        ...aeatAmortization,
        cadastralValue: aeatAmortization.cadastralValue || inmueble.valorCatastral || 0,
        constructionCadastralValue: aeatAmortization.constructionCadastralValue || inmueble.valorCatastralConstruccion || 0,
        constructionPercentage: aeatAmortization.constructionPercentage || inmueble.porcentajeConstruccion || 0,
        onerosoAcquisition: {
          acquisitionAmount: aeatAmortization.onerosoAcquisition?.acquisitionAmount || inmueble.importeAdquisicion || 0,
          acquisitionExpenses: aeatAmortization.onerosoAcquisition?.acquisitionExpenses || inmueble.gastosAdquisicion || 0,
        },
      },
      updatedAt: new Date().toISOString(),
    } as Property);
  }

  return generatedIds.sort((a, b) => a - b);
}

export async function cerrarEjercicioConWorkflow(input: {
  año: number;
  validarContraDatosReales: boolean;
  notasRevision?: string;
}): Promise<{ ejercicio: EjercicioFiscal; resultado: ResultadoEjercicio; snapshot: SnapshotDeclaracion }> {
  const ejercicio = await getOrCreateEjercicio(input.año);
  if (ejercicio.estado !== 'vivo') {
    throw new Error(`El ejercicio ${input.año} no está vivo y no se puede cerrar.`);
  }

  const declaracion = await calcularDeclaracionIRPF(input.año, { usarConciliacion: true });
  const arrastres = await getArrastresMetadata(input.año);
  const snapshot = await crearSnapshotDeclaracion(input.año, {
    origen: 'cierre_automatico',
    incluirCasillasAEAT: true,
    force: true,
  });

  const resultado = await saveResultado(
    buildResultadoFromDeclaracion(
      input.año,
      declaracion,
      arrastres,
      'cierre',
      'cerrado',
      ejercicio.origen,
      input.validarContraDatosReales,
      input.notasRevision,
    ),
  );

  const now = new Date().toISOString();
  const updatedEjercicio: EjercicioFiscal = {
    ...ejercicio,
    estado: 'cerrado',
    fechaRevisionFinal: now,
    fechaCierre: now,
    snapshotId: snapshot.id,
    resultadoEjercicioId: resultado.id,
    resumen: {
      baseImponibleGeneral: resultado.resumen.baseImponibleGeneral,
      baseImponibleAhorro: resultado.resumen.baseImponibleAhorro,
      cuotaIntegra: resultado.resumen.cuotaIntegra,
      deducciones: resultado.resumen.deducciones,
      retencionesYPagos: resultado.resumen.retencionesYPagosCuenta,
      resultado: resultado.resumen.resultado,
    },
    updatedAt: now,
  };

  await saveLegacyEjercicioRecord(updatedEjercicio);

  return { ejercicio: updatedEjercicio, resultado, snapshot };
}

export async function importarDeclaracionManual(input: {
  ejercicio: number;
  casillasAEAT: Record<string, number>;
  resultado: {
    baseImponibleGeneral: number;
    baseImponibleAhorro: number;
    cuotaIntegra: number;
    cuotaLiquida: number;
    deducciones: number;
    retencionesYPagosCuenta: number;
    resultado: number;
    tipoEfectivo?: number;
  };
  arrastresPendientes?: Array<{
    tipo: TipoArrastre | 'gastos_0105_0106' | 'perdidas_patrimoniales_ahorro';
    importePendiente: number;
    ejercicioOrigen?: number;
    ejercicioCaducidad?: number;
    inmuebleId?: number;
  }>;
  notasRevision?: string;
  declaracionCompleta?: DeclaracionIRPF;
  datosActivos?: DatosActivosExtraidos;
  inmueblesParsed?: InmuebleParsedFromPDF[];
}): Promise<{ ejercicio: EjercicioFiscal; resultado: ResultadoEjercicio }> {
  const ejercicio = await getOrCreateEjercicio(input.ejercicio);
  const now = new Date().toISOString();

  const manualArrastres = input.arrastresPendientes ?? [];
  const createdArrastres: ArrastreIRPF[] = [];

  for (const arrastre of manualArrastres) {
    if (arrastre.tipo === 'perdidas_patrimoniales_ahorro') {
      await crearPerdidaPatrimonialSiNoExiste({
        ejercicioOrigen: arrastre.ejercicioOrigen ?? input.ejercicio,
        importePendiente: arrastre.importePendiente,
      });
      continue;
    }

    const created = await crearArrastreSiNoExiste({
      ejercicioOrigen: arrastre.ejercicioOrigen ?? input.ejercicio,
      tipo: resolveArrastreTipo(arrastre.tipo),
      importe: arrastre.importePendiente,
      ejercicioCaducidad: arrastre.ejercicioCaducidad,
      inmuebleId: arrastre.inmuebleId,
    });
    createdArrastres.push(created);
  }

  const datosActivosArrastresIds = input.datosActivos
    ? await procesarDatosActivos(input.ejercicio, input.datosActivos, createdArrastres)
    : createdArrastres
      .map((arrastre) => arrastre.id)
      .filter((id): id is number => typeof id === 'number');

  const arrastres = await getArrastresMetadata(input.ejercicio);
  const declaracion = input.declaracionCompleta;

  const resultado = declaracion
    ? await saveResultado({
        ...buildResultadoFromDeclaracion(
          input.ejercicio,
          declaracion,
          arrastres,
          ejercicio.origen === 'calculado' ? 'importacion_manual' : 'mixto',
          'declarado',
          ejercicio.origen === 'calculado' ? 'importado' : 'mixto',
          true,
          input.notasRevision,
        ),
        fechaCierre: now,
        fechaPresentacion: now,
      })
    : await saveResultado({
        ejercicio: input.ejercicio,
        origen: ejercicio.origen === 'calculado' ? 'importacion_manual' : 'mixto',
        estadoEjercicio: 'declarado',
        fechaGeneracion: now,
        fechaCierre: now,
        fechaPresentacion: now,
        moneda: 'EUR',
        resumen: {
          ingresosIntegros: 0,
          gastosDeducibles: 0,
          amortizacion: 0,
          reducciones: 0,
          baseImponibleGeneral: round2(input.resultado.baseImponibleGeneral),
          baseImponibleAhorro: round2(input.resultado.baseImponibleAhorro),
          cuotaIntegra: round2(input.resultado.cuotaIntegra),
          cuotaLiquida: round2(input.resultado.cuotaLiquida),
          deducciones: round2(input.resultado.deducciones),
          retencionesYPagosCuenta: round2(input.resultado.retencionesYPagosCuenta),
          resultado: round2(input.resultado.resultado),
          tipoEfectivo: round2(input.resultado.tipoEfectivo ?? 0),
        },
        arrastres,
        casillasAEAT: input.casillasAEAT,
        metadatos: {
          validadoContraDatosReales: true,
          notasRevision: input.notasRevision,
          origenDatos: ejercicio.origen === 'calculado' ? 'importado' : 'mixto',
          generadoPor: 'usuario',
        },
        createdAt: now,
        updatedAt: now,
      });

  const snapshot = await crearSnapshotDeclaracionManual(input.ejercicio, {
    casillasAEAT: input.casillasAEAT,
    datos: {
      baseGeneral: declaracion?.baseGeneral,
      baseAhorro: declaracion?.baseAhorro,
      reducciones: declaracion?.reducciones,
      minimosPersonales: declaracion?.minimoPersonal,
      liquidacion: declaracion?.liquidacion,
      declaracionCompleta: declaracion,
    },
    arrastresGeneradosIds: datosActivosArrastresIds,
  });

  const updatedEjercicio: EjercicioFiscal = {
    ...ejercicio,
    estado: 'declarado',
    origen: ejercicio.origen === 'calculado' ? 'importado' : 'mixto',
    fechaRevisionFinal: now,
    fechaCierre: ejercicio.fechaCierre ?? now,
    fechaDeclaracion: now,
    snapshotId: snapshot.id,
    resultadoEjercicioId: resultado.id,
    resumen: {
      baseImponibleGeneral: resultado.resumen.baseImponibleGeneral,
      baseImponibleAhorro: resultado.resumen.baseImponibleAhorro,
      cuotaIntegra: resultado.resumen.cuotaIntegra,
      deducciones: resultado.resumen.deducciones,
      retencionesYPagos: resultado.resumen.retencionesYPagosCuenta,
      resultado: resultado.resumen.resultado,
    },
    updatedAt: now,
  };

  await saveLegacyEjercicioRecord(updatedEjercicio);

  return { ejercicio: updatedEjercicio, resultado };
}

export async function obtenerHistoricoFiscalReal(): Promise<Array<{ ejercicio: number; estado: EjercicioFiscal['estado']; origen: OrigenEjercicio; fechaCierre?: string; fechaDeclaracion?: string; resultado: ResultadoEjercicio['resumen']; resultadoEjercicioId?: number }>> {
  const db = await initDB();
  const ejercicios = (await db.getAll(EJERCICIOS_STORE)) as EjercicioFiscal[];

  const filtered = ejercicios
    .filter((e) => e.estado === 'cerrado' || e.estado === 'declarado' || e.origen === 'importado' || e.origen === 'mixto')
    .sort((a, b) => b.año - a.año);

  const rows = await Promise.all(
    filtered.map(async (ejercicio) => {
      const resultado = ejercicio.resultadoEjercicioId
        ? ((await db.get(RESULTADOS_STORE, ejercicio.resultadoEjercicioId)) as ResultadoEjercicio | undefined)
        : undefined;

      return {
        ejercicio: ejercicio.año,
        estado: ejercicio.estado,
        origen: ejercicio.origen,
        fechaCierre: ejercicio.fechaCierre,
        fechaDeclaracion: ejercicio.fechaDeclaracion,
        resultado: resultado?.resumen ?? {
          ingresosIntegros: 0,
          gastosDeducibles: 0,
          amortizacion: 0,
          reducciones: 0,
          baseImponibleGeneral: ejercicio.resumen?.baseImponibleGeneral ?? 0,
          baseImponibleAhorro: ejercicio.resumen?.baseImponibleAhorro ?? 0,
          cuotaIntegra: ejercicio.resumen?.cuotaIntegra ?? 0,
          cuotaLiquida: 0,
          deducciones: ejercicio.resumen?.deducciones ?? 0,
          retencionesYPagosCuenta: ejercicio.resumen?.retencionesYPagos ?? 0,
          resultado: ejercicio.resumen?.resultado ?? 0,
          tipoEfectivo: 0,
        },
        resultadoEjercicioId: ejercicio.resultadoEjercicioId,
      };
    }),
  );

  return rows;
}
