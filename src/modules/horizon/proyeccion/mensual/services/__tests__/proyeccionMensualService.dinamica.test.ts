// Tests de integración · dinámica anual del motor (C-PROY-5 · Fase B3)
// Criterio B3: la curva ya no es plana · cada supuesto mueve el resultado ·
// subir revalorización 1 punto sube el patrimonio a 20 años · fiscal y
// cashflow coherentes (contratos simulados inyectados al IRPF).
//
// Patrón de mocks del repo (resetMocks de CRA): factories con jest.fn() vacíos
// e implementaciones asignadas en beforeEach.

import type { SupuestosProyeccion } from '../../../../../../types/supuestosProyeccion';

jest.mock('../../../../../../services/fiscalContextService', () => ({
  getFiscalContextSafe: jest.fn(),
}));
jest.mock('../../../../../../services/nominaService', () => ({
  nominaService: { getNominas: jest.fn() },
}));
jest.mock('../../../../../../services/nominaCalculoService', () => ({
  calcularNetoMesNomina: jest.fn(),
}));
jest.mock('../../../../../../services/autonomoService', () => ({
  autonomoService: { getAutonomos: jest.fn() },
}));
jest.mock('../../../../../../services/pensionService', () => ({
  pensionService: { getPensiones: jest.fn(), calculatePension: jest.fn() },
}));
jest.mock('../../../../../../services/otrosIngresosService', () => ({
  otrosIngresosService: { getOtrosIngresos: jest.fn() },
}));
jest.mock('../../../../../../services/contractService', () => ({
  getAllContracts: jest.fn(),
}));
jest.mock('../../../../../../services/inmuebleService', () => ({
  inmuebleService: { getAll: jest.fn() },
}));
jest.mock('../../../../../../services/prestamosService', () => ({
  prestamosService: { getAllPrestamos: jest.fn(), getPaymentPlan: jest.fn() },
}));
jest.mock('../../../../../../services/inversionesService', () => ({
  inversionesService: { getPosiciones: jest.fn() },
}));
jest.mock('../../../../../../services/accountBalanceService', () => ({
  calculateTotalInitialCash: jest.fn(),
}));
jest.mock('../../../../../../services/valoracionesService', () => ({
  valoracionesService: {
    getAllValoraciones: jest.fn(),
    getMapValoracionesMasRecientes: jest.fn(),
  },
}));
jest.mock('../../../../../../services/personal/compromisosRecurrentesService', () => ({
  listarCompromisos: jest.fn(),
}));
jest.mock('../../../../../../services/escenariosService', () => ({
  getSupuestosProyeccion: jest.fn(),
}));
jest.mock('../../../../../../services/irpfCalculationService', () => ({
  calcularDeclaracionIRPF: jest.fn(),
}));
jest.mock('../../../../../../services/fiscalPaymentsService', () => ({
  getConfiguracionFiscal: jest.fn(),
  generarEventosFiscales: jest.fn(),
}));

import {
  generateProyeccionMensual,
  invalidateProyeccionCache,
} from '../proyeccionMensualService';
import { getFiscalContextSafe } from '../../../../../../services/fiscalContextService';
import { nominaService } from '../../../../../../services/nominaService';
import { calcularNetoMesNomina } from '../../../../../../services/nominaCalculoService';
import { autonomoService } from '../../../../../../services/autonomoService';
import { pensionService } from '../../../../../../services/pensionService';
import { otrosIngresosService } from '../../../../../../services/otrosIngresosService';
import { getAllContracts } from '../../../../../../services/contractService';
import { inmuebleService } from '../../../../../../services/inmuebleService';
import { prestamosService } from '../../../../../../services/prestamosService';
import { inversionesService } from '../../../../../../services/inversionesService';
import { calculateTotalInitialCash } from '../../../../../../services/accountBalanceService';
import { valoracionesService } from '../../../../../../services/valoracionesService';
import { listarCompromisos } from '../../../../../../services/personal/compromisosRecurrentesService';
import { getSupuestosProyeccion } from '../../../../../../services/escenariosService';
import { calcularDeclaracionIRPF } from '../../../../../../services/irpfCalculationService';
import {
  getConfiguracionFiscal,
  generarEventosFiscales,
} from '../../../../../../services/fiscalPaymentsService';
import { SUPUESTOS_PROYECCION_DEFAULTS } from '../../../../../../types/supuestosProyeccion';

