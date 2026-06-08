// FIX PUNTO 4 · el bloque cuentas ES la gestión dentro del flujo (no puente):
// lista de cuentas con chip y saldo, alta con el modal real sobre el flujo,
// "Subir extracto" POR CUENTA (cuenta destino prefijada · P7 muerto) y cierre
// del bucle al crear/editar o volver de subir un extracto.
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import CuentasBloque from '../CuentasBloque';
import { setCuentaVia } from '../../../../../services/onboardingProgressService';
import { loadSaldosActualesCuentas } from '../../../../mi-plan/wizards/utils/getCurrentSaldoCuenta';
import type { Account } from '../../../../../services/db';

const mockRefresh = jest.fn().mockResolvedValue(undefined);
let mockCuentasVia: Record<number, string> = {};
jest.mock('../../OnboardingContext', () => ({
  useOnboarding: () => ({
    refresh: mockRefresh,
    loading: false,
    setBloque: jest.fn(),
    progress: { pct: 0, nucleoCompleto: false, pendientes: [], completados: 0 },
    state: { bloques: {}, cuentas: mockCuentasVia, nucleoCompleto: false, revealVisto: false, updatedAt: '' },
  }),
}));

const mockToast = jest.fn();
jest.mock('../../../../../design-system/v5', () => {
  const actual = jest.requireActual('../../../../../design-system/v5');
  return { ...actual, showToastV5: (...a: unknown[]) => mockToast(...a) };
});

let mockCuentas: Account[] = [];
let mockSaldos = new Map<number, number>();
jest.mock('../../../../mi-plan/wizards/utils/getCurrentSaldoCuenta', () => ({
  loadSaldosActualesCuentas: jest.fn(),
}));

jest.mock('../../../../../services/onboardingProgressService', () => ({
  setCuentaVia: jest.fn(),
}));
const mockSetCuentaVia = setCuentaVia as jest.Mock;
const mockLoadSaldos = loadSaldosActualesCuentas as jest.Mock;

// Modal real · stubeado a un botón que dispara onSuccess (alta a mano).
jest.mock('../../../../../components/cuenta/CuentaWizard', () => ({
  __esModule: true,
  default: ({ open, onSuccess }: { open: boolean; onSuccess?: () => void }) =>
    open ? (
      <button type="button" onClick={() => onSuccess?.()}>
        stub-guardar-cuenta
      </button>
    ) : null,
}));

// Sección sugerencias · stub (tiene su propio test).
jest.mock('../SugerenciasSection', () => ({
  __esModule: true,
  default: () => <div data-testid="sug-section">sugerencias</div>,
}));

const Loc: React.FC = () => {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname}{l.search}</div>;
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/empezar/cuentas" element={<CuentasBloque />} />
        <Route path="*" element={<Loc />} />
      </Routes>
    </MemoryRouter>,
  );

const eur = (n: number) =>
  `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const cuenta = (over: Partial<Account> = {}): Account =>
  ({ id: 5, alias: 'Nómina BBVA', banco: { name: 'BBVA' }, iban: 'ES1234567890123456789012', ...over }) as Account;

beforeEach(() => {
  // CRA usa resetMocks:true · reestablecemos implementaciones en cada test.
  mockCuentas = [];
  mockSaldos = new Map();
  mockCuentasVia = {};
  mockRefresh.mockResolvedValue(undefined);
  mockSetCuentaVia.mockResolvedValue(undefined);
  mockLoadSaldos.mockImplementation(async () => ({ cuentas: mockCuentas, saldos: mockSaldos }));
});

describe('CuentasBloque · gestión dentro del flujo (P1/P5)', () => {
  it('con cero cuentas NO ofrece subir extractos sueltos · primero crear cuenta (P7 muerto)', async () => {
    renderAt('/empezar/cuentas');
    await screen.findByText(/Aún no tienes cuentas/);
    expect(screen.queryByRole('button', { name: /Subir extracto/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Añadir cuenta/ })).toBeInTheDocument();
  });

  it('lista la cuenta · chip "a mano" por defecto · saldo y acciones por cuenta', async () => {
    mockCuentas = [cuenta()];
    mockSaldos = new Map([[5, 1500]]);
    renderAt('/empezar/cuentas');
    await screen.findByText('Nómina BBVA');
    expect(screen.getByText('a mano')).toBeInTheDocument();
    // saldo en la fila + en el total "Saldo total hoy" (única cuenta).
    expect(screen.getAllByText(eur(1500))).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Subir extracto/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Editar saldo/ })).toBeInTheDocument();
  });

  it('chip "con extracto" cuando la vía está registrada', async () => {
    mockCuentas = [cuenta()];
    mockCuentasVia = { 5: 'con_extracto' };
    renderAt('/empezar/cuentas');
    await screen.findByText('con extracto');
    expect(screen.queryByText('a mano')).not.toBeInTheDocument();
  });

  it('"Subir extracto" nace de la fila · la cuenta destino llega PREFIJADA (?accountId)', async () => {
    mockCuentas = [cuenta()];
    renderAt('/empezar/cuentas');
    await userEvent.click(await screen.findByRole('button', { name: /Subir extracto/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/tesoreria/importar?accountId=5&from=empezar');
  });

  it('al volver de un extracto (?extracto=5) marca "con extracto", refresca y avisa', async () => {
    mockCuentas = [cuenta()];
    renderAt('/empezar/cuentas?extracto=5');
    // refresh es lo último de la cadena del efecto · esperar a él garantiza que
    // setCuentaVia y el toast (anteriores) ya corrieron.
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(mockSetCuentaVia).toHaveBeenCalledWith(5, 'con_extracto');
    expect(mockToast).toHaveBeenCalledWith(expect.stringMatching(/saldo actualizado/), 'success');
  });

  it('añadir cuenta a mano abre el modal real y al guardar cierra el bucle (refresh)', async () => {
    renderAt('/empezar/cuentas');
    await userEvent.click(await screen.findByRole('button', { name: /Añadir cuenta/ }));
    await userEvent.click(screen.getByRole('button', { name: 'stub-guardar-cuenta' }));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it('la sección de sugerencias vive DENTRO del bloque', async () => {
    renderAt('/empezar/cuentas');
    await screen.findByTestId('sug-section');
  });
});
