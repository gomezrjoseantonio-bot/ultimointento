// De dónde sale el euríbor que aparece escrito en la revisión.
//
// El caso que motiva todo esto: una revisión que aplica en agosto, con la
// escritura diciendo «el del mes anterior», se confirma en octubre. Lo que hay
// que proponer es el euríbor publicado de JULIO, no el de hoy.

import { renderHook, waitFor } from '@testing-library/react';

jest.mock('../../../../services/prestamos/tramosDeTipo', () => ({
  tramoVigente: () => ({ variable: true }),
}));

jest.mock('../../../../services/bonificaciones/revisionDelBanco', () => ({
  calendarioDe: () => [],
  revisionPendiente: () => ({ fecha: '2026-08-01', aplicaDesde: '2026-08-01', bonificaciones: [] }),
}));

const mockSnapshot = jest.fn();
jest.mock('../../../../services/financialValuesService', () => ({
  getFinancialValuesSnapshot: () => mockSnapshot(),
}));

const mockCargarSerie = jest.fn();
jest.mock('../../../../services/indices/seriesIndicesService', () => ({
  cargarSerie: (...a: unknown[]) => mockCargarSerie(...a),
  valorEnMes: jest.requireActual('../../../../services/indices/seriesIndicesService').valorEnMes,
}));

const { useRevisionPendiente } = require('../useRevisionPendiente');

const serieEuribor = (valores: Record<string, number>) => ({
  esquema: 1 as const,
  id: 'euribor-12m' as const,
  nombre: 'Euríbor a 12 meses',
  unidad: 'porcentaje' as const,
  cadenciaMeses: 1,
  fuente: { nombre: 'BCE', url: 'https://example.test', serieOrigen: 'FM...' },
  actualizadoEn: '2026-10-03T05:00:00.000Z',
  valores,
});

// `indiceDesfaseMeses: 1` = «el euríbor del mes anterior», que es lo que dice
// la escritura más habitual.
const prestamo = { id: 'p1', indiceDesfaseMeses: 1 } as never;

describe('useRevisionPendiente · qué euríbor se propone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSnapshot.mockResolvedValue({ euriborPercent: 3.5 });
  });

  it('propone el publicado del mes que manda, no el de hoy', async () => {
    mockCargarSerie.mockResolvedValue(serieEuribor({ '2026-07': 2.134, '2026-09': 2.9 }));

    const { result } = renderHook(() => useRevisionPendiente(prestamo, '2026-10-15', () => {}));

    await waitFor(() => expect(result.current.indiceSugerido).not.toBeNull());
    expect(result.current.indiceSugerido).toBe(2.134);
    expect(result.current.origenSugerido).toBe('publicado');
    expect(result.current.periodoSugerido).toBe('2026-07');
    expect(result.current.indiceRaw).toBe('2,134');
    // Si el mes publicado sirve, no se llega a mirar «Actualizar valores».
    expect(mockSnapshot).not.toHaveBeenCalled();
  });

  it('si ese mes aún no está publicado, vuelve al manual y lo dice', async () => {
    mockCargarSerie.mockResolvedValue(serieEuribor({ '2026-05': 2.0 }));

    const { result } = renderHook(() => useRevisionPendiente(prestamo, '2026-10-15', () => {}));

    await waitFor(() => expect(result.current.indiceSugerido).not.toBeNull());
    expect(result.current.indiceSugerido).toBe(3.5);
    expect(result.current.origenSugerido).toBe('manual');
    expect(result.current.periodoSugerido).toBeNull();
  });

  it('sin desfase en la escritura no se va a buscar ningún mes', async () => {
    mockCargarSerie.mockResolvedValue(serieEuribor({ '2026-07': 2.134 }));
    const sinDesfase = { id: 'p2' } as never;

    const { result } = renderHook(() => useRevisionPendiente(sinDesfase, '2026-10-15', () => {}));

    await waitFor(() => expect(result.current.indiceSugerido).not.toBeNull());
    expect(result.current.origenSugerido).toBe('manual');
    expect(mockCargarSerie).not.toHaveBeenCalled();
  });

  it('si la serie no está disponible no se queda sin propuesta', async () => {
    mockCargarSerie.mockRejectedValue(new Error('sin red'));

    const { result } = renderHook(() => useRevisionPendiente(prestamo, '2026-10-15', () => {}));

    await waitFor(() => expect(result.current.indiceSugerido).not.toBeNull());
    expect(result.current.indiceSugerido).toBe(3.5);
    expect(result.current.origenSugerido).toBe('manual');
  });
});