const ANIO = new Date().getFullYear();

function supuestos(overrides: Partial<SupuestosProyeccion> = {}): SupuestosProyeccion {
  return { ...SUPUESTOS_PROYECCION_DEFAULTS, ...overrides };
}

function contratoFixture(): unknown[] {
  return [
    {
      id: 1,
      inmuebleId: 7,
      inquilino: { nombre: 'Ana', apellidos: 'Pérez' },
      fechaInicio: `${ANIO - 1}-01-01`,
      fechaFin: `${ANIO + 2}-12-31`,
      rentaMensual: 1000,
      indexacion: 'ipc',
      estadoContrato: 'activo',
    },
  ];
}

beforeEach(() => {
  (getFiscalContextSafe as jest.Mock).mockResolvedValue(null);
  (nominaService.getNominas as jest.Mock).mockResolvedValue([
    { activa: true, nombre: 'Dirección' },
  ]);
  (calcularNetoMesNomina as jest.Mock).mockReturnValue({ netoMes: 2000 });
  (autonomoService.getAutonomos as jest.Mock).mockResolvedValue([]);
  (pensionService.getPensiones as jest.Mock).mockResolvedValue([]);
  (otrosIngresosService.getOtrosIngresos as jest.Mock).mockResolvedValue([]);
  (getAllContracts as jest.Mock).mockResolvedValue(contratoFixture());
  (inmuebleService.getAll as jest.Mock).mockResolvedValue([
    { id: '7', alias: 'Piso Sol', estado: 'ACTIVO', compra: { precio_compra: 100000 } },
  ]);
  (prestamosService.getAllPrestamos as jest.Mock).mockResolvedValue([]);
  (prestamosService.getPaymentPlan as jest.Mock).mockResolvedValue(null);
  (inversionesService.getPosiciones as jest.Mock).mockResolvedValue([]);
  (calculateTotalInitialCash as jest.Mock).mockResolvedValue(0);
  (valoracionesService.getAllValoraciones as jest.Mock).mockResolvedValue([]);
  (valoracionesService.getMapValoracionesMasRecientes as jest.Mock).mockResolvedValue(
    new Map(),
  );
  (listarCompromisos as jest.Mock).mockResolvedValue([]);
  (getSupuestosProyeccion as jest.Mock).mockResolvedValue(supuestos());
  (calcularDeclaracionIRPF as jest.Mock).mockResolvedValue({});
  (getConfiguracionFiscal as jest.Mock).mockResolvedValue({ incluir_prevision_irpf: true });
  (generarEventosFiscales as jest.Mock).mockResolvedValue([]);
  invalidateProyeccionCache();
});

afterEach(() => {
  invalidateProyeccionCache();
});

async function proyectar(s: SupuestosProyeccion) {
  (getSupuestosProyeccion as jest.Mock).mockResolvedValue(s);
  invalidateProyeccionCache();
  return generateProyeccionMensual();
}

