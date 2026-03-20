import { informesDataService } from './informesDataService';
import { dashboardService } from './dashboardService';
import { inmuebleService } from './inmuebleService';
import { prestamosService } from './prestamosService';
import { personalDataService } from './personalDataService';
import { inversionesService } from './inversionesService';
import { initDB } from './db';
import { calcularDeclaracionIRPF } from './irpfCalculationService';
import { generarEventosFiscales, type EventoFiscal } from './fiscalPaymentsService';
import { generateProyeccionMensual } from '../modules/horizon/proyeccion/mensual/services/proyeccionMensualService';

jest.mock('./dashboardService', () => ({
  dashboardService: {
    getPatrimonioNeto: jest.fn(),
    getFlujosCaja: jest.fn(),
    getTesoreriaPanel: jest.fn(),
  },
}));

jest.mock('./inmuebleService', () => ({
  inmuebleService: {
    getAll: jest.fn(),
  },
}));

jest.mock('./prestamosService', () => ({
  prestamosService: {
    getAllPrestamos: jest.fn(),
    getPaymentPlan: jest.fn(),
  },
}));

jest.mock('./personalDataService', () => ({
  personalDataService: {
    getPersonalData: jest.fn(),
  },
}));

jest.mock('./inversionesService', () => ({
  inversionesService: {
    getPosiciones: jest.fn(),
  },
}));

jest.mock('./db', () => ({
  initDB: jest.fn(),
}));

jest.mock('./irpfCalculationService', () => ({
  calcularDeclaracionIRPF: jest.fn(),
}));

jest.mock('./fiscalPaymentsService', () => ({
  generarEventosFiscales: jest.fn(),
}));

jest.mock('../modules/horizon/proyeccion/mensual/services/proyeccionMensualService', () => ({
  generateProyeccionMensual: jest.fn(),
}));

const mockedDashboardService = dashboardService as jest.Mocked<typeof dashboardService>;
const mockedInmuebleService = inmuebleService as jest.Mocked<typeof inmuebleService>;
const mockedPrestamosService = prestamosService as jest.Mocked<typeof prestamosService>;
const mockedPersonalDataService = personalDataService as jest.Mocked<typeof personalDataService>;
const mockedInversionesService = inversionesService as jest.Mocked<typeof inversionesService>;
const mockedInitDB = initDB as jest.MockedFunction<typeof initDB>;
const mockedCalcularDeclaracionIRPF = calcularDeclaracionIRPF as jest.MockedFunction<typeof calcularDeclaracionIRPF>;
const mockedGenerarEventosFiscales = generarEventosFiscales as jest.MockedFunction<typeof generarEventosFiscales>;
const mockedGenerateProyeccionMensual = generateProyeccionMensual as jest.MockedFunction<typeof generateProyeccionMensual>;

const makeInmueble = (overrides: Record<string, unknown> = {}) => ({
  id: '1',
  alias: 'Tenderina 64 4D',
  direccion: {
    calle: 'Calle Tenderina',
    numero: '64',
    cp: '33010',
    municipio: 'Oviedo',
    provincia: 'Asturias',
    ca: 'Asturias',
  },
  estado: 'ACTIVO',
  fecha_alta: '2024-01-01',
  caracteristicas: { m2: 80, habitaciones: 3, banos: 1 },
  compra: {
    fecha_compra: '2024-01-01',
    regimen: 'USADA_ITP',
    precio_compra: 100000,
    gastos: { notaria: 0, registro: 0, gestoria: 0, inmobiliaria: 0, psi: 0, otros: 0 },
    impuestos: {},
    total_gastos: 0,
    total_impuestos: 0,
    coste_total_compra: 100000,
    eur_por_m2: 1250,
  },
  fiscalidad: {
    valor_catastral_total: 0,
    valor_catastral_construccion: 0,
    porcentaje_construccion: 0,
    tipo_adquisicion: 'LUCRATIVA_ONEROSA',
    metodo_amortizacion: 'REGLA_GENERAL_3',
    amortizacion_anual_base: 0,
    porcentaje_amortizacion_info: 3,
  },
  relaciones: { contratos_ids: [], prestamos_ids: [], cuentas_bancarias_ids: [], documentos_ids: [] },
  auditoria: {
    created_at: '2024-01-01T00:00:00.000Z',
    created_by: 'test',
    updated_at: '2024-01-01T00:00:00.000Z',
    updated_by: 'test',
    version: 1,
  },
  completitud: {
    identificacion_status: 'COMPLETO',
    caracteristicas_status: 'COMPLETO',
    compra_status: 'COMPLETO',
    fiscalidad_status: 'COMPLETO',
  },
  ...overrides,
}) as any;

