// Lo que acompaña a la casilla que ya viene con el dato oficial puesto.

import { render, screen, waitFor } from '@testing-library/react';

const mockCargarSerie = jest.fn();
jest.mock('../../../../services/indices/seriesIndicesService', () => {
  const real = jest.requireActual('../../../../services/indices/seriesIndicesService');
  return { ...real, cargarSerie: (...a: unknown[]) => mockCargarSerie(...a) };
});

const IndicadorOficial = require('../IndicadorOficial').default;

const serie = (valores: Record<string, number>, extra: Record<string, unknown> = {}) => ({
  esquema: 1 as const,
  id: 'euribor-12m' as const,
  nombre: 'Euríbor a 12 meses',
  unidad: 'porcentaje' as const,
  cadenciaMeses: 1,
  fuente: {
    nombre: 'Banco Central Europeo · Data Portal',
    url: 'https://x.test',
    serieOrigen: 'FM...',
  },
  actualizadoEn: '2026-08-22T05:00:00.000Z',
  valores,
  ...extra,
});

describe('IndicadorOficial', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-08-22T10:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  // Lo importante: la casilla se rellena sola, sin que nadie pulse nada.
  it('entrega el valor publicado para que la casilla venga puesta', async () => {
    const onDato = jest.fn();
    mockCargarSerie.mockResolvedValue(serie({ '2026-06': 2.7, '2026-07': 2.855087 }));
    render(<IndicadorOficial serie="euribor-12m" decimales={3} onDato={onDato} />);

    await waitFor(() => expect(onDato).toHaveBeenCalled());
    // Tres decimales · el BCE publica seis y una escritura española aplica tres.
    expect(onDato).toHaveBeenCalledWith(2.855);
  });

  it('lo entrega una sola vez · no pisa lo que se escriba después', async () => {
    const onDato = jest.fn();
    mockCargarSerie.mockResolvedValue(serie({ '2026-07': 2.855087 }));
    const { rerender } = render(<IndicadorOficial serie="euribor-12m" onDato={onDato} />);

    await waitFor(() => expect(onDato).toHaveBeenCalledTimes(1));
    rerender(<IndicadorOficial serie="euribor-12m" onDato={onDato} />);
    rerender(<IndicadorOficial serie="euribor-12m" onDato={onDato} />);
    expect(onDato).toHaveBeenCalledTimes(1);
  });

  it('dice mes de referencia, organismo y cuándo se descargó', async () => {
    mockCargarSerie.mockResolvedValue(serie({ '2026-07': 2.855087 }));
    render(<IndicadorOficial serie="euribor-12m" />);

    expect(await screen.findByText('jul 2026')).toBeTruthy();
    // Siglas · el nombre largo partía la línea en dos en la columna del formulario.
    expect(screen.getByText('BCE')).toBeTruthy();
    expect(screen.getByText('act. 22 ago 2026')).toBeTruthy();
  });

  it('avisa cuando la serie va con retraso', async () => {
    mockCargarSerie.mockResolvedValue(serie({ '2025-12': 2.9 }));
    render(<IndicadorOficial serie="ipc" />);

    expect(await screen.findByText(/atrasado 7 meses/)).toBeTruthy();
  });

  it('sin dato no promete nada ni entrega valor', async () => {
    const onDato = jest.fn();
    mockCargarSerie.mockResolvedValue(serie({}));
    render(<IndicadorOficial serie="ipc" onDato={onDato} />);

    expect(await screen.findByText('sin dato oficial disponible')).toBeTruthy();
    expect(onDato).not.toHaveBeenCalled();
  });
});
