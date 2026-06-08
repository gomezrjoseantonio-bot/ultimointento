// FIX P1/P2 · el bloque contratos enlaza ambas vías con ?from=empezar y, al
// volver con ?done=…, cierra el bucle: refresh() (marca el bloque) + toast +
// vuelta al mapa.
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import ContratosBloque from '../ContratosBloque';

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
        <Route path="/empezar/contratos" element={<ContratosBloque />} />
        <Route path="*" element={<Loc />} />
      </Routes>
    </MemoryRouter>,
  );

describe('ContratosBloque · ida y vuelta (P1/P2)', () => {
  beforeEach(() => {
    mockRefresh.mockClear();
    mockToast.mockClear();
  });

  it('la vía Importar navega con ?from=empezar', async () => {
    renderAt('/empezar/contratos');
    await userEvent.click(screen.getByRole('button', { name: /Importar de una vez/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/inmuebles/importar-contratos?from=empezar');
  });

  it('la vía manual navega con ?from=empezar', async () => {
    renderAt('/empezar/contratos');
    await userEvent.click(screen.getByRole('button', { name: /Uno a uno/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/contratos/nuevo?from=empezar');
  });

  it('al volver con ?done refresca, marca, hace toast y va al hub', async () => {
    renderAt('/empezar/contratos?done=import');
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockToast).toHaveBeenCalledWith(expect.stringMatching(/bloque contratos completado/), 'success');
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/empezar/hub'));
  });

  it('sin ?done no cierra el bucle (no refresh ni toast)', () => {
    renderAt('/empezar/contratos');
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });
});
