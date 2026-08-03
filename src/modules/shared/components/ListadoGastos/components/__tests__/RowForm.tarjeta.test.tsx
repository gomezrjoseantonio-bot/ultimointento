// Pagar un recurrente con tarjeta · docs/VOCABULARIO-dinero.md §3.
//
// Lo que vigila: que «Tarjeta» deje de ser una etiqueta suelta. Antes se
// guardaba el medio a secas y la cuenta se elegía a mano, así que un gasto de
// la Carrefour podía acabar apuntando a Santander cuando su recibo lo paga
// Bankinter. Ahora se dice CON CUÁL, y la cuenta la decide ella.

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RowForm from '../RowForm';
import type { Account } from '../../../../../../services/db';
import type { CompromisoRecurrente } from '../../../../../../types/compromisosRecurrentes';
import type { Tarjeta } from '../../../../../../types/tarjetas';

const mockActualizar = jest.fn();
const mockTarjetas = jest.fn();

jest.mock('../../../../../../services/personal/compromisosRecurrentesService', () => ({
  actualizarCompromiso: (...a: unknown[]) => mockActualizar(...a),
}));

jest.mock('../../../../../../services/tarjetasService', () => ({
  listarTarjetas: () => mockTarjetas(),
}));

jest.mock('../../../../../../design-system/v5', () => ({
  showToastV5: jest.fn(),
}));

const CUENTAS = [
  { id: 1, alias: 'Santander', tipo: 'CORRIENTE' },
  { id: 2, alias: 'Bankinter', tipo: 'CORRIENTE' },
] as Account[];

const tarjeta = (over: Partial<Tarjeta> = {}): Tarjeta =>
  ({
    id: 11,
    alias: 'Carrefour',
    origen: 'externa',
    modalidad: 'credito',
    cuentaLiquidacionId: 2,
    ciclo: { periodicidad: 'mensual', corte: 24, diaCargo: 5, periodosHastaElCargo: 1 },
    activa: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Tarjeta;

const compromiso = (over: Partial<CompromisoRecurrente> = {}) =>
  ({
    id: 7,
    alias: 'Compra semanal',
    proveedor: { nombre: 'Carrefour' },
    patron: { tipo: 'mensualDiaFijo', dia: 10 },
    importe: { modo: 'fijo', importe: 120 },
    cuentaCargo: 1,
    conceptoBancario: 'CARREFOUR',
    metodoPago: 'domiciliacion',
    categoria: 'dia_a_dia.compra',
    bolsaPresupuesto: 'necesidades',
    responsable: 'titular',
    ambito: 'personal',
    fechaInicio: '2026-01-01',
    estado: 'activo',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as CompromisoRecurrente & { id: number };

const pintar = (c = compromiso()) =>
  render(<RowForm compromiso={c} accounts={CUENTAS} onSaved={jest.fn()} />);

beforeEach(() => {
  mockActualizar.mockReset();
  mockActualizar.mockImplementation(async (_id, patch) => ({ ...compromiso(), ...patch }));
  mockTarjetas.mockReset();
  mockTarjetas.mockResolvedValue([tarjeta()]);
});

// `Field` pinta la etiqueta sin `for`, así que un `getByLabelText` no la ata a
// su control. Se busca por la opción, que es lo que identifica al desplegable.
const selectConOpcion = (texto: string): HTMLSelectElement => {
  const opcion = screen
    .getAllByRole('option')
    .find((o) => o.textContent === texto);
  if (!opcion) throw new Error(`No hay ningún desplegable con la opción "${texto}"`);
  return opcion.closest('select') as HTMLSelectElement;
};

const opcionesDe = (s: HTMLSelectElement) =>
  Array.from(s.querySelectorAll('option')).map((o) => o.textContent);

const medio = () => selectConOpcion('Domiciliación');

describe('el medio «Tarjeta»', () => {
  // Mismo criterio que efectivo sin colchón: ofrecer un medio que no se puede
  // usar guarda un dato que luego no se puede proyectar.
  it('no se ofrece si no hay ninguna tarjeta dada de alta', async () => {
    mockTarjetas.mockResolvedValue([]);
    pintar();

    await waitFor(() => expect(mockTarjetas).toHaveBeenCalled());
    const opciones = opcionesDe(medio());
    expect(opciones).toContain('Domiciliación');
    expect(opciones).not.toContain('Tarjeta');
  });

  it('se ofrece en cuanto hay una', async () => {
    pintar();

    expect(await screen.findByRole('option', { name: 'Tarjeta' })).toBeTruthy();
  });
});

describe('al elegir tarjeta', () => {
  it('pregunta con cuál y lleva el cargo a SU cuenta', async () => {
    pintar();
    await screen.findByRole('option', { name: 'Tarjeta' });

    fireEvent.change(medio(), { target: { value: 'tarjeta' } });

    // Aparece el desplegable de tarjetas...
    expect(opcionesDe(selectConOpcion('Carrefour'))).toContain('Carrefour');
    // ...y la cuenta deja de elegirse: se enseña, ya decidida por la tarjeta.
    expect(screen.getByText('Bankinter')).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Santander' })).toBeNull();
  });

  it('guarda la tarjeta y su cuenta de liquidación', async () => {
    pintar();
    await screen.findByRole('option', { name: 'Tarjeta' });

    fireEvent.change(medio(), { target: { value: 'tarjeta' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());
    expect(mockActualizar.mock.calls[0][1]).toMatchObject({
      metodoPago: 'tarjeta',
      tarjetaId: 11,
      // Y NO la 1, que era la que estaba elegida a mano.
      cuentaCargo: 2,
    });
  });
});

describe('al dejar de pagar con tarjeta', () => {
  // Un id que sobrevive a un cambio de método es un dato muerto que la
  // proyección seguiría leyendo.
  it('el id de la tarjeta se limpia', async () => {
    pintar(compromiso({ metodoPago: 'tarjeta', tarjetaId: 11, cuentaCargo: 2 }));
    await waitFor(() => expect(mockTarjetas).toHaveBeenCalled());

    fireEvent.change(medio(), { target: { value: 'transferencia' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());
    expect(mockActualizar.mock.calls[0][1].tarjetaId).toBeUndefined();
  });
});

describe('lo que llega de antes', () => {
  // Los gastos guardados cuando «Tarjeta» era una etiqueta suelta no dicen con
  // cuál. Guardarlos así seguiría sin poder proyectarse.
  it('un «con tarjeta» sin tarjeta no se puede guardar', async () => {
    const { showToastV5 } = jest.requireMock('../../../../../../design-system/v5');
    pintar(compromiso({ metodoPago: 'tarjeta' }));
    await waitFor(() => expect(mockTarjetas).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

    await waitFor(() =>
      expect(showToastV5).toHaveBeenCalledWith('Elige con qué tarjeta se paga', 'warn')
    );
    expect(mockActualizar).not.toHaveBeenCalled();
  });
});
