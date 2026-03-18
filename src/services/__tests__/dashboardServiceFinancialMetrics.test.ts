import { dashboardService } from '../dashboardService';
import { initDB } from '../db';

jest.mock('../db', () => ({
  initDB: jest.fn()
}));

describe('dashboardService financial metrics', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-08T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
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
      getAll: jest.fn(async (store: string) => datasets[store] ?? [])
    });

    const liquidez = await dashboardService.getLiquidez();
    const salud = await dashboardService.getSaludFinanciera();

    expect(liquidez.disponibleHoy).toBeCloseTo(1500.5, 2);
    expect(liquidez.comprometido30d).toBeCloseTo(615, 2);
    expect(liquidez.ingresos30d).toBeCloseTo(650, 2);
    expect(liquidez.proyeccion30d).toBeCloseTo(1535.5, 2);

    expect(salud.liquidezHoy).toBeCloseTo(1500.5, 2);
    expect(salud.gastoMedioMensual).toBeCloseTo(566.666666, 2);
    expect(salud.colchonMeses).toBeCloseTo(1500.5 / 566.666666, 5);
    expect(salud.estado).toBe('warning');
    expect(salud.proyeccion30d.gastos).toBeCloseTo(615, 2);
    expect(salud.proyeccion30d.ingresos).toBeCloseTo(650, 2);
    expect(salud.proyeccion30d.estimado).toBeCloseTo(1535.5, 2);
  });


  it('usa renta mensual de contratos activos cuando no hay cobros pagados en rentPayments', async () => {
    const datasets: Record<string, any[]> = {
      ingresos: [],
      gastos: [
        { fecha: '2026-03-05', importe: 200, esPersonal: false, destino: 'inmueble_id', destino_id: 1 }
      ],
      expenses: [
        { fecha: '2026-03-08', importe: 50, propertyId: 1 }
      ],
      rentPayments: [
        { fecha: '2026-03-10', importe: 900, estado: 'pendiente' }
      ],
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
      getAll: jest.fn(async (store: string) => datasets[store] ?? [])
    });

    const flujos = await dashboardService.getFlujosCaja();

    // 1000 (renta contrato) - 250 (gastos) - 300 (hipoteca) = 450
    expect(flujos.inmuebles.cashflow).toBeCloseTo(450, 2);
    expect(flujos.inmuebles.ocupacion).toBeCloseTo(100, 2);
  });

  it('prioriza cobros reales pagados aunque el neto mensual sea cero o negativo', async () => {
    const datasets: Record<string, any[]> = {
      ingresos: [],
      gastos: [
        { fecha: '2026-03-05', importe: 200, esPersonal: false, destino: 'inmueble_id', destino_id: 1 }
      ],
      expenses: [],
      rentPayments: [
        { fecha: '2026-03-10', importe: 100, estado: 'pagada' },
        { fecha: '2026-03-11', importe: -150, estado: 'paid' }
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
      getAll: jest.fn(async (store: string) => datasets[store] ?? [])
    });

    const flujos = await dashboardService.getFlujosCaja();

    // Debe usar cobros reales: (100 - 150) - 200 = -250
    // y NO caer al fallback de contrato (1000) porque sí hay cobros pagados.
    expect(flujos.inmuebles.cashflow).toBeCloseTo(-250, 2);
  });


  it('trata estado confirmado como cobro real para evitar fallback de contrato', async () => {
    const datasets: Record<string, any[]> = {
      ingresos: [],
      gastos: [],
      expenses: [],
      rentPayments: [
        { fecha: '2026-03-10', importe: 700, estado: 'confirmado' }
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
      getAll: jest.fn(async (store: string) => datasets[store] ?? [])
    });

    const flujos = await dashboardService.getFlujosCaja();

    // Debe usar 700 (confirmado real) y no 1000 del contrato fallback.
    expect(flujos.inmuebles.cashflow).toBeCloseTo(700, 2);
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
      add: jest.fn(async () => 1)
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
      getAll: jest.fn(async (store: string) => datasets[store] ?? [])
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
      add: jest.fn(async () => 1)
    });

    const [patrimonio, panel] = await Promise.all([
      dashboardService.getPatrimonioNeto(),
      dashboardService.getTesoreriaPanel()
    ]);

    expect(panel.totales.hoy).toBe(6906);
    expect(patrimonio.desglose.cuentas).toBe(6906);
    expect(patrimonio.total).toBe(6906);
  });
});
