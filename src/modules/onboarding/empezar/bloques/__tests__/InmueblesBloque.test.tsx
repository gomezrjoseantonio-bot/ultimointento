// FIX P1 · el bloque inmuebles enlaza la vía manual con ?from=empezar y, al
// volver con ?done=…, cierra el bucle: refresh() (marca el bloque) + toast +
// vuelta al mapa. Cancelar (sin ?done) no marca nada.
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import InmueblesBloque from '../InmueblesBloque';

const mockRefresh = jest.fn().mockResolvedValue(undefined);
jest.mock('../../OnboardingContext', () => ({
  useOnboarding: () => ({
    refresh: mockRefresh,
    loading: false,
    setBloque: jest.fn(),
    progress: { pct: 0, nucleoCompleto: false, pendientes: [], completados: 0 },
    state: {
      bloques: {
        persona: { estado: 'pendiente' }, inmuebles: { estado: 'pendiente' },
        contratos: { estado: 'pendiente' }, cuentas: { estado: 'pendiente' },
        finanzas: { estado: 'pendiente' }, prestamos: { estado: 'pendiente' },
        nomina: { estado: 'pendiente' }, inversiones: { estado: 'pendiente' },
      },
      cuentas: {}, nucleoCompleto: false, revealVisto: false, updatedAt: '',
    },
  }),
}));

const mockToast = jest.fn();
jest.mock('../../../../../design-system/v5', () => {
  const actual = jest.requireActual('../../../../../design-system/v5');
  return { ...actual, showToastV5: (...a: unknown[]) => mockToast(...a) };
});

const Loc: React.FC = () => {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname}{l.search}</div>;
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/empezar/inmuebles" element={<InmueblesBloque />} />
        <Route path="*" element={<Loc />} />
      </Routes>
    </MemoryRouter>,
  );

describe('InmueblesBloque · ida y vuelta (P1)', () => {
  beforeEach(() => {
    mockRefresh.mockClear();
    mockToast.mockClear();
  });

  it('la vía manual navega con ?from=empezar', async () => {
    renderAt('/empezar/inmuebles');
    await userEvent.click(screen.getByRole('button', { name: /Uno a uno/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/inmuebles/nuevo?from=empezar');
  });

  it('al volver con ?done refresca, marca, hace toast y va al hub', async () => {
    renderAt('/empezar/inmuebles?done=inmueble');
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockToast).toHaveBeenCalledWith(expect.stringMatching(/bloque inmuebles completado/), 'success');
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/empezar/hub'));
  });

  it('sin ?done (cancelar) no cierra el bucle (no refresh ni toast)', () => {
    renderAt('/empezar/inmuebles');
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });
});
