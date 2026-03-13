import { mapDeclaracionToTaxState } from './taxHydrationMapper';
import { DeclaracionIRPF } from '../../services/irpfCalculationService';

jest.mock('../../services/db', () => ({
  initDB: jest.fn(),
}));

jest.mock('../../services/fiscalSummaryService', () => ({
  calculateFiscalSummary: jest.fn(),
}));

const { initDB } = jest.requireMock('../../services/db') as { initDB: jest.Mock };
const { calculateFiscalSummary } = jest.requireMock('../../services/fiscalSummaryService') as {
  calculateFiscalSummary: jest.Mock;
};

function buildDeclaracion(): DeclaracionIRPF {
  return {
    ejercicio: 2026,
    baseGeneral: {
      rendimientosTrabajo: null,
      rendimientosAutonomo: null,
      rendimientosInmuebles: [
        {
          inmuebleId: 1,
          alias: 'Tenderina 64 4D',
          diasAlquilado: 365,
          diasVacio: 0,
          diasEnObras: 0,
          diasTotal: 365,
          ingresosIntegros: 12000,
          gastosDeducibles: 3000,
          amortizacion: 1000,
          reduccionHabitual: 0,
          rendimientoNetoAlquiler: 8000,
          esHabitual: true,
          imputacionRenta: 0,
          rendimientoNeto: 8000,
        },
      ],
      imputacionRentas: [
        {
          inmuebleId: 2,
          alias: 'Manresa',
          valorCatastral: 100000,
          porcentajeImputacion: 0.02,
          diasVacio: 365,
          imputacion: 2000,
        },
      ],
      total: 10000,
    },
    baseAhorro: {
      capitalMobiliario: { intereses: 0, dividendos: 0, retenciones: 0, total: 0 },
      gananciasYPerdidas: { plusvalias: 0, minusvalias: 0, minusvaliasPendientes: 0, compensado: 0 },
      total: 0,
    },
    reducciones: { ppEmpleado: 0, ppEmpresa: 0, ppIndividual: 0, planPensiones: 0, total: 0 },
    minimoPersonal: { contribuyente: 0, descendientes: 0, ascendientes: 0, discapacidad: 0, total: 0 },
    liquidacion: {
      baseImponibleGeneral: 10000,
      baseImponibleAhorro: 0,
      cuotaBaseGeneral: 0,
      cuotaBaseAhorro: 0,
      cuotaMinimosBaseGeneral: 0,
      cuotaIntegra: 0,
      deduccionesDobleImposicion: 0,
      cuotaLiquida: 0,
    },
    retenciones: { trabajo: 0, autonomoM130: 0, capitalMobiliario: 0, total: 0 },
    resultado: 0,
    tipoEfectivo: 0,
  };
}

describe('mapDeclaracionToTaxState', () => {
  it('incluye inmuebles alquilados, con imputación y activos sin datos fiscales', async () => {
    calculateFiscalSummary.mockResolvedValue({
      box0105: 100,
      box0106: 50,
      box0109: 200,
      box0112: 25,
      box0113: 125,
      box0114: 300,
      box0115: 400,
      box0117: 75,
      capexTotal: 1500,
    });

    initDB.mockResolvedValue({
      getAll: jest.fn(async (storeName: string) => {
        if (storeName !== 'properties') return [];
        return [
          {
            id: 1,
            alias: 'Tenderina 64 4D',
            state: 'activo',
            acquisitionCosts: {
              price: 100000,
              itp: 7000,
              notary: 900,
              registry: 350,
              management: 500,
            },
          },
          { id: 2, alias: 'Manresa', state: 'activo' },
          { id: 3, alias: 'Sant Fruitós', state: 'activo' },
          { id: 4, alias: 'Garaje Tenderina', state: 'activo', fiscalData: { isAccessory: true, mainPropertyId: 1 } },
        ];
      }),
    });

    const payload = await mapDeclaracionToTaxState(buildDeclaracion());

    expect(payload.inmuebles.map((i) => i.id).sort()).toEqual(['1', '2', '3']);
    expect(payload.inmuebles.find((i) => i.id === '2')?.rentaImputada).toBe(2000);
    expect(payload.inmuebles.find((i) => i.id === '3')?.direccion).toBe('Sant Fruitós');

    const rented = payload.inmuebles.find((i) => i.id === '1');
    expect(rented?.interesesFinanciacion).toBe(100);
    expect(rented?.gastosReparacion).toBe(50);
    expect(rented?.seguro).toBe(300);
    expect(rented?.amortizacionMuebles).toBe(75);
    expect(rented?.mejoras).toBe(1500);
    expect(rented?.gastosTributos).toBe(8750);
  });
});
