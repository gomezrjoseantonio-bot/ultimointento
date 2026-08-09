import { act, renderHook, waitFor } from '@testing-library/react';
import { useRegistrosInmueble } from '../useRegistrosInmueble';
import { gastosInmuebleService } from '../../../../services/gastosInmuebleService';
import { mejorasInmuebleService } from '../../../../services/mejorasInmuebleService';
import { mueblesInmuebleService } from '../../../../services/mueblesInmuebleService';
import { ejercicioFiscalService } from '../../../../services/ejercicioFiscalService';

jest.mock('../../../../design-system/v5', () => ({ showToastV5: jest.fn() }));

jest.mock('../../../../services/gastosInmuebleService', () => ({
  gastosInmuebleService: {
    getByInmueble: jest.fn().mockResolvedValue([]),
    add: jest.fn().mockResolvedValue(1),
  },
}));
jest.mock('../../../../services/mejorasInmuebleService', () => ({
  mejorasInmuebleService: {
    getPorInmueble: jest.fn().mockResolvedValue([]),
    crear: jest.fn().mockResolvedValue({}),
  },
}));
jest.mock('../../../../services/mueblesInmuebleService', () => ({
  mueblesInmuebleService: {
    getPorInmueble: jest.fn().mockResolvedValue([]),
    crear: jest.fn().mockResolvedValue({}),
  },
}));
jest.mock('../../../../services/ejercicioFiscalService', () => ({
  ejercicioFiscalService: { getAllEjercicios: jest.fn().mockResolvedValue([]) },
}));

const mockedGastos = jest.mocked(gastosInmuebleService);
const mockedMejoras = jest.mocked(mejorasInmuebleService);
const mockedMuebles = jest.mocked(mueblesInmuebleService);
const mockedEjercicios = jest.mocked(ejercicioFiscalService);

beforeEach(() => {
  jest.clearAllMocks();
  mockedGastos.getByInmueble.mockResolvedValue([]);
  mockedMejoras.getPorInmueble.mockResolvedValue([]);
  mockedMuebles.getPorInmueble.mockResolvedValue([]);
  mockedEjercicios.getAllEjercicios.mockResolvedValue([]);
});

describe('useRegistrosInmueble · alta', () => {
  it('crea un gasto real con inmuebleId, origen manual y estado confirmado', async () => {
    const { result } = renderHook(() => useRegistrosInmueble(7));
    await waitFor(() => expect(mockedEjercicios.getAllEjercicios).toHaveBeenCalled());

    act(() => result.current.abrirAlta('real'));
    await act(async () => {
      await result.current.crear({
        concepto: 'Luz',
        categoria: 'suministro',
        casillaAEAT: '0113',
        fecha: '2026-02-01',
        importe: 60,
        ejercicio: 2026,
      });
    });

    expect(mockedGastos.add).toHaveBeenCalledWith(
      expect.objectContaining({
        inmuebleId: 7,
        origen: 'manual',
        estado: 'confirmado',
        concepto: 'Luz',
        casillaAEAT: '0113',
        importe: 60,
        ejercicio: 2026,
      }),
    );
    expect(result.current.tipoAlta).toBeNull();
  });

  it('crea mobiliario con activo=true', async () => {
    const { result } = renderHook(() => useRegistrosInmueble(7));
    await waitFor(() => expect(mockedEjercicios.getAllEjercicios).toHaveBeenCalled());

    act(() => result.current.abrirAlta('mobiliario'));
    await act(async () => {
      await result.current.crear({
        descripcion: 'Nevera',
        fechaAlta: '2026-02-01',
        importe: 500,
        vidaUtil: 10,
        ejercicio: 2026,
      });
    });

    expect(mockedMuebles.crear).toHaveBeenCalledWith(
      expect.objectContaining({ inmuebleId: 7, activo: true, descripcion: 'Nevera', vidaUtil: 10 }),
    );
  });

  it('no crea en un ejercicio declarado (bloqueado)', async () => {
    mockedEjercicios.getAllEjercicios.mockResolvedValue([
      { ejercicio: 2024, año: 2024, estado: 'declarado', createdAt: '', updatedAt: '' },
    ] as never);
    const { result } = renderHook(() => useRegistrosInmueble(7));
    await waitFor(() => expect(result.current.ejerciciosBloqueados).toContain(2024));

    act(() => result.current.abrirAlta('mejora'));
    await act(async () => {
      await result.current.crear({
        descripcion: 'Reforma',
        tipo: 'mejora',
        fecha: '2024-05-01',
        importe: 3000,
        ejercicio: 2024,
      });
    });

    expect(mockedMejoras.crear).not.toHaveBeenCalled();
  });
});
