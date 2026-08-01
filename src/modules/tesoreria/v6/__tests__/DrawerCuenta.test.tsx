// Drawer de cuenta (§4.4) · la bandeja de trabajo.
//
// Lo que fija: que Pendientes muestre SOLO lo que falta por ocurrir, que un
// descartado no aparezca, que las dos pestañas usen `PunteoList` con la
// configuración que pide §4.4, y que el estado vacío diga lo que tiene que
// decir en vez de parecer un error.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import DrawerCuenta from '../DrawerCuenta';
import type { Account, Movement, TreasuryEvent } from '../../../../services/db';

const cuenta: Account = {
  id: 1,
  iban: 'ES9100491500051234567892',
  alias: 'Sabadell principal',
  ultimosCuatro: '7892',
  status: 'ACTIVE',
  activa: true,
  createdAt: '',
  updatedAt: '',
};

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
  date: '2026-07-05',
  amount: -50,
  description: 'Compra',
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
  cuenta,
  saldoHoy: 1000,
  year: 2026,
  month0: 6,
  // A1 · Pendientes solo lista lo que YA debería haber pasado, así que los
  // tests necesitan una fecha de "hoy" posterior a los previstos que montan.
  hoy: '2026-07-31',
  onCerrar: jest.fn(),
  onConfirmar: jest.fn(),
  onDescartar: jest.fn(),
  movimientos: [] as Movement[],
  eventos: [] as TreasuryEvent[],
};

describe('cabecera', () => {
  it('pinta nombre, mask y los 4 KPIs recalculados', () => {
    render(
      <DrawerCuenta
        {...base}
        eventos={[
          ev({ id: 1, type: 'income', amount: 650, predictedDate: '2026-07-20' }),
          ev({ id: 2, type: 'expense', amount: 200, predictedDate: '2026-07-25' }),
        ]}
      />
    );

    expect(screen.getByText('Sabadell principal')).toBeInTheDocument();
    expect(screen.getByText('···· 7892')).toBeInTheDocument();
    expect(screen.getByText('Saldo hoy')).toBeInTheDocument();
    expect(screen.getByText('+650 €')).toBeInTheDocument();
    expect(screen.getByText('−200 €')).toBeInTheDocument();
    // Saldo final = 1000 + 650 − 200
    expect(screen.getByText('1.450 €')).toBeInTheDocument();
  });

  it('un descartado no mueve los KPIs', () => {
    render(
      <DrawerCuenta
        {...base}
        eventos={[ev({ id: 1, type: 'expense', amount: 500, descartado: true })]}
      />
    );
    // Saldo final sigue siendo el saldo de hoy.
    expect(screen.getAllByText('1.000 €').length).toBeGreaterThan(0);
  });
});

// A1 · el defecto más grave del parte: la bandeja listaba 252 "pendientes",
// entre ellos recibos de diciembre estando a 1 de agosto. Eso no son
// pendientes, son previsiones futuras. Pendiente = lo que YA debería haber
// pasado y sigue sin confirmar; es una bandeja que se vacía.
describe('A1 · Pendientes no mezcla futuro', () => {
  it('lo que aún no ha llegado NO es trabajo de hoy', () => {
    render(
      <DrawerCuenta
        {...base}
        hoy="2026-07-15"
        eventos={[
          ev({ id: 1, predictedDate: '2026-07-10', description: 'Ya venció' }),
          ev({ id: 2, predictedDate: '2026-12-20', description: 'Diciembre' }),
        ]}
      />
    );

    expect(screen.getByText('Ya venció')).toBeInTheDocument();
    expect(screen.queryByText('Diciembre')).not.toBeInTheDocument();
    // Y el contador cuenta eso y solo eso · un 252 abruma en vez de tranquilizar.
    expect(screen.getByRole('button', { name: /Pendientes · 1/ })).toBeInTheDocument();
  });

  it('lo de HOY sí entra · vence hoy y sigue sin confirmar', () => {
    render(
      <DrawerCuenta
        {...base}
        hoy="2026-07-15"
        eventos={[ev({ id: 1, predictedDate: '2026-07-15', description: 'Vence hoy' })]}
      />
    );
    expect(screen.getByText('Vence hoy')).toBeInTheDocument();
  });

  it('lo más reciente arriba · es por donde se empieza a vaciar', () => {
    render(
      <DrawerCuenta
        {...base}
        hoy="2026-07-31"
        eventos={[
          ev({ id: 1, predictedDate: '2026-07-05', description: 'Antiguo' }),
          ev({ id: 2, predictedDate: '2026-07-28', description: 'Reciente' }),
        ]}
      />
    );

    const conceptos = screen.getAllByText(/Antiguo|Reciente/).map((n) => n.textContent);
    expect(conceptos).toEqual(['Reciente', 'Antiguo']);
  });
});

