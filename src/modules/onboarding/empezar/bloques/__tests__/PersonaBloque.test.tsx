/**
 * FIX onboarding · P2/P3 · el bloque persona ES el formulario fiscal embebido
 * (ya NO una página-puente a /ajustes/perfil).
 *
 * Cubre (§3):
 *   · la página-puente ya no existe · la ruta renderiza el formulario (campos
 *     fiscales presentes · sin CTA "Abrir mis datos")
 *   · guardar marca el bloque persona como completado y vuelve al mapa
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockNavigate = jest.fn();
const mockSetBloque = jest.fn().mockResolvedValue(undefined);

jest.mock('react-router-dom', () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));
jest.mock('../../OnboardingContext', () => ({
  __esModule: true,
  useOnboarding: () => ({ setBloque: mockSetBloque }),
}));
jest.mock('../../OnboardingTopbar', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../../../services/personalDataService', () => ({
  __esModule: true,
  personalDataService: { getPersonalData: jest.fn(), savePersonalData: jest.fn() },
}));

import PersonaBloque from '../PersonaBloque';
import { personalDataService } from '../../../../../services/personalDataService';

const mockGet = personalDataService.getPersonalData as jest.Mock;
const mockSave = personalDataService.savePersonalData as jest.Mock;

beforeEach(() => {
  mockNavigate.mockReset();
  mockSetBloque.mockClear();
  mockGet.mockReset().mockResolvedValue(null);
  mockSave.mockReset().mockImplementation(async (d) => ({ id: 1, ...d, fechaCreacion: 'x', fechaActualizacion: 'y' }));
});

it('renderiza el formulario fiscal · NO la página-puente', async () => {
  render(<PersonaBloque />);
  await waitFor(() => expect(screen.getByLabelText('NIF')).toBeInTheDocument());
  expect(screen.getByLabelText('Estado civil')).toBeInTheDocument();
  // El CTA de la página-puente ya no existe.
  expect(screen.queryByText('Abrir mis datos')).not.toBeInTheDocument();
});

it('guardar marca el bloque completado y vuelve al mapa', async () => {
  render(<PersonaBloque />);
  await waitFor(() => expect(screen.getByLabelText('Nombre')).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Marta' } });
  fireEvent.click(screen.getByText('Guardar y volver al mapa'));

  await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockSetBloque).toHaveBeenCalledWith('persona', 'completado', expect.any(String)));
  expect(mockNavigate).toHaveBeenCalledWith('/empezar/hub');
});
