/**
 * Onboarding día 0 · C7 · datos del reveal.
 *
 * Cubre (§5 · C7):
 *   · reveal sin nómina (sin renta de trabajo/actividad) → IRPF null (UI: "—")
 *   · con renta de trabajo → IRPF = cuotaLiquida
 *   · el bootstrap se dispara (idempotente · forward-only · su no-duplicación
 *     se prueba en su propia suite); dos cargas no acumulan eventos en cliente
 *   · rentas/gastos del año se agregan desde treasuryEvents (FUTURO)
 */
jest.mock('../treasuryBootstrapService', () => ({
  __esModule: true,
  regenerateForecastsForward: jest.fn(),
}));
jest.mock('../estimacionFiscalEnCursoService', () => ({
  __esModule: true,
  calcularEstimacionEnCurso: jest.fn(),
}));

const anio = new Date().getFullYear();
let mockEventos: Array<Record<string, unknown>> = [];
jest.mock('../db', () => ({
  __esModule: true,
  initDB: async () => ({
    getAll: async (store: string) =>
      store === 'treasuryEvents'
        ? mockEventos
        : store === 'properties'
          ? [{ id: 1 }, { id: 2 }]
          : store === 'contracts'
            ? [{ estadoContrato: 'activo' }]
            : [],
  }),
}));

import { cargarRevealData, puntosSVG, ejeMax } from '../onboardingRevealService';
import { regenerateForecastsForward } from '../treasuryBootstrapService';
import { calcularEstimacionEnCurso } from '../estimacionFiscalEnCursoService';

const mockBootstrap = regenerateForecastsForward as jest.Mock;
const mockEstimacion = calcularEstimacionEnCurso as jest.Mock;

beforeEach(() => {
  mockBootstrap.mockReset().mockResolvedValue({});
  mockEstimacion.mockReset();
  mockEventos = [
    { type: 'income', amount: 2140, predictedDate: `${anio}-01-01` },
    { type: 'income', amount: 2140, predictedDate: `${anio}-02-01` },
    { type: 'expense', amount: -785, predictedDate: `${anio}-01-05` },
  ];
});

it('sin renta de trabajo/actividad → IRPF null (UI muestra "—")', async () => {
  mockEstimacion.mockResolvedValue({
    ingresosAcumulados: { trabajo: 0, actividades: 0 },
    ingresosProyectados: { trabajo: 0 },
    resultadoEstimado: { cuotaLiquida: 1234 },
  });
  const data = await cargarRevealData();
  expect(data.irpf).toBeNull();
  expect(mockBootstrap).toHaveBeenCalledTimes(1); // bootstrap disparado
});

it('con renta de trabajo → IRPF = cuotaLiquida', async () => {
  mockEstimacion.mockResolvedValue({
    ingresosAcumulados: { trabajo: 30000, actividades: 0 },
    ingresosProyectados: { trabajo: 30000 },
    resultadoEstimado: { cuotaLiquida: 4200 },
  });
  const data = await cargarRevealData();
  expect(data.irpf).toBe(4200);
});

it('agrega rentas/gastos del año desde treasuryEvents', async () => {
  mockEstimacion.mockResolvedValue(null);
  const data = await cargarRevealData();
  expect(data.rentasAnio).toBe(4280); // 2140 + 2140
  expect(data.gastosAnio).toBe(785);
  expect(data.ocupacion).toBe('1 de 2');
  expect(data.mensualIngreso[0]).toBe(2140);
});

it('dos cargas no acumulan eventos en cliente (idempotente)', async () => {
  mockEstimacion.mockResolvedValue(null);
  const a = await cargarRevealData();
  const b = await cargarRevealData();
  expect(a.rentasAnio).toBe(b.rentasAnio);
});

describe('SVG', () => {
  it('puntosSVG escala a la altura del eje (regla Y)', () => {
    expect(puntosSVG([0], 100)).toBe('60,220'); // valor 0 → base
    expect(puntosSVG([100], 100)).toBe('60,20'); // valor max → tope
  });
  it('ejeMax redondea hacia arriba a cifra bonita', () => {
    expect(ejeMax([2140], [785])).toBe(3000);
  });
});
