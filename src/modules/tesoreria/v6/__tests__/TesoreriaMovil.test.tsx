// Vista móvil (§4.11).
//
// No es la de escritorio encogida: la pregunta cambia. En escritorio se
// planifica ("¿tengo para lo que viene?"), en móvil se despacha ("¿qué me queda
// por confirmar?"). Estos tests fijan esa diferencia y la recompensa de acabar.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TesoreriaMovil from '../TesoreriaMovil';
import type { Account, TreasuryEvent } from '../../../../services/db';

const cuenta = (id: number, alias: string, over: Partial<Account> = {}): Account =>
  ({
    id,
    alias,
    ultimosCuatro: `867${id}`,
    iban: `ES91004915000512345678${id}`,
    status: 'ACTIVE',
    activa: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Account;

const ev = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 1,
    accountId: 1,
    type: 'expense',
    amount: 100,
    predictedDate: '2026-08-10',
    description: 'Recibo',
    sourceType: 'manual',
    status: 'predicted',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as TreasuryEvent;

const base = {
  cuentas: [cuenta(1, 'Santander'), cuenta(2, 'Abanca')],
  saldoPorCuenta: new Map([
    [1, 1000],
    [2, 1000],
  ]),
  saldoHoy: 2000,
  cierre: 2400,
  month0: 7, // agosto
  onConfirmar: jest.fn(),
  onSubirExtracto: jest.fn(),
};

describe('el mini-hero', () => {
  it('enseña saldo hoy y el cierre, que es la única cifra en oro', () => {
    render(<TesoreriaMovil {...base} eventos={[]} />);

    expect(screen.getByText('Saldo hoy')).toBeInTheDocument();
    // §1-BIS · "Fin de mes" es de las prohibidas: la palabra es "Cierre".
    expect(screen.getByText('Cierre')).toBeInTheDocument();
  });

  it('la cabecera cuenta lo que queda, y dice "al día" cuando no queda nada', () => {
    const { unmount } = render(<TesoreriaMovil {...base} eventos={[ev(), ev({ id: 2 })]} />);
    expect(screen.getByText('2 por confirmar · agosto')).toBeInTheDocument();
    unmount();

    render(<TesoreriaMovil {...base} eventos={[]} />);
    expect(screen.getByText('al día · agosto')).toBeInTheDocument();
  });
});

describe('los pendientes, agrupados por cuenta', () => {
  it('cada cuenta con pendientes trae su nombre y sus últimos cuatro', () => {
    render(<TesoreriaMovil {...base} eventos={[ev({ accountId: 1 })]} />);

    expect(screen.getByText('Santander')).toBeInTheDocument();
    expect(screen.getByText('····8671')).toBeInTheDocument();
    // La cuenta 2 no tiene nada pendiente · no aparece (§4.11).
    expect(screen.queryByText('Abanca')).not.toBeInTheDocument();
  });

  it('un toque en la fila confirma · el objetivo es el pulgar, no un icono', () => {
    const onConfirmar = jest.fn();
    render(
      <TesoreriaMovil
        {...base}
        onConfirmar={onConfirmar}
        eventos={[ev({ id: 9, description: 'Mapfre' })]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Mapfre/ }));
    expect(onConfirmar).toHaveBeenCalledWith(9);
  });

  it('avisa de la cuenta que se queda corta, con la cifra', () => {
    render(<TesoreriaMovil {...base} eventos={[ev({ amount: 5000 })]} />);
    expect(screen.getByText(/se queda en/)).toHaveTextContent('4.000');
  });

  it('no avisa cuando la cuenta aguanta', () => {
    render(<TesoreriaMovil {...base} eventos={[ev({ amount: 50 })]} />);
    expect(screen.queryByText(/se queda en/)).not.toBeInTheDocument();
  });

  it('el importe de cada fila lleva signo', () => {
    render(
      <TesoreriaMovil
        {...base}
        eventos={[ev({ type: 'income', amount: 475, description: 'Lucía' })]}
      />
    );
    const fila = screen.getByRole('button', { name: /Confirmar Lucía/ });
    expect(within(fila).getByText(/^\+475/)).toBeInTheDocument();
  });
});

describe('nada pendiente · la recompensa', () => {
  it('lo dice y remata con el cierre proyectado', () => {
    render(<TesoreriaMovil {...base} eventos={[]} />);

    expect(screen.getByText('Nada por confirmar')).toBeInTheDocument();
    expect(screen.getByText('Tus 2 cuentas están al día.')).toBeInTheDocument();
    expect(screen.getByText(/Cierre · agosto/)).toBeInTheDocument();
  });

  it('singulariza con una sola cuenta', () => {
    render(<TesoreriaMovil {...base} cuentas={[cuenta(1, 'Santander')]} eventos={[]} />);
    expect(screen.getByText('Tu cuenta está al día.')).toBeInTheDocument();
  });
});

describe('subir extracto', () => {
  it('está siempre, con o sin pendientes', () => {
    const onSubirExtracto = jest.fn();
    const { unmount } = render(
      <TesoreriaMovil {...base} eventos={[]} onSubirExtracto={onSubirExtracto} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Subir extracto/ }));
    expect(onSubirExtracto).toHaveBeenCalled();
    unmount();

    render(<TesoreriaMovil {...base} eventos={[ev()]} />);
    expect(screen.getByRole('button', { name: /Subir extracto/ })).toBeInTheDocument();
  });
});

describe('lo que el móvil NO trae', () => {
  it('sin carrusel de cuentas ni proyección a seis meses · aquí se despacha', () => {
    render(<TesoreriaMovil {...base} eventos={[ev()]} />);

    expect(screen.queryByText(/Movimientos bancarios previstos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cómo va/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Saldo actual en mis cuentas/i)).not.toBeInTheDocument();
  });
});
