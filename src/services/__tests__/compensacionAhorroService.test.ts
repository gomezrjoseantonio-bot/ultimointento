import { ejecutarCompensacionAhorro, migrarPerdidasLegacy } from '../compensacionAhorroService';
import { ArrastreIRPF, PerdidaPatrimonialAhorro } from '../db';

jest.mock('../db', () => ({
  initDB: jest.fn(),
}));

jest.mock('../propertyDisposalTaxService', () => ({
  getGananciasPatrimonialesInmueblesEjercicio: jest.fn(),
}));

jest.mock('../inversionesFiscalService', () => ({
  calcularGananciasPerdidasEjercicio: jest.fn(),
}));

jest.mock('../fiscalPaymentsService', () => ({
  getConfiguracionFiscal: jest.fn(),
}));

import { initDB } from '../db';
import { getGananciasPatrimonialesInmueblesEjercicio } from '../propertyDisposalTaxService';
import { calcularGananciasPerdidasEjercicio } from '../inversionesFiscalService';
import { getConfiguracionFiscal } from '../fiscalPaymentsService';

const mockInitDB = initDB as jest.MockedFunction<typeof initDB>;
const mockGetGananciasPatrimonialesInmueblesEjercicio = getGananciasPatrimonialesInmueblesEjercicio as jest.MockedFunction<typeof getGananciasPatrimonialesInmueblesEjercicio>;
const mockCalcularGananciasPerdidasEjercicio = calcularGananciasPerdidasEjercicio as jest.MockedFunction<typeof calcularGananciasPerdidasEjercicio>;
const mockGetConfiguracionFiscal = getConfiguracionFiscal as jest.MockedFunction<typeof getConfiguracionFiscal>;

