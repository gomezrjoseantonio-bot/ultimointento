// Gestión delegada · impacto FISCAL (recopilarDatosInmuebles):
//  · Pieza 1 · el contrato de gestión (padre) NO suma a ingresos íntegros; los
//    íntegros del piso son los de sus subcontratos de inquilinos.
//  · Pieza 2 · la comisión de la agencia es gasto deducible (casilla 0112),
//    derivada del contrato (no de Tesorería) → idéntica en ambos flujos.

import { recopilarDatosInmuebles } from '../irpfCalculationService';
import type { Contract } from '../db';

jest.mock('../db', () => ({ initDB: jest.fn() }));
jest.mock('../fiscalSummaryService', () => ({
  calculateFiscalSummary: jest.fn(),
  calculateCarryForwards: jest.fn(),
}));
jest.mock('../ejercicioResolverService', () => ({
  getInmueblesDelEjercicio: jest.fn(),
}));

import { initDB } from '../db';
import { calculateFiscalSummary, calculateCarryForwards } from '../fiscalSummaryService';
import { getInmueblesDelEjercicio } from '../ejercicioResolverService';

const EMPTY_SUMMARY = {
  box0105: 0, box0106: 0, box0109: 0, box0112: 0, box0113: 0,
  box0114: 0, box0115: 0, box0117: 0, annualDepreciation: 0,
};

const c = (over: Partial<Contract>): Contract =>
  ({
    inmuebleId: 9,
    unidadTipo: 'vivienda',
    modalidad: 'temporal', // sin reducción · para leer el neto sin ruido
    inquilino: { nombre: 'Inquilino', apellidos: '', dni: 'X', telefono: '', email: '' },
    fechaInicio: '2026-01-01',
    fechaFin: '2026-12-31',
    rentaMensual: 500,
    diaPago: 1,
    estadoContrato: 'activo',
    ...over,
  }) as Contract;

beforeEach(() => {
  (initDB as jest.Mock).mockResolvedValue({
    getAll: jest.fn(async (store: string) =>
      store === 'properties'
        ? [{ id: 9, alias: 'Piso 9', state: 'activo', fiscalData: { cadastralValue: 0 } }]
        : [],
    ),
    getAllFromIndex: jest.fn(async () => []),
  });
  (calculateFiscalSummary as jest.Mock).mockResolvedValue(EMPTY_SUMMARY);
  (calculateCarryForwards as jest.Mock).mockResolvedValue([]);
  (getInmueblesDelEjercicio as jest.Mock).mockResolvedValue([9]);
});

const padreGarantizada = (over: Partial<Contract> = {}): Contract =>
  c({
    id: 1,
    rentaMensual: 1350,
    gestion: { agenciaNif: 'B1', modeloIngreso: 'garantizada', rentaGarantizada: 1350, honorarios: [], comisionTipo: 'garantizada' },
    ...over,
  } as Partial<Contract>);

describe('recopilarDatosInmuebles · gestión delegada', () => {
  it('pieza 1 · ingresos íntegros = Σ subcontratos, el padre NO cuenta', async () => {
    const contratos = [
      padreGarantizada(),
      c({ id: 2, gestionPadreId: 1, rentaMensual: 900 }),
      c({ id: 3, gestionPadreId: 1, rentaMensual: 900 }),
    ];
    const { inmuebles } = await recopilarDatosInmuebles(2026, null, contratos);
    const piso = inmuebles.find((i) => i.inmuebleId === 9)!;
    // Σ subcontratos = (900 + 900) × 12 = 21.600 · SIN el padre (1.350 × 12 = 16.200)
    expect(piso.ingresosIntegros).toBe(21600);
  });

  it('pieza 2 · la comisión es gasto deducible (garantizada: facturación − garantizado)', async () => {
    const contratos = [
      padreGarantizada(),
      c({ id: 2, gestionPadreId: 1, rentaMensual: 900 }),
      c({ id: 3, gestionPadreId: 1, rentaMensual: 900 }),
    ];
    const { inmuebles } = await recopilarDatosInmuebles(2026, null, contratos);
    const piso = inmuebles.find((i) => i.inmuebleId === 9)!;
    // comisión = 21.600 − 16.200 = 5.400 · entra en gastosDeducibles
    expect(piso.comisionGestion).toBe(5400);
    expect(piso.gastosDeducibles).toBe(5400);
    // rendimiento neto = 21.600 − 5.400 = 16.200
    expect(piso.rendimientoNetoAlquiler).toBe(16200);
  });

  it('comisión por porcentaje · idéntica sea cual sea la liquidación (flujo B)', async () => {
    const padre = c({
      id: 1,
      rentaMensual: 0,
      gestion: { agenciaNif: 'B1', modeloIngreso: 'traspaso', honorarios: [], comisionTipo: 'porcentaje', comisionPorcentaje: 10, liquidacion: 'propietario_bruto' },
    } as Partial<Contract>);
    const contratos = [
      padre,
      c({ id: 2, gestionPadreId: 1, rentaMensual: 600 }),
      c({ id: 3, gestionPadreId: 1, rentaMensual: 400 }),
    ];
    const { inmuebles } = await recopilarDatosInmuebles(2026, null, contratos);
    const piso = inmuebles.find((i) => i.inmuebleId === 9)!;
    expect(piso.ingresosIntegros).toBe(12000); // 1000 × 12
    expect(piso.comisionGestion).toBe(1200); // 10%
    expect(piso.rendimientoNetoAlquiler).toBe(10800);
  });

  it('piso normal (sin gestión) · comisión ausente, íntegros = renta del contrato', async () => {
    const contratos = [c({ id: 1, rentaMensual: 800 })];
    const { inmuebles } = await recopilarDatosInmuebles(2026, null, contratos);
    const piso = inmuebles.find((i) => i.inmuebleId === 9)!;
    expect(piso.ingresosIntegros).toBe(9600); // 800 × 12
    expect(piso.comisionGestion).toBeUndefined();
    expect(piso.gastosDeducibles).toBe(0);
  });
});
