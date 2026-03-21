import { calcularDeclaracionIRPF } from '../irpfCalculationService';

jest.mock('../db', () => ({
  initDB: jest.fn(),
}));

jest.mock('../fiscalSummaryService', () => ({
  calculateFiscalSummary: jest.fn(),
  calculateCarryForwards: jest.fn(),
}));

jest.mock('../personalDataService', () => ({
  personalDataService: {
    getPersonalData: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../nominaService', () => ({
  nominaService: {
    getAllActiveNominas: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../compensacionAhorroService', () => ({
  ejecutarCompensacionAhorro: jest.fn().mockResolvedValue({
    ejercicio: 2025,
    fuentes: {
      inmuebles: {
        plusvalias: 37148.46,
        minusvalias: 0,
        detalle: [
          {
            inmuebleId: 7,
            alias: 'Tenderina 48',
            precioVenta: 185000,
            gastosVenta: 3867.5,
            gastosVentaDesglose: { agencia: 2117.5, plusvaliaMunicipal: 1000, notariaRegistro: 600, otros: 150 },
            valorTransmision: 181132.5,
            precioCompra: 139000,
            gastosAdquisicion: 12380.36,
            mejoras: 0,
            amortizacionMinima: 7396.32,
            valorAdquisicion: 143984.04,
            gananciaPatrimonial: 37148.46,
            esPerdida: false,
            fechaVenta: '2025-11-27',
            fechaCompra: '2022-09-23',
            añosTenencia: 3.18,
            ejercicioFiscal: 2025,
            integracion: 'base_ahorro',
            amortizacionDeducida: 7396.32,
            amortizacionEstandar: 7396.32,
            amortizacionAplicada: 7396.32,
          },
        ],
      },
      inversiones: {
        plusvalias: 1000,
        minusvalias: 250,
        operaciones: 1,
      },
    },
    saldoNetoEjercicio: 37898.46,
    perdidasPendientesAntes: [{ ejercicioOrigen: 2024, importeOriginal: 200, importePendiente: 200, ejercicioCaducidad: 2028, estado: 'pendiente' }],
    compensacionAplicada: [{ ejercicioOrigen: 2024, importeAplicado: 200, importeRestanteTras: 0 }],
    totalCompensado: 200,
    saldoNetoTrasCompensar: 37698.46,
    compensacionConCapitalMobiliario: 0,
    limiteCapitalMobiliario: 0,
    nuevaPerdidaArrastrada: 0,
    ejercicioCaducidadNueva: 2029,
    perdidasPendientesDespues: [],
    perdidasCaducadas: [],
  }),
}));

import { initDB } from '../db';
import { calculateFiscalSummary } from '../fiscalSummaryService';
import { ejecutarCompensacionAhorro } from '../compensacionAhorroService';

const mockInitDB = initDB as jest.MockedFunction<typeof initDB>;
const mockCalculateFiscalSummary = calculateFiscalSummary as jest.MockedFunction<typeof calculateFiscalSummary>;
const mockEjecutarCompensacionAhorro = ejecutarCompensacionAhorro as jest.MockedFunction<typeof ejecutarCompensacionAhorro>;

function buildMockDB() {
  return {
    getAll: jest.fn().mockImplementation((store: string) => {
      if (store === 'properties') return Promise.resolve([]);
      if (store === 'contracts') return Promise.resolve([]);
      if (store === 'nominas') return Promise.resolve([]);
      if (store === 'autonomos') return Promise.resolve([]);
      if (store === 'inversiones') return Promise.resolve([]);
      return Promise.resolve([]);
    }),
    getAllFromIndex: jest.fn().mockResolvedValue([]),
  } as any;
}

describe('irpfCalculationService con ventas de inmuebles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitDB.mockResolvedValue(buildMockDB());
    mockEjecutarCompensacionAhorro.mockResolvedValue({
      ejercicio: 2025,
      fuentes: {
        inmuebles: {
          plusvalias: 37148.46,
          minusvalias: 0,
          detalle: [
            {
              inmuebleId: 7,
              alias: 'Tenderina 48',
              precioVenta: 185000,
              gastosVenta: 3867.5,
              gastosVentaDesglose: { agencia: 2117.5, plusvaliaMunicipal: 1000, notariaRegistro: 600, otros: 150 },
              valorTransmision: 181132.5,
              precioCompra: 139000,
              gastosAdquisicion: 12380.36,
              mejoras: 0,
              amortizacionMinima: 7396.32,
              valorAdquisicion: 143984.04,
              gananciaPatrimonial: 37148.46,
              esPerdida: false,
              fechaVenta: '2025-11-27',
              fechaCompra: '2022-09-23',
              añosTenencia: 3.18,
              ejercicioFiscal: 2025,
              integracion: 'base_ahorro',
              amortizacionDeducida: 7396.32,
              amortizacionEstandar: 7396.32,
              amortizacionAplicada: 7396.32,
            },
          ],
        },
        inversiones: {
          plusvalias: 1000,
          minusvalias: 250,
          operaciones: 1,
        },
      },
      saldoNetoEjercicio: 37898.46,
      perdidasPendientesAntes: [{ ejercicioOrigen: 2024, importeOriginal: 200, importePendiente: 200, ejercicioCaducidad: 2028, estado: 'pendiente' }],
      compensacionAplicada: [{ ejercicioOrigen: 2024, importeAplicado: 200, importeRestanteTras: 0 }],
      totalCompensado: 200,
      saldoNetoTrasCompensar: 37698.46,
      compensacionConCapitalMobiliario: 0,
      limiteCapitalMobiliario: 0,
      nuevaPerdidaArrastrada: 0,
      ejercicioCaducidadNueva: 2029,
      perdidasPendientesDespues: [],
      perdidasCaducadas: [],
    } as any);
    mockCalculateFiscalSummary.mockResolvedValue({
      annualDepreciation: 0,
      box0105: 0,
      box0106: 0,
      box0109: 0,
      box0112: 0,
      box0113: 0,
      box0114: 0,
      box0115: 0,
      box0117: 0,
    } as any);
  });

  it('integra la compensación unificada de ahorro y conserva el detalle de inmuebles', async () => {
    const result = await calcularDeclaracionIRPF(2025);

    expect(mockEjecutarCompensacionAhorro).toHaveBeenCalledWith(2025, 0);
    expect(result.baseAhorro.gananciasYPerdidas.plusvalias).toBe(38148.46);
    expect(result.baseAhorro.gananciasYPerdidas.minusvalias).toBe(250);
    expect(result.baseAhorro.gananciasYPerdidas.minusvaliasPendientes).toBe(0);
    expect(result.baseAhorro.gananciasYPerdidas.compensado).toBe(37698.46);
    expect(result.baseAhorro.total).toBe(37698.46);
    expect(result.compensacionAhorro?.totalCompensado).toBe(200);
    expect(result.ventasInmuebles).toHaveLength(1);
    expect(result.ventasInmuebles?.[0].alias).toBe('Tenderina 48');
  });
});
