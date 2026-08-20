// "Mis Bancos" (F1) · el switch reparte UN mismo espacio entre cuentas y
// tarjetas, y el botón de añadir cambia con él. Lo que se prueba aquí es
// justamente eso: que nunca se vean las dos mitades a la vez y que "+ Añadir"
// no mande al sitio equivocado.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import MisBancos from '../MisBancos';
import type { FilaCuenta } from '../TablaCuentas';
import type { FilaTarjeta } from '../ListaTarjetas';
import type { Account } from '../../../../services/db';
import type { KpisHero } from '../../../../services/tesoreriaV6Metrics';
import type { Tarjeta } from '../../../../types/tarjetas';

const kpis: KpisHero = {
  saldo: 1000,
  numCuentas: 1,
  pendienteEntrar: 0,
  movimientosEntrar: 0,
  pendienteSalir: 0,
  movimientosSalir: 0,
  cierre: 1000,
  ultimoDia: 31,
};

const filaCuenta: FilaCuenta = {
  cuenta: { id: 1, iban: 'ES001', status: 'ACTIVE', activa: true, createdAt: '', updatedAt: '' } as Account,
  nombre: 'Unicaja',
  mask: '4437',
  saldo: 1000,
  entra: 0,
  sale: 0,
  cierre: 1000,
  estado: { tipo: 'al-dia' },
};

const filaTarjeta: FilaTarjeta = {
  tarjeta: { id: 7, alias: 'Visa Oro', modalidad: 'credito', activa: true } as Tarjeta,
  sub: 'liquida en Unicaja',
  consumo: 250,
  etiqueta: 'consumido · ciclo',
};

const noop = () => undefined;

const montar = (over: Partial<React.ComponentProps<typeof MisBancos>> = {}) =>
  render(
    <MisBancos
      filasCuentas={[filaCuenta]}
      kpis={kpis}
      mesActual="agosto"
      onAbrirCuenta={noop}
      onEditarCuenta={noop}
      onEliminarCuenta={noop}
      onAnadirCuenta={noop}
      onPrevision={noop}
      filasTarjetas={[filaTarjeta]}
      onAbrirTarjeta={noop}
      onEditarTarjeta={noop}
      onEliminarTarjeta={noop}
      onAnadirTarjeta={noop}
      {...over}
    />
  );

const irA = (rotulo: string) => fireEvent.click(screen.getByRole('tab', { name: rotulo }));

describe('el switch Cuentas · Tarjetas', () => {
  it('arranca en Cuentas · la tabla se ve y las tarjetas no', () => {
    montar();
    expect(screen.getByRole('tab', { name: 'Cuentas' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Unicaja')).toBeInTheDocument();
    expect(screen.queryByText('Visa Oro')).not.toBeInTheDocument();
  });

  it('al pasar a Tarjetas se cambia la mitad visible · comparten espacio', () => {
    montar();
    irA('Tarjetas');
    expect(screen.getByText('Visa Oro')).toBeInTheDocument();
    // La tabla de cuentas desaparece entera, con su fila Total incluida. Las
    // dos mitades tienen pie, así que se comprueba CUÁL de los dos está.
    expect(screen.queryByText('Unicaja')).not.toBeInTheDocument();
    expect(screen.queryByText(/Total · 1 cuenta/)).not.toBeInTheDocument();
    expect(screen.getByText(/Total · 1 tarjeta/)).toBeInTheDocument();
  });

  it('se puede volver a Cuentas', () => {
    montar();
    irA('Tarjetas');
    irA('Cuentas');
    expect(screen.getByText('Unicaja')).toBeInTheDocument();
    expect(screen.queryByText('Visa Oro')).not.toBeInTheDocument();
  });
});

describe('el botón "+ Añadir" es contextual', () => {
  it('en Cuentas dice "+ Añadir cuenta" y llama al alta de cuenta', () => {
    const onAnadirCuenta = jest.fn();
    const onAnadirTarjeta = jest.fn();
    montar({ onAnadirCuenta, onAnadirTarjeta });

    fireEvent.click(screen.getByRole('button', { name: '+ Añadir cuenta' }));
    expect(onAnadirCuenta).toHaveBeenCalledTimes(1);
    expect(onAnadirTarjeta).not.toHaveBeenCalled();
  });

  it('en Tarjetas cambia de etiqueta Y de acción', () => {
    const onAnadirCuenta = jest.fn();
    const onAnadirTarjeta = jest.fn();
    montar({ onAnadirCuenta, onAnadirTarjeta });
    irA('Tarjetas');

    // El de cuenta ya no existe: es UN botón que cambia, no dos a la vez.
    expect(screen.queryByRole('button', { name: '+ Añadir cuenta' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Añadir tarjeta' }));
    expect(onAnadirTarjeta).toHaveBeenCalledTimes(1);
    expect(onAnadirCuenta).not.toHaveBeenCalled();
  });
});

describe('la cabecera', () => {
  it('se titula "Mis Bancos" y conserva la puerta del calendario', () => {
    const onPrevision = jest.fn();
    montar({ onPrevision });

    expect(screen.getByText('Mis Bancos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Previsión · meses y días/ }));
    expect(onPrevision).toHaveBeenCalledTimes(1);
  });

  it('"Previsión · meses y días" sigue estando en Tarjetas · no depende del switch', () => {
    montar();
    irA('Tarjetas');
    expect(screen.getByRole('button', { name: /Previsión · meses y días/ })).toBeInTheDocument();
  });
});

// Una tarjeta y una cuenta son dos formas de lo mismo, y por eso se leen y se
// manejan igual: misma tabla, mismas cabeceras ordenables, mismo pie y —sobre
// todo— las mismas tres acciones en el "⋯".
describe('las tarjetas se comportan como las cuentas', () => {
  it('se pintan en tabla, con cabeceras y pie de total', () => {
    montar();
    irA('Tarjetas');

    expect(screen.getByRole('button', { name: /Tarjeta/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Consumo/ })).toBeInTheDocument();
    expect(screen.getByText(/Total · 1 tarjeta/)).toBeInTheDocument();
  });

  it('el "⋯" ofrece las MISMAS tres acciones que una cuenta', () => {
    const onAbrirTarjeta = jest.fn();
    montar({ onAbrirTarjeta });
    irA('Tarjetas');

    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Visa Oro' }));
    expect(screen.getByRole('button', { name: /Confirmar movimientos/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Editar tarjeta/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Eliminar tarjeta/ })).toBeInTheDocument();

    // "Confirmar movimientos" lleva al cajón de la tarjeta · su punteo.
    fireEvent.click(screen.getByRole('button', { name: /Confirmar movimientos/ }));
    expect(onAbrirTarjeta).toHaveBeenCalledTimes(1);
  });
});
