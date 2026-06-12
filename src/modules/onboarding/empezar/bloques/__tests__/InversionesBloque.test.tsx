// FIX PUNTO 7 · P1/P2 · el bloque inversiones enlaza la vía manual con
// ?from=empezar y, al volver con ?done=…, cierra el bucle: refresh() (marca el
// bloque) + toast + vuelta al mapa. Cancelar (sin ?done) no marca nada.
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import InversionesBloque from '../InversionesBloque';

window.scrollTo = jest.fn();

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
        prestamos: { estado: 'pendiente' }, nomina: { estado: 'pendiente' },
        inversiones: { estado: 'pendiente' },
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
        <Route path="/empezar/inversiones" element={<InversionesBloque />} />
        <Route path="*" element={<Loc />} />
      </Routes>
    </MemoryRouter>,
  );

describe('InversionesBloque · ida y vuelta (P1/P2)', () => {
  beforeEach(() => {
    mockRefresh.mockClear();
    mockToast.mockClear();
  });

  it('la vía "una a una" navega con ?from=empezar', async () => {
    renderAt('/empezar/inversiones');
    await userEvent.click(screen.getByRole('button', { name: /Una a una/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/inversiones?from=empezar');
  });

  it('al volver con ?done refresca, marca, hace toast y va al hub', async () => {
    renderAt('/empezar/inversiones?done=posicion');
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockToast).toHaveBeenCalledWith(expect.stringMatching(/bloque inversiones completado/), 'success');
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/empezar/hub'));
  });

  it('sin ?done (cancelar) no cierra el bucle (no refresh ni toast)', () => {
    renderAt('/empezar/inversiones');
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });
});
