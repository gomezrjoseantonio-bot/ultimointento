import { dashboardService } from '../dashboardService';
import { initDB } from '../db';
import { prestamosService } from '../prestamosService';
import { generateProyeccionMensual } from '../../modules/horizon/proyeccion/mensual/services/proyeccionMensualService';

jest.mock('../db', () => ({
  initDB: jest.fn()
}));

jest.mock('../../modules/horizon/proyeccion/mensual/services/proyeccionMensualService', () => ({
  generateProyeccionMensual: jest.fn(async () => [])
}));

describe('dashboardService financial metrics', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-08T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    (generateProyeccionMensual as jest.Mock).mockResolvedValue([]);
  });

  it('normaliza importes string y alinea liquidez/salud con eventos de tesorería', async () => {
    const datasets: Record<string, any[]> = {
      accounts: [
        { id: 1, isActive: true, balance: '1.200,50' },
        { id: 2, isActive: true, balance: '300' }
      ],
      expenses: [
        { fecha: '2026-03-10', importe: '100,00', propertyId: 10 },
        { fecha: '2026-02-12', importe: '200', propertyId: 10 },
        { fecha: '2026-01-06', importe: '300', propertyId: 10 },
        { fecha: '2026-04-20', importe: '999', propertyId: 10 }
      ],
      treasuryEvents: [
        { type: 'expense', status: 'pending', amount: '315', predictedDate: '2026-03-15' },
        { type: 'financing', status: 'pending', amount: '200', predictedDate: '2026-03-16' },
        { type: 'expense', status: 'confirmed', amount: '999', predictedDate: '2026-03-17' },
        { type: 'expense', status: 'pending', amount: '120', predictedDate: '2026-03-01' },
        { type: 'expense', status: 'pending', amount: '100', predictedDate: '2026-02-15' },
        { type: 'financing', status: 'pending', amount: '80', predictedDate: '2026-02-20' },
        { type: 'expense', status: 'executed', amount: '777', predictedDate: '2026-03-20' },
        { type: 'income', status: 'pending', amount: '50', predictedDate: '2026-03-14' }
      ],
      rentPayments: [
        { fecha: '2026-03-18', importe: '400,00' }
      ],
      ingresos: [
        { fecha: '2026-03-12', importe: '200,00' }
      ],
      gastos: [
        { fecha: '2026-03-05', importe: '300,00', esPersonal: true },
        { fecha: '2026-02-06', importe: '600,00', esPersonal: true },
        { fecha: '2026-02-09', importe: '150,00', esPersonal: false }
      ]
    };

    (initDB as jest.Mock).mockResolvedValue({
      getAll: jest.fn(async (store: string) => datasets[store] ?? []),
      put: jest.fn(async () => undefined),
      get: jest.fn(async () => undefined)
    });

    const liquidez = await dashboardService.getLiquidez();
    const salud = await dashboardService.getSaludFinanciera();

    expect(liquidez.disponibleHoy).toBeCloseTo(1500.5, 2);
    expect(liquidez.comprometido30d).toBeCloseTo(615, 2);
    expect(liquidez.ingresos30d).toBeCloseTo(650, 2);
    expect(liquidez.proyeccion30d).toBeCloseTo(1535.5, 2);

    expect(salud.liquidezHoy).toBeCloseTo(1500.5, 2);
    expect(salud.gastoMedioMensual).toBeCloseTo(616.666666, 2);
    expect(salud.colchonMeses).toBeCloseTo(1500.5 / 616.666666, 5);
    expect(salud.estado).toBe('warning');
    expect(salud.proyeccion30d.gastos).toBeCloseTo(615, 2);
    expect(salud.proyeccion30d.ingresos).toBeCloseTo(650, 2);
    expect(salud.proyeccion30d.estimado).toBeCloseTo(1535.5, 2);
  });



  it('incluye gastos de inmuebles guardados con el esquema H5 date/amount en el cashflow mensual', async () => {
    const datasets: Record<string, any[]> = {
      ingresos: [],
      gastos: [],
      expenses: [
        { date: '2026-03-08', amount: 320, propertyId: 1, destino: 'inmueble' }
      ],
      rentPayments: [
        { period: '2026-03', expectedAmount: 1000, status: 'pendiente' }
      ],
      contracts: [
        {
          id: 1,
          inmuebleId: 1,
          rentaMensual: 1000,
          fechaInicio: '2026-01-01',
          fechaFin: '2026-12-31',
          estadoContrato: 'activo'
        }
      ],
      prestamos: [],
      properties: [
        { id: 1, estado: 'activo' }
      ],
      inversiones: []
    };

    (initDB as jest.Mock).mockResolvedValue({
      getAll: jest.fn(async (store: string) => datasets[store] ?? []),
      put: jest.fn(async () => undefined),
      get: jest.fn(async () => undefined)
    });

    const flujos = await dashboardService.getFlujosCaja();

    expect(flujos.inmuebles.cashflow).toBeCloseTo(680, 2);
    expect(flujos.inmuebles.cashflowHoy).toBeCloseTo(-320, 2);
  });

  it('descuenta los gastos personales recurrentes y puntuales del módulo personal en economía familiar', async () => {
    const datasets: Record<string, any[]> = {
      ingresos: [
        { fecha_prevista_cobro: '2026-03-05', importe: 2000, destino: 'personal' }
      ],
      gastos: [],
      expenses: [],
      rentPayments: [],
      contracts: [],
      prestamos: [],
      properties: [],
      inversiones: [],
      personalExpenses: [
        { personalDataId: 1, activo: true, frecuencia: 'mensual', importe: 900 }
      ],
      gastosRecurrentes: [
        { personalDataId: 1, activo: true, frecuencia: 'mensual', importe: 300 }
      ],
      gastosPuntuales: [
        { personalDataId: 1, fecha: '2026-03-04', importe: 250 }
      ]
    };

    (initDB as jest.Mock).mockResolvedValue({
      getAll: jest.fn(async (store: string) => datasets[store] ?? []),
      put: jest.fn(async () => undefined),
      get: jest.fn(async () => undefined)
    });

    const flujos = await dashboardService.getFlujosCaja();

    expect(flujos.trabajo.netoMensual).toBeCloseTo(550, 2);
    expect(flujos.trabajo.netoHoy).toBeCloseTo(1750, 2);
  });


  it('alinea los importes mensuales del dashboard con la proyección mensual cuando existe forecast del mes actual', async () => {
    const datasets: Record<string, any[]> = {
      ingresos: [
        { fecha_prevista_cobro: '2026-03-05', importe: 2000, destino: 'personal' }
      ],
      gastos: [],
      expenses: [],
      rentPayments: [
        { period: '2026-03', expectedAmount: 4720, status: 'pendiente' }
      ],
      contracts: [],
      prestamos: [],
      properties: [
        { id: 1, estado: 'activo' }
      ],
      inversiones: [
        { activo: true, dividendos: { dividendos_recibidos: [] }, rendimiento: { pagos_generados: [] } }
      ]
    };

    (generateProyeccionMensual as jest.Mock).mockResolvedValue([
      {
        month: '2026-03',
        ingresos: {
          nomina: 13393,
          serviciosFreelance: 0,
          pensiones: 0,
          rentasAlquiler: 4720,
          dividendosInversiones: 608,
          otrosIngresos: 529
        },
        gastos: {
          gastosOperativos: 1141,
          gastosPersonales: 2901,
          gastosAutonomo: 344
        },
        financiacion: {
          cuotasHipotecas: 1269,
          cuotasPrestamos: 3448
        }
      },
      {
        month: '2026-02',
        ingresos: { nomina: 4008, serviciosFreelance: 0, pensiones: 0, rentasAlquiler: 4720, dividendosInversiones: 608, otrosIngresos: 529 },
        gastos: { gastosOperativos: 1356, gastosPersonales: 2841, gastosAutonomo: 344 },
        financiacion: { cuotasHipotecas: 1269, cuotasPrestamos: 3448 }
      },
      {
        month: '2026-01',
        ingresos: { nomina: 4008, serviciosFreelance: 0, pensiones: 0, rentasAlquiler: 4720, dividendosInversiones: 608, otrosIngresos: 529 },
        gastos: { gastosOperativos: 1141, gastosPersonales: 2781, gastosAutonomo: 344 },
        financiacion: { cuotasHipotecas: 1269, cuotasPrestamos: 3448 }
      },
      {
        month: '2025-12',
        ingresos: { nomina: 8477, serviciosFreelance: 4500, pensiones: 0, rentasAlquiler: 1585, dividendosInversiones: 608, otrosIngresos: 529 },
        gastos: { gastosOperativos: 1574, gastosPersonales: 3011, gastosAutonomo: 344 },
        financiacion: { cuotasHipotecas: 1269, cuotasPrestamos: 3017 }
      }
    ]);

    (initDB as jest.Mock).mockResolvedValue({
      getAll: jest.fn(async (store: string) => datasets[store] ?? []),
      put: jest.fn(async () => undefined),
      get: jest.fn(async () => undefined)
    });

    const flujos = await dashboardService.getFlujosCaja();

    expect(flujos.trabajo.netoMensual).toBeCloseTo(7229, 2);
    expect(flujos.inmuebles.cashflow).toBeCloseTo(2310, 2);
    expect(flujos.inversiones.dividendosMes).toBeCloseTo(608, 2);
  });

  it('usa renta mensual de contratos activos cuando no hay pagos generados en rentPayments', async () => {
    const datasets: Record<string, any[]> = {
      ingresos: [],
      gastos: [
        { fecha: '2026-03-05', importe: 200, esPersonal: false, destino: 'inmueble_id', destino_id: 1 }
      ],
      expenses: [
        { fecha: '2026-03-08', importe: 50, propertyId: 1 }
      ],
      rentPayments: [],
      contratos: [],
      contracts: [
        {
          id: 1,
          inmuebleId: 1,
          rentaMensual: 1000,
          fechaInicio: '2026-01-01',
          fechaFin: '2026-12-31',
          estadoContrato: 'activo'
        }
      ],
      prestamos: [
        { ambito: 'INMUEBLE', cuotaMensual: 300, activo: true }
      ],
      properties: [
        { id: 1, estado: 'activo' }
      ],
      inversiones: []
    };

    (initDB as jest.Mock).mockResolvedValue({
      getAll: jest.fn(async (store: string) => datasets[store] ?? []),
      put: jest.fn(async () => undefined),
      get: jest.fn(async () => undefined)
    });

    const flujos = await dashboardService.getFlujosCaja();

    // 1000 (renta contrato) - 250 (gastos) - 300 (hipoteca) = 450
    expect(flujos.inmuebles.cashflow).toBeCloseTo(450, 2);
    expect(flujos.inmuebles.ocupacion).toBeCloseTo(100, 2);
  });

  it('proyecta el mes completo de inmuebles con expectedAmount aunque el cobro vaya parcial a mitad de mes', async () => {
    const datasets: Record<string, any[]> = {
      ingresos: [],
      gastos: [
        { fecha: '2026-03-05', importe: 200, esPersonal: false, destino: 'inmueble_id', destino_id: 1 }
      ],
      expenses: [],
      rentPayments: [
        {
          contractId: 1,
          period: '2026-03',
          expectedAmount: 1000,
          status: 'partial',
          paidAmount: 100
        }
      ],
      contracts: [
        {
          id: 1,
          inmuebleId: 1,
          rentaMensual: 1000,
          fechaInicio: '2026-01-01',
          fechaFin: '2026-12-31',
          estadoContrato: 'activo'
        }
      ],
      prestamos: [],
      properties: [
        { id: 1, estado: 'activo' }
      ],
      inversiones: []
    };

    (initDB as jest.Mock).mockResolvedValue({
      getAll: jest.fn(async (store: string) => datasets[store] ?? []),
      put: jest.fn(async () => undefined),
      get: jest.fn(async () => undefined)
    });

    const flujos = await dashboardService.getFlujosCaja();

    // Debe proyectar el mes completo: 1000 esperado - 200 gastos = 800
    // y no quedarse solo con lo cobrado hasta hoy (100).
    expect(flujos.inmuebles.cashflow).toBeCloseTo(800, 2);
    expect(flujos.inmuebles.cashflowHoy).toBeCloseTo(-100, 2);
    expect(flujos.inmuebles.pendienteMes).toBeCloseTo(900, 2);
  });


  it('usa pagos generados del mes aunque sigan pendientes y evita caer al fallback del contrato', async () => {
    const datasets: Record<string, any[]> = {
      ingresos: [],
      gastos: [],
      expenses: [],
      rentPayments: [
        { fecha: '2026-03-10', importe: 700, estado: 'confirmado' },
        { fecha: '2026-03-20', importe: 300, estado: 'pendiente' }
      ],
      contracts: [
        {
          id: 1,
          inmuebleId: 1,
          rentaMensual: 1000,
          fechaInicio: '2026-01-01',
          fechaFin: '2026-12-31',
          estadoContrato: 'activo'
        }
      ],
      prestamos: [],
      properties: [
        { id: 1, estado: 'activo' }
      ],
      inversiones: []
    };

    (initDB as jest.Mock).mockResolvedValue({
      getAll: jest.fn(async (store: string) => datasets[store] ?? []),
      put: jest.fn(async () => undefined),
      get: jest.fn(async () => undefined)
    });

    const flujos = await dashboardService.getFlujosCaja();

    // Debe usar 700 + 300 generados en marzo, sin caer al fallback del contrato.
    expect(flujos.inmuebles.cashflow).toBeCloseTo(1000, 2);
  });

  it('genera una alerta cuando la ocupación está por debajo del objetivo y hay inmuebles activos', async () => {
    const datasets: Record<string, any[]> = {
      rentPayments: [],
      documents: [],
      expenses: [],
      gastos: [],
      ingresos: [],
      inversiones: [],
      prestamos: [],
      properties: [
        { id: 1, estado: 'activo', alias: 'Piso Centro' },
        { id: 2, estado: 'activo', alias: 'Piso Norte' }
      ],
      contracts: [
        {
          id: 1,
          inmuebleId: 1,
          rentaMensual: 1000,
          fechaInicio: '2026-01-01',
          fechaFin: '2026-12-31',
          estadoContrato: 'activo'
        }
      ]
    };

    (initDB as jest.Mock).mockResolvedValue({
      getAll: jest.fn(async (store: string) => datasets[store] ?? []),
      put: jest.fn(async () => undefined),
      get: jest.fn(async () => undefined)
    });

    const alertas = await dashboardService.getAlertas();
    const alertaOcupacion = alertas.find((alerta) => alerta.id === 'occupancy-warning');

    expect(alertaOcupacion).toBeDefined();
    expect(alertaOcupacion?.titulo).toContain('vacante');
    expect(alertaOcupacion?.descripcion).toContain('50.0%');
    expect(alertaOcupacion?.descripcion).toContain('Piso Norte');
  });


  it('en patrimonio neto prioriza valor actual del activo antes que precio de compra cuando no hay valoración histórica', async () => {
    const datasets: Record<string, any[]> = {
      properties: [
        {
          id: 1,
          state: 'activo',
          acquisitionCosts: { price: 100000 },
          currentValue: 155000
        }
      ],
      valoraciones_historicas: [],
      accounts: [],
      inversiones: [],
      prestamos: []
    };

    (initDB as jest.Mock).mockResolvedValue({
      getAll: jest.fn(async (store: string) => datasets[store] ?? []),
      getAllFromIndex: jest.fn(async () => []),
      add: jest.fn(async () => 1),
      put: jest.fn(async () => undefined),
      get: jest.fn(async () => undefined)
    });

    const patrimonio = await dashboardService.getPatrimonioNeto();

    expect(patrimonio.desglose.inmuebles).toBeCloseTo(155000, 2);
    expect(patrimonio.total).toBeCloseTo(155000, 2);
  });

  it('incluye financiación y reasigna eventos de tarjeta al banco de cargo en tesorería panel', async () => {
    const datasets: Record<string, any[]> = {
      accounts: [
        { id: 1, isActive: true, alias: 'Banco Principal', balance: 1000 },
        { id: 2, isActive: true, alias: 'Visa Atlas', tipo: 'TARJETA_CREDITO', cardConfig: { chargeAccountId: 1 }, balance: 0 }
      ],
      movements: [],
      treasuryEvents: [
        { accountId: 1, type: 'expense', status: 'predicted', amount: 25, predictedDate: '2026-03-02' },
        { accountId: 1, type: 'income', status: 'predicted', amount: 500, predictedDate: '2026-03-20' },
        { accountId: 1, type: 'expense', status: 'predicted', amount: 100, predictedDate: '2026-03-21' },
        { accountId: 1, type: 'financing', status: 'predicted', amount: 300, predictedDate: '2026-03-22' },
        { accountId: 1, type: 'expense', status: 'confirmed', amount: 400, predictedDate: '2026-03-24' },
        { accountId: 2, type: 'expense', status: 'predicted', amount: 50, predictedDate: '2026-03-23' }
      ]
    };

    (initDB as jest.Mock).mockResolvedValue({
      getAll: jest.fn(async (store: string) => datasets[store] ?? []),
      put: jest.fn(async () => undefined),
      get: jest.fn(async () => undefined)
    });

    const panel = await dashboardService.getTesoreriaPanel();

    expect(panel.filas).toHaveLength(1);
    expect(panel.filas[0].hoy).toBe(1000);
    expect(panel.filas[0].porCobrar).toBe(500);
    expect(panel.filas[0].porPagar).toBe(475);
    expect(panel.filas[0].proyeccion).toBe(1025);
    expect(panel.totales.hoy).toBe(1000);
    expect(panel.totales.porPagar).toBe(475);
  });

  it('alinea tesorería dashboard con saldo hoy y fin de mes de la vista de tesorería', async () => {
    const datasets: Record<string, any[]> = {
      accounts: [
        { id: 1, isActive: true, activa: true, alias: 'Cuenta Banco', balance: 1000, openingBalance: 1000, openingBalanceDate: '2026-03-01' }
      ],
      treasuryEvents: [
        { accountId: 1, type: 'expense', status: 'confirmed', amount: 200, predictedDate: '2026-03-04' },
        { accountId: 1, type: 'income', status: 'executed', amount: 50, predictedDate: '2026-03-08' },
        { accountId: 1, type: 'income', status: 'predicted', amount: 500, predictedDate: '2026-03-20' },
        { accountId: 1, type: 'financing', status: 'predicted', amount: 300, predictedDate: '2026-03-22' }
      ],
      movements: []
    };

    const dbMock = {
      getAll: jest.fn(async (store: string) => datasets[store] ?? []),
      put: jest.fn(async (_store: string, value: any) => value),
      get: jest.fn(async () => undefined)
    };
    (initDB as jest.Mock).mockResolvedValue(dbMock);

    const panel = await dashboardService.getTesoreriaPanel();

    expect(panel.filas).toHaveLength(1);
    expect(panel.filas[0].inicioMes).toBe(1000);
    expect(panel.filas[0].hoy).toBe(850);
    expect(panel.filas[0].porCobrar).toBe(500);
    expect(panel.filas[0].porPagar).toBe(300);
    expect(panel.filas[0].proyeccion).toBe(1050);
    expect(panel.totales.hoy).toBe(850);
    expect(panel.totales.proyeccion).toBe(1050);
  });

  it('alinea deuda del dashboard con el capital vivo calculado en financiación', async () => {
    const datasets: Record<string, any[]> = {
      properties: [],
      valoraciones_historicas: [],
      inversiones: [],
      accounts: [],
      treasuryEvents: [],
      prestamos: [
        {
          id: 'loan-1',
          activo: true,
          estado: 'activo',
          principalInicial: 100000,
          principalVivo: 92000,
          plazoMesesTotal: 120,
          tipo: 'FIJO',
          tipoNominalAnualFijo: 2.2,
          fechaFirma: '2024-01-01',
          fechaPrimerCargo: '2024-02-01'
        }
      ]
    };

    const dbMock = {
      getAll: jest.fn(async (store: string) => datasets[store] ?? []),
      getAllFromIndex: jest.fn(async () => []),
      add: jest.fn(async () => 1),
      put: jest.fn(async (_store: string, value: any) => value),
      get: jest.fn(async () => undefined)
    };
    (initDB as jest.Mock).mockResolvedValue(dbMock);
    const getPaymentPlanSpy = jest.spyOn(prestamosService, 'getPaymentPlan').mockResolvedValue({
      periodos: [
        { periodo: 1, pagado: true, principalFinal: 87500 }
      ],
      resumen: { totalIntereses: 0, fechaFinalizacion: '2034-01-01' },
      metadata: { source: 'manual' }
    } as any);

    const patrimonio = await dashboardService.getPatrimonioNeto();

    getPaymentPlanSpy.mockRestore();

    expect(patrimonio.desglose.deuda).toBe(87500);
    expect(patrimonio.total).toBe(-87500);
  });

  it('alinea patrimonio cuentas con el saldo actual de tesorería sin descontar eventos ya reflejados', async () => {
    const datasets: Record<string, any[]> = {
      properties: [],
      valoraciones_historicas: [],
      inversiones: [],
      prestamos: [],
      accounts: [
        { id: 1, isActive: true, alias: 'Cuenta Banco', balance: 6906 }
      ],
      treasuryEvents: [
        { accountId: 1, type: 'expense', status: 'confirmed', amount: 1240, predictedDate: '2026-03-04' }
      ]
    };

    (initDB as jest.Mock).mockResolvedValue({
      getAll: jest.fn(async (store: string) => datasets[store] ?? []),
      getAllFromIndex: jest.fn(async () => []),
      add: jest.fn(async () => 1),
      put: jest.fn(async () => undefined),
      get: jest.fn(async () => undefined)
    });

    const [patrimonio, panel] = await Promise.all([
      dashboardService.getPatrimonioNeto(),
      dashboardService.getTesoreriaPanel()
    ]);

    expect(panel.totales.hoy).toBe(5666);
    expect(patrimonio.desglose.cuentas).toBe(5666);
    expect(patrimonio.total).toBe(5666);
  });
});
