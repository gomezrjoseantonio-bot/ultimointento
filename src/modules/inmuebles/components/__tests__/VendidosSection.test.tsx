import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import VendidosSection, { VendidoVM } from '../VendidosSection';

const vendido = (over: Partial<VendidoVM>): VendidoVM => ({
  id: 6,
  alias: 'Campoamor 12',
  astId: 'AST-06',
  tipoLabel: 'Piso',
  municipio: 'Oviedo',
  saleDateLabel: 'vendido mar 2024',
  venta: 138000,
  plusvalia: 40200,
  ...over,
});

const LocationProbe = () => {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
};

const renderWithRouter = (ui: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={['/inmuebles']}>
      <Routes>
        <Route path="/inmuebles" element={ui} />
        <Route path="/inmuebles/:id" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

describe('VendidosSection', () => {
  it('no renderiza nada si no hay vendidos', () => {
    const { container } = renderWithRouter(<VendidosSection vendidos={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra la cabecera con la plusvalía total y despliega las filas', () => {
    renderWithRouter(
      <VendidosSection
        vendidos={[vendido({}), vendido({ id: 7, alias: 'Garaje Uría 8', plusvalia: 8000, venta: 18000 })]}
      />,
    );
    expect(screen.getByText('Vendidos')).toBeInTheDocument();
    // total plusvalía = 48.200
    expect(screen.getByText(/48\.200/)).toBeInTheDocument();
    // cuerpo plegado por defecto
    expect(screen.queryByText('Campoamor 12')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Vendidos'));
    expect(screen.getByText('Campoamor 12')).toBeInTheDocument();
    expect(screen.getByText('Garaje Uría 8')).toBeInTheDocument();
  });

  it('al clicar una fila de vendido navega a su detalle', () => {
    renderWithRouter(<VendidosSection vendidos={[vendido({ id: 6 })]} />);
    fireEvent.click(screen.getByText('Vendidos')); // desplegar
    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalle de Campoamor 12' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/inmuebles/6');
  });
});
