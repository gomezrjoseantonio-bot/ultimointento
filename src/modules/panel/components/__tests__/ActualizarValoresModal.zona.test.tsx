// La estimación tiene que llegar hasta la fila del inmueble.
//
// Los tests de `EstimacionZonaInmueble` prueban el componente en aislamiento y
// pasan aunque nadie lo monte. Lo que aquí se comprueba es el eslabón que
// faltaba: que el modal cruza `properties` con la lista de valoraciones por el
// id y le entrega los datos. Si ese cruce se rompe —un id que no casa, un
// store que cambia de nombre— la fila se queda muda y ningún test lo nota.

import { render, screen, waitFor } from '@testing-library/react';

const mockGetAll = jest.fn();
jest.mock('../../../../services/db', () => ({
  initDB: async () => ({ getAll: (...a: unknown[]) => mockGetAll(...a) }),
}));

const mockSnapshot = jest.fn();
jest.mock('../../../../services/financialValuesService', () => ({
  getFinancialValuesSnapshot: () => mockSnapshot(),
  saveFinancialValuesSnapshot: jest.fn(),
}));

jest.mock('../../../../services/indices/seriesIndicesService', () => ({
  cargarSerie: async () => null,
  valorEnMes: () => null,
  variacionInteranual: () => null,
  porcentajeDeActualizacion: () => null,
  mesesDeRetraso: () => null,
}));

const mockEstimarPorZona = jest.fn();
const mockRevalorizarCompra = jest.fn();
jest.mock('../../../../services/valoracion/notariadoService', () => ({
  estimarPorZona: (...a: unknown[]) => mockEstimarPorZona(...a),
}));
jest.mock('../../../../services/valoracion/revalorizacionService', () => ({
  revalorizarCompra: (...a: unknown[]) => mockRevalorizarCompra(...a),
}));

const ActualizarValoresModal = require('../ActualizarValoresModal').default;

const inmueble = {
  id: 7,
  alias: 'Fuertes Acevedo 32',
  address: 'Fuertes Acevedo 32',
  postalCode: '33006',
  squareMeters: 100,
  transmissionRegime: 'usada',
  state: 'activo',
  purchaseDate: '2022-09-26',
  acquisitionCosts: { price: 75000 },
  tipoActivo: 'piso',
};

describe('ActualizarValoresModal · la estimación llega a la fila', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAll.mockResolvedValue([inmueble]);
    mockSnapshot.mockResolvedValue({
      ipcMonthlyPercent: null,
      euriborPercent: null,
      effectiveDate: '2026-08-22',
      realEstateValuations: [{ id: '7', name: 'Fuertes Acevedo 32', value: 90000 }],
      investmentValuations: [],
      updatedAt: null,
    });
    mockEstimarPorZona.mockResolvedValue(null);
    mockRevalorizarCompra.mockResolvedValue(null);
  });

  it('monta la estimación bajo el nombre del inmueble', async () => {
    render(<ActualizarValoresModal onClose={() => undefined} />);
    expect(await screen.findByText(/Fuertes Acevedo 32/)).toBeTruthy();
    // Con los servicios devolviendo `null` el componente dice por qué no hay
    // estimación · lo que se comprueba es que ESTÁ, no lo que calcula.
    expect(await screen.findByText(/sin estimación|consultando precio de zona/)).toBeTruthy();
  });

  it('le pasa el código postal y los metros que tiene guardados', async () => {
    render(<ActualizarValoresModal onClose={() => undefined} />);
    await waitFor(() =>
      expect(mockEstimarPorZona).toHaveBeenCalledWith(100, '33006', 'usada', 'piso'),
    );
    expect(mockRevalorizarCompra).toHaveBeenCalledWith(75000, '2022-09-26');
  });
});
