import 'fake-indexeddb/auto';

import { initDB } from '../db';
import * as irpfCalculationService from '../irpfCalculationService';
import { cerrarEjercicioConWorkflow, importarDeclaracionManual, obtenerHistoricoFiscalReal } from '../fiscalLifecycleService';

const EJERCICIO = 2024;

function buildDeclaracionMock() {
  return {
    ejercicio: EJERCICIO,
    baseGeneral: {
      rendimientosTrabajo: { salarioBrutoAnual: 20000, especieAnual: 0 },
      rendimientosAutonomo: { ingresos: 4000, gastos: 3000, cuotaSS: 500 },
      rendimientosInmuebles: [{ ingresosIntegros: 2500, gastosDeducibles: 1500, amortizacion: 1000 }],
    },
    baseAhorro: { total: 1000, capitalMobiliario: { total: 200 }, gananciasYPerdidas: { plusvalias: 100 } },
    reducciones: { total: 1200 },
    minimoPersonal: { total: 5550 },
    liquidacion: {
      baseImponibleGeneral: 18000,
      baseImponibleAhorro: 1000,
      cuotaIntegra: 3000,
      cuotaLiquida: 2400,
      deduccionesDobleImposicion: 100,
    },
    retenciones: { total: 1500 },
    resultado: 900,
    tipoEfectivo: 12.5,
  } as any;
}

describe('fiscalLifecycleService', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    const db = await initDB();
    await db.clear('ejerciciosFiscales');
    await db.clear('resultadosEjercicio');
    await db.clear('arrastresIRPF');
    await db.clear('snapshotsDeclaracion');
  });

  test('cierre de ejercicio genera snapshot y resultado inmutable', async () => {
    jest.spyOn(irpfCalculationService, 'calcularDeclaracionIRPF').mockResolvedValue(buildDeclaracionMock());

    const { ejercicio, resultado, snapshot } = await cerrarEjercicioConWorkflow({
      año: EJERCICIO,
      validarContraDatosReales: true,
      notasRevision: 'validado con extractos y facturas',
    });

    expect(ejercicio.estado).toBe('cerrado');
    expect(ejercicio.resultadoEjercicioId).toBeDefined();
    expect(snapshot.id).toBeDefined();
    expect(resultado.estadoEjercicio).toBe('cerrado');
    expect(resultado.resumen.cuotaLiquida).toBe(2400);
  });

  test('importación manual crea ejercicio declarado e histórico real', async () => {
    const imported = await importarDeclaracionManual({
      ejercicio: 2022,
      casillasAEAT: { '0595': 1400, '0670': 100 },
      resultado: {
        baseImponibleGeneral: 15000,
        baseImponibleAhorro: 2000,
        cuotaIntegra: 2200,
        cuotaLiquida: 1800,
        deducciones: 100,
        retencionesYPagosCuenta: 500,
        resultado: 1300,
      },
      arrastresPendientes: [{ tipo: 'otros', importePendiente: 600, ejercicioCaducidad: 2026 }],
    });

    expect(imported.ejercicio.estado).toBe('declarado');
    expect(imported.ejercicio.origen).toBe('importado');

    const historico = await obtenerHistoricoFiscalReal();
    expect(historico).toHaveLength(1);
    expect(historico[0]?.ejercicio).toBe(2022);
    expect(historico[0]?.origen).toBe('importado');
    expect(historico[0]?.resultado.resultado).toBe(1300);
  });
});
