// Smoke test · GaleriaFiltros · PR 2 T-INVERSIONES-V5
// Cobertura mínima (spec §11.1) · click en pill activa filtro · contador correcto.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import GaleriaFiltros from '../GaleriaFiltros';

const COUNTS = { planes: 2, equity: 4, rentaFija: 1, otros: 0 };

describe('GaleriaFiltros · pills horizontales', () => {
  it('renderiza 5 pills + botón ordenar con conteos correctos', () => {
    render(
      <GaleriaFiltros
        selected="todas"
        onSelect={() => undefined}
        counts={COUNTS}
        onSortClick={() => undefined}
      />,
    );

    expect(screen.getByText('Todas')).toBeInTheDocument();
    expect(screen.getByText('Planes pensiones')).toBeInTheDocument();
    expect(screen.getByText('Equity / fondos')).toBeInTheDocument();
    expect(screen.getByText('Renta fija')).toBeInTheDocument();
    expect(screen.getByText('Otros')).toBeInTheDocument();

    // Pill "Todas" suma · 2 + 4 + 1 + 0 = 7
    const todasPill = screen.getByRole('button', { name: /Todas/ });
    expect(todasPill.textContent).toMatch(/7/);

    // Cada pill muestra su conteo individual
    expect(screen.getByRole('button', { name: /Planes pensiones/ }).textContent).toMatch(/2/);
    expect(screen.getByRole('button', { name: /Equity \/ fondos/ }).textContent).toMatch(/4/);
    expect(screen.getByRole('button', { name: /Renta fija/ }).textContent).toMatch(/1/);
    expect(screen.getByRole('button', { name: /Otros/ }).textContent).toMatch(/0/);

    // Botón "Ordenar"
    expect(screen.getByText(/Ordenar/)).toBeInTheDocument();
  });

  it('aplica aria-pressed=true al pill activo', () => {
    render(
      <GaleriaFiltros
        selected="equity"
        onSelect={() => undefined}
        counts={COUNTS}
      />,
    );
    expect(screen.getByRole('button', { name: /Equity \/ fondos/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /Todas/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('llama onSelect con la clave correcta al clicar cada pill', () => {
    const onSelect = jest.fn();
    render(
      <GaleriaFiltros selected="todas" onSelect={onSelect} counts={COUNTS} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Planes pensiones/ }));
    expect(onSelect).toHaveBeenLastCalledWith('planes');

    fireEvent.click(screen.getByRole('button', { name: /Equity \/ fondos/ }));
    expect(onSelect).toHaveBeenLastCalledWith('equity');

    fireEvent.click(screen.getByRole('button', { name: /Renta fija/ }));
    expect(onSelect).toHaveBeenLastCalledWith('rentaFija');

    fireEvent.click(screen.getByRole('button', { name: /Otros/ }));
    expect(onSelect).toHaveBeenLastCalledWith('otros');

    fireEvent.click(screen.getByRole('button', { name: /Todas/ }));
    expect(onSelect).toHaveBeenLastCalledWith('todas');

    expect(onSelect).toHaveBeenCalledTimes(5);
  });

  it('dispara onSortClick al clicar el botón "Ordenar"', () => {
    const onSortClick = jest.fn();
    render(
      <GaleriaFiltros
        selected="todas"
        onSelect={() => undefined}
        counts={COUNTS}
        onSortClick={onSortClick}
      />,
    );
    fireEvent.click(screen.getByText(/Ordenar/));
    expect(onSortClick).toHaveBeenCalledTimes(1);
  });
});
