import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

import * as irpf from '../../../../services/irpfCalculationService';
import * as ventaSvc from '../../../../services/propertySaleService';
import FiscalidadInmueble from '../FiscalidadInmueble';

jest.mock('../../../../services/irpfCalculationService', () => ({
  recopilarDatosInmuebles: jest.fn(),
}));

jest.mock('../../../../services/propertySaleService', () => ({
  getLatestConfirmedSaleForProperty: jest.fn(),
}));

const mockedRecopilar = irpf.recopilarDatosInmuebles as jest.MockedFunction<
  typeof irpf.recopilarDatosInmuebles
>;
const mockedGetVenta = ventaSvc.getLatestConfirmedSaleForProperty as jest.MockedFunction<
  typeof ventaSvc.getLatestConfirmedSaleForProperty
>;

const LocationProbe = () => {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
};

const renderTab = () =>
  render(
    <MemoryRouter initialEntries={['/inmuebles/4']}>
      <Routes>
        <Route path="/inmuebles/4" element={<FiscalidadInmueble inmuebleId={4} />} />
        <Route path="/fiscal/ejercicio/:anio/venta/:ventaId" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

describe('FiscalidadInmueble · inmueble vendido', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Sin rendimiento de alquiler para este inmueble.
    mockedRecopilar.mockResolvedValue({ inmuebles: [] } as any);
    mockedGetVenta.mockResolvedValue({
      id: 7,
      propertyId: 4,
      saleDate: '2026-03-15',
      salePrice: 130000,
      status: 'confirmed',
      fiscalSnapshot: {
        gananciaPatrimonial: 38508,
        irpfEstimado: 7967,
        valorNetoTransmision: 121750,
      },
    } as any);
  });

  it('muestra la ganancia patrimonial de la venta aunque no haya alquiler', async () => {
    renderTab();
    expect(await screen.findByText(/Venta · ganancia patrimonial/i)).toBeInTheDocument();
    // No debe quedarse en el estado vacío de "sin actividad".
    expect(screen.queryByText(/Sin actividad fiscal registrada/i)).not.toBeInTheDocument();
  });

  it('el enlace lleva al desglose de la venta del ejercicio correcto', async () => {
    renderTab();
    const link = await screen.findByRole('button', { name: /Ver el desglose completo de la venta/i });
    fireEvent.click(link);
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/fiscal/ejercicio/2026/venta/7');
    });
  });
});
