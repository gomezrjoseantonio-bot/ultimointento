import { calcularDeclaracionIRPF } from '../irpfCalculationService';
import { initDB } from '../db';
import { personalDataService } from '../personalDataService';
import { nominaService } from '../nominaService';
import { calcularGananciasPerdidasEjercicio, getMinusvaliasPendientes } from '../inversionesFiscalService';
import { getGananciasPatrimonialesInmueblesEjercicio } from '../propertyDisposalTaxService';

jest.mock('../db', () => ({
  initDB: jest.fn(),
}));

jest.mock('../personalDataService', () => ({
  personalDataService: {
    getPersonalData: jest.fn(),
  },
}));

jest.mock('../nominaService', () => ({
  nominaService: {
    getAllActiveNominas: jest.fn(),
  },
}));

jest.mock('../inversionesFiscalService', () => ({
  calcularGananciasPerdidasEjercicio: jest.fn(),
  getMinusvaliasPendientes: jest.fn(),
}));

jest.mock('../propertyDisposalTaxService', () => ({
  getGananciasPatrimonialesInmueblesEjercicio: jest.fn(),
}));

jest.mock('../fiscalConciliationService', () => ({
  conciliarEjercicioFiscal: jest.fn(),
}));

const mockInitDB = initDB as jest.MockedFunction<typeof initDB>;
const mockGetPersonalData = personalDataService.getPersonalData as jest.MockedFunction<typeof personalDataService.getPersonalData>;
const mockGetAllActiveNominas = nominaService.getAllActiveNominas as jest.MockedFunction<typeof nominaService.getAllActiveNominas>;
const mockCalcularGanancias = calcularGananciasPerdidasEjercicio as jest.MockedFunction<typeof calcularGananciasPerdidasEjercicio>;
const mockGetMinusvaliasPendientes = getMinusvaliasPendientes as jest.MockedFunction<typeof getMinusvaliasPendientes>;
const mockGetGananciasInmuebles = getGananciasPatrimonialesInmueblesEjercicio as jest.MockedFunction<typeof getGananciasPatrimonialesInmueblesEjercicio>;

describe('irpfCalculationService capital mobiliario en base general', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockInitDB.mockResolvedValue({
      getAll: jest.fn(async (storeName: string) => {
        if (storeName === 'inversiones') {
          return [
            {
              id: 1,
              activo: true,
              nombre: 'Cuenta remunerada',
              entidad: 'Banco Atlas',
              tipo: 'cuenta_remunerada',
              rendimiento: {
                integracion_fiscal: 'ahorro',
                pagos_generados: [
                  {
                    id: 101,
                    fecha_pago: '2025-02-15T00:00:00.000Z',
                    importe_bruto: 464.65,
                    retencion_fiscal: 88.28,
                    importe_neto: 376.37,
                  },
                ],
              },
            },
            {
              id: 2,
              activo: true,
              nombre: 'Unihouser',
              entidad: 'UNIHOUSER, SOCIEDAD LIMITADA',
              tipo: 'prestamo_p2p',
              notas: 'Otro rendimiento BIG · casillas 0046-0051',
              rendimiento: {
                integracion_fiscal: 'general',
                pagos_generados: [
                  {
                    id: 201,
                    fecha_pago: '2025-03-10T00:00:00.000Z',
                    importe_bruto: 755.89,
                    retencion_fiscal: 143.61,
                    importe_neto: 612.28,
                    casilla_irpf: '0046',
                  },
                ],
              },
            },
          ];
        }

        return [];
      }),
    } as any);

    mockGetPersonalData.mockResolvedValue({
      descendientes: [],
      ascendientes: [],
      discapacidad: 'ninguna',
    } as any);
    mockGetAllActiveNominas.mockResolvedValue([]);
    mockCalcularGanancias.mockResolvedValue({ plusvalias: 0, minusvalias: 0 });
    mockGetMinusvaliasPendientes.mockResolvedValue([]);
    mockGetGananciasInmuebles.mockResolvedValue([]);
  });

  it('envía los rendimientos BIG a base general y mantiene intereses ordinarios en base ahorro', async () => {
    const declaracion = await calcularDeclaracionIRPF(2025);

    expect(declaracion.baseAhorro.capitalMobiliario.intereses).toBe(464.65);
    expect(declaracion.baseAhorro.capitalMobiliario.total).toBe(464.65);
    expect(declaracion.baseGeneral.capitalMobiliarioGeneral?.total).toBe(755.89);
    expect(declaracion.baseGeneral.total).toBe(755.89);
    expect(declaracion.liquidacion.baseImponibleGeneral).toBe(755.89);
    expect(declaracion.liquidacion.baseImponibleAhorro).toBe(464.65);
    expect(declaracion.retenciones.capitalMobiliario).toBe(231.89);
    expect(declaracion.retenciones.total).toBe(231.89);
  });

  it('detecta también por heurística casillas 0046-0051 aunque no exista flag explícito', async () => {
    mockInitDB.mockResolvedValue({
      getAll: jest.fn(async (storeName: string) => {
        if (storeName !== 'inversiones') return [];

        return [
          {
            id: 9,
            activo: true,
            nombre: 'REG0001',
            entidad: 'UNIHOUSER, SOCIEDAD LIMITADA',
            tipo: 'prestamo_p2p',
            rendimiento: {
              pagos_generados: [
                {
                  id: 999,
                  fecha_pago: '2025-06-30T00:00:00.000Z',
                  importe_bruto: 755.89,
                  retencion_fiscal: 143.61,
                  importe_neto: 612.28,
                  casilla_irpf: '0051',
                },
              ],
            },
          },
        ];
      }),
    } as any);

    const declaracion = await calcularDeclaracionIRPF(2025);

    expect(declaracion.baseAhorro.capitalMobiliario.total).toBe(0);
    expect(declaracion.baseGeneral.capitalMobiliarioGeneral?.total).toBe(755.89);
    expect(declaracion.baseGeneral.capitalMobiliarioGeneral?.retenciones).toBe(143.61);
    expect(declaracion.retenciones.capitalMobiliario).toBe(143.61);
  });
});
