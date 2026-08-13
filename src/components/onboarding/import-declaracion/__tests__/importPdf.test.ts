import { renderHook, act, waitFor } from '@testing-library/react';
import { useWizardImportState } from '../useWizardImportState';
import * as aeat from '../../../../services/aeatParserService';
import * as resolver from '../../../../services/ejercicioResolverService';

jest.mock('../../../../services/aeatParserService', () => ({
  parsearDeclaracionAEAT: jest.fn(),
}));
jest.mock('../../../../services/ejercicioResolverService', () => ({
  importarDeclaracionAEAT: jest.fn(),
}));

const mockedParse = aeat.parsearDeclaracionAEAT as jest.MockedFunction<typeof aeat.parsearDeclaracionAEAT>;
const mockedImport = resolver.importarDeclaracionAEAT as jest.MockedFunction<typeof resolver.importarDeclaracionAEAT>;

const fakeExtraccion = (ejercicio: number): any => ({
  exito: true,
  errores: [],
  warnings: [],
  meta: { ejercicio, modelo: '100', nif: '00000000T', nombre: 'Demo', esRectificativa: false },
  declaracion: {},
  casillasRaw: { '0435': 12000, '0500': '10000', X: 'no-num' },
  inmueblesDetalle: [],
  arrastres: { gastos0105_0106: [], perdidasAhorro: [], gastosInmuebleDetalle: [] },
  paginasProcesadas: 1,
  totalCasillas: 2,
});

const pdfFile = () => new File([new Uint8Array([1, 2, 3, 4])], 'JUS-2012.pdf', { type: 'application/pdf' });

describe('wizard import · PDF se parsea e importa como snapshot AEAT', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedImport.mockResolvedValue({} as any);
  });

  it('un PDF válido cuenta como ejercicio detectado y no queda como simple adjunto', async () => {
    mockedParse.mockResolvedValue(fakeExtraccion(2012));
    const { result } = renderHook(() => useWizardImportState());

    await act(async () => {
      await result.current.agregarArchivos([pdfFile()]);
    });

    await waitFor(() => expect(result.current.ejerciciosDetectados).toBe(1));
    const archivo = result.current.archivos[0];
    expect(archivo.estado).toBe('validado');
    expect(archivo.tipo).toBe('pdf');
    expect(archivo.ejercicio).toBe(2012);
    expect(archivo.extraccion).toBeTruthy();
  });

  it('al importar, el PDF llama a importarDeclaracionAEAT con año + casillas numéricas', async () => {
    mockedParse.mockResolvedValue(fakeExtraccion(2012));
    const { result } = renderHook(() => useWizardImportState());

    await act(async () => {
      await result.current.agregarArchivos([pdfFile()]);
    });
    await waitFor(() => expect(result.current.ejerciciosDetectados).toBe(1));

    await act(async () => {
      await result.current.importar();
    });

    expect(mockedImport).toHaveBeenCalledTimes(1);
    const arg = mockedImport.mock.calls[0][0];
    expect(arg.año).toBe(2012);
    // Solo casillas numéricas (la string numérica se convierte; la no-numérica se descarta).
    expect(arg.casillas).toEqual({ '0435': 12000, '0500': 10000 });
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