describe('compensacionAhorroService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('compensa pérdidas pendientes FIFO contra un saldo positivo del ejercicio', async () => {
    const perdidas: PerdidaPatrimonialAhorro[] = [
      {
        id: 1,
        ejercicioOrigen: 2022,
        ejercicioCaducidad: 2026,
        importeOriginal: 1344.99,
        importeAplicado: 0,
        importePendiente: 1344.99,
        tipoOrigen: 'crypto',
        estado: 'pendiente',
        aplicaciones: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 2,
        ejercicioOrigen: 2023,
        ejercicioCaducidad: 2027,
        importeOriginal: 27764.23,
        importeAplicado: 0,
        importePendiente: 27764.23,
        tipoOrigen: 'crypto',
        estado: 'pendiente',
        aplicaciones: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ];

    const db = {
      getAll: jest.fn().mockImplementation((store: string) => {
        if (store === 'perdidasPatrimonialesAhorro') return Promise.resolve(perdidas);
        return Promise.resolve([]);
      }),
      put: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockResolvedValue(3),
    } as any;

    mockInitDB.mockResolvedValue(db);
    mockGetGananciasPatrimonialesInmueblesEjercicio.mockResolvedValue([
      {
        inmuebleId: 7,
        alias: 'Tenderina 48',
        valorTransmision: 181132.5,
        valorAdquisicion: 143984.04,
        gananciaPatrimonial: 37148.46,
        esPerdida: false,
        fechaVenta: '2025-11-27',
        fechaCompra: '2022-09-23',
        añosTenencia: 3.18,
        ejercicioFiscal: 2025,
        integracion: 'base_ahorro',
        precioVenta: 185000,
        gastosVenta: 3867.5,
        gastosVentaDesglose: { agencia: 2117.5, plusvaliaMunicipal: 1000, notariaRegistro: 600, otros: 150 },
        precioCompra: 139000,
        gastosAdquisicion: 12380.36,
        mejoras: 0,
        amortizacionMinima: 7396.32,
        amortizacionDeducida: 7396.32,
        amortizacionEstandar: 7396.32,
        amortizacionAplicada: 7396.32,
      },
    ] as any);
    mockCalcularGananciasPerdidasEjercicio.mockResolvedValue({ plusvalias: 0, minusvalias: 0, operaciones: [] });

    const result = await ejecutarCompensacionAhorro(2025, 464);

    expect(result.saldoNetoEjercicio).toBe(37148.46);
    expect(result.totalCompensado).toBe(29109.22);
    expect(result.saldoNetoTrasCompensar).toBe(8039.24);
    expect(result.compensacionAplicada).toEqual([
      { ejercicioOrigen: 2022, importeAplicado: 1344.99, importeRestanteTras: 0 },
      { ejercicioOrigen: 2023, importeAplicado: 27764.23, importeRestanteTras: 0 },
    ]);
    expect(result.perdidasPendientesDespues).toEqual([]);
    expect(db.put).toHaveBeenCalledTimes(2);
  });

  it('compensa saldo negativo con capital mobiliario y arrastra el resto', async () => {
    const db = {
      getAll: jest.fn().mockImplementation((store: string) => {
        if (store === 'perdidasPatrimonialesAhorro') return Promise.resolve([]);
        return Promise.resolve([]);
      }),
      put: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockResolvedValue(11),
    } as any;

    mockInitDB.mockResolvedValue(db);
    mockGetGananciasPatrimonialesInmueblesEjercicio.mockResolvedValue([]);
    mockCalcularGananciasPerdidasEjercicio.mockResolvedValue({ plusvalias: 100, minusvalias: 500, operaciones: [] });

    const result = await ejecutarCompensacionAhorro(2025, 1000);

    expect(result.saldoNetoEjercicio).toBe(-400);
    expect(result.compensacionConCapitalMobiliario).toBe(250);
    expect(result.limiteCapitalMobiliario).toBe(250);
    expect(result.nuevaPerdidaArrastrada).toBe(150);
    expect(result.perdidasPendientesDespues).toEqual([
      expect.objectContaining({ ejercicioOrigen: 2025, importePendiente: 150, ejercicioCaducidad: 2029 }),
    ]);
    expect(db.add).toHaveBeenCalledWith('perdidasPatrimonialesAhorro', expect.objectContaining({ importePendiente: 150 }));
  });

  it('migra pérdidas legacy sin duplicar ejercicios ya migrados', async () => {
    const arrastres: ArrastreIRPF[] = [
      {
        id: 8,
        ejercicioOrigen: 2023,
        tipo: 'perdidas_patrimoniales_ahorro',
        importeOriginal: 27764.23,
        importePendiente: 27764.23,
        ejercicioCaducidad: 2027,
        aplicaciones: [],
        estado: 'pendiente',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 9,
        ejercicioOrigen: 2022,
        tipo: 'perdidas_patrimoniales_ahorro',
        importeOriginal: 1344.99,
        importePendiente: 1000,
        ejercicioCaducidad: 2026,
        aplicaciones: [{ ejercicio: 2024, importe: 344.99, fecha: '2024-06-30T00:00:00.000Z' }],
        estado: 'aplicado_parcial',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ];

    const db = {
      count: jest.fn().mockResolvedValue(0),
      getAll: jest.fn().mockImplementation((store: string) => {
        if (store === 'perdidasPatrimonialesAhorro') return Promise.resolve([]);
        if (store === 'arrastresIRPF') return Promise.resolve(arrastres);
        return Promise.resolve([]);
      }),
      add: jest.fn().mockResolvedValue(1),
    } as any;

    mockInitDB.mockResolvedValue(db);
    mockGetConfiguracionFiscal.mockResolvedValue({
      minusvalias_pendientes: [
        { anio: 2022, importe: 1344.99 },
      ],
    } as any);

    const migradas = await migrarPerdidasLegacy();

    expect(migradas).toBe(2);
    expect(db.add).toHaveBeenCalledTimes(2);
    expect(db.add).toHaveBeenNthCalledWith(1, 'perdidasPatrimonialesAhorro', expect.objectContaining({ ejercicioOrigen: 2022, tipoOrigen: 'crypto' }));
    expect(db.add).toHaveBeenNthCalledWith(2, 'perdidasPatrimonialesAhorro', expect.objectContaining({ ejercicioOrigen: 2023, tipoOrigen: 'importado' }));
  });
});
