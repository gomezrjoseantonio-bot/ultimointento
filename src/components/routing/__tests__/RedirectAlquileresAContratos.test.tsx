import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { RedirectAlquileresAContratos } from '../RedirectAlquileresAContratos';

// Sonda que renderiza la ruta destino para verificar dónde acaba el redirect,
// incluyendo el query string preservado.
const Sonda = (): JSX.Element => {
  const { pathname, search } = useLocation();
  return <div data-testid="destino">{pathname + search}</div>;
};

const renderConRuta = (entrada: string): void => {
  render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path="/alquileres/*" element={<RedirectAlquileresAContratos />} />
        <Route path="/contratos" element={<Sonda />} />
        <Route path="/contratos/lista" element={<Sonda />} />
        <Route path="/contratos/nuevo" element={<Sonda />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('RedirectAlquileresAContratos · alias Fase B', () => {
  it('/alquileres → /contratos', () => {
    renderConRuta('/alquileres');
    expect(screen.getByTestId('destino')).toHaveTextContent('/contratos');
  });

  it('/alquileres/nuevo → /contratos/nuevo (preserva sufijo)', () => {
    renderConRuta('/alquileres/nuevo');
    expect(screen.getByTestId('destino')).toHaveTextContent('/contratos/nuevo');
  });

  it('/alquileres/lista → /contratos/lista', () => {
    renderConRuta('/alquileres/lista');
    expect(screen.getByTestId('destino')).toHaveTextContent('/contratos/lista');
  });

  it('preserva el query ?tab=vigentes', () => {
    renderConRuta('/alquileres?tab=vigentes');
    expect(screen.getByTestId('destino')).toHaveTextContent('/contratos?tab=vigentes');
  });

  it('preserva el query en sub-ruta (?inmueble=3 en /nuevo)', () => {
    renderConRuta('/alquileres/nuevo?inmueble=3');
    expect(screen.getByTestId('destino')).toHaveTextContent('/contratos/nuevo?inmueble=3');
  });
});
