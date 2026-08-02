// Calendario diario (§4.9) · el día elegido.
//
// Lo que fija:
//   · el calendario es la COLA DE TRABAJO · solo lo que queda por confirmar.
//     Lo ya real vive en la cuenta (§4.4), que es donde se mira el histórico;
//     enseñándolo también aquí, un día no se vaciaba nunca al terminarlo.
//   · el día va agrupado POR CUENTA, como al entrar por la cuenta: bajo el
//     nombre de cada una, lo suyo.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import DrawerCalendario from '../DrawerCalendario';
import type { Account, Movement, TreasuryEvent } from '../../../../services/db';

const cuenta = (id: number, alias: string): Account => ({
  id,
  iban: `ES910049150005123456789${id}`,
  alias,
  status: 'ACTIVE',
  activa: true,
  createdAt: '',
  updatedAt: '',
});

const ev = (over: Partial<TreasuryEvent> & { id: number }): TreasuryEvent => ({
  type: 'expense',
  amount: 100,
  predictedDate: '2026-07-20',
  description: 'Recibo luz',
  sourceType: 'manual',
  status: 'predicted',
  accountId: 1,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const mov = (over: Partial<Movement> & { id: number }): Movement => ({
  accountId: 1,
  date: '2026-07-20',
  amount: -50,
  description: 'Compra ya conciliada',
  status: 'pendiente',
  unifiedStatus: 'conciliado',
  source: 'import',
  category: { tipo: 'Gastos' },
  type: 'Gasto',
  origin: 'CSV',
  movementState: 'Confirmado',
  ambito: 'PERSONAL',
  statusConciliacion: 'sin_match',
  createdAt: '',
  updatedAt: '',
  ...over,
});

const base = {
  abierto: true,
  year: 2026,
  month0: 6,
  hoy: '2026-07-01',
  onMes: jest.fn(),
  cuentas: [cuenta(1, 'Abanca'), cuenta(2, 'Unicaja')],
  saldoPorCuenta: new Map([
    [1, 5000],
    [2, 5000],
  ]),
  saldoTotalHoy: 10000,
  onCerrar: jest.fn(),
  onConfirmar: jest.fn(),
  onDescartar: jest.fn(),
  onConfirmarDia: jest.fn(),
  movimientos: [] as Movement[],
  eventos: [] as TreasuryEvent[],
};

/** Abre el día 20 de julio, que es donde estos tests montan todo. */
function abrirDia20() {
  fireEvent.click(screen.getByRole('gridcell', { name: /^20 de julio/ }));
}

describe('solo lo que queda por confirmar', () => {
  it('un movimiento ya real NO sale en el día · su sitio es la cuenta', () => {
    render(
      <DrawerCalendario
        {...base}
        eventos={[ev({ id: 1, description: 'Recibo luz' })]}
        movimientos={[mov({ id: 90, description: 'Compra ya conciliada' })]}
      />
    );
    abrirDia20();

    expect(screen.getByText('Recibo luz')).toBeInTheDocument();
    expect(screen.queryByText('Compra ya conciliada')).not.toBeInTheDocument();
    expect(screen.getByText('1 por confirmar')).toBeInTheDocument();
  });

  it('un día con todo hecho queda vacío, y lo dice', () => {
    render(<DrawerCalendario {...base} movimientos={[mov({ id: 90 })]} />);
    abrirDia20();
    expect(screen.getByText('Nada por confirmar este día')).toBeInTheDocument();
  });

  it('la celda tampoco cuenta lo ya real', () => {
    render(<DrawerCalendario {...base} movimientos={[mov({ id: 90 })]} />);
    // Sin nada pendiente, la celda no enseña cifra ninguna.
    expect(screen.getByRole('gridcell', { name: /^20 de julio · nada por confirmar/ })).toBeInTheDocument();
  });
});

describe('el día, agrupado por cuenta', () => {
  it('pone cada cargo bajo el nombre de SU cuenta', () => {
    render(
      <DrawerCalendario
        {...base}
        eventos={[
          ev({ id: 1, accountId: 1, description: 'Recibo luz' }),
          ev({ id: 2, accountId: 2, description: 'Seguro hogar' }),
          ev({ id: 3, accountId: 1, description: 'Recibo agua' }),
        ]}
      />
    );
    abrirDia20();

    expect(screen.getByText('Abanca')).toBeInTheDocument();
    expect(screen.getByText('Unicaja')).toBeInTheDocument();
    expect(screen.getByText('Recibo luz')).toBeInTheDocument();
    expect(screen.getByText('Seguro hogar')).toBeInTheDocument();
  });

  it('con una sola cuenta la cabecera SIGUE estando · dice de dónde sale todo', () => {
    // Agrupando por fecha se calla, porque repetiría el día que ya encabeza el
    // panel. Por cuenta no repite nada: es el dato que la lista plana no daba.
    render(<DrawerCalendario {...base} eventos={[ev({ id: 1, accountId: 1 })]} />);
    abrirDia20();
    expect(screen.getByText('Abanca')).toBeInTheDocument();
  });
});
