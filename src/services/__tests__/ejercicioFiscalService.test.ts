import 'fake-indexeddb/auto';

import { initDB } from '../db';
import {
  addArrastreManual,
  addDocumentoFiscal,
  createEmptyDeclaracion,
  declararEjercicio,
  deleteDocumentoFiscal,
  ejercicioFiscalService,
  getCoberturaDocumental,
  getDocumentosFiscales,
  getDocumentosPorInmueble,
  getEjercicio,
  getOrCreateEjercicio,
  guardarCalculoAtlas,
  inicializarEjercicioActual,
  marcarArrastresReemplazados,
  verificarCierresAutomaticos,
} from '../ejercicioFiscalService';
import type { DeclaracionIRPF, DeclaracionInmueble } from '../../types/fiscal';

const EJERCICIO = 2024;

function inmuebleMinimo(overrides: Partial<DeclaracionInmueble> = {}): DeclaracionInmueble {
  return {
    orden: 1,
    referenciaCatastral: 'REF-2024-A',
    direccion: 'Calle Fiscal 1',
    porcentajePropiedad: 100,
    uso: 'arrendamiento',
    esAccesorio: false,
    derechoReduccion: true,
    diasArrendado: 365,
    diasDisposicion: 0,
    rentaImputada: 0,
    ingresosIntegros: 12000,
    arrastresRecibidos: 0,
    arrastresAplicados: 0,
    interesesFinanciacion: 800,
    gastosReparacion: 300,
    gastos0105_0106Aplicados: 1100,
    arrastresGenerados: 0,
    gastosComunidad: 500,
    gastosServicios: 150,
    gastosSuministros: 250,
    gastosSeguros: 100,
    gastosTributos: 200,
    amortizacionMuebles: 90,
    amortizacionInmueble: 600,
    rendimientoNeto: 9010,
    reduccion: 0,
    rendimientoNetoReducido: 9010,
    ...overrides,
  };
}

function crearDeclaracionMinima(overrides: Partial<DeclaracionIRPF> = {}): DeclaracionIRPF {
  return {
    ...createEmptyDeclaracion(),
    trabajo: {
      ...createEmptyDeclaracion().trabajo,
      retribucionesDinerarias: 18000,
      totalIngresosIntegros: 18000,
      rendimientoNetoPrevio: 18000,
      rendimientoNeto: 18000,
      rendimientoNetoReducido: 18000,
      retencionesTrabajoTotal: 2200,
    },
    inmuebles: [inmuebleMinimo()],
    basesYCuotas: {
      ...createEmptyDeclaracion().basesYCuotas,
      baseImponibleGeneral: 25000,
      cuotaIntegra: 5000,
      cuotaLiquida: 4200,
      retencionesTotal: 2200,
      resultadoDeclaracion: 2000,
    },
    ...overrides,
  };
}

function crearDeclaracionConArrastres(ejercicioOrigen = EJERCICIO): DeclaracionIRPF {
  return crearDeclaracionMinima({
    inmuebles: [
      inmuebleMinimo({
        referenciaCatastral: 'REF-ARR-1',
        arrastresGenerados: 28239,
        gastosReparacion: 1200,
        interesesFinanciacion: 1800,
        gastos0105_0106Aplicados: 3000,
      }),
    ],
    gananciasPerdidas: {
      ...createEmptyDeclaracion().gananciasPerdidas,
      compensacionPerdidasAnteriores: 0,
      perdidasPendientes: [
        {
          ejercicioOrigen,
          importeOriginal: 1345,
          importeAplicado: 0,
          importePendiente: 1345,
          caducaEjercicio: ejercicioOrigen + 4,
          origen: 'crypto',
        },
      ],
    },
  });
}

async function clearStores() {
  const db = await initDB();
  await Promise.all([
    db.clear('ejerciciosFiscales'),
    db.clear('documentosFiscales'),
    db.clear('arrastresManual'),
  ]);
}

