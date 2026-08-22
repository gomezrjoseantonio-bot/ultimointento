// Lo que ve quien abre «Actualizar valores» al lado de la casilla que teclea.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockCargarSerie = jest.fn();
jest.mock('../../../../services/indices/seriesIndicesService', () => {
  const real = jest.requireActual('../../../../services/indices/seriesIndicesService');
  return { ...real, cargarSerie: (...a: unknown[]) => mockCargarSerie(...a) };
});

const IndicadorOficial = require('../IndicadorOficial').default;

const serie = (valores: Record<string, number>, extra = {}) => ({
  esquema: 1 as const,
  id: 'euribor-12m' as const,
  nombre: 'Euríbor a 12 meses',
  unidad: 'porcentaje' as const,
  cadenciaMeses: 1,
  fuente: { nombre: 'Banco Central Europeo', url: 'https://x.test', serieOrigen: 'FM...' },
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

  it('enseña el valor publicado, de qué mes es y de dónde sale', async () => {
    mockCargarSerie.mockResolvedValue(serie({ '2026-06': 2.7, '2026-07': 2.855087 }));
    render(<IndicadorOficial serie="euribor-12m" decimales={3} />);

    expect(await screen.findByText('2,855 %')).toBeTruthy();
    expect(screen.getByText(/jul 2026 · Banco Central Europeo/)).toBeTruthy();
  });

  it('el botón «usar» entrega el valor a la casilla, no lo guarda solo', async () => {
    const onUsar = jest.fn();
    mockCargarSerie.mockResolvedValue(serie({ '2026-07': 2.855087 }));
    render(<IndicadorOficial serie="euribor-12m" decimales={3} onUsar={onUsar} />);

    userEvent.click(await screen.findByRole('button', { name: 'usar' }));
    await waitFor(() => expect(onUsar).toHaveBeenCalled());
    expect(onUsar).toHaveBeenCalledWith(2.855087);
  });

  it('sin onUsar no hay botón · el IRAV solo se consulta', async () => {
    mockCargarSerie.mockResolvedValue(serie({ '2026-07': 2.49 }));
    render(<IndicadorOficial serie="irav" />);

    await screen.findByText('2,49 %');
    expect(screen.queryByRole('button', { name: 'usar' })).toBeNull();
  });

  // Un dato viejo señalado es útil; disfrazado de fresco, no.
  it('avisa cuando la serie va con retraso', async () => {
    mockCargarSerie.mockResolvedValue(serie({ '2025-12': 2.9 }));
    render(<IndicadorOficial serie="ipc" />);

    expect(await screen.findByText(/atrasado 7 meses/)).toBeTruthy();
  });

  it('sin dato lo dice, en vez de prometer un oficial que no hay', async () => {
    mockCargarSerie.mockResolvedValue(serie({}));
    render(<IndicadorOficial serie="ipc" />);

    expect(await screen.findByText('Oficial · sin dato disponible')).toBeTruthy();
  });
});
