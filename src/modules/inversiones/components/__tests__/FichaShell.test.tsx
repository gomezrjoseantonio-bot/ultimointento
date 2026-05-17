// Smoke test · FichaShell · PR 1 T-INVERSIONES-V5
// Cobertura mínima (spec §11.1) · render hero + actionbar · sin crash.
// FichaShell ya existía en el repo (decisión Q3 · reutilizar y extender) ·
// este test fija el comportamiento actual como contrato.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import FichaShell from '../FichaShell';

describe('FichaShell · smoke', () => {
  it('renderiza hero + meta + stats sin crash', () => {
    render(
      <FichaShell
        onBack={() => undefined}
        hero={{
          variant: 'plan',
          badge: 'Plan de pensiones · PPI',
          logo: { text: 'BBVA' },
          title: 'Plan BBVA Mixto',
          meta: 'Gestora BBVA',
          stats: [
            { lab: 'Valor', val: '12.500 €' },
            { lab: 'Aportado', val: '10.000 €' },
            { lab: 'Rentab.', val: '+25,0%', valVariant: 'pos' },
            { lab: 'Fiscalidad', val: '4.500 €', valVariant: 'gold' },
          ],
        }}
      >
        <div data-testid="ficha-children">Contenido específico</div>
      </FichaShell>,
    );

    expect(screen.getByText('Plan de pensiones · PPI')).toBeInTheDocument();
    expect(screen.getByText('Plan BBVA Mixto')).toBeInTheDocument();
    expect(screen.getByText('Gestora BBVA')).toBeInTheDocument();
    expect(screen.getByText('Valor')).toBeInTheDocument();
    expect(screen.getByText('12.500 €')).toBeInTheDocument();
    expect(screen.getByTestId('ficha-children')).toBeInTheDocument();
  });

  it('renderiza acciones cuando se proporcionan y dispara onClick', () => {
    const onAportar = jest.fn();
    const onEditar = jest.fn();
    render(
      <FichaShell
        onBack={() => undefined}
        hero={{
          variant: 'plan',
          badge: 'badge',
          logo: { text: 'B' },
          title: 'T',
          stats: [{ lab: 'X', val: 'Y' }],
        }}
        actions={[
          { label: 'Aportar', onClick: onAportar },
          { label: 'Editar', onClick: onEditar, variant: 'gold' },
        ]}
      >
        <div>contenido</div>
      </FichaShell>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Aportar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(onAportar).toHaveBeenCalledTimes(1);
    expect(onEditar).toHaveBeenCalledTimes(1);
  });

  it('renderiza modo legacy (sin hero) con title + subtitle + tipoChip', () => {
    render(
      <FichaShell
        onBack={() => undefined}
        title="Plan legacy"
        subtitle="subtítulo"
        tipoChip="PPI"
      >
        <div>contenido</div>
      </FichaShell>,
    );
    expect(screen.getByText('Plan legacy')).toBeInTheDocument();
    expect(screen.getByText('subtítulo')).toBeInTheDocument();
    expect(screen.getByText('PPI')).toBeInTheDocument();
  });

  it('dispara onBack al pulsar "Volver a Inversiones"', () => {
    const onBack = jest.fn();
    render(
      <FichaShell onBack={onBack} title="x">
        <div>x</div>
      </FichaShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Volver a Inversiones/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