beforeEach(() => {
  jest.resetAllMocks();

  mockedGenerateProyeccionMensual.mockResolvedValue([] as any);
  mockedInmuebleService.getAll.mockResolvedValue([] as any);
  mockedPrestamosService.getAllPrestamos.mockResolvedValue([] as any);
  mockedPersonalDataService.getPersonalData.mockResolvedValue({
    nombre: 'Ada',
    apellidos: 'Lovelace',
    situacionLaboral: ['cuenta_ajena'],
  } as any);
  mockedDashboardService.getPatrimonioNeto.mockResolvedValue({
    total: 0,
    variacionMes: 0,
    variacionPorcentaje: 0,
    fechaCalculo: '2026-01-01T00:00:00.000Z',
    desglose: { inmuebles: 0, inversiones: 0, cuentas: 0, deuda: 0 },
  } as any);
  mockedDashboardService.getFlujosCaja.mockResolvedValue({
    trabajo: { netoMensual: 0, netoHoy: 0, pendienteMes: 0, tendencia: 'stable', variacionPorcentaje: 0 },
    inmuebles: { cashflow: 0, cashflowHoy: 0, pendienteMes: 0, ocupacion: 0, vacantes: [], tendencia: 'stable' },
    inversiones: { rendimientoMes: 0, dividendosMes: 0, totalHoy: 0, pendienteMes: 0, tendencia: 'stable' },
  } as any);
  mockedDashboardService.getTesoreriaPanel.mockResolvedValue({
    asOf: '2026-01-01T00:00:00.000Z',
    filas: [],
    totales: { inicioMes: 0, hoy: 0, porCobrar: 0, porPagar: 0, proyeccion: 0 },
  } as any);
  mockedInversionesService.getPosiciones.mockResolvedValue([] as any);
  mockedCalcularDeclaracionIRPF.mockResolvedValue(null as any);
  mockedGenerarEventosFiscales.mockResolvedValue([] as EventoFiscal[]);
  mockedInitDB.mockResolvedValue({
    getAll: jest.fn(async (store: string) => {
      if (store === 'properties') return [];
      if (store === 'valoraciones_historicas') return [];
      if (store === 'contracts') return [];
      return [];
    }),
  } as any);
});

describe('informesDataService', () => {
  it('usa fiscalData y aeatAmortization como fallback para detalleFiscal de cartera', async () => {
    mockedInmuebleService.getAll.mockResolvedValue([
      makeInmueble(),
    ] as any);

    mockedInitDB.mockResolvedValue({
      getAll: jest.fn(async (store: string) => {
        if (store === 'properties') {
          return [{
            id: 1,
            alias: 'Tenderina 64 4D',
            address: 'Calle Tenderina 64',
            municipality: 'Oviedo',
            acquisitionCosts: { price: 100000 },
            fiscalData: {
              cadastralValue: 47656,
              constructionCadastralValue: 17834,
              constructionPercentage: 37.42,
            },
          }];
        }
        if (store === 'valoraciones_historicas') return [];
        if (store === 'contracts') return [];
        return [];
      }),
    } as any);

    const data = await informesDataService.getInformesData(2025);

    expect(data.cartera.detalleFiscal).toEqual([
      expect.objectContaining({
        alias: 'Tenderina 64 4D',
        valorCatastral: 47656,
        vcConstruccion: 17834,
        pctConstruccion: 37.42,
      }),
    ]);
  });

  it('completa el calendario fiscal con M130 e IRPF fraccionado cuando el servicio devuelve eventos incompletos', async () => {
    mockedCalcularDeclaracionIRPF.mockResolvedValue({
      baseGeneral: {
        rendimientosTrabajo: { rendimientoNeto: 0 },
        rendimientosAutonomo: { rendimientoNeto: 6148 },
        rendimientosInmuebles: [],
      },
      baseAhorro: { capitalMobiliario: { total: 0 } },
      liquidacion: {
        baseImponibleGeneral: 0,
        baseImponibleAhorro: 0,
        cuotaIntegra: 0,
      },
      reducciones: { total: 0 },
      retenciones: { trabajo: 0, capitalMobiliario: 0, autonomoM130: 0, total: 0 },
      resultado: 3042,
    } as any);

    mockedGenerarEventosFiscales.mockResolvedValue([
      {
        modelo: 'IRPF_ANUAL',
        ejercicio: 2025,
        fechaLimite: '2026-06-25',
        importe: 3042,
        descripcion: 'IRPF 2025 — A pagar (3042.00 €)',
        pagado: false,
        sourceType: 'irpf_declaracion',
      },
    ]);

    const data = await informesDataService.getInformesData(2025);

    expect(data.fiscal.calendario).toHaveLength(6);
    expect(data.fiscal.calendario.slice(0, 4)).toEqual([
      expect.objectContaining({ concepto: 'Modelo 130 — T1 2025 (pago fraccionado)', fecha: '2025-04-20', importe: 307.4 }),
      expect.objectContaining({ concepto: 'Modelo 130 — T2 2025 (pago fraccionado)', fecha: '2025-07-20', importe: 307.4 }),
      expect.objectContaining({ concepto: 'Modelo 130 — T3 2025 (pago fraccionado)', fecha: '2025-10-20', importe: 307.4 }),
      expect.objectContaining({ concepto: 'Modelo 130 — T4 2025 (pago fraccionado)', fecha: '2026-01-30', importe: 307.4 }),
    ]);
    expect(data.fiscal.calendario.slice(4)).toEqual([
      expect.objectContaining({ concepto: 'IRPF 2025 — Primera fracción (60%)', fecha: '2026-06-30', importe: 1825.2, estado: 'Pendiente' }),
      expect.objectContaining({ concepto: 'IRPF 2025 — Segunda fracción (40%)', fecha: '2026-11-05', importe: 1216.8, estado: 'Pendiente' }),
    ]);
  });
});
