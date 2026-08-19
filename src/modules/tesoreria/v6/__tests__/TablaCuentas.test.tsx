// V9 · tabla "Mis cuentas" · orden por cabecera, paginación en cliente y la
// fila Total pintando LOS MISMOS números que el hero (no una suma propia).

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import TablaCuentas, { type FilaCuenta } from '../TablaCuentas';
import type { Account } from '../../../../services/db';
import type { KpisHero } from '../../../../services/tesoreriaV6Metrics';

const fila = (id: number, nombre: string, saldo: number, over: Partial<FilaCuenta> = {}): FilaCuenta => ({
  cuenta: { id, iban: `ES00${id}`, status: 'ACTIVE', activa: true, createdAt: '', updatedAt: '' } as Account,
  color: 'var(--atlas-v5-ink-5)',
  nombre,
  mask: String(1000 + id),
  saldo,
  entra: 0,
  sale: 0,
  cierre: saldo,
  estado: { tipo: 'al-dia' },
  ...over,
});

const kpis: KpisHero = {
  saldo: 41673.9,
  numCuentas: 10,
  pendienteEntrar: 5435.32,
  movimientosEntrar: 3,
  pendienteSalir: -4143.59,
  movimientosSalir: 6,
  cierre: 42965.63,
  ultimoDia: 31,
};

const noop = () => undefined;

const montar = (filas: FilaCuenta[]) =>
  render(
    <TablaCuentas
      filas={filas}
      kpis={kpis}
      mesActual="agosto"
      onAbrir={noop}
      onEditar={noop}
      onEliminar={noop}
      onPrevision={noop}
      onAnadir={noop}
    />
  );

describe('orden por cabecera', () => {
  it('clic en "Saldo hoy" ordena de mayor a menor · segundo clic invierte', () => {
    const { container } = montar([fila(1, 'Pequeña', 100), fila(2, 'Grande', 900), fila(3, 'Media', 500)]);
    const th = screen.getByRole('button', { name: /Saldo hoy/ });

    fireEvent.click(th);
    let nombres = Array.from(container.querySelectorAll('.nombre')).map((n) => n.textContent);
    expect(nombres).toEqual(['Grande', 'Media', 'Pequeña']);

    fireEvent.click(th);
    nombres = Array.from(container.querySelectorAll('.nombre')).map((n) => n.textContent);
    expect(nombres).toEqual(['Pequeña', 'Media', 'Grande']);
  });

  it('el estado ordena por urgencia · descubierto > por confirmar > al día', () => {
    const { container } = montar([
      fila(1, 'Tranquila', 100),
      fila(2, 'Corta', 100, { estado: { tipo: 'se-queda-corta', minimo: -50, dia: '2026-08-27' } }),
      fila(3, 'Pendiente', 100, { estado: { tipo: 'por-confirmar', n: 2 } }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: /Estado/ }));
    // Primer clic en una columna no-nombre = descendente · aquí "descendente"
    // sube lo menos urgente; el segundo clic deja lo urgente arriba.
    fireEvent.click(screen.getByRole('button', { name: /Estado/ }));
    const nombres = Array.from(container.querySelectorAll('.nombre')).map((n) => n.textContent);
    expect(nombres[0]).toBe('Corta');
  });
});

describe('paginación en cliente', () => {
  const diez = Array.from({ length: 10 }, (_, i) => fila(i + 1, `Cuenta ${i + 1}`, (i + 1) * 100));

  it('5 por página · el pie dice "5 de 10" y avanza', () => {
    montar(diez);
    expect(screen.getByText('5 de 10')).toBeInTheDocument();
    expect(screen.getByText('Cuenta 1')).toBeInTheDocument();
    expect(screen.queryByText('Cuenta 6')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Cuentas siguientes'));
    expect(screen.getByText('10 de 10')).toBeInTheDocument();
    expect(screen.getByText('Cuenta 6')).toBeInTheDocument();
    expect(screen.queryByText('Cuenta 1')).not.toBeInTheDocument();
  });

  it('con 5 o menos no hay pie de paginación', () => {
    montar(diez.slice(0, 4));
    expect(screen.queryByLabelText('Cuentas siguientes')).not.toBeInTheDocument();
  });
});

describe('la fila Total', () => {
  it('pinta los números del hero · el cierre en oro es el MISMO que arriba', () => {
    montar([fila(1, 'Única', 100)]);
    expect(screen.getByText('Total · 10 cuentas')).toBeInTheDocument();
    expect(screen.getByText('41.673,90 €')).toBeInTheDocument();
    expect(screen.getByText('+5.435,32 €')).toBeInTheDocument();
    expect(screen.getByText('−4.143,59 €')).toBeInTheDocument();
    expect(screen.getByText('42.965,63 €')).toBeInTheDocument();
  });
});
