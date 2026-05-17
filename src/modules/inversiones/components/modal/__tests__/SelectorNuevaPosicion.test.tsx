// Smoke test · SelectorNuevaPosicion · PR 2 T-INVERSIONES-V5
// Cobertura mínima (spec §11.1) · render 6 cards · click cada una llama
// openModal con la familia correcta.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import SelectorNuevaPosicion, { type Familia } from '../SelectorNuevaPosicion';

// Helper de testing · refleja la ruta actual en el DOM para verificar
// navegación tras click en importer del footer.
const LocationProbe: React.FC = () => {
  const loc = useLocation();
  return <span data-testid="location-probe">{loc.pathname}</span>;
};

const renderSelector = (
  props: Partial<React.ComponentProps<typeof SelectorNuevaPosicion>> = {},
) => {
  const onPickFamilia = props.onPickFamilia ?? jest.fn();
  const onClose = props.onClose ?? jest.fn();
  const utils = render(
    <MemoryRouter initialEntries={['/inversiones']}>
      <SelectorNuevaPosicion
        onPickFamilia={onPickFamilia}
        onClose={onClose}
      />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
  return { ...utils, onPickFamilia, onClose };
};

describe('SelectorNuevaPosicion · 6 familias', () => {
  it('renderiza header navy + 6 cards con label y sub', () => {
    renderSelector();

    // Header
    expect(screen.getByText('Nueva posición')).toBeInTheDocument();
    expect(
      screen.getByText('elige la familia · el wizard te guía con los subtipos'),
    ).toBeInTheDocument();

    // 6 cards · label
    expect(screen.getByText('Plan de pensiones')).toBeInTheDocument();
    expect(screen.getByText('Fondo de inversión')).toBeInTheDocument();
    expect(screen.getByText('Acción / ETF / REIT')).toBeInTheDocument();
    expect(screen.getByText('Préstamo')).toBeInTheDocument();
    expect(screen.getByText('Depósito o cuenta')).toBeInTheDocument();
    expect(screen.getByText('Crypto u otros')).toBeInTheDocument();

    // 6 cards · sub
    expect(screen.getByText('PPI · PPE · PPES · PPA')).toBeInTheDocument();
    expect(screen.getByText('FI español o UCITS · art. 94')).toBeInTheDocument();
    expect(screen.getByText('valores cotizados en bolsa')).toBeInTheDocument();
    expect(screen.getByText('P2P o a empresa')).toBeInTheDocument();
    expect(screen.getByText('plazo fijo o remunerada · FGD')).toBeInTheDocument();
    expect(screen.getByText('exchanges, carteras frías, oro')).toBeInTheDocument();

    // 6 botones tipo familia
    const familiaButtons = screen
      .getAllByRole('button')
      .filter((b) => b.dataset.familia);
    expect(familiaButtons).toHaveLength(6);
  });

  it.each<[Familia, string]>([
    ['plan', 'Plan de pensiones'],
    ['fondo', 'Fondo de inversión'],
    ['accion', 'Acción / ETF / REIT'],
    ['prestamo', 'Préstamo'],
    ['deposito', 'Depósito o cuenta'],
    ['crypto', 'Crypto u otros'],
  ])(
    'click en "%s" llama onPickFamilia con la familia correcta',
    (familia, label) => {
      const { onPickFamilia } = renderSelector();
      // Cards usan `data-familia=<key>` para identificarse · click sobre el botón.
      const button = document.querySelector(`button[data-familia="${familia}"]`);
      expect(button).not.toBeNull();
      fireEvent.click(button!);
      expect(onPickFamilia).toHaveBeenCalledTimes(1);
      expect(onPickFamilia).toHaveBeenCalledWith(familia);
      // El label visible coincide con el contenido textual del botón
      expect(button!.textContent).toContain(label);
    },
  );

  it('renderiza 2 hints en el footer (Indexa + CSV)', () => {
    renderSelector();
    expect(screen.getByText(/Indexa Capital/)).toBeInTheDocument();
    expect(screen.getByText(/Aportaciones CSV/)).toBeInTheDocument();
  });

  it('click en "Indexa Capital" cierra el selector y navega al importer', () => {
    const { onClose } = renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /Indexa Capital/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/inversiones/importar-indexa',
    );
  });

  it('click en "Aportaciones CSV" cierra el selector y navega al importer', () => {
    const { onClose } = renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /Aportaciones CSV/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/inversiones/importar-aportaciones',
    );
  });

  it('llama onClose al pulsar Escape', () => {
    const { onClose } = renderSelector();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('llama onClose al click en el botón X del header', () => {
    const { onClose } = renderSelector();
    fireEvent.click(screen.getByTestId('modal-atlas-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
