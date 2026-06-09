// FIX PUNTO 4 · la sección "Esto encontré en tus extractos" vive DENTRO del
// bloque cuentas. "Añadir recurrente a mano" y confirmar una sugerencia
// empiezan preguntando el ÁMBITO (P10): un inmueble → gastosInmueble del
// inmueble (deducible), personal → Personal · Gastos. Nunca cruzados.
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import SugerenciasSection from '../SugerenciasSection';
import {
  detectarSugerencias,
  confirmarSugerencia,
  descartarSugerencia,
  adivinarAmbitoRecurrente,
  type Sugerencia,
  type AmbitoRecurrente,
} from '../../../../../services/onboardingDetectionService';
import { initDB } from '../../../../../services/db';

const mockRefresh = jest.fn().mockResolvedValue(undefined);
jest.mock('../../OnboardingContext', () => ({
  useOnboarding: () => ({
    refresh: mockRefresh,
    loading: false,
    setBloque: jest.fn(),
    progress: { pct: 0, nucleoCompleto: false, pendientes: [], completados: 0 },
    state: { bloques: {}, cuentas: {}, nucleoCompleto: false, revealVisto: false, updatedAt: '' },
  }),
}));

const mockToast = jest.fn();
jest.mock('../../../../../design-system/v5', () => {
  const actual = jest.requireActual('../../../../../design-system/v5');
  return { ...actual, showToastV5: (...a: unknown[]) => mockToast(...a) };
});

let mockSugerencias: Sugerencia[] = [];
let mockGuess: AmbitoRecurrente = { ambito: 'personal' };
jest.mock('../../../../../services/onboardingDetectionService', () => ({
  detectarSugerencias: jest.fn(),
  confirmarSugerencia: jest.fn(),
  descartarSugerencia: jest.fn(),
  adivinarAmbitoRecurrente: jest.fn(),
}));
const mockDetectar = detectarSugerencias as jest.Mock;
const mockConfirmar = confirmarSugerencia as jest.Mock;
const mockDescartar = descartarSugerencia as jest.Mock;
const mockAdivinar = adivinarAmbitoRecurrente as jest.Mock;

const Loc: React.FC = () => {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname}{l.search}</div>;
};

const renderSection = () =>
  render(
    <MemoryRouter initialEntries={['/empezar/cuentas']}>
      <Routes>
        <Route path="/empezar/cuentas" element={<SugerenciasSection />} />
        <Route path="*" element={<Loc />} />
      </Routes>
    </MemoryRouter>,
  );

const recurrente = (): Sugerencia =>
  ({
    tipo: 'recurrente', clave: 'r1', nombre: 'Netflix', meta: 'mensual', contraparte: 'netflix',
    accountId: 5, importe: 12.99, cadencia: 'mensual',
  }) as Sugerencia;

async function seedInmueble(id: number, alias: string) {
  const db = await initDB();
  await db.put('properties', { id, alias, address: `${alias} 1` } as never);
}

beforeEach(async () => {
  // CRA usa resetMocks:true · reestablecemos implementaciones en cada test.
  mockSugerencias = [];
  mockGuess = { ambito: 'personal' };
  mockRefresh.mockResolvedValue(undefined);
  mockDetectar.mockImplementation(async () => mockSugerencias);
  mockConfirmar.mockResolvedValue(undefined);
  mockDescartar.mockResolvedValue(undefined);
  mockAdivinar.mockImplementation(() => mockGuess);
  // Limpia properties entre tests.
  const db = await initDB();
  await db.clear('properties');
});

describe('SugerenciasSection · ámbito de recurrentes (P10)', () => {
  it('"Añadir recurrente a mano" · personal → alta real /personal/gastos/nuevo?from=empezar', async () => {
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: /Añadir recurrente a mano/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /Personal · hogar/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: /Continuar/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/personal/gastos/nuevo?from=empezar');
  });

  it('"Añadir recurrente a mano" · inmueble → alta de gasto del inmueble /inmuebles/:id/gastos/nuevo?from=empezar', async () => {
    await seedInmueble(7, 'Piso Centro');
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: /Añadir recurrente a mano/ }));
    const dialog = await screen.findByRole('dialog');
    const inmuebleBtn = within(dialog).getByRole('button', { name: /Un inmueble/ });
    await waitFor(() => expect(inmuebleBtn).toBeEnabled());
    await userEvent.click(inmuebleBtn);
    await userEvent.click(within(dialog).getByRole('button', { name: /Continuar/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/inmuebles/7/gastos/nuevo?from=empezar');
  });

  it('confirmar una recurrente · personal → la crea en ámbito personal y refresca', async () => {
    mockSugerencias = [recurrente()];
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /Confirmar/ }));
    await waitFor(() => expect(mockConfirmar).toHaveBeenCalledTimes(1));
    expect(mockConfirmar.mock.calls[0][1]).toEqual({ ambito: 'personal' });
    await waitFor(() => expect(screen.queryByText('Netflix')).not.toBeInTheDocument());
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('confirmar una recurrente · inmueble → la crea en gastosInmueble del inmueble (no en Personal)', async () => {
    await seedInmueble(7, 'Piso Centro');
    mockSugerencias = [recurrente()];
    mockGuess = { ambito: 'inmueble', inmuebleId: 7 }; // motor pre-marca inmueble
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    const dialog = await screen.findByRole('dialog');
    // El ámbito viene pre-marcado · el usuario solo confirma.
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /Un inmueble/ })).toHaveAttribute('aria-pressed', 'true'),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: /Confirmar/ }));
    await waitFor(() => expect(mockConfirmar).toHaveBeenCalledTimes(1));
    expect(mockConfirmar.mock.calls[0][1]).toEqual({ ambito: 'inmueble', inmuebleId: 7 });
  });

  it('sin cuentas con extracto invita a subir el extracto desde la fila (no puente suelto)', async () => {
    renderSection();
    await waitFor(() =>
      expect(screen.getByText(/Sube el extracto de una cuenta/)).toBeInTheDocument(),
    );
  });
});
