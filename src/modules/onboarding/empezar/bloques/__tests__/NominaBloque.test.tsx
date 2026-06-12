/**
 * FIX onboarding punto 6 · bloque nómina/autónomo de `/empezar`.
 *
 * Cubre los criterios de aceptación de la tarea:
 *   · El bloque LEE la situación laboral de persona y se adapta (P5):
 *       solo asalariado → directo nómina · solo autónomo → directo actividad ·
 *       ambos → muestra las dos tareas · desempleado/jubilado → no fuerza nómina ·
 *       sin situación laboral → deja elegir y sugiere completar persona.
 *   · Sin doble vía falsa · cada tarea abre su formulario real.
 *   · Con nómina detectada · el form sale pre-rellenado (empresa/día/cuenta);
 *     sin detección · en blanco (mismo form · la diferencia es solo el prefill).
 *   · Guardar → marca el bloque (completo solo cuando todas las tareas exigidas
 *     están hechas o saltadas) · sube el % · vuelve al flujo.
 *   · Cancelar → vuelve sin marcar el bloque.
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

const mockGetPersonalData = jest.fn();
jest.mock('../../../../../services/personalDataService', () => ({
  __esModule: true,
  personalDataService: { getPersonalData: (...a: unknown[]) => mockGetPersonalData(...a) },
}));
const mockGetNominas = jest.fn();
jest.mock('../../../../../services/nominaService', () => ({
  __esModule: true,
  nominaService: { getNominas: (...a: unknown[]) => mockGetNominas(...a) },
}));
const mockGetAutonomos = jest.fn();
jest.mock('../../../../../services/autonomoService', () => ({
  __esModule: true,
  autonomoService: { getAutonomos: (...a: unknown[]) => mockGetAutonomos(...a) },
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

const persona = (situacionLaboral: string[]) => ({ id: 1, situacionLaboral });

const renderBloque = () =>
  render(
    <MemoryRouter>
      <NominaBloque />
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockDetectar.mockResolvedValue([]);
  mockGetPersonalData.mockResolvedValue(null);
  mockGetNominas.mockResolvedValue([]);
  mockGetAutonomos.mockResolvedValue([]);
  lastNominaProps = null;
});

describe('NominaBloque · /empezar · se adapta a la situación laboral (P5)', () => {
  test('solo asalariado → abre directo el formulario de nómina', async () => {
    mockGetPersonalData.mockResolvedValue(persona(['asalariado']));
    renderBloque();
    await screen.findByTestId('nomina-wizard');
    expect(screen.queryByTestId('autonomo-wizard')).toBeNull();
  });

  test('solo autónomo → abre directo el formulario de actividad', async () => {
    mockGetPersonalData.mockResolvedValue(persona(['autonomo']));
    renderBloque();
    await screen.findByTestId('autonomo-wizard');
    expect(screen.queryByTestId('nomina-wizard')).toBeNull();
  });

  test('asalariado + autónomo → muestra AMBAS tareas · no abre directo', async () => {
    mockGetPersonalData.mockResolvedValue(persona(['asalariado', 'autonomo']));
    renderBloque();
    await screen.findByText('Tu nómina');
    expect(screen.getByText('Tu actividad · autónomo')).toBeTruthy();
    expect(screen.queryByTestId('nomina-wizard')).toBeNull();
    expect(screen.queryByTestId('autonomo-wizard')).toBeNull();
  });

  test('desempleado → no fuerza nómina · ofrece otro ingreso del trabajo', async () => {
    mockGetPersonalData.mockResolvedValue(persona(['desempleado']));
    renderBloque();
    await screen.findByText('Sin nómina ni actividad ahora mismo');
    expect(screen.getByText('Tengo otro ingreso del trabajo')).toBeTruthy();
    expect(screen.queryByTestId('nomina-wizard')).toBeNull();
  });

  test('sin situación laboral (persona vacía) → deja elegir y sugiere completar persona', async () => {
    mockGetPersonalData.mockResolvedValue(null);
    renderBloque();
    await screen.findByText('Nómina');
    expect(screen.getByText('Autónomo')).toBeTruthy();
    expect(screen.getByText(/Completa «Quién eres»/)).toBeTruthy();
  });
});

describe('NominaBloque · /empezar · pre-relleno y cierre del bucle', () => {
  test('con nómina detectada · al abrir Nómina el form sale pre-rellenado (empresa/día/cuenta)', async () => {
    mockGetPersonalData.mockResolvedValue(null);
    mockDetectar.mockResolvedValue([
      { tipo: 'nomina', prefill: { neto: 1850, dia: 25, cuentaId: 7, pagador: 'ACME SL' } },
    ]);
    renderBloque();
    await screen.findByText('Detectado en tus extractos');
    fireEvent.click(screen.getByText('Nómina'));
    await screen.findByTestId('nomina-wizard');
    expect(lastNominaProps?.prefill).toEqual({ neto: 1850, dia: 25, cuentaId: 7, empresa: 'ACME SL' });
  });

  test('sin detección · al abrir Nómina el form sale en blanco (mismo form · sin prefill)', async () => {
    mockGetPersonalData.mockResolvedValue(null);
    renderBloque();
    fireEvent.click(await screen.findByText('Nómina'));
    await screen.findByTestId('nomina-wizard');
    expect(lastNominaProps?.prefill).toBeUndefined();
  });

  test('solo asalariado · guardar → marca el bloque completado, sube el % y vuelve al flujo', async () => {
    mockGetPersonalData.mockResolvedValue(persona(['asalariado']));
    renderBloque();
    await screen.findByTestId('nomina-wizard');
    fireEvent.click(screen.getByText('guardar-nomina'));
    await waitFor(() => expect(mockSetBloque).toHaveBeenCalledWith('nomina', 'completado'));
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/empezar/hub');
  });

  test('solo asalariado · cancelar → vuelve al bloque sin marcarlo', async () => {
    mockGetPersonalData.mockResolvedValue(persona(['asalariado']));
    renderBloque();
    await screen.findByTestId('nomina-wizard');
    fireEvent.click(screen.getByText('cancelar-nomina'));
    await waitFor(() => expect(screen.queryByTestId('nomina-wizard')).toBeNull());
    expect(screen.getByText('Completar')).toBeTruthy(); // de vuelta en la tarea
    expect(mockSetBloque).not.toHaveBeenCalled();
  });

  test('ambos · completar una deja el bloque parcial · completar la segunda lo cierra', async () => {
    mockGetPersonalData.mockResolvedValue(persona(['asalariado', 'autonomo']));
    renderBloque();
    await screen.findByText('Tu nómina');

    // Primera tarea · nómina.
    fireEvent.click(screen.getAllByText('Completar')[0]);
    await screen.findByTestId('nomina-wizard');
    fireEvent.click(screen.getByText('guardar-nomina'));
    await waitFor(() => expect(mockSetBloque).toHaveBeenCalledWith('nomina', 'parcial'));
    expect(mockNavigate).not.toHaveBeenCalled();

    // De vuelta a la lista · nómina hecha, queda la actividad.
    await screen.findByText('✓ Hecho');
    fireEvent.click(screen.getByText('Completar'));
    await screen.findByTestId('autonomo-wizard');
    fireEvent.click(screen.getByText('guardar-autonomo'));
    await waitFor(() => expect(mockSetBloque).toHaveBeenCalledWith('nomina', 'completado'));
    expect(mockNavigate).toHaveBeenCalledWith('/empezar/hub');
  });

  test('ambos · saltar las dos tareas cierra el bloque', async () => {
    mockGetPersonalData.mockResolvedValue(persona(['asalariado', 'autonomo']));
    renderBloque();
    await screen.findByText('Tu nómina');

    fireEvent.click(screen.getAllByText('Saltar')[0]); // salta nómina · aún falta actividad
    await waitFor(() => expect(screen.getByText('Saltada')).toBeTruthy());
    expect(mockSetBloque).not.toHaveBeenCalledWith('nomina', 'completado');

    fireEvent.click(screen.getByText('Saltar')); // salta actividad · se completa
    await waitFor(() => expect(mockSetBloque).toHaveBeenCalledWith('nomina', 'completado'));
    expect(mockNavigate).toHaveBeenCalledWith('/empezar/hub');
  });
});
