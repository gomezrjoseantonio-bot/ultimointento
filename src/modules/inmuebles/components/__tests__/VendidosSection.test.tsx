import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('VendidosSection', () => {
  it('no renderiza nada si no hay vendidos', () => {
    const { container } = render(<VendidosSection vendidos={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra la cabecera con la plusvalía total y despliega las filas', () => {
    render(
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
});
