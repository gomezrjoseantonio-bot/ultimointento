/**
 * FIX onboarding · el form fiscal compartido escribe/lee el store REAL
 * (personalDataService). Es la "una sola fuente · dos puertas": el mismo
 * componente lo usan Ajustes y el bloque persona del onboarding, así que
 * guardar por una puerta se lee por la otra.
 *
 * Cubre (§3): guardar persiste vía savePersonalData · cargar rellena los campos
 * desde getPersonalData (regresión del guardado roto que solo hacía un toast).
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../../../../services/personalDataService', () => ({
  __esModule: true,
  personalDataService: {
    getPersonalData: jest.fn(),
    savePersonalData: jest.fn(),
    // Regla real espejada: desempleado/jubilado no se combinan.
    validateSituacionLaboral: (situaciones: string[]) =>
      (situaciones.includes('desempleado') || situaciones.includes('jubilado')) && situaciones.length > 1
        ? { isValid: false, error: 'no combinable' }
        : { isValid: true },
  },
}));

import PerfilFiscalForm from '../PerfilFiscalForm';
import { personalDataService } from '../../../../services/personalDataService';

const mockGet = personalDataService.getPersonalData as jest.Mock;
const mockSave = personalDataService.savePersonalData as jest.Mock;

beforeEach(() => {
  mockGet.mockReset();
  mockSave.mockReset();
  mockSave.mockImplementation(async (data) => ({ id: 1, ...data, fechaCreacion: 'x', fechaActualizacion: 'y' }));
});

it('guardar persiste en personalDataService y dispara onSaved', async () => {
  mockGet.mockResolvedValue(null);
  const onSaved = jest.fn();
  render(<PerfilFiscalForm onSaved={onSaved} submitLabel="Guardar cambios" />);

  await waitFor(() => expect(screen.getByLabelText('Nombre')).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('NIF'), { target: { value: '00000000T' } });
  fireEvent.click(screen.getByText('Guardar cambios'));

  await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
  const payload = mockSave.mock.calls[0][0];
  expect(payload.nombre).toBe('Ana');
  expect(payload.dni).toBe('00000000T');
  expect(onSaved).toHaveBeenCalledTimes(1);
});

it('carga los datos existentes (se leen desde el store)', async () => {
  mockGet.mockResolvedValue({
    id: 1,
    nombre: 'Luis',
    apellidos: 'García',
    dni: '11111111H',
    direccion: '',
    situacionPersonal: 'casado',
    situacionLaboral: ['asalariado'],
    comunidadAutonoma: 'Madrid',
    fechaCreacion: 'x',
    fechaActualizacion: 'y',
  });
  render(<PerfilFiscalForm />);

  await waitFor(() => expect(screen.getByLabelText('Nombre')).toHaveValue('Luis'));
  expect(screen.getByLabelText('NIF')).toHaveValue('11111111H');
  expect(screen.getByLabelText('Estado civil')).toHaveValue('casado');
});

it('no guarda sin nombre (validación mínima)', async () => {
  mockGet.mockResolvedValue(null);
  render(<PerfilFiscalForm submitLabel="Guardar cambios" />);
  await waitFor(() => expect(screen.getByLabelText('Nombre')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Guardar cambios'));
  await waitFor(() => expect(mockSave).not.toHaveBeenCalled());
});

it('normaliza fechaNacimiento dd/mm/yyyy → YYYY-MM-DD al hidratar (no se pierde)', async () => {
  mockGet.mockResolvedValue({
    id: 1,
    nombre: 'Eva',
    apellidos: '',
    dni: '',
    direccion: '',
    situacionPersonal: 'soltero',
    situacionLaboral: ['asalariado'],
    fechaNacimiento: '15/03/1980',
    fechaCreacion: 'x',
    fechaActualizacion: 'y',
  });
  render(<PerfilFiscalForm />);
  await waitFor(() => expect(screen.getByLabelText('Fecha de nacimiento')).toHaveValue('1980-03-15'));
});

it('situación laboral · jubilado es exclusiva (no se combina)', async () => {
  mockGet.mockResolvedValue(null);
  render(<PerfilFiscalForm submitLabel="Guardar cambios" />);
  await waitFor(() => expect(screen.getByLabelText('Nombre')).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Eva' } });
  fireEvent.click(screen.getByLabelText('Asalariado/a'));
  fireEvent.click(screen.getByLabelText('Jubilado/a'));
  // Al activar jubilado, asalariado se retira.
  expect(screen.getByLabelText('Asalariado/a')).not.toBeChecked();
  expect(screen.getByLabelText('Jubilado/a')).toBeChecked();

  fireEvent.click(screen.getByText('Guardar cambios'));
  await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
  expect(mockSave.mock.calls[0][0].situacionLaboral).toEqual(['jubilado']);
});
