// FIX PUNTO 4 · la sección "Esto encontré en tus extractos" vive DENTRO del
// bloque cuentas. "Añadir recurrente a mano" es la vía manual REAL (lleva al
// alta existente con ?from=empezar · no una vía fantasma). Confirmar una
// sugerencia la crea por su servicio canónico y refresca el progreso.
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import SugerenciasSection from '../SugerenciasSection';
import {
  detectarSugerencias,
  confirmarSugerencia,
  descartarSugerencia,
  type Sugerencia,
} from '../../../../../services/onboardingDetectionService';

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
jest.mock('../../../../../services/onboardingDetectionService', () => ({
  detectarSugerencias: jest.fn(),
  confirmarSugerencia: jest.fn(),
  descartarSugerencia: jest.fn(),
}));
const mockDetectar = detectarSugerencias as jest.Mock;
const mockConfirmar = confirmarSugerencia as jest.Mock;
const mockDescartar = descartarSugerencia as jest.Mock;

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

beforeEach(() => {
  // CRA usa resetMocks:true · reestablecemos implementaciones en cada test.
  mockSugerencias = [];
  mockRefresh.mockResolvedValue(undefined);
  mockDetectar.mockImplementation(async () => mockSugerencias);
  mockConfirmar.mockResolvedValue(undefined);
  mockDescartar.mockResolvedValue(undefined);
});

describe('SugerenciasSection · dentro del bloque cuentas', () => {
  it('"Añadir recurrente a mano" lleva al alta real con ?from=empezar (vía manual de verdad)', async () => {
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: /Añadir recurrente a mano/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/personal/gastos/nuevo?from=empezar');
  });

  it('confirmar una recurrente la crea por su servicio y refresca el progreso', async () => {
    mockSugerencias = [recurrente()];
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mockConfirmar).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('Netflix')).not.toBeInTheDocument());
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('sin cuentas con extracto invita a subir el extracto desde la fila (no puente suelto)', async () => {
    renderSection();
    await waitFor(() =>
      expect(screen.getByText(/Sube el extracto de una cuenta/)).toBeInTheDocument(),
    );
  });
});
