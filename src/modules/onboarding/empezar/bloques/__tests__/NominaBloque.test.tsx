/**
 * FIX onboarding punto 6 · bloque nómina/autónomo de `/empezar`.
 *
 * Cubre los criterios de aceptación de la tarea:
 *   · Sin doble vía falsa · dos entradas REALES y distintas (Nómina / Autónomo).
 *   · Con nómina detectada · el form sale pre-rellenado (empresa/día/cuenta);
 *     sin detección · en blanco (mismo form · la diferencia es solo el prefill).
 *   · Guardar (nómina o autónomo) → marca el bloque · sube el % · vuelve al flujo.
 *   · Cancelar → vuelve a la elección sin marcar el bloque.
 *
 * El "encendido del IRPF estimado" es derivado (al haber renta de trabajo la
 * estimación deja de mostrar "—") y está cubierto en
 * `onboardingRevealService.test.ts`; aquí se prueba su disparador onboarding-side:
 * que guardar marca el bloque `nomina`.
 *
 * Los wizards reales (NominaPage/AutonomoWizard) se mockean: quedan intactos y
 * fuera de este alcance · aquí solo se verifica el cableado del bloque.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSetBloque = jest.fn().mockResolvedValue(undefined);
const mockRefresh = jest.fn().mockResolvedValue(undefined);
jest.mock('../../OnboardingContext', () => ({
  useOnboarding: () => ({
    state: { bloques: {}, cuentas: {}, nucleoCompleto: false, revealVisto: false, updatedAt: '' },
    progress: { pct: 0, nucleoCompleto: false, pendientes: [], completados: 0 },
    loading: false,
    setBloque: mockSetBloque,
    refresh: mockRefresh,
  }),
}));

jest.mock('../../../../../services/onboardingDetectionService', () => ({
  __esModule: true,
  detectarSugerencias: jest.fn(),
}));

// Wizards reales mockeados · solo capturamos las props con las que se abren.
let lastNominaProps: { prefill?: unknown; onSaved?: () => void; onCancel?: () => void } | null = null;
jest.mock('../../../../../pages/GestionPersonal/wizards/NominaPage', () => ({
  __esModule: true,
  default: (props: { prefill?: unknown; onSaved?: () => void; onCancel?: () => void }) => {
    lastNominaProps = props;
    return (
      <div>
        <div data-testid="nomina-wizard" />
        <button onClick={() => props.onSaved && props.onSaved()}>guardar-nomina</button>
        <button onClick={() => props.onCancel && props.onCancel()}>cancelar-nomina</button>
      </div>
    );
  },
}));
jest.mock('../../../../../pages/GestionPersonal/wizards/AutonomoWizard', () => ({
  __esModule: true,
  default: (props: { onSaved?: () => void; onCancel?: () => void }) => (
    <div>
      <div data-testid="autonomo-wizard" />
      <button onClick={() => props.onSaved && props.onSaved()}>guardar-autonomo</button>
      <button onClick={() => props.onCancel && props.onCancel()}>cancelar-autonomo</button>
    </div>
  ),
}));

import NominaBloque from '../NominaBloque';
import { detectarSugerencias } from '../../../../../services/onboardingDetectionService';

const mockDetectar = detectarSugerencias as jest.Mock;

const renderBloque = () =>
  render(
    <MemoryRouter>
      <NominaBloque />
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockDetectar.mockResolvedValue([]);
  lastNominaProps = null;
});

describe('NominaBloque · /empezar', () => {
  test('muestra dos entradas reales (Nómina / Autónomo) · sin doble vía falsa', () => {
    renderBloque();
    expect(screen.getByText('Nómina')).toBeTruthy();
    expect(screen.getByText('Autónomo')).toBeTruthy();
    // No abre ningún wizard hasta elegir · una entrada por destino real.
    expect(screen.queryByTestId('nomina-wizard')).toBeNull();
    expect(screen.queryByTestId('autonomo-wizard')).toBeNull();
  });

  test('con nómina detectada · al abrir Nómina el form sale pre-rellenado (empresa/día/cuenta)', async () => {
    mockDetectar.mockResolvedValue([
      { tipo: 'nomina', prefill: { neto: 1850, dia: 25, cuentaId: 7, pagador: 'ACME SL' } },
    ]);
    renderBloque();
    // El badge cambia cuando llega la detección.
    await screen.findByText('Detectado en tus extractos');
    fireEvent.click(screen.getByText('Nómina'));
    await screen.findByTestId('nomina-wizard');
    expect(lastNominaProps?.prefill).toEqual({ neto: 1850, dia: 25, cuentaId: 7, empresa: 'ACME SL' });
  });

  test('sin detección · al abrir Nómina el form sale en blanco (mismo form · sin prefill)', async () => {
    mockDetectar.mockResolvedValue([]);
    renderBloque();
    fireEvent.click(screen.getByText('Nómina'));
    await screen.findByTestId('nomina-wizard');
    expect(lastNominaProps?.prefill).toBeUndefined();
  });

  test('guardar nómina · marca el bloque, sube el % (refresh) y vuelve al flujo', async () => {
    renderBloque();
    fireEvent.click(screen.getByText('Nómina'));
    await screen.findByTestId('nomina-wizard');
    fireEvent.click(screen.getByText('guardar-nomina'));
    await waitFor(() => expect(mockSetBloque).toHaveBeenCalledWith('nomina', 'completado'));
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/empezar/hub');
  });

  test('cancelar nómina · vuelve a la elección sin marcar el bloque', async () => {
    renderBloque();
    fireEvent.click(screen.getByText('Nómina'));
    await screen.findByTestId('nomina-wizard');
    fireEvent.click(screen.getByText('cancelar-nomina'));
    await screen.findByText('Autónomo'); // de vuelta en la elección
    expect(mockSetBloque).not.toHaveBeenCalled();
  });

  test('guardar autónomo · también marca el bloque y vuelve al flujo', async () => {
    renderBloque();
    fireEvent.click(screen.getByText('Autónomo'));
    await screen.findByTestId('autonomo-wizard');
    fireEvent.click(screen.getByText('guardar-autonomo'));
    await waitFor(() => expect(mockSetBloque).toHaveBeenCalledWith('nomina', 'completado'));
    expect(mockNavigate).toHaveBeenCalledWith('/empezar/hub');
  });
});
