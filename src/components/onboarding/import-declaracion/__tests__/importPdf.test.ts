import { renderHook, act, waitFor } from '@testing-library/react';
import { useWizardImportState } from '../useWizardImportState';
import * as aeat from '../../../../services/aeatParserService';
import * as pdfImport from '../../../../services/justificantePdfImportService';
import * as distribuidor from '../../../../services/declaracionDistributorService';

// El PDF fluye ahora por el MISMO pipeline que el XML: se parsea con
// `parsearDeclaracionAEAT`, se proyecta a `DeclaracionCompleta` con
// `construirDeclaracionCompletaDesdeCasillas` y se importa con
// `distribuirDeclaracion` — no como snapshot plano de casillas.
jest.mock('../../../../services/aeatParserService', () => ({
  parsearDeclaracionAEAT: jest.fn(),
}));
jest.mock('../../../../services/justificantePdfImportService', () => ({
  construirDeclaracionCompletaDesdeCasillas: jest.fn(),
}));
jest.mock('../../../../services/declaracionDistributorService', () => ({
  distribuirDeclaracion: jest.fn(),
}));

const mockedParse = aeat.parsearDeclaracionAEAT as jest.MockedFunction<typeof aeat.parsearDeclaracionAEAT>;
const mockedConstruir = pdfImport.construirDeclaracionCompletaDesdeCasillas as jest.MockedFunction<typeof pdfImport.construirDeclaracionCompletaDesdeCasillas>;
const mockedDistribuir = distribuidor.distribuirDeclaracion as jest.MockedFunction<typeof distribuidor.distribuirDeclaracion>;

const fakeExtraccion = (ejercicio: number): any => ({
  exito: true,
  errores: [],
  warnings: [],
  meta: { ejercicio, modelo: '100', nif: '00000000T', nombre: 'Demo', esRectificativa: false },
  declaracion: {},
  casillasRaw: { '0435': 12000, '0102_1': 12000, '0066_1': 'REF1' },
  inmueblesDetalle: [],
  arrastres: { gastos0105_0106: [], perdidasAhorro: [], gastosInmuebleDetalle: [] },
  paginasProcesadas: 1,
  totalCasillas: 2,
});

const fakeDeclaracion = (ejercicio: number): any => ({
  meta: { ejercicio, modelo: '100', fuenteImportacion: 'pdf', tipoDeclaracion: 'I', numeroJustificante: '', csv: '', referencia: '', fechaPresentacion: '', confianza: 'alta', esComplementaria: false, esRectificativa: false },
  declarante: { nif: '00000000T', nombreCompleto: 'Demo', tributacion: 'individual', asignacionSocial: false, asignacionIglesia: false },
  inmuebles: [], integracion: {} as any, resultado: { resultadoDeclaracion: -500 } as any,
  arrastres: { gastosPendientes: [], perdidasPatrimoniales: [] }, casillas: {}, camposExtra: {},
});

const pdfFile = () => new File([new Uint8Array([1, 2, 3, 4])], 'JUS-2012.pdf', { type: 'application/pdf' });

describe('wizard import · PDF fluye por el mismo pipeline que el XML', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDistribuir.mockResolvedValue({} as any);
  });

  it('un PDF válido cuenta como ejercicio detectado y produce una declaración (no snapshot)', async () => {
    mockedParse.mockResolvedValue(fakeExtraccion(2012));
    mockedConstruir.mockReturnValue(fakeDeclaracion(2012));
    const { result } = renderHook(() => useWizardImportState());

    await act(async () => {
      await result.current.agregarArchivos([pdfFile()]);
    });

    await waitFor(() => expect(result.current.ejerciciosDetectados).toBe(1));
    const archivo = result.current.archivos[0];
    expect(archivo.estado).toBe('validado');
    expect(archivo.tipo).toBe('pdf');
    expect(archivo.ejercicio).toBe(2012);
    expect(archivo.declaracion).toBeTruthy();
    expect(archivo.declaracion?.meta.fuenteImportacion).toBe('pdf');
  });

  it('al importar, el PDF llama a distribuirDeclaracion con la DeclaracionCompleta (fuente pdf)', async () => {
    mockedParse.mockResolvedValue(fakeExtraccion(2012));
    mockedConstruir.mockReturnValue(fakeDeclaracion(2012));
    const { result } = renderHook(() => useWizardImportState());

    await act(async () => {
      await result.current.agregarArchivos([pdfFile()]);
    });
    await waitFor(() => expect(result.current.ejerciciosDetectados).toBe(1));

    await act(async () => {
      await result.current.importar();
    });

    expect(mockedDistribuir).toHaveBeenCalledTimes(1);
    const declArg = mockedDistribuir.mock.calls[0][0] as any;
    expect(declArg.meta.ejercicio).toBe(2012);
    expect(declArg.meta.fuenteImportacion).toBe('pdf');
  });

  it('un PDF ilegible (exito=false) queda en error y no cuenta como ejercicio', async () => {
    mockedParse.mockResolvedValue({ ...fakeExtraccion(0), exito: false, errores: ['No se pudieron leer casillas del PDF'] });
    const { result } = renderHook(() => useWizardImportState());

    await act(async () => {
      await result.current.agregarArchivos([pdfFile()]);
    });

    await waitFor(() => expect(result.current.archivos[0].estado).toBe('error'));
    expect(result.current.ejerciciosDetectados).toBe(0);
    expect(result.current.archivos[0].error).toMatch(/casillas/i);
  });
});