describe('ejercicioFiscalService', () => {
  beforeEach(async () => {
    await clearStores();
  });

  test('CRUD: crea ejercicio, no duplica y recupera por año', async () => {
    const creado = await ejercicioFiscalService.getOrCreateEjercicio(EJERCICIO, 'en_curso');
    const repetido = await ejercicioFiscalService.getOrCreateEjercicio(EJERCICIO, 'cerrado');
    const recuperado = await ejercicioFiscalService.getEjercicio(EJERCICIO);
    const todos = await ejercicioFiscalService.getAllEjercicios();

    expect(creado.ejercicio).toBe(EJERCICIO);
    expect(repetido.ejercicio).toBe(EJERCICIO);
    expect(recuperado?.ejercicio).toBe(EJERCICIO);
    expect(todos).toHaveLength(1);
    expect(todos[0].estado).toBe('en_curso');
  });

  test('Transiciones: cerrar en_curso y no cerrar declarado', async () => {
    await ejercicioFiscalService.getOrCreateEjercicio(EJERCICIO, 'en_curso');

    const cerrado = await ejercicioFiscalService.cerrarEjercicio(EJERCICIO);
    const trasSegundoCierre = await ejercicioFiscalService.cerrarEjercicio(EJERCICIO);

    expect(cerrado.estado).toBe('cerrado');
    expect(cerrado.cerradoAt).toBeDefined();
    expect(trasSegundoCierre.estado).toBe('cerrado');

    const declarado = await ejercicioFiscalService.declararEjercicio(
      EJERCICIO,
      crearDeclaracionMinima(),
      'manual',
      '2025-06-30T00:00:00.000Z',
    );
    const trasIntentoCerrar = await ejercicioFiscalService.cerrarEjercicio(EJERCICIO);

    expect(declarado.estado).toBe('declarado');
    expect(trasIntentoCerrar.estado).toBe('declarado');
  });

  test('Transiciones: declarar guarda datos AEAT, congela estado y extrae arrastres', async () => {
    const declaracion = crearDeclaracionConArrastres();
    await ejercicioFiscalService.getOrCreateEjercicio(EJERCICIO, 'en_curso');

    const declarado = await ejercicioFiscalService.declararEjercicio(
      EJERCICIO,
      declaracion,
      'pdf_importado',
      '2025-06-30T00:00:00.000Z',
      'pdf://aeat/2024.pdf',
    );

    expect(declarado.estado).toBe('declarado');
    expect(declarado.declaracionAeatOrigen).toBe('pdf_importado');
    expect(declarado.declaracionAeatPdfRef).toBe('pdf://aeat/2024.pdf');
    expect(declarado.arrastresGenerados.gastos0105_0106[0].importePendiente).toBe(28239);
    expect(declarado.arrastresGenerados.perdidasPatrimonialesAhorro[0].importePendiente).toBe(1345);
  });

  test('guardarCalculoAtlas no sobreescribe foto congelada de ejercicios declarados', async () => {
    const aeat = crearDeclaracionMinima();
    await ejercicioFiscalService.declararEjercicio(EJERCICIO, aeat, 'manual');

    await ejercicioFiscalService.guardarCalculoAtlas(EJERCICIO, crearDeclaracionMinima({
      trabajo: {
        ...createEmptyDeclaracion().trabajo,
        retribucionesDinerarias: 999999,
        totalIngresosIntegros: 999999,
        rendimientoNetoPrevio: 999999,
        rendimientoNeto: 999999,
        rendimientoNetoReducido: 999999,
        retencionesTrabajoTotal: 1,
      },
    }));

    const ejercicio = await ejercicioFiscalService.getEjercicio(EJERCICIO);
    expect(ejercicio?.declaracionAeat).toEqual(aeat);
    expect(ejercicio?.calculoAtlas).toBeUndefined();
  });

  test('Verdad vigente: AEAT manda si existe, ATLAS como fallback y tres verdades devuelve ambas', async () => {
    const atlas = crearDeclaracionMinima();
    const aeat = crearDeclaracionMinima({
      basesYCuotas: {
        ...crearDeclaracionMinima().basesYCuotas,
        resultadoDeclaracion: 1234,
      },
    });

    await guardarCalculoAtlas(EJERCICIO, atlas);
    expect(await ejercicioFiscalService.getVerdadVigente(EJERCICIO)).toEqual(atlas);

    await ejercicioFiscalService.declararEjercicio(EJERCICIO, aeat, 'manual');
    expect(await ejercicioFiscalService.getVerdadVigente(EJERCICIO)).toEqual(aeat);

    const tresVerdades = await ejercicioFiscalService.getTresVerdades(EJERCICIO);
    expect(tresVerdades.calculado).toEqual(atlas);
    expect(tresVerdades.declarado).toEqual(aeat);
    expect(tresVerdades.estado).toBe('declarado');
  });

  test('Arrastres: propaga de ejercicio declarado al siguiente', async () => {
    await ejercicioFiscalService.declararEjercicio(2024, crearDeclaracionConArrastres(2024), 'pdf_importado');

    const arrastres = await ejercicioFiscalService.getArrastresParaEjercicio(2025);

    expect(arrastres.gastos0105_0106[0].importePendiente).toBe(28239);
    expect(arrastres.perdidasPatrimonialesAhorro[0].importePendiente).toBe(1345);
  });

  test('Arrastres: fallback a manuales si no hay declaración', async () => {
    await addArrastreManual({
      tipo: 'gastos_0105_0106',
      ejercicioOrigen: 2023,
      importe: 700,
      referenciaCatastral: 'REF-MANUAL',
      reemplazadoPorImportacion: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    const arrastres = await ejercicioFiscalService.getArrastresParaEjercicio(2025);

    expect(arrastres.gastos0105_0106).toHaveLength(1);
    expect(arrastres.gastos0105_0106[0].importePendiente).toBe(700);
  });

  test('Arrastres: reemplaza manuales al importar declaración', async () => {
    await addArrastreManual({
      tipo: 'perdidas_ahorro',
      ejercicioOrigen: 2024,
      importe: 1345,
      detalle: 'crypto',
      reemplazadoPorImportacion: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    });

    await ejercicioFiscalService.declararEjercicio(2024, crearDeclaracionConArrastres(2024), 'pdf_importado');

    const manuales = await ejercicioFiscalService.getArrastresManual();
    expect(manuales[0].reemplazadoPorImportacion).toBe(true);
  });

  test('Arrastres: no devuelve arrastres caducados (> 4 años)', async () => {
    await addArrastreManual({
      tipo: 'perdidas_ahorro',
      ejercicioOrigen: 2019,
      importe: 500,
      detalle: 'caducado',
      reemplazadoPorImportacion: false,
      createdAt: '2020-01-01T00:00:00.000Z',
    });

    const arrastres = await ejercicioFiscalService.getArrastresParaEjercicio(2025);
    expect(arrastres.perdidasPatrimonialesAhorro).toHaveLength(0);
  });

  test('Documentación: añade y recupera documentos por ejercicio e inmueble', async () => {
    const doc1 = await addDocumentoFiscal({
      ejercicio: EJERCICIO,
      tipo: 'factura',
      concepto: 'gastos_comunidad',
      inmuebleId: 'inm-1',
      inmuebleRef: 'REF-2024-A',
      importe: 500,
      fechaDocumento: '2024-03-01',
      fechaSubida: '2024-03-02T00:00:00.000Z',
      descripcion: 'Factura comunidad marzo',
    });

    await addDocumentoFiscal({
      ejercicio: EJERCICIO,
      tipo: 'factura',
      concepto: 'gastos_suministros',
      inmuebleId: 'inm-2',
      inmuebleRef: 'REF-2024-B',
      importe: 250,
      fechaDocumento: '2024-04-01',
      fechaSubida: '2024-04-02T00:00:00.000Z',
      descripcion: 'Factura luz abril',
    });

    const porEjercicio = await getDocumentosFiscales(EJERCICIO);
    const porInmueble = await getDocumentosPorInmueble(EJERCICIO, 'inm-1');

    expect(doc1.id).toBeDefined();
    expect(porEjercicio).toHaveLength(2);
    expect(porInmueble).toHaveLength(1);
    expect(porInmueble[0].descripcion).toBe('Factura comunidad marzo');
  });

  test('Documentación: cobertura marca cubierto y sin_documentar, y riesgo total suma diferencias', async () => {
    await ejercicioFiscalService.declararEjercicio(
      EJERCICIO,
      crearDeclaracionMinima({
        inmuebles: [
          inmuebleMinimo({
            gastosComunidad: 500,
            gastosSuministros: 250,
          }),
        ],
      }),
      'manual',
    );

    await addDocumentoFiscal({
      ejercicio: EJERCICIO,
      tipo: 'factura',
      concepto: 'gastos_comunidad',
      inmuebleRef: 'REF-2024-A',
      importe: 500,
      fechaDocumento: '2024-03-01',
      fechaSubida: '2024-03-02T00:00:00.000Z',
      descripcion: 'Comunidad pagada',
    });

    const informe = await getCoberturaDocumental(EJERCICIO);
    const lineaComunidad = informe.lineas.find((linea) => linea.concepto === 'gastos_comunidad');
    const lineaSuministros = informe.lineas.find((linea) => linea.concepto === 'gastos_suministros');

    expect(lineaComunidad?.estado).toBe('cubierto');
    expect(lineaSuministros?.estado).toBe('sin_documentar');
    expect(informe.riesgoTotal).toBeGreaterThanOrEqual(250);
  });

  test('Documentación: deleteDocumentoFiscal elimina el documento', async () => {
    const doc = await addDocumentoFiscal({
      ejercicio: EJERCICIO,
      tipo: 'factura',
      concepto: 'gastos_comunidad',
      importe: 200,
      fechaDocumento: '2024-05-01',
      fechaSubida: '2024-05-01T10:00:00.000Z',
    });

    await deleteDocumentoFiscal(doc.id as number);

    expect(await getDocumentosFiscales(EJERCICIO)).toHaveLength(0);
  });

  test('Inicialización: crea ejercicio actual y cierra pasados automáticamente', async () => {
    const currentYear = new Date().getFullYear();
    await ejercicioFiscalService.saveEjercicio({
      ejercicio: currentYear - 1,
      estado: 'en_curso',
      declaracionAeatOrigen: 'no_presentada',
      arrastresRecibidos: { gastos0105_0106: [], perdidasPatrimonialesAhorro: [], amortizacionesAcumuladas: [] },
      arrastresGenerados: { gastos0105_0106: [], perdidasPatrimonialesAhorro: [], amortizacionesAcumuladas: [] },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    const actual = await inicializarEjercicioActual();
    const cerrados = await verificarCierresAutomaticos();
    const pasado = await ejercicioFiscalService.getEjercicio(currentYear - 1);

    expect(actual.ejercicio).toBe(currentYear);
    expect(actual.estado).toBe('en_curso');
    expect(cerrados.some((item) => item.ejercicio === currentYear - 1)).toBe(true);
    expect(pasado?.estado).toBe('cerrado');
  });

  test('Wrappers legacy: getOrCreateEjercicio y getEjercicio siguen exponiendo vista db', async () => {
    const legacy = await getOrCreateEjercicio(EJERCICIO);
    const fetched = await getEjercicio(EJERCICIO);

    expect(legacy.ejercicio).toBe(EJERCICIO);
    expect(legacy.año).toBe(EJERCICIO);
    expect(fetched?.origen).toBe('calculado');
  });

  test('Funciones auxiliares explícitas: marcarArrastresReemplazados actualiza manuales', async () => {
    await addArrastreManual({
      tipo: 'gastos_0105_0106',
      ejercicioOrigen: 2023,
      importe: 100,
      referenciaCatastral: 'REF-X',
      reemplazadoPorImportacion: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    await marcarArrastresReemplazados(2023);

    const manuales = await ejercicioFiscalService.getArrastresManual();
    expect(manuales[0].reemplazadoPorImportacion).toBe(true);
  });
});
