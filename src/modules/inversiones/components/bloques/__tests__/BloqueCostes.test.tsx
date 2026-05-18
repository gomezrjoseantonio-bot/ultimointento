// Smoke test · BloqueCostes (PR 4 · spec §11 fila 8).
// PPE NO muestra botón "Buscar plan con TER menor" · PPI sí.
// Verifica copy tipo-aware ("Lo que te cobra…" / "Lo que cuesta…").

import '@testing-library/jest-dom';

// Mock service de avisos · el hook `useAvisoCerrable` lo consume.
const mockEstaAvisoActivo = jest.fn();
const mockCerrarAviso = jest.fn();
jest.mock('../../../../../services/avisosUsuarioService', () => ({
  estaAvisoActivo: (...args: any[]) => mockEstaAvisoActivo(...args),
  cerrarAviso: (...args: any[]) => mockCerrarAviso(...args),
}));

jest.mock('../../../../../design-system/v5', () => ({
  showToastV5: jest.fn(),
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BloqueCostes from '../BloqueCostes';

const baseProps = {
  posicionId: 'plan-1',
  tipoActivo: 'plan_pensiones' as const,
  ter: 0.0138,
  saldoMedioAnual: 36000,
  anosTranscurridos: 17,
  anosHastaRescate: 23,
  saldoMedioProyectado: 70000,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEstaAvisoActivo.mockResolvedValue(true);
  mockCerrarAviso.mockResolvedValue(undefined);
});

describe('BloqueCostes · tipo-aware copy (§5.4)', () => {
  test('PPI · título "Lo que te cobra la gestora" · botón "Buscar plan con TER menor"', async () => {
    render(<BloqueCostes {...baseProps} tipoPlan="PPI" />);
    expect(await screen.findByText('Lo que te cobra la gestora')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Buscar plan con TER menor/ }),
    ).toBeInTheDocument();
  });

  test('PPE · título "Lo que cuesta tener este plan" · SIN botón "Buscar plan con TER menor"', async () => {
    render(
      <BloqueCostes {...baseProps} tipoPlan="PPE" nombreEmpresa="Orange España" />,
    );
    expect(await screen.findByText('Lo que cuesta tener este plan')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Buscar plan con TER menor/ }),
    ).not.toBeInTheDocument();
  });

  test('PPES · botón presente igual que PPI', async () => {
    render(<BloqueCostes {...baseProps} tipoPlan="PPES" />);
    await screen.findByText('Lo que te cobra la gestora');
    expect(
      screen.getByRole('button', { name: /Buscar plan con TER menor/ }),
    ).toBeInTheDocument();
  });

  test('PPA garantizado · SIN botón · banner info-garantizado visible', async () => {
    render(<BloqueCostes {...baseProps} tipoPlan="PPA" garantizado />);
    await screen.findByText('Lo que te cobra la gestora');
    expect(
      screen.queryByRole('button', { name: /Buscar plan con TER menor/ }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/garantizado/)).toBeInTheDocument(),
    );
  });

  test('PPA NO garantizado · botón presente', async () => {
    render(<BloqueCostes {...baseProps} tipoPlan="PPA" garantizado={false} />);
    await screen.findByText('Lo que te cobra la gestora');
    expect(
      screen.getByRole('button', { name: /Buscar plan con TER menor/ }),
    ).toBeInTheDocument();
  });

  test('PPE · banner sustituye {nombreEmpresa}', async () => {
    render(
      <BloqueCostes {...baseProps} tipoPlan="PPE" nombreEmpresa="Orange España" />,
    );
    await waitFor(() =>
      expect(screen.getByText(/Orange España/)).toBeInTheDocument(),
    );
  });

  test('PPI · banner cerrable · click X llama cerrarAviso con id correcto', async () => {
    render(<BloqueCostes {...baseProps} tipoPlan="PPI" />);
    const cerrar = await screen.findByLabelText('Cerrar aviso de comisiones');
    fireEvent.click(cerrar);
    await waitFor(() =>
      expect(mockCerrarAviso).toHaveBeenCalledWith(
        'coste-cambio-gestora-cta',
        expect.objectContaining({ ubicacionContexto: '/inversiones/plan-1' }),
      ),
    );
  });

  test('PPE · banner cerrable · usa avisoId distinto (coste-ppe-info)', async () => {
    render(<BloqueCostes {...baseProps} tipoPlan="PPE" />);
    const cerrar = await screen.findByLabelText('Cerrar aviso de comisiones');
    fireEvent.click(cerrar);
    await waitFor(() =>
      expect(mockCerrarAviso).toHaveBeenCalledWith(
        'coste-ppe-info',
        expect.any(Object),
      ),
    );
  });

  test('aviso cerrado previamente · banner no se muestra', async () => {
    mockEstaAvisoActivo.mockResolvedValueOnce(false);
    render(<BloqueCostes {...baseProps} tipoPlan="PPI" />);
    await screen.findByText('Lo que te cobra la gestora');
    await waitFor(() => {
      expect(
        screen.queryByLabelText('Cerrar aviso de comisiones'),
      ).not.toBeInTheDocument();
    });
  });
});
