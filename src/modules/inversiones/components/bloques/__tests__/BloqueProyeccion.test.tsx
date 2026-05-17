// Smoke test · BloqueProyeccion (PR 1 · spec §11 fila 2).
// Render con datos mock + toggle de escenarios cambia clase active.

import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import BloqueProyeccion from '../BloqueProyeccion';

describe('BloqueProyeccion · shell PR 1', () => {
  test('renderiza con props mínimas · expone los 3 toggles de escenario', () => {
    render(<BloqueProyeccion posicionId="pos-1" tipoActivo="plan_pensiones" />);
    expect(screen.getByLabelText('Proyección')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escenario actual' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Si cambias gestora' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Si aportas el máximo' })).toBeInTheDocument();
  });

  test('toggle inicial · "Escenario actual" tiene clase active · los otros no', () => {
    render(<BloqueProyeccion posicionId="pos-1" tipoActivo="plan_pensiones" />);
    const btnActual = screen.getByRole('button', { name: 'Escenario actual' });
    const btnBench = screen.getByRole('button', { name: 'Si cambias gestora' });
    const btnMax = screen.getByRole('button', { name: 'Si aportas el máximo' });
    expect(btnActual.className).toMatch(/active/);
    expect(btnBench.className).not.toMatch(/active/);
    expect(btnMax.className).not.toMatch(/active/);
  });

  test('al click en "Si cambias gestora" · la clase active migra a ese botón', () => {
    render(<BloqueProyeccion posicionId="pos-1" tipoActivo="plan_pensiones" />);
    const btnActual = screen.getByRole('button', { name: 'Escenario actual' });
    const btnBench = screen.getByRole('button', { name: 'Si cambias gestora' });
    fireEvent.click(btnBench);
    expect(btnBench.className).toMatch(/active/);
    expect(btnActual.className).not.toMatch(/active/);
  });

  test('al click en "Si aportas el máximo" · ese botón queda activo', () => {
    render(<BloqueProyeccion posicionId="pos-1" tipoActivo="plan_pensiones" />);
    const btnMax = screen.getByRole('button', { name: 'Si aportas el máximo' });
    fireEvent.click(btnMax);
    expect(btnMax.className).toMatch(/active/);
  });

  test('genérico · acepta otros tipos de activo · expone data-tipo-activo', () => {
    const { container } = render(
      <BloqueProyeccion posicionId="pos-2" tipoActivo="fondo" />,
    );
    const root = container.querySelector('[data-bloque="P1"]');
    expect(root).not.toBeNull();
    expect(root!.getAttribute('data-tipo-activo')).toBe('fondo');
    expect(root!.getAttribute('data-posicion-id')).toBe('pos-2');
  });

  test('mensaje override · sustituye el copy provisional del shell', () => {
    render(
      <BloqueProyeccion
        posicionId="pos-1"
        tipoActivo="plan_pensiones"
        mensaje="A los 65 años tendrás X €"
      />,
    );
    expect(screen.getByText(/A los 65 años tendrás X €/)).toBeInTheDocument();
  });
});
