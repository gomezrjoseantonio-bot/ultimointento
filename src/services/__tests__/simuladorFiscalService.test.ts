import { ejecutarSimulacion } from '../simuladorFiscalService';

jest.mock('../irpfCalculationService', () => ({
  calcularDeclaracionIRPF: jest.fn(),
  calcularCuotaPorTramos: jest.fn((base: number, _tramos: Array<{ tipo: number }>) => Number(base.toFixed(2))),
}));

jest.mock('../propertyDisposalTaxService', () => ({
  calcularGananciaPatrimonialVentaSimulada: jest.fn().mockResolvedValue({
    inmuebleId: 3,
    alias: 'Venta simulada',
    precioVenta: 200000,
    gastosVenta: 5000,
    gastosVentaDesglose: { agencia: 0, plusvaliaMunicipal: 0, notariaRegistro: 0, otros: 5000 },
    valorTransmision: 195000,
    precioCompra: 150000,
    gastosAdquisicion: 10000,
    mejoras: 0,
    amortizacionMinima: 0,
    valorAdquisicion: 160000,
    gananciaPatrimonial: 35000,
    esPerdida: false,
    fechaVenta: '2025-09-30',
    fechaCompra: '2020-01-01',
    añosTenencia: 5.75,
    ejercicioFiscal: 2025,
    integracion: 'base_ahorro',
    amortizacionDeducida: 0,
    amortizacionEstandar: 0,
    amortizacionAplicada: 0,
  }),
}));

import { calcularDeclaracionIRPF } from '../irpfCalculationService';
import { calcularGananciaPatrimonialVentaSimulada } from '../propertyDisposalTaxService';

const mockCalcularDeclaracionIRPF = calcularDeclaracionIRPF as jest.MockedFunction<typeof calcularDeclaracionIRPF>;
const mockCalcularGananciaPatrimonialVentaSimulada = calcularGananciaPatrimonialVentaSimulada as jest.MockedFunction<typeof calcularGananciaPatrimonialVentaSimulada>;

describe('simuladorFiscalService venta_inmueble', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCalcularGananciaPatrimonialVentaSimulada.mockResolvedValue({
      inmuebleId: 3,
      alias: 'Venta simulada',
      precioVenta: 200000,
      gastosVenta: 5000,
      gastosVentaDesglose: { agencia: 0, plusvaliaMunicipal: 0, notariaRegistro: 0, otros: 5000 },
      valorTransmision: 195000,
      precioCompra: 150000,
      gastosAdquisicion: 10000,
      mejoras: 0,
      amortizacionMinima: 0,
      valorAdquisicion: 160000,
      gananciaPatrimonial: 35000,
      esPerdida: false,
      fechaVenta: '2025-09-30',
      fechaCompra: '2020-01-01',
      añosTenencia: 5.75,
      ejercicioFiscal: 2025,
      integracion: 'base_ahorro',
      amortizacionDeducida: 0,
      amortizacionEstandar: 0,
      amortizacionAplicada: 0,
    });
    mockCalcularDeclaracionIRPF.mockResolvedValue({
      ejercicio: 2025,
      baseGeneral: {
        rendimientosTrabajo: null,
        rendimientosAutonomo: null,
        rendimientosInmuebles: [],
        imputacionRentas: [],
        total: 0,
      },
      baseAhorro: {
        capitalMobiliario: { intereses: 0, dividendos: 0, retenciones: 0, total: 0 },
        gananciasYPerdidas: { plusvalias: 1000, minusvalias: 200, minusvaliasPendientes: 0, compensado: 800 },
        total: 800,
      },
      reducciones: { ppEmpleado: 0, ppEmpresa: 0, ppIndividual: 0, planPensiones: 0, total: 0 },
      minimoPersonal: { contribuyente: 0, descendientes: 0, ascendientes: 0, discapacidad: 0, total: 0 },
      liquidacion: {
        baseImponibleGeneral: 0,
        baseImponibleAhorro: 800,
        cuotaBaseGeneral: 0,
        cuotaBaseAhorro: 800,
        cuotaMinimosBaseGeneral: 0,
        cuotaIntegra: 800,
        deduccionesDobleImposicion: 0,
        cuotaLiquida: 800,
      },
      retenciones: { trabajo: 0, autonomoM130: 0, capitalMobiliario: 0, total: 0 },
      resultado: 800,
      tipoEfectivo: 0,
    });
  });

  it('añade una venta de inmueble al resultado simulado', async () => {
    const sim = await ejecutarSimulacion(2025, 'venta_inmueble', {
      inmuebleId: 3,
      precioVenta: 200000,
      gastosVenta: 5000,
      fechaVenta: '2025-09-30',
    });

    expect(sim.resultadoSimulado.baseAhorro.gananciasYPerdidas.plusvalias).toBe(36000);
    expect(sim.resultadoSimulado.baseAhorro.gananciasYPerdidas.compensado).toBe(35800);
    expect(sim.resultadoSimulado.baseAhorro.total).toBe(35800);
    expect(sim.resultadoSimulado.ventasInmuebles).toHaveLength(1);
  });
});
