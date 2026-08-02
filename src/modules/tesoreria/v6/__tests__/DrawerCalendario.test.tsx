// Calendario diario (§4.9) · el día elegido.
//
// Lo que fija:
//   · el calendario mira HACIA DELANTE · solo lo que el saldo de hoy no
//     incorpora todavía. Lo ya pasado vive en la cuenta (§4.4), que es donde se
//     mira el histórico; enseñándolo también aquí, un día no se vaciaba nunca
//     al terminarlo.
//   · pero un movimiento con fecha adelantada SÍ entra: no pide confirmar nada
//     y sin embargo mueve dinero ese día, y si es él quien deja la cuenta corta
//     tiene que haber una fila que lo explique.
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

describe('solo lo que todavía no ha movido dinero', () => {
  // `hoy` es el 1 de julio, así que un movimiento del día 20 está ADELANTADO:
  // para que quede "ya pasado" hay que ponerle fecha anterior a hoy.
  const yaPasado = { ...base, hoy: '2026-07-31' };

  it('un movimiento ya pasado NO sale en el día · su sitio es la cuenta', () => {
    render(
      <DrawerCalendario
        {...yaPasado}
        eventos={[ev({ id: 1, description: 'Recibo luz' })]}
        movimientos={[mov({ id: 90, description: 'Compra ya conciliada' })]}
      />
    );
    abrirDia20();

    expect(screen.getByText('Recibo luz')).toBeInTheDocument();
    expect(screen.queryByText('Compra ya conciliada')).not.toBeInTheDocument();
    expect(screen.getByText('1 pendiente')).toBeInTheDocument();
  });

  it('un día que ya ocurrió entero queda vacío, y lo dice', () => {
    render(<DrawerCalendario {...yaPasado} movimientos={[mov({ id: 90 })]} />);
    abrirDia20();
    expect(screen.getByText('Nada pendiente este día')).toBeInTheDocument();
  });

  it('la celda tampoco cuenta lo ya pasado', () => {
    render(<DrawerCalendario {...yaPasado} movimientos={[mov({ id: 90 })]} />);
    expect(
      screen.getByRole('gridcell', { name: /^20 de julio · nada pendiente/ })
    ).toBeInTheDocument();
  });

  it('un movimiento ADELANTADO sí sale · es quien puede dejar la cuenta corta', () => {
    // Con hoy = 1 de julio, el del día 20 aún no está en el saldo.
    render(<DrawerCalendario {...base} movimientos={[mov({ id: 90, description: 'Recibo adelantado' })]} />);
    abrirDia20();
    expect(screen.getByText('Recibo adelantado')).toBeInTheDocument();
  });

  it('un evento ya confirmado se pinta, pero no se lee como tarea', () => {
    // `confirmed` es una venta o una liquidación: está decidido y solo espera
    // al banco. Mueve dinero, así que tiene que verse; pero el chip de estado
    // lo separa del previsto, que es el que sí hay que confirmar.
    render(
      <DrawerCalendario
        {...base}
        eventos={[
          ev({ id: 1, description: 'Recibo luz' }),
          ev({ id: 2, description: 'Venta piso', status: 'confirmed', type: 'income', amount: 200000 }),
        ]}
      />
    );
    abrirDia20();
    expect(screen.getByText('Venta piso')).toBeInTheDocument();
    expect(screen.getByText('confirmado')).toBeInTheDocument();
    expect(screen.getByText('previsto')).toBeInTheDocument();
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
