import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import AccionesRapidas from '../AccionesRapidas';

describe('AccionesRapidas', () => {
  it('renderiza la acción rápida "Actualizar valores" y abre su flujo dedicado', () => {
    const onNavigate = jest.fn();
    const onOpenUpdateValues = jest.fn();

    render(
      <AccionesRapidas
        onNavigate={onNavigate}
        onOpenUpdateValues={onOpenUpdateValues}
      />,
    );

    fireEvent.click(screen.getByText('Actualizar valores'));

    expect(screen.getByText('IPC, Euríbor, inmuebles e inversiones')).toBeInTheDocument();
    expect(onOpenUpdateValues).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
