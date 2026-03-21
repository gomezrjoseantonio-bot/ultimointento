import 'fake-indexeddb/auto';

import { initDB } from '../db';
import * as irpfCalculationService from '../irpfCalculationService';
import {
  cerrarEjercicio,
  declararEjercicio,
  deleteEjercicio,
  ejercicioFiscalService,
  getEjercicio,
  getOrCreateEjercicio,
  reabrirEjercicio,
  updateResumen,
} from '../ejercicioFiscalService';
import type { EjercicioFiscal } from '../../types/fiscal';

const EJERCICIO = 2024;

function buildDeclaracionMock(ejercicio = EJERCICIO) {
  return {
    ejercicio,
    liquidacion: {
      baseImponibleGeneral: 12000.567,
      baseImponibleAhorro: 3500.333,
      cuotaIntegra: 1800.899,
      deduccionesDobleImposicion: 125.259,
    },
    retenciones: {
      total: 1400.115,
    },
    resultado: 275.455,
  } as any;
}

async function clearEjercicios() {
  const db = await initDB();
  await db.clear('ejerciciosFiscales');
}

describe('ejercicioFiscalService', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    await clearEjercicios();
  });

  test('getOrCreateEjercicio crea ejercicio nuevo si no existe', async () => {
    const result = await getOrCreateEjercicio(EJERCICIO);

    expect(result.año).toBe(EJERCICIO);
    expect(result.estado).toBe('vivo');
    expect(result.origen).toBe('calculado');

    const persisted = await ejercicioFiscalService.getEjercicio(EJERCICIO);
    expect(persisted).toBeDefined();
    expect(persisted?.ejercicio).toBe(EJERCICIO);
    expect(persisted?.estado).toBe('en_curso');
  });

  test('getOrCreateEjercicio permite años históricos desde 2010', async () => {
    const historico = await getOrCreateEjercicio(2010);

    expect(historico.año).toBe(2010);
    expect(historico.estado).toBe('vivo');
  });

  test('getOrCreateEjercicio rechaza años anteriores a 2010', async () => {
    const currentYear = new Date().getFullYear();

    await expect(getOrCreateEjercicio(2009)).rejects.toThrow(
      `Año fiscal fuera del rango permitido (2010 – ${currentYear + 1})`,
    );
  });

  test('updateResumen rellena el campo resumen desde el motor IRPF', async () => {
    jest.spyOn(irpfCalculationService, 'calcularDeclaracionIRPF').mockResolvedValue(buildDeclaracionMock());

    const updated = await updateResumen(EJERCICIO);

    expect(updated.resumen).toEqual({
      baseImponibleGeneral: 12000.57,
      baseImponibleAhorro: 3500.33,
      cuotaIntegra: 1800.9,
      deducciones: 125.26,
      retencionesYPagos: 1400.12,
      resultado: 275.46,
    });
  });

  test('cerrarEjercicio cambia estado de vivo a cerrado', async () => {
    jest.spyOn(irpfCalculationService, 'calcularDeclaracionIRPF').mockResolvedValue(buildDeclaracionMock());

    const cerrado = await cerrarEjercicio(EJERCICIO);

    expect(cerrado.estado).toBe('cerrado');
    expect(cerrado.fechaCierre).toBeDefined();
  });

  test('reabrirEjercicio cambia estado de cerrado a vivo', async () => {
    jest.spyOn(irpfCalculationService, 'calcularDeclaracionIRPF').mockResolvedValue(buildDeclaracionMock());
    await cerrarEjercicio(EJERCICIO);

    const reabierto = await reabrirEjercicio(EJERCICIO);

    expect(reabierto.estado).toBe('vivo');
    expect(reabierto.fechaCierre).toBeUndefined();
  });

  test('declararEjercicio cambia estado de cerrado a declarado', async () => {
    jest.spyOn(irpfCalculationService, 'calcularDeclaracionIRPF').mockResolvedValue(buildDeclaracionMock());
    await cerrarEjercicio(EJERCICIO);

    const declarado = await declararEjercicio(EJERCICIO);

    expect(declarado.estado).toBe('declarado');
    expect(declarado.fechaDeclaracion).toBeDefined();
  });

  test('deleteEjercicio solo funciona si estado es vivo', async () => {
    await getOrCreateEjercicio(EJERCICIO);

    await deleteEjercicio(EJERCICIO);

    const result = await getEjercicio(EJERCICIO);
    expect(result).toBeUndefined();
  });

  test('save/getEstado/getVerdadVigente siguen el modelo fundacional', async () => {
    const ejercicio: EjercicioFiscal = {
      ejercicio: EJERCICIO,
      estado: 'en_curso',
      calculoAtlas: buildDeclaracionMock(),
      calculoAtlasFecha: '2025-01-15T00:00:00.000Z',
      declaracionAeatOrigen: 'no_presentada',
      arrastresRecibidos: { porInmueble: [], porAnio: [] },
      arrastresGenerados: { porInmueble: [], porAnio: [] },
      documentos: [],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-15T00:00:00.000Z',
    };

    await ejercicioFiscalService.save(ejercicio);

    expect(await ejercicioFiscalService.getEstado(EJERCICIO)).toBe('en_curso');
    expect(await ejercicioFiscalService.getVerdadVigente(EJERCICIO)).toEqual(ejercicio.calculoAtlas);
  });

  test('si existe AEAT getVerdadVigente devuelve AEAT por delante de ATLAS', async () => {
    const atlas = buildDeclaracionMock(EJERCICIO);
    const aeat = { ...buildDeclaracionMock(EJERCICIO), resultado: 999 } as any;

    await ejercicioFiscalService.save({
      ejercicio: EJERCICIO,
      estado: 'declarado',
      calculoAtlas: atlas,
      calculoAtlasFecha: '2025-01-10T00:00:00.000Z',
      declaracionAeat: aeat,
      declaracionAeatFecha: '2025-06-30T00:00:00.000Z',
      declaracionAeatOrigen: 'pdf_importado',
      arrastresRecibidos: { porInmueble: [], porAnio: [] },
      arrastresGenerados: { porInmueble: [], porAnio: [] },
      documentos: [],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-06-30T00:00:00.000Z',
      cerradoAt: '2025-05-31T00:00:00.000Z',
      declaradoAt: '2025-06-30T00:00:00.000Z',
    });

    expect(await ejercicioFiscalService.getVerdadVigente(EJERCICIO)).toEqual(aeat);
  });

  test('getArrastresParaEjercicio(2025) busca los arrastres generados en 2024', async () => {
    await ejercicioFiscalService.save({
      ejercicio: 2024,
      estado: 'declarado',
      declaracionAeat: buildDeclaracionMock(2024),
      declaracionAeatFecha: '2025-06-30T00:00:00.000Z',
      declaracionAeatOrigen: 'pdf_importado',
      arrastresRecibidos: { porInmueble: [], porAnio: [] },
      arrastresGenerados: {
        porInmueble: [
          {
            inmuebleRef: 'REF-1',
            concepto: 'gastos_0105_0106',
            ejercicioOrigen: 2024,
            importePendiente: 28123.45,
          },
        ],
        porAnio: [
          {
            tipo: 'perdidas_ahorro',
            ejercicioOrigen: 2024,
            ejercicioCaducidad: 2028,
            importePendiente: 1345.67,
          },
        ],
      },
      documentos: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2025-06-30T00:00:00.000Z',
      cerradoAt: '2025-05-31T00:00:00.000Z',
      declaradoAt: '2025-06-30T00:00:00.000Z',
    });

    const arrastres = await ejercicioFiscalService.getArrastresParaEjercicio(2025);

    expect(arrastres.porInmueble).toHaveLength(1);
    expect(arrastres.porAnio).toHaveLength(1);
    expect(arrastres.porInmueble[0].importePendiente).toBe(28123.45);
  });

  test('addDocumento y getCoberturaDocumental persisten datos del ejercicio', async () => {
    await ejercicioFiscalService.ensureEjercicio(EJERCICIO);
    await ejercicioFiscalService.addDocumento(EJERCICIO, {
      nombre: 'Factura comunidad marzo',
      tipo: 'factura',
      conceptoFiscal: 'Comunidad',
      importe: 100.5,
      importeDeclarado: 120.5,
      ejercicio: EJERCICIO,
      fechaSubida: '2025-03-12T10:00:00.000Z',
    });

    const documentos = await ejercicioFiscalService.getDocumentos(EJERCICIO);
    const cobertura = await ejercicioFiscalService.getCoberturaDocumental(EJERCICIO);

    expect(documentos).toHaveLength(1);
    expect(cobertura.totalDocumentos).toBe(1);
    expect(cobertura.totalImporteDocumentado).toBe(100.5);
    expect(cobertura.totalImportePendiente).toBe(20);
  });
});
