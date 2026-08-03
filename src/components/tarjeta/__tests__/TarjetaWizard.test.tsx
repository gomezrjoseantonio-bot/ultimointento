// La ficha de tarjeta · VOCABULARIO §3.
//
// Lo que vigila: que el formulario no permita llegar a un imposible. Las reglas
// están escritas en `tarjetasReglas` y comprobadas otra vez en el servicio,
// pero un formulario que ofrece lo que luego rechaza es un formulario que
// enseña mal el modelo.

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TarjetaWizard from '../TarjetaWizard';
import type { Account } from '../../../services/db';
import type { Tarjeta } from '../../../types/tarjetas';

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

const mockCrear = jest.fn().mockResolvedValue(1);
const mockActualizar = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../services/tarjetasService', () => ({
  crearTarjeta: (...a: unknown[]) => mockCrear(...a),
  actualizarTarjeta: (...a: unknown[]) => mockActualizar(...a),
  eliminarTarjeta: jest.fn().mockResolvedValue(undefined),
}));

const CUENTAS = [
  { id: 1, alias: 'Santander', tipo: 'CORRIENTE' },
  { id: 2, alias: 'Bankinter', tipo: 'CORRIENTE' },
  { id: 3, alias: 'Efectivo', tipo: 'EFECTIVO' },
] as Account[];

const pintar = (tarjeta: Tarjeta | null = null) =>
  render(
    <TarjetaWizard
      open
      tarjeta={tarjeta}
      cuentas={CUENTAS}
      onClose={jest.fn()}
      onSuccess={jest.fn()}
    />
  );

beforeEach(() => {
  mockCrear.mockClear();
  mockActualizar.mockClear();
});

describe('de qué cuenta puede salir', () => {
  // El colchón no domicilia recibos (§3.2) · ofrecerlo sería enseñar un
  // imposible que el servicio rechaza después.
  it('el efectivo no se ofrece', () => {
    pintar();

    const opciones = Array.from(
      screen.getByLabelText(/De qué cuenta sale/i).querySelectorAll('option')
    ).map((o) => o.textContent);

    expect(opciones).toContain('Santander');
    expect(opciones).not.toContain('Efectivo');
  });
});

describe('el ciclo', () => {
  it('solo se pide en las de crédito', () => {
    pintar();
    expect(screen.getByLabelText(/Corta el/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Débito/i }));

    expect(screen.queryByLabelText(/Corta el/i)).toBeNull();
  });

  // Los días significan cosas distintas en cada periodicidad · arrastrar el
  // valor guardaría un ciclo que no existe (un "corte el 24" semanal).
  it('cambiar a semanal reajusta los días', async () => {
    pintar();

    fireEvent.change(screen.getByLabelText(/Cada cuánto corta/i), {
      target: { value: 'semanal' },
    });

    const corte = screen.getByLabelText(/Corta el/i) as HTMLSelectElement;
    expect(corte.tagName).toBe('SELECT');
    expect(corte.value).toBe('7');
  });
});

describe('guardar', () => {
  it('una de crédito lleva su ciclo', async () => {
    pintar();

    fireEvent.change(screen.getByLabelText(/^Nombre/i), { target: { value: 'Carrefour' } });
    fireEvent.change(screen.getByLabelText(/De qué cuenta sale/i), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(mockCrear).toHaveBeenCalled());
    expect(mockCrear.mock.calls[0][0]).toMatchObject({
      alias: 'Carrefour',
      modalidad: 'credito',
      cuentaLiquidacionId: 2,
      ciclo: { periodicidad: 'mensual', corte: 24, diaCargo: 5 },
    });
  });

  // El débito cobra al momento · mandarle un ciclo sería un dato que al leerlo
  // engaña, aunque el servicio lo descarte igualmente.
  it('una de débito va sin ciclo', async () => {
    pintar();

    fireEvent.change(screen.getByLabelText(/^Nombre/i), { target: { value: 'Visa' } });
    fireEvent.click(screen.getByRole('button', { name: /Débito/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(mockCrear).toHaveBeenCalled());
    expect(mockCrear.mock.calls[0][0].ciclo).toBeUndefined();
  });

  it('sin nombre no se guarda', async () => {
    pintar();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Ponle un nombre')).toBeTruthy();
    expect(mockCrear).not.toHaveBeenCalled();
  });
});

describe('editar', () => {
  const existente: Tarjeta = {
    id: 5,
    alias: 'Carrefour',
    origen: 'externa',
    modalidad: 'credito',
    cuentaLiquidacionId: 1,
    ciclo: { periodicidad: 'mensual', corte: 24, diaCargo: 5, periodosHastaElCargo: 1 },
    activa: true,
    createdAt: '',
    updatedAt: '',
  };

  // Re-domiciliar una de fuera es una operación NORMAL (§3.2): rehacerla
  // perdería el historial que prueba las bonificaciones y mide el cashback.
  it('cambiar de cuenta es una edición · no una tarjeta nueva', async () => {
    pintar(existente);

    fireEvent.change(screen.getByLabelText(/De qué cuenta sale/i), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());
    expect(mockActualizar.mock.calls[0][0]).toBe(5);
    expect(mockActualizar.mock.calls[0][1]).toMatchObject({ cuentaLiquidacionId: 2 });
    expect(mockCrear).not.toHaveBeenCalled();
  });
});
