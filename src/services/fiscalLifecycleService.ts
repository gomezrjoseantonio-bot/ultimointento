import {
  ArrastreIRPF,
  EjercicioFiscal,
  OrigenEjercicio,
  ResultadoEjercicio,
  SnapshotDeclaracion,
  TipoArrastre,
  initDB,
} from './db';
import { calcularDeclaracionIRPF } from './irpfCalculationService';
import { crearSnapshotDeclaracion } from './snapshotDeclaracionService';
import { getOrCreateEjercicio } from './ejercicioFiscalService';
import { crearArrastreFiscal } from './arrastresFiscalesService';

const EJERCICIOS_STORE = 'ejerciciosFiscales';
const RESULTADOS_STORE = 'resultadosEjercicio';
const ARRASTRES_STORE = 'arrastresIRPF';

type DeclaracionIRPF = Awaited<ReturnType<typeof calcularDeclaracionIRPF>>;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
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
          }))
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
  notasRevision?: string
): ResultadoEjercicio {
  const now = new Date().toISOString();

  const ingresosTrabajo = Number(declaracion?.baseGeneral?.rendimientosTrabajo?.salarioBrutoAnual ?? 0)
    + Number(declaracion?.baseGeneral?.rendimientosTrabajo?.especieAnual ?? 0);
  const ingresosAutonomo = Number(declaracion?.baseGeneral?.rendimientosAutonomo?.ingresos ?? 0);
  const ingresosInmuebles = (declaracion?.baseGeneral?.rendimientosInmuebles ?? []).reduce(
    (sum, inmueble) => sum + Number(inmueble?.ingresosIntegros ?? 0),
    0
  );
  const ingresosAhorro = Number(declaracion?.baseAhorro?.capitalMobiliario?.total ?? 0)
    + Number(declaracion?.baseAhorro?.gananciasYPerdidas?.plusvalias ?? 0);

  const gastosAutonomo = Number(declaracion?.baseGeneral?.rendimientosAutonomo?.gastos ?? 0)
    + Number(declaracion?.baseGeneral?.rendimientosAutonomo?.cuotaSS ?? 0);
  const gastosInmuebles = (declaracion?.baseGeneral?.rendimientosInmuebles ?? []).reduce(
    (sum, inmueble) => sum + Number(inmueble?.gastosDeducibles ?? 0),
    0
  );

  const amortizacion = (declaracion?.baseGeneral?.rendimientosInmuebles ?? []).reduce(
    (sum, inmueble) => sum + Number(inmueble?.amortizacion ?? 0),
    0
  );

  const ingresos = ingresosTrabajo + ingresosAutonomo + ingresosInmuebles + ingresosAhorro;
  const gastos = gastosAutonomo + gastosInmuebles;

  return {
    ejercicio,
    origen,
    estadoEjercicio,
    fechaGeneracion: now,
    moneda: 'EUR',
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
  const snapshot = await crearSnapshotDeclaracion(input.año, { origen: 'cierre_automatico', incluirCasillasAEAT: true, force: true });

  const resultado = await saveResultado(
    buildResultadoFromDeclaracion(
      input.año,
      declaracion,
      arrastres,
      'cierre',
      'cerrado',
      ejercicio.origen,
      input.validarContraDatosReales,
      input.notasRevision
    )
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

  const db = await initDB();
  await db.put(EJERCICIOS_STORE, updatedEjercicio);

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
  arrastresPendientes?: Array<{ tipo: TipoArrastre; importePendiente: number; ejercicioOrigen?: number; ejercicioCaducidad?: number; inmuebleId?: number }>;
  notasRevision?: string;
}): Promise<{ ejercicio: EjercicioFiscal; resultado: ResultadoEjercicio }> {
  const ejercicio = await getOrCreateEjercicio(input.ejercicio);
  const now = new Date().toISOString();

  const createdArrastres: ResultadoEjercicio['arrastres']['generados'] = [];
  for (const arrastre of input.arrastresPendientes ?? []) {
    const created = await crearArrastreFiscal({
      ejercicioOrigen: arrastre.ejercicioOrigen ?? input.ejercicio,
      tipo: arrastre.tipo,
      importe: arrastre.importePendiente,
      ejercicioCaducidad: arrastre.ejercicioCaducidad,
      inmuebleId: arrastre.inmuebleId,
    });
    createdArrastres.push({
      arrastreId: created.id,
      tipo: created.tipo,
      importe: created.importeOriginal,
      ejercicioCaducidad: created.ejercicioCaducidad,
    });
  }

  const resultado: ResultadoEjercicio = await saveResultado({
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
    arrastres: {
      generados: createdArrastres,
      aplicados: [],
    },
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

  const updatedEjercicio: EjercicioFiscal = {
    ...ejercicio,
    estado: 'declarado',
    origen: ejercicio.origen === 'calculado' ? 'importado' : 'mixto',
    fechaRevisionFinal: now,
    fechaCierre: ejercicio.fechaCierre ?? now,
    fechaDeclaracion: now,
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

  const db = await initDB();
  await db.put(EJERCICIOS_STORE, updatedEjercicio);

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
    })
  );

  return rows;
}
