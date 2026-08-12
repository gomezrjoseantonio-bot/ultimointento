import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import NuevoContrato from '../NuevoContrato';

// Los wizards hijos se stubean · aquí solo probamos el ruteo del paso 0.
jest.mock('../NuevoContratoWizard', () => () => <div data-testid="wiz-directo">directo</div>);
jest.mock('../NuevoContratoGestionWizard', () => (props: { onBack?: () => void }) => (
  <div data-testid="wiz-gestion">
    gestión
    <button type="button" onClick={props.onBack}>volver-paso-0</button>
  </div>
));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/contratos/nuevo" element={<NuevoContrato />} />
        <Route path="/contratos" element={<div data-testid="lista">lista</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('NuevoContrato · paso 0 · tipo de contrato', () => {
  it('muestra las dos tarjetas de tipo', () => {
    renderAt('/contratos/nuevo');
    expect(screen.getByText('Alquiler directo')).toBeInTheDocument();
    expect(screen.getByText('Gestión delegada')).toBeInTheDocument();
    expect(screen.queryByTestId('wiz-directo')).toBeNull();
    expect(screen.queryByTestId('wiz-gestion')).toBeNull();
  });

  it('elegir "Alquiler directo" renderiza el wizard LAU', () => {
    renderAt('/contratos/nuevo');
    fireEvent.click(screen.getByText('Alquiler directo'));
    expect(screen.getByTestId('wiz-directo')).toBeInTheDocument();
  });

  it('elegir "Gestión delegada" renderiza el wizard de gestión, y se puede volver al paso 0', () => {
    renderAt('/contratos/nuevo');
    fireEvent.click(screen.getByText('Gestión delegada'));
    expect(screen.getByTestId('wiz-gestion')).toBeInTheDocument();
    fireEvent.click(screen.getByText('volver-paso-0'));
    expect(screen.getByText('Alquiler directo')).toBeInTheDocument();
  });

  it('en modo edición (?edit=) salta el paso 0 y va directo al wizard LAU', () => {
    renderAt('/contratos/nuevo?edit=5');
    expect(screen.getByTestId('wiz-directo')).toBeInTheDocument();
    expect(screen.queryByText('Gestión delegada')).toBeNull();
  });
});
