// ============================================================================
// «Deja de cobrarse el» · poner fin no es dar de baja
// ============================================================================
//
// El usuario tenía dos gestos para tres situaciones, y por eso acababa
// borrando. Dar de baja corta YA y es retroactivo («esto se acabó»); poner fin
// es decir que el gasto SIGUE cobrándose hasta una fecha y para ahí. El modelo
// tenía `fechaFin` desde el principio y el motor ya recorta la proyección en
// ella; lo que faltaba era poder decirlo desde la ficha.
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RowForm from '../RowForm';
import type { Account } from '../../../../../../services/db';
import type { CompromisoRecurrente } from '../../../../../../types/compromisosRecurrentes';

const mockActualizar = jest.fn();
jest.mock('../../../../../../services/personal/compromisosRecurrentesService', () => ({
  actualizarCompromiso: (...a: unknown[]) => mockActualizar(...a),
}));
jest.mock('../../../../../../services/tarjetasService', () => ({ listarTarjetas: async () => [] }));
jest.mock('../../../../../../design-system/v5', () => ({
  showToastV5: jest.fn(),
  Icons: new Proxy({}, { get: () => () => null }),
}));

const CUENTAS = [{ id: 1, alias: 'Santander', tipo: 'CORRIENTE' }] as Account[];

const compromiso = (over: Partial<CompromisoRecurrente> = {}) =>
  ({
    id: 7, alias: 'Alarma', patron: { tipo: 'mensualDiaFijo', dia: 5 },
    importe: { modo: 'fijo', importe: 30 },
    cuentaCargo: 1, conceptoBancario: 'ALARMA', metodoPago: 'domiciliacion',
    categoria: 'personal.suscripciones', bolsaPresupuesto: 'deseos', responsable: 'titular',
    ambito: 'personal', fechaInicio: '2026-01-01', estado: 'activo',
    createdAt: '', updatedAt: '', ...over,
  }) as CompromisoRecurrente & { id: number };

const pintar = (c = compromiso()) =>
  render(<RowForm compromiso={c} accounts={CUENTAS} onSaved={jest.fn()} />);

const campoFin = () => screen.getByLabelText('Deja de cobrarse el') as HTMLInputElement;

beforeEach(() => {
  mockActualizar.mockReset();
  mockActualizar.mockImplementation(async (_id, patch) => ({ ...compromiso(), ...patch }));
});

const guardar = () => fireEvent.click(screen.getByRole('button', { name: /^Guardar/ }));
const patch = () => mockActualizar.mock.calls[0][1];

describe('el fin del gasto se dice en la ficha', () => {
  it('está junto al primer cobro, en «cuándo se cobra», y nace vacío', () => {
    pintar();
    expect(screen.getByText('Cuándo se cobra')).toBeInTheDocument();
    expect(screen.getByText('Deja de cobrarse el')).toBeInTheDocument();
    expect(campoFin().value).toBe('');
    // El caso normal es que no termine · el rótulo lo dice.
    expect(screen.getByText('Si no termina, déjalo vacío')).toBeInTheDocument();
  });

  it('vacío se guarda como indefinido, no como una fecha vacía', async () => {
    pintar();
    guardar();
    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());
    expect(patch().fechaFin).toBeUndefined();
  });

  it('la fecha puesta viaja al compromiso', async () => {
    pintar();
    fireEvent.change(campoFin(), { target: { value: '2027-10-31' } });
    guardar();
    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());
    expect(patch().fechaFin).toBe('2027-10-31');
  });

  it('reabrir la ficha enseña el fin que ya tenía', () => {
    pintar(compromiso({ fechaFin: '2027-10-31' }));
    expect(campoFin().value).toBe('2027-10-31');
  });

  it('borrarlo lo deshace · el gasto vuelve a ser indefinido', async () => {
    pintar(compromiso({ fechaFin: '2027-10-31' }));
    fireEvent.change(campoFin(), { target: { value: '' } });
    guardar();
    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());
    expect(patch().fechaFin).toBeUndefined();
  });

  it('poner fin NO da de baja · el gasto sigue activo hasta esa fecha', async () => {
    pintar();
    fireEvent.change(campoFin(), { target: { value: '2027-10-31' } });
    guardar();
    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());
    expect(patch().estado).toBeUndefined();
    expect(patch().motivoBaja).toBeUndefined();
  });
});
