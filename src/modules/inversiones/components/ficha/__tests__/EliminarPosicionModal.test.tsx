// INVERSIONES V1 · Fase 3 · EliminarPosicionModal · confirmación destructiva.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import EliminarPosicionModal from '../EliminarPosicionModal';

const renderModal = () => {
  const onConfirm = jest.fn();
  const onClose = jest.fn();
  render(<EliminarPosicionModal what="«Orange»" onConfirm={onConfirm} onClose={onClose} />);
  return { onConfirm, onClose };
};

describe('EliminarPosicionModal', () => {
  it('muestra qué se elimina y avisa de que no borra conciliados', () => {
    renderModal();
    expect(screen.getByText('¿Eliminar «Orange»?')).toBeInTheDocument();
    expect(screen.getByText(/no se borran/i)).toBeInTheDocument();
  });

  it('confirma con "Eliminar" y cancela con "Cancelar"', () => {
    const { onConfirm, onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cierra con Escape', () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
