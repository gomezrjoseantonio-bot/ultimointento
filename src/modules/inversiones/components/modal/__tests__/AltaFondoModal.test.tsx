// Smoke test · AltaFondoModal · PR 3 T-INVERSIONES-V5
// Cobertura mínima (spec §11.1 PR 3) · render + preview muestra "Régimen art. 94".

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import AltaFondoModal from '../AltaFondoModal';

describe('AltaFondoModal · alta fondo de inversión', () => {
  it('renderiza header + form básico + preview con régimen art. 94', () => {
    render(<AltaFondoModal onSave={() => undefined} onClose={() => undefined} />);

    expect(screen.getByText('Nuevo fondo de inversión')).toBeInTheDocument();
    expect(screen.getByText(/FI español o UCITS/)).toBeInTheDocument();

    // Form
    expect(screen.getByText(/Nombre del fondo/)).toBeInTheDocument();
    expect(screen.getByText(/Gestora \/ broker/)).toBeInTheDocument();
    expect(screen.getByText('ISIN', { exact: false })).toBeInTheDocument();

    // Preview · régimen art. 94
    expect(screen.getByText('Art. 94 LIRPF')).toBeInTheDocument();
    expect(screen.getByText('diferimiento por traspaso')).toBeInTheDocument();
    // El banner usa <strong> que rompe el nodo de texto · busco el banner
    // directamente con matcher por su texto fragmentado.
    expect(
      screen.getAllByText(
        (_, el) => Boolean(
          el?.textContent?.includes('traspasos') &&
          el?.textContent?.includes('entre fondos NO generan'),
        ),
      ).length,
    ).toBeGreaterThan(0);
  });

  it('llama onSave con tipo=fondo_inversion al rellenar campos requeridos', () => {
    const onSave = jest.fn();
    const onClose = jest.fn();
    render(<AltaFondoModal onSave={onSave} onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText(/MSCI World UCITS/), {
      target: { value: 'MSCI World' },
    });
    fireEvent.change(screen.getByPlaceholderText(/MyInvestor, Indexa/), {
      target: { value: 'MyInvestor' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear fondo/ }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const arg = onSave.mock.calls[0][0];
    expect(arg.tipo).toBe('fondo_inversion');
    expect(arg.nombre).toBe('MSCI World');
    expect(arg.entidad).toBe('MyInvestor');
    expect(arg.activo).toBe(true);
  });

  it('cancelar dispara onClose', () => {
    const onClose = jest.fn();
    render(<AltaFondoModal onSave={() => undefined} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
