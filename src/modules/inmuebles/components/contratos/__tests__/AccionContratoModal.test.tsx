import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AccionContratoModal from '../AccionContratoModal';
import type { Contract } from '../../../../../services/db';

const mockToast = jest.fn();
jest.mock('../../../../../design-system/v5', () => {
  const actual = jest.requireActual('../../../../../design-system/v5');
  return { ...actual, showToastV5: (m: string) => mockToast(m) };
});

const mockRenovar = jest.fn().mockResolvedValue(undefined);
const mockFinalizar = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../../../services/contractLifecycleService', () => ({
  renovarContrato: (...args: unknown[]) => mockRenovar(...args),
  finalizarContrato: (...args: unknown[]) => mockFinalizar(...args),
}));

const contrato: Contract & { id: number } = {
  id: 77,
  inmuebleId: 1,
  unidadTipo: 'vivienda',
  modalidad: 'larga_estancia',
  inquilino: { nombre: 'Ana', apellidos: 'Ruiz', dni: '1', telefono: '', email: '' },
  fechaInicio: '2025-01-01',
  fechaFin: '2027-01-01',
  rentaMensual: 1000,
  diaPago: 1,
  estadoContrato: 'activo',
} as Contract & { id: number };

beforeEach(() => {
  mockToast.mockReset();
  mockRenovar.mockClear();
  mockFinalizar.mockClear();
});

describe('AccionContratoModal · renovar', () => {
  it('prefija fecha fin actual y renta, y renueva llamando al servicio', async () => {
    const onHecho = jest.fn();
    render(<AccionContratoModal contrato={contrato} modo="renovar" onClose={() => {}} onHecho={onHecho} />);

    expect(screen.getByRole('dialog', { name: 'Renovar contrato' })).toBeInTheDocument();
    const fecha = screen.getByLabelText('Nueva fecha fin') as HTMLInputElement;
    expect(fecha.value).toBe('2027-01-01');

    fireEvent.change(fecha, { target: { value: '2029-01-01' } });
    fireEvent.change(screen.getByLabelText(/Nueva renta mensual/), { target: { value: '1100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Renovar' }));

    await waitFor(() => expect(mockRenovar).toHaveBeenCalledTimes(1));
    expect(mockRenovar).toHaveBeenCalledWith(77, expect.objectContaining({ nuevaFechaFin: '2029-01-01', nuevaRenta: 1100 }));
    await waitFor(() => expect(onHecho).toHaveBeenCalled());
  });

  it('no envía nuevaRenta si no cambia respecto a la actual', async () => {
    render(<AccionContratoModal contrato={contrato} modo="renovar" onClose={() => {}} onHecho={() => {}} />);
    fireEvent.change(screen.getByLabelText('Nueva fecha fin'), { target: { value: '2028-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Renovar' }));
    await waitFor(() => expect(mockRenovar).toHaveBeenCalled());
    expect(mockRenovar.mock.calls[0][1]).not.toHaveProperty('nuevaRenta');
  });
});

describe('AccionContratoModal · finalizar', () => {
  it('finaliza con fecha de salida y motivo', async () => {
    const onHecho = jest.fn();
    render(<AccionContratoModal contrato={contrato} modo="finalizar" onClose={() => {}} onHecho={onHecho} />);

    expect(screen.getByRole('dialog', { name: 'Finalizar contrato' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Fecha de salida'), { target: { value: '2026-05-31' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'cambio_ciudad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar' }));

    await waitFor(() => expect(mockFinalizar).toHaveBeenCalledTimes(1));
    expect(mockFinalizar).toHaveBeenCalledWith(77, expect.objectContaining({ fechaCierre: '2026-05-31', motivoFin: 'cambio_ciudad' }));
    await waitFor(() => expect(onHecho).toHaveBeenCalled());
  });
});
