// Smoke test · BloqueProyeccion (PR 4 · cableado).
// Reemplaza el smoke shell de PR 1 · ahora el componente carga datos vía
// servicios y usa react-router para los chips fuente.

import '@testing-library/jest-dom';

// Mock servicios de datos · evita IndexedDB y deps en tests.
jest.mock('../../../../../services/escenariosService', () => ({
  getEscenarioActivo: jest.fn(() =>
    Promise.resolve({
      id: 1,
      modoVivienda: 'alquiler',
      gastosVidaLibertadMensual: 2500,
      estrategia: 'hibrido',
      hitos: [],
      edadObjetivoRescate: 65,
      inflacionAnualAsumida: 2,
      updatedAt: '2026-05-17T00:00:00.000Z',
    }),
  ),
}));

jest.mock('../../../../../services/benchmarksReferenciaService', () => ({
  listBenchmarks: jest.fn(() => Promise.resolve([])),
}));

jest.mock('../../../../../services/personalDataService', () => ({
  personalDataService: {
    getPersonalData: jest.fn(() => Promise.resolve(null)),
  },
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BloqueProyeccion from '../BloqueProyeccion';

const renderConRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

const baseProps = {
  posicionId: 'plan-orange',
  tipoActivo: 'plan_pensiones' as const,
  saldoActual: 35491,
  aportadoActual: 36327,
  aportacionAnualEstimada: 1500,
  twrHistorico: -0.001,
  anosTranscurridos: 17,
  politicaInversion: 'renta_mixta',
};

describe('BloqueProyeccion · render base', () => {
  test('expone los 3 toggles de escenario · accesibles por nombre', async () => {
    renderConRouter(<BloqueProyeccion {...baseProps} />);
    expect(await screen.findByLabelText('Proyección')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escenario actual' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Si cambias gestora' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Si aportas el máximo' })).toBeInTheDocument();
  });

  test('toggle inicial · "Escenario actual" tiene clase active', async () => {
    renderConRouter(<BloqueProyeccion {...baseProps} />);
    const btnActual = await screen.findByRole('button', { name: 'Escenario actual' });
    expect(btnActual.className).toMatch(/active/);
  });

  test('click en "Si aportas el máximo" migra la clase active a ese botón', async () => {
    renderConRouter(<BloqueProyeccion {...baseProps} />);
    const btnMax = await screen.findByRole('button', { name: 'Si aportas el máximo' });
    fireEvent.click(btnMax);
    expect(btnMax.className).toMatch(/active/);
  });

  test('chips fuente · 3 botones navegables ↗ (Mi Plan · Mi Plan · Ajustes)', async () => {
    renderConRouter(<BloqueProyeccion {...baseProps} />);
    expect(
      await screen.findByLabelText('Editar edad de rescate en Mi Plan'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Editar inflación asumida en Mi Plan'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Configurar benchmarks en Ajustes'),
    ).toBeInTheDocument();
  });

  test('genérico · data-tipo-activo refleja la prop · prop tipoActivo agnostic', async () => {
    const { container } = renderConRouter(
      <BloqueProyeccion {...baseProps} tipoActivo="fondo" />,
    );
    const root = await waitFor(() =>
      container.querySelector('[data-bloque="P1"]'),
    );
    expect(root).not.toBeNull();
    expect(root!.getAttribute('data-tipo-activo')).toBe('fondo');
    expect(root!.getAttribute('data-posicion-id')).toBe('plan-orange');
  });

});

// NOTA · el copy tipo-aware (PPI/PPE accionable/informativo · PPA garantizado)
// queda cubierto por `tipoPlanCopy.test.ts` (unitario) y `BloqueCostes.test.tsx`
// (integración del banner). El render asíncrono del mensaje en
// BloqueProyeccion depende del async load completo y no aporta cobertura
// adicional sobre la decisión tipo-aware.