describe('generateProyeccionMensual · dinámica anual (B3)', () => {
  it('la curva ya no es plana · el patrimonio evoluciona año a año', async () => {
    const proy = await proyectar(supuestos());

    expect(proy).toHaveLength(20);
    const p0 = proy[0].totalesAnuales.patrimonioNetoFinal;
    const p10 = proy[10].totalesAnuales.patrimonioNetoFinal;
    const p19 = proy[19].totalesAnuales.patrimonioNetoFinal;
    expect(p10).not.toBeCloseTo(p0, 0);
    expect(p19).toBeGreaterThan(p10);
  });

  it('criterio 2 · subir revalorización 1 punto sube el patrimonio a 20 años de forma coherente', async () => {
    const base = await proyectar(supuestos({ revalorizacionInmueblesPct: 3 }));
    const subida = await proyectar(supuestos({ revalorizacionInmueblesPct: 4 }));

    const ultimoMesBase = base[19].months[11].patrimonio;
    const ultimoMesSubida = subida[19].months[11].patrimonio;

    // El componente inmuebles responde EXACTAMENTE al factor compuesto
    expect(ultimoMesBase.inmuebles).toBeCloseTo(100000 * Math.pow(1.03, 19), 4);
    expect(ultimoMesSubida.inmuebles).toBeCloseTo(100000 * Math.pow(1.04, 19), 4);
    // Y el patrimonio total sube en consecuencia (resto de piezas iguales)
    expect(ultimoMesSubida.patrimonioNeto).toBeGreaterThan(ultimoMesBase.patrimonioNeto);
    expect(ultimoMesSubida.patrimonioNeto - ultimoMesBase.patrimonioNeto).toBeCloseTo(
      ultimoMesSubida.inmuebles - ultimoMesBase.inmuebles,
      4,
    );
  });

  it('rentas: indexan bajo contrato y a su vencimiento renuevan con vacancia · no mueren ni quedan planas', async () => {
    const proy = await proyectar(supuestos({ subidaRentasPct: 2.5, vacanciaPct: 5 }));

    const renta = (yi: number, m: number) => proy[yi].months[m].ingresos.rentasAlquiler;
    expect(renta(0, 2)).toBeCloseTo(1000, 6);
    expect(renta(1, 2)).toBeCloseTo(1025, 6);
    // El contrato vence en ANIO+2 · en ANIO+3 hay renovación indexada con vacancia
    expect(renta(3, 0)).toBeCloseTo(1000 * Math.pow(1.025, 3) * 0.95, 6);
    // Y a 20 años sigue viva y compuesta
    expect(renta(19, 11)).toBeCloseTo(1000 * Math.pow(1.025, 19) * 0.95, 6);
  });

  it('nómina: el % anual de B1 compone año a año sobre el neto calculado', async () => {
    const proy = await proyectar(supuestos({ subidaNominaPct: 2 }));

    expect(proy[0].months[0].ingresos.nomina).toBeCloseTo(2000, 6);
    expect(proy[5].months[0].ingresos.nomina).toBeCloseTo(2000 * Math.pow(1.02, 5), 6);
  });

  it('rentabilidad del ahorro: con tasa > 0 la caja a 20 años acaba por encima de la de tasa 0', async () => {
    const sinAhorro = await proyectar(supuestos({ rentabilidadAhorroPct: 0 }));
    const conAhorro = await proyectar(supuestos({ rentabilidadAhorroPct: 2 }));

    const cajaSin = sinAhorro[19].months[11].tesoreria.cajaFinal;
    const cajaCon = conAhorro[19].months[11].tesoreria.cajaFinal;
    expect(cajaCon).toBeGreaterThan(cajaSin);
    // El invariante de tesorería se mantiene: cajaFinal = cajaInicial + flujo
    const mes = conAhorro[10].months[6].tesoreria;
    expect(mes.cajaFinal).toBeCloseTo(mes.cajaInicial + mes.flujoCajaMes, 6);
  });

  it('criterio 3 · el IRPF de ejercicios futuros recibe los contratos SIMULADOS (renovados + indexados)', async () => {
    await proyectar(supuestos({ subidaRentasPct: 2.5 }));

    const calls = (calcularDeclaracionIRPF as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    for (const [ejercicio, opciones] of calls) {
      if (ejercicio > ANIO) {
        // Futuro: contratos simulados · renta indexada · fechaFin extendida si renueva
        expect(opciones.contratosOverride).toHaveLength(1);
        const sim = opciones.contratosOverride[0];
        expect(sim.rentaMensual).toBeCloseTo(1000 * Math.pow(1.025, ejercicio - ANIO), 6);
        if (ejercicio > ANIO + 2) {
          expect(sim.fechaFin).toBe(`${ejercicio}-12-31`);
        }
      } else {
        // Presente/pasado: datos reales de DB · sin override
        expect(opciones.contratosOverride).toBeUndefined();
      }
    }
  });
});
