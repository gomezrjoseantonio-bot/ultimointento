// Homogeneización (B) · el alta de conciliación usa el MISMO catálogo unificado
// que la ficha de Tesorería V6: el gasto se clasifica con Familia → Concepto
// (no con tarjetas gruesas), el ingreso mantiene sus conceptos propios, y la
// persistencia (`categoryKey`/`subtypeKey`) sale de la misma proyección.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// CRA (react-scripts) corre con `resetMocks: true`, que borra la implementación
// de los mocks antes de cada test. Por eso las fábricas solo crean los jest.fn
// y las implementaciones se (re)establecen en `beforeEach`.
jest.mock('../../../../../../services/db', () => ({
  __esModule: true,
  __add: jest.fn(),
  initDB: jest.fn(),
}));
jest.mock('../../../../../../services/treasuryConfirmationService', () => ({
  confirmTreasuryEvent: jest.fn(),
}));
jest.mock('../../../../../../services/treasuryTransferService', () => ({
  createTransfer: jest.fn(),
}));
jest.mock('../../../../../../services/documentRequirementsService', () => ({
  computeDocFlags: jest.fn(),
}));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import AddMovementModal from '../AddMovementModal';
/* eslint-disable @typescript-eslint/no-var-requires */
const dbMock = require('../../../../../../services/db') as any;
const { computeDocFlags } = require('../../../../../../services/documentRequirementsService') as any;
/* eslint-enable @typescript-eslint/no-var-requires */
const mockDbAdd = dbMock.__add as jest.Mock;

const accounts = [{ id: 1, alias: 'Santander', iban: 'ES0000000000000000000001' }] as never;
const properties = [{ id: 7, alias: 'Tenderina 64', state: 'activo' }] as never;

const base = {
  accounts,
  properties,
  defaultYear: 2026,
  defaultMonth0: 7,
  onClose: jest.fn(),
  onCreated: jest.fn(async () => {}),
};

beforeEach(() => {
  mockDbAdd.mockResolvedValue(1);
  dbMock.initDB.mockImplementation(async () => ({
    add: mockDbAdd,
    getAll: jest.fn(async () => []),
  }));
  computeDocFlags.mockReturnValue({ facturaNoAplica: false, justificanteNoAplica: false });
});

const importe = (v: string) =>
  fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: v } });

describe('el gasto se clasifica con el catálogo unificado', () => {
  it('en personal ofrece las familias que las tarjetas de inmueble no tenían', () => {
    render(<AddMovementModal {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }));

    const familia = screen.getByLabelText('Familia');
    expect(familia).toHaveTextContent('Alquiler');
    expect(familia).toHaveTextContent('Cuotas');
    expect(familia).toHaveTextContent('Suscripciones');
    expect(familia).toHaveTextContent('Día a día');
    expect(screen.getByLabelText('Concepto del gasto')).toBeInTheDocument();
  });

  it('un gasto personal persiste la macro-categoría personal (sin casilla)', async () => {
    render(<AddMovementModal {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }));
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'dia_a_dia' } });
    fireEvent.change(screen.getByLabelText('Concepto del gasto'), { target: { value: 'supermercado' } });
    importe('40');
    fireEvent.click(screen.getByRole('button', { name: 'Crear previsión' }));

    await waitFor(() => expect(mockDbAdd).toHaveBeenCalled());
    const payload = mockDbAdd.mock.calls[0][1] as any;
    expect(payload.type).toBe('expense');
    expect(payload.categoryKey).toBe('gasto_personal_dia_dia');
    expect(payload.subtypeKey).toBeUndefined();
  });

  it('un gasto de inmueble persiste la key fiscal + subtipo del concepto', async () => {
    render(<AddMovementModal {...base} prefill={{ tipo: 'gasto', ambito: 'inmueble', inmuebleId: 7 }} />);
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'suministros' } });
    fireEvent.change(screen.getByLabelText('Concepto del gasto'), { target: { value: 'luz' } });
    importe('74,09');
    fireEvent.click(screen.getByRole('button', { name: 'Crear previsión' }));

    await waitFor(() => expect(mockDbAdd).toHaveBeenCalled());
    const payload = mockDbAdd.mock.calls[0][1] as any;
    expect(payload.categoryKey).toBe('suministro_inmueble');
    expect(payload.subtypeKey).toBe('luz');
    expect(payload.ambito).toBe('INMUEBLE');
    expect(payload.inmuebleId).toBe(7);
  });
});

describe('restricción OPEX (recurrentes de inmueble)', () => {
  const opexProps = {
    ...base,
    prefill: { tipo: 'gasto' as const, ambito: 'inmueble' as const, inmuebleId: 7 },
    locked: { tipo: true, ambito: true, inmueble: true },
    restrictCategoriesTo: 'opex' as const,
  };

  it('la familia se limita a las de gasto corriente · sin mobiliario amortizable', () => {
    render(<AddMovementModal {...opexProps} />);
    const familia = screen.getByLabelText('Familia');
    expect(familia).toHaveTextContent('Suministros');
    expect(familia).not.toHaveTextContent('Mobiliario y enseres');
  });
});

describe('el ingreso conserva sus propios conceptos', () => {
  it('muestra las categorías de ingreso, no la clasificación de gasto', () => {
    render(<AddMovementModal {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /Ingreso/ }));

    expect(screen.queryByLabelText('Familia')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Otros ingresos/ })).toBeInTheDocument();
  });
});
