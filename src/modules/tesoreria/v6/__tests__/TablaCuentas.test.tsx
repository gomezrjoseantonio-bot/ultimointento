// V9 · tabla de cuentas (cuerpo de "Mis Bancos") · orden por cabecera,
// paginación en cliente y la fila Total pintando LOS MISMOS números que el
// hero (no una suma propia).

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import TablaCuentas, { type FilaCuenta } from '../TablaCuentas';
import type { Account } from '../../../../services/db';
import type { KpisHero } from '../../../../services/tesoreriaV6Metrics';

const fila = (id: number, nombre: string, saldo: number, over: Partial<FilaCuenta> = {}): FilaCuenta => ({
  cuenta: { id, iban: `ES00${id}`, status: 'ACTIVE', activa: true, createdAt: '', updatedAt: '' } as Account,
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

const montar = (filas: FilaCuenta[], over: Partial<React.ComponentProps<typeof TablaCuentas>> = {}) =>
  render(
    <TablaCuentas
      filas={filas}
      kpis={kpis}
      mesActual="agosto"
      onAbrir={noop}
      onEditar={noop}
      onEliminar={noop}
      seleccionada={null}
      onSeleccionar={noop}
      {...over}
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


// F3 · mirar y tocar se separan: la fila abre el día a día, y el punteo pasa a
// vivir detrás del "⋯". Antes el clic de fila hacía las dos cosas a la vez.
describe('F3 · seleccionar una cuenta', () => {
  const dos = [fila(1, 'Unicaja', 900), fila(2, 'Sabadell', 300)];

  it('el clic en la fila SELECCIONA · ya no abre el punteo', () => {
    const onSeleccionar = jest.fn();
    const onAbrir = jest.fn();
    montar(dos, { onSeleccionar, onAbrir });

    fireEvent.click(screen.getByText('Unicaja'));
    expect(onSeleccionar).toHaveBeenCalledWith(1);
    expect(onAbrir).not.toHaveBeenCalled();
  });

  it('volver a pulsar la fila abierta la cierra', () => {
    const onSeleccionar = jest.fn();
    montar(dos, { seleccionada: 1, onSeleccionar });

    fireEvent.click(screen.getByText('Unicaja'));
    expect(onSeleccionar).toHaveBeenCalledWith(null);
  });

  it('el teclado hace lo mismo que el ratón', () => {
    const onSeleccionar = jest.fn();
    const { container } = montar(dos, { onSeleccionar });

    fireEvent.keyDown(container.querySelectorAll('tbody tr')[0], { key: 'Enter' });
    expect(onSeleccionar).toHaveBeenCalledWith(1);
  });

  it('el "⋯ → Confirmar movimientos" SIGUE abriendo el punteo', () => {
    const onAbrir = jest.fn();
    const onSeleccionar = jest.fn();
    montar(dos, { onAbrir, onSeleccionar });

    fireEvent.click(screen.getByLabelText('Acciones de Unicaja'));
    fireEvent.click(screen.getByText('Confirmar movimientos'));
    expect(onAbrir).toHaveBeenCalledTimes(1);
    // Y el kebab no arrastra consigo la selección de la fila.
    expect(onSeleccionar).not.toHaveBeenCalled();
  });

  it('la fila abierta se marca, y el gráfico se despliega SOLO bajo ella', () => {
    const { container } = montar(dos, {
      seleccionada: 1,
      grafico: <div data-testid="grafico">día a día</div>,
    });

    const filas = container.querySelectorAll('tbody tr[aria-expanded]');
    expect(filas[0]).toHaveAttribute('aria-expanded', 'true');
    expect(filas[1]).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByTestId('grafico')).toHaveLength(1);
  });

  it('sin cuenta abierta no hay gráfico', () => {
    montar(dos, { grafico: <div data-testid="grafico">día a día</div> });
    expect(screen.queryByTestId('grafico')).not.toBeInTheDocument();
  });
});
