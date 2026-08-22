// Lo que se enseña cuando NO se puede estimar · una fila muda no distingue
// entre «falta un dato tuyo» y «esto no funciona».

import { render, screen } from '@testing-library/react';

const mockEstimarPorZona = jest.fn();
const mockRevalorizarCompra = jest.fn();
jest.mock('../../../../services/valoracion/notariadoService', () => ({
  estimarPorZona: (...a: unknown[]) => mockEstimarPorZona(...a),
}));
jest.mock('../../../../services/valoracion/revalorizacionService', () => ({
  revalorizarCompra: (...a: unknown[]) => mockRevalorizarCompra(...a),
}));

const EstimacionZonaInmueble = require('../EstimacionZonaInmueble').default;

const completo = {
  codigoPostal: '33010',
  metrosCuadrados: 90,
  regimen: 'usada' as const,
  precioCompra: 180000,
  fechaCompra: '2015-06-15',
};

describe('EstimacionZonaInmueble · cuando no hay estimación', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEstimarPorZona.mockResolvedValue(null);
    mockRevalorizarCompra.mockResolvedValue(null);
  });

  it('dice qué dato del inmueble falta', async () => {
    render(
      <EstimacionZonaInmueble
        datos={{ ...completo, codigoPostal: '', metrosCuadrados: 0 }}
      />,
    );
    expect(await screen.findByText(/faltan datos del inmueble/)).toBeTruthy();
    expect(screen.getByText(/código postal, metros/)).toBeTruthy();
    // Sin código postal ni siquiera se molesta al servicio.
    expect(mockEstimarPorZona).not.toHaveBeenCalled();
  });

  it('distingue un fallo del servicio de una falta de datos', async () => {
    mockEstimarPorZona.mockRejectedValue(new Error('HTTP 403'));
    render(<EstimacionZonaInmueble datos={completo} />);
    expect(await screen.findByText(/no se pudo consultar el precio de zona/)).toBeTruthy();
    expect(screen.getByText(/HTTP 403/)).toBeTruthy();
  });

  it('y de una zona sin escrituras', async () => {
    render(<EstimacionZonaInmueble datos={completo} />);
    expect(await screen.findByText(/sin datos de escrituras para el CP 33010/)).toBeTruthy();
  });

  it('con una sola estimación no dibuja horquilla', async () => {
    mockEstimarPorZona.mockResolvedValue({
      valor: 225000,
      fiabilidad: 'alta',
      precioZona: {
        precioM2: 2500,
        precioMedio: 220000,
        superficieMedia: 88,
        operaciones: 60,
        operacionesInformadas: 55,
        estimado: false,
        nivel: 'codigo-postal',
        zona: '33010',
        consultadoEn: '2026-08-22T10:00:00.000Z',
      },
    });
    render(<EstimacionZonaInmueble datos={{ ...completo, precioCompra: undefined }} />);
    expect(await screen.findByText('~225.000 €')).toBeTruthy();
  });
});