describe('pestaña Pendientes', () => {
  it('lista lo que falta por ocurrir y lo cuenta en la pestaña', () => {
    render(<DrawerCuenta {...base} eventos={[ev({ id: 1 }), ev({ id: 2, description: 'Agua' })]} />);

    expect(screen.getByRole('button', { name: /Pendientes · 2/ })).toBeInTheDocument();
    expect(screen.getByText('Recibo luz')).toBeInTheDocument();
    expect(screen.getByText('Agua')).toBeInTheDocument();
  });

  it('un descartado no aparece ni cuenta', () => {
    render(
      <DrawerCuenta {...base} eventos={[ev({ id: 1 }), ev({ id: 2, description: 'Agua', descartado: true })]} />
    );
    expect(screen.getByRole('button', { name: /Pendientes · 1/ })).toBeInTheDocument();
    expect(screen.queryByText('Agua')).not.toBeInTheDocument();
  });

  it('un ejecutado tampoco: su realidad ya vive en el movimiento', () => {
    render(<DrawerCuenta {...base} eventos={[ev({ id: 1, status: 'executed' })]} />);
    expect(screen.getByRole('button', { name: /Pendientes · 0/ })).toBeInTheDocument();
  });

  it('usa la anatomía de fila de Tesorería: editar y descartar en la fila', () => {
    render(<DrawerCuenta {...base} eventos={[ev({ id: 1 })]} onEditar={jest.fn()} />);
    expect(screen.getByLabelText('Editar Recibo luz')).toBeInTheDocument();
    expect(screen.getByLabelText('Descartar Recibo luz')).toBeInTheDocument();
  });

  it('el círculo confirma y el aspa descarta', () => {
    const onConfirmar = jest.fn();
    const onDescartar = jest.fn();
    render(<DrawerCuenta {...base} eventos={[ev({ id: 1 })]} onConfirmar={onConfirmar} onDescartar={onDescartar} />);

    fireEvent.click(screen.getByLabelText('Puntear Recibo luz'));
    expect(onConfirmar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Descartar Recibo luz'));
    expect(onDescartar).toHaveBeenCalledTimes(1);
  });

  it('sin nada pendiente, el vacío es una buena noticia y no un error', () => {
    render(<DrawerCuenta {...base} eventos={[]} />);
    expect(screen.getByText('Nada pendiente')).toBeInTheDocument();
    expect(screen.getByText('el mes está al día en esta cuenta')).toBeInTheDocument();
  });

  it('no pinta los chips de estado: mandan las pestañas (§4.4)', () => {
    render(<DrawerCuenta {...base} eventos={[ev({ id: 1 })]} />);
    expect(screen.queryByRole('tablist', { name: /estado de punteo/i })).not.toBeInTheDocument();
  });
});

describe('pestaña Todo {mes}', () => {
  const abrirTodo = () => fireEvent.click(screen.getByRole('button', { name: /Todo julio/ }));

  it('mezcla previsión y realidad del mes', () => {
    render(
      <DrawerCuenta {...base} eventos={[ev({ id: 1 })]} movimientos={[mov({ id: 9, description: 'Compra real' })]} />
    );
    abrirTodo();

    // Los grupos nacen plegados (§4.4), así que se busca para abrirlos.
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'a' } });
    expect(screen.getByText('Compra real')).toBeInTheDocument();
  });

  it('trae buscador y ejes de agrupación', () => {
    render(<DrawerCuenta {...base} eventos={[ev({ id: 1 })]} />);
    abrirTodo();

    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: /agrupar por/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Inmueble' })).toBeInTheDocument();
  });

  it('los grupos nacen plegados con recuento y subtotal', () => {
    render(<DrawerCuenta {...base} eventos={[ev({ id: 1 })]} />);
    abrirTodo();

    // Plegado: la fila no está, pero su cabecera sí.
    expect(screen.queryByText('Recibo luz')).not.toBeInTheDocument();
    const cab = screen.getAllByRole('button', { expanded: false })[0];
    expect(within(cab).getByText('1')).toBeInTheDocument();
  });

  it('esconde Anotar y Subir extracto: son de la bandeja, no de la consulta', () => {
    render(<DrawerCuenta {...base} eventos={[ev({ id: 1 })]} />);
    expect(screen.getByRole('button', { name: /Anotar/ })).toBeInTheDocument();

    abrirTodo();
    expect(screen.queryByRole('button', { name: /Anotar/ })).not.toBeInTheDocument();
  });
});

describe('cierre', () => {
  it('el aspa y el fondo cierran el drawer', () => {
    const onCerrar = jest.fn();
    const { container } = render(<DrawerCuenta {...base} onCerrar={onCerrar} />);

    fireEvent.click(screen.getByLabelText('Cerrar'));
    expect(onCerrar).toHaveBeenCalledTimes(1);

    fireEvent.click(container.querySelector('.back')!);
    expect(onCerrar).toHaveBeenCalledTimes(2);
  });

  it('sin cuenta no renderiza nada', () => {
    const { container } = render(<DrawerCuenta {...base} cuenta={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
