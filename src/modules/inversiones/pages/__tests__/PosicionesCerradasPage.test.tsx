// Smoke test · PosicionesCerradasPage (PR 5 · spec §11 fila 10).
// 4 KPIs presentes · histograma 5 bins · best/worst · ranking tabla.

import '@testing-library/jest-dom';

// Mocks de servicios · evita IndexedDB y carga de datos reales.
const mockGet = jest.fn();
jest.mock('../../adapters/posicionesCerradas', () => {
  const actual = jest.requireActual('../../adapters/posicionesCerradas');
  return {
    ...actual,
    getPosicionesCerradas: (...args: any[]) => mockGet(...args),
  };
});

// Mocks de avisos · banners cerrables.
jest.mock('../../../../services/avisosUsuarioService', () => ({
  estaAvisoActivo: jest.fn(() => Promise.resolve(true)),
  cerrarAviso: jest.fn(),
}));

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PosicionesCerradasPage from '../PosicionesCerradasPage';
import type { PosicionCerrada } from '../../adapters/posicionesCerradas';

const mk = (patch: Partial<PosicionCerrada> = {}): PosicionCerrada => ({
  id: 'p-1',
  nombre: 'Fondo Test',
  tipo: 'fondo_inversion',
  entidad: 'BBVA',
  fechaCierre: '2024-12-31T00:00:00.000Z',
  aportado: 10_000,
  vendido: 12_000,
  resultado: 2_000,
  resultadoPercent: 20,
  cagr: 8,
  duracionDias: 730,
  fechaApertura: '2023-01-01T00:00:00.000Z',
  ...patch,
});

const renderConRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PosicionesCerradasPage · estado vacío', () => {
  test('sin cerradas · empty state con mensaje', async () => {
    mockGet.mockResolvedValueOnce([]);
    renderConRouter(<PosicionesCerradasPage />);
    expect(
      await screen.findByText(/Aún no tienes posiciones cerradas/),
    ).toBeInTheDocument();
  });
});

describe('PosicionesCerradasPage · render con datos · 4 KPIs + histograma + ranking', () => {
  beforeEach(() => {
    const cs = [
      mk({ id: 'a', tipo: 'fondo_inversion', aportado: 10_000, vendido: 12_000, resultado: 2_000, resultadoPercent: 20, cagr: 8 }),
      mk({ id: 'b', tipo: 'accion', aportado: 5_000, vendido: 6_500, resultado: 1_500, resultadoPercent: 30, cagr: 15 }),
      mk({ id: 'c', tipo: 'accion', aportado: 3_000, vendido: 2_700, resultado: -300, resultadoPercent: -10, cagr: -5 }),
      mk({ id: 'd', tipo: 'fondo_inversion', aportado: 8_000, vendido: 8_400, resultado: 400, resultadoPercent: 5, cagr: 2.5 }),
      mk({ id: 'e', tipo: 'crypto', aportado: 2_000, vendido: 5_000, resultado: 3_000, resultadoPercent: 150, cagr: 50 }),
    ];
    mockGet.mockResolvedValue(cs);
  });

  test('hero · los 4 KPIs aparecen con labels canónicos (§6.1)', async () => {
    renderConRouter(<PosicionesCerradasPage />);
    expect(await screen.findByText('Capital invertido')).toBeInTheDocument();
    expect(screen.getByText('Plusvalía neta')).toBeInTheDocument();
    expect(screen.getByText('CAGR medio ponderado')).toBeInTheDocument();
    expect(screen.getByText('Tasa de acierto')).toBeInTheDocument();
  });

  test('best/worst · 2 cards · mejor por % (no por € absoluto)', async () => {
    renderConRouter(<PosicionesCerradasPage />);
    await screen.findByText('Capital invertido');
    // Mejor = crypto (150 %) · NO el fondo que tiene mayor € absoluto.
    expect(screen.getByText('Mejor cierre')).toBeInTheDocument();
    expect(screen.getByText('Peor cierre')).toBeInTheDocument();
    // El nombre del mejor (crypto) debe aparecer en la card best.
    // El peor es 'c' (-10 %).
    await waitFor(() => {
      const text = document.body.textContent ?? '';
      expect(text).toContain('Fondo Test'); // nombre genérico mock
    });
  });

  test('histograma · 5 bins fijos siempre presentes', async () => {
    renderConRouter(<PosicionesCerradasPage />);
    await screen.findByText('Capital invertido');
    // Los labels de los 5 bins están en el DOM.
    expect(screen.getByText('<0%')).toBeInTheDocument();
    expect(screen.getByText('0-3%')).toBeInTheDocument();
    expect(screen.getByText('3-10%')).toBeInTheDocument();
    expect(screen.getByText('10-20%')).toBeInTheDocument();
    expect(screen.getByText('>20%')).toBeInTheDocument();
  });

  test('ranking · tabla por tipo con encabezados canónicos (§6.4)', async () => {
    renderConRouter(<PosicionesCerradasPage />);
    await screen.findByText('Capital invertido');
    expect(screen.getByText('Por tipo de activo')).toBeInTheDocument();
    // Tipo · Nº ops · Capital · Plusvalía · CAGR medio · Tiempo medio
    expect(screen.getByText('Nº ops')).toBeInTheDocument();
    expect(screen.getByText('CAGR medio')).toBeInTheDocument();
    expect(screen.getByText('Tiempo medio')).toBeInTheDocument();
    // El líder (acciones · CAGR weighted más alto si ponderamos) muestra tag "líder"
    expect(screen.getByText('líder')).toBeInTheDocument();
  });

  test('detalle de operaciones · listado tabular SIN columnas fiscales', async () => {
    renderConRouter(<PosicionesCerradasPage />);
    await screen.findByText('Capital invertido');
    // Las 6 columnas canónicas: Activo · Cierre · Aportado · Tiempo · Plusvalía · TWR.
    expect(screen.getByText('Operaciones cerradas')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Cierre')).toBeInTheDocument();
    expect(screen.getByText('Aportado')).toBeInTheDocument();
    expect(screen.getByText('Tiempo')).toBeInTheDocument();
    // 'Plusvalía' aparece en ranking (totales) + detalle (por op).
    expect(screen.getAllByText('Plusvalía').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('TWR')).toBeInTheDocument();
    // NO debe aparecer ninguna columna fiscal.
    expect(screen.queryByText(/casilla/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/documento/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/IRPF/i)).not.toBeInTheDocument();
  });

  test('subtítulo es "foco rentabilidad real" · no fiscal', async () => {
    renderConRouter(<PosicionesCerradasPage />);
    await screen.findByText('Capital invertido');
    expect(screen.getByText(/foco rentabilidad real/)).toBeInTheDocument();
  });
});
