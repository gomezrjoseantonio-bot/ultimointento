import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import HorizonVisualPanel from './HorizonVisualPanel';
import { dashboardService } from '../../../../services/dashboardService';

jest.mock('../../../../components/dashboard/ActualizacionValoresDrawer', () => () => null);
jest.mock('../../../../services/dashboardService', () => ({
  dashboardService: {
    getPatrimonioNeto: jest.fn(),
    getLiquidez: jest.fn(),
    getSaludFinanciera: jest.fn(),
    getTesoreriaPanel: jest.fn(),
    getAlertas: jest.fn(),
    getFlujosCaja: jest.fn()
  }
}));

describe('HorizonVisualPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-18T10:00:00.000Z'));

    (dashboardService.getPatrimonioNeto as jest.Mock).mockResolvedValue({
      total: 650171,
      variacionMes: 650171,
      variacionPorcentaje: 0,
      fechaCalculo: '2026-03-18T10:00:00.000Z',
      desglose: {
        inmuebles: 782000,
        inversiones: 225734,
        cuentas: 38437,
        deuda: 396000
      }
    });
    (dashboardService.getLiquidez as jest.Mock).mockResolvedValue({
      disponibleHoy: 38437,
      comprometido30d: 3518,
      ingresos30d: 0,
      proyeccion30d: 34919
    });
    (dashboardService.getSaludFinanciera as jest.Mock).mockResolvedValue({
      liquidezHoy: 38437,
      gastoMedioMensual: 2088,
      colchonMeses: 18.4,
      estado: 'ok',
      proyeccion30d: {
        estimado: 34919,
        ingresos: 0,
        gastos: 3518
      }
    });
    (dashboardService.getTesoreriaPanel as jest.Mock).mockResolvedValue({
      asOf: '2026-03-18T10:00:00.000Z',
      filas: [],
      totales: { inicioMes: 0, hoy: 0, porCobrar: 0, porPagar: 0, proyeccion: 0 }
    });
    (dashboardService.getAlertas as jest.Mock).mockResolvedValue([]);
    (dashboardService.getFlujosCaja as jest.Mock).mockResolvedValue({
      trabajo: {
        netoMensual: 1280.6,
        tendencia: 'up',
        variacionPorcentaje: 0
      },
      inmuebles: {
        cashflow: 4720.4,
        ocupacion: 80,
        tendencia: 'up'
      },
      inversiones: {
        rendimientoMes: 607.5,
        dividendosMes: 0,
        tendencia: 'stable'
      }
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cuadra el cashflow neto con la suma visible de los tres bloques', async () => {
    const { container } = render(<HorizonVisualPanel />);

    await waitFor(() => {
      expect(container.textContent).toContain('Cashflow neto6609');
    });

    expect(container.textContent).toContain('Economía familiar1281');
    expect(container.textContent).toContain('Inmuebles4720');
    expect(container.textContent).toContain('Inversiones608');
    expect(screen.getByText('Flujos de caja · MAR 2026')).toBeTruthy();
  });
});
