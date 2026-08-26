// El rótulo de reducción sale de UNA verdad, y la misma para todos los años.
//
// Lo que había:
//
//   · `detectarPorcentajeReduccion` (motor B) devolvía 60 % para cualquier
//     inmueble en modo I/II/III, sin mirar un solo contrato. Ese 60 no salía de
//     la ley ni del alta: salía de un `if`. Y con él se recalculaba la casilla
//     0150 de cualquier año sin declaración importada.
//   · El campo `reduccionLeyVivienda`, que ese motor leía de los contratos, no
//     existe en `Contract`: era su única puerta de escape y estaba tapiada.
//
// Lo que se prueba aquí es lo contrario: que el porcentaje lo pone el motor del
// contrato (el del art. 23.2), que un año declarado se LEE y no se recalcula, y
// que cuando no hay con qué saberlo el rótulo dice que no lo sabe en vez de
// rellenar el hueco con un número redondo.

import { calculateFiscalSummaryExtended } from '../fiscalSummaryService';
import { initDB } from '../db';
import { getRendimientoFiscal } from '../rendimientoActivoService';
import { getEjercicio } from '../ejercicioResolverService';
import { getRentalDaysForYear, updateFiscalSummaryWithAEAT } from '../aeatAmortizationService';
import { gastosInmuebleService } from '../gastosInmuebleService';
import {
  generarOperacionesDesdeIntereses,
  generarOperacionesDesdeRecurrentes,
} from '../operacionFiscalService';
import { calcularAmortizacionMobiliarioAnual } from '../mobiliarioActivoService';
import { getTotalMejorasHastaEjercicio } from '../mejoraActivoService';
import { getExerciseStatus } from '../aeatClassificationService';
import { getCarryForwardsDisponibles, consumirArrastresAplicados } from '../carryForwardService';
import { calcularImputacion } from '../imputacionRentaService';
import { etiquetaTramo } from '../desgloseReduccion';

jest.mock('../db', () => ({ initDB: jest.fn() }));
jest.mock('../operacionFiscalService', () => ({
  generarOperacionesDesdeIntereses: jest.fn(),
  generarOperacionesDesdeRecurrentes: jest.fn(),
}));
jest.mock('../gastosInmuebleService', () => ({
  gastosInmuebleService: { getSumaPorCasilla: jest.fn() },
}));
jest.mock('../aeatAmortizationService', () => ({
  getRentalDaysForYear: jest.fn(),
  updateFiscalSummaryWithAEAT: jest.fn(),
}));
jest.mock('../mobiliarioActivoService', () => ({ calcularAmortizacionMobiliarioAnual: jest.fn() }));
jest.mock('../mejoraActivoService', () => ({ getTotalMejorasHastaEjercicio: jest.fn() }));
jest.mock('../aeatClassificationService', () => ({ getExerciseStatus: jest.fn() }));
jest.mock('../rendimientoActivoService', () => ({
  getRendimientoFiscal: jest.fn(),
  normalizeRefCatastral: (r: string) => (r ?? '').replace(/[\s.-]/g, '').trim().toUpperCase(),
}));
jest.mock('../ejercicioResolverService', () => ({ getEjercicio: jest.fn() }));
jest.mock('../carryForwardService', () => ({
  getCarryForwardsDisponibles: jest.fn(),
  consumirArrastresAplicados: jest.fn(),
}));
jest.mock('../imputacionRentaService', () => ({ calcularImputacion: jest.fn() }));

const mocked = <T extends (...a: any[]) => any>(f: T) => f as jest.MockedFunction<T>;

/** Un inmueble sin nada raro: los ingresos y los gastos los pone cada test. */
const montarBase = (opciones: {
  contratos?: any[];
  ingresos?: number;
  refCatastral?: string;
  declaracion?: any;
}): void => {
  mocked(generarOperacionesDesdeRecurrentes).mockResolvedValue(0);
  mocked(generarOperacionesDesdeIntereses).mockResolvedValue(0);
  mocked(gastosInmuebleService.getSumaPorCasilla).mockResolvedValue({} as any);
  mocked(getRentalDaysForYear).mockResolvedValue(365);
  mocked(calcularAmortizacionMobiliarioAnual).mockResolvedValue(0);
  mocked(getTotalMejorasHastaEjercicio).mockResolvedValue(0);
  mocked(getExerciseStatus).mockReturnValue('abierto' as any);
  mocked(updateFiscalSummaryWithAEAT).mockResolvedValue({
    constructionValue: 0, annualDepreciation: 0, aeatAmortization: 0,
  } as any);
  mocked(getCarryForwardsDisponibles).mockResolvedValue({ total: 0, detalle: [] });
  mocked(consumirArrastresAplicados).mockResolvedValue(undefined);
  mocked(calcularImputacion).mockResolvedValue({ imputacion: 0 } as any);
  mocked(getEjercicio).mockResolvedValue(opciones.declaracion ?? (null as any));

  mocked(initDB).mockResolvedValue({
    get: jest.fn(async (store: string) => {
      if (store === 'properties') {
        return { id: 1, alias: 'Piso', cadastralReference: opciones.refCatastral ?? '' };
      }
      if (store === 'ejerciciosFiscalesCoord') return opciones.declaracion ?? null;
      return null;
    }),
    getAll: jest.fn(async (store: string) =>
      store === 'contracts' ? (opciones.contratos ?? []) : [],
    ),
    getAllFromIndex: jest.fn(async () => []),
    add: jest.fn(async () => 1),
    put: jest.fn(),
    delete: jest.fn(),
  } as any);
};

const contratoHabitual = (extra: Record<string, unknown> = {}) => ({
  id: 1,
  inmuebleId: 1,
  modalidad: 'habitual',
  fechaInicio: '2025-01-01',
  fechaFin: '2030-12-31',
  rentaMensual: 1000,
  ...extra,
});

/** Sin declaración importada: la rama que recalculaba al 60 %. */
const sinDeclaracion = (): void => {
  mocked(getRendimientoFiscal).mockResolvedValue({
    rentasDeclaradas: 0, diasArrendado: 0, rentaImputada: 0, diasDisposicion: 0,
    totalIngresos: 0, interesesFinanciacion: 0, reparacionConservacion: 0,
    reparacionAplicada: 0, reparacionExceso: 0, ibiTasas: 0, comunidad: 0,
    suministros: 0, seguros: 0, amortMobiliario: 0, amortInmueble: 0,
    baseAmortizacion: 0, totalGastosDeducibles: 0, rendimientoNeto: 0,
    reduccionVivienda: 0, tipoArrendamiento: 2, rendimientoNetoReducido: 0,
    fuente: 'atlas',
  } as any);
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ───────────────────────────────────────────────────────────────────────────
describe('sin declaración importada · el % lo pone el contrato, no un if', () => {
  it('un habitual post-Ley reduce el 50 %, no el 60 % que ponía el motor viejo', async () => {
    // 12.000 € de renta, sin gastos: el rendimiento neto es 12.000 y el
    // contrato es de 2025, ya bajo la Ley de Vivienda → 50 %.
    montarBase({ contratos: [contratoHabitual()] });
    sinDeclaracion();
    mocked(gastosInmuebleService.getSumaPorCasilla).mockResolvedValue({} as any);

    const ext = await calculateFiscalSummaryExtended(1, 2025);

    expect(ext.reduccion.origen).toBe('atlas');
    expect(ext.reduccion.tramos.map(etiquetaTramo)).toEqual(['50% vivienda habitual']);
    // Y la casilla sigue el mismo número que el rótulo.
    expect(ext.box0150).toBe(ext.reduccion.importe);
    expect(ext.box0150).toBe(Math.round(ext.box0149 * 0.5 * 100) / 100);
  });

  it('un habitual firmado antes de la Ley reduce el 60 %, y por su fecha', async () => {
    montarBase({
      contratos: [contratoHabitual({ fechaInicio: '2022-03-01', fechaFirmaContrato: '2022-03-01' })],
    });
    sinDeclaracion();

    const ext = await calculateFiscalSummaryExtended(1, 2025);
    expect(ext.reduccion.tramos.map(etiquetaTramo)).toEqual(['60% vivienda habitual']);
  });

  it('temporada · 0 % explícito, no un tramo escondido', async () => {
    montarBase({
      contratos: [contratoHabitual({ modalidad: 'temporada' })],
    });
    sinDeclaracion();

    const ext = await calculateFiscalSummaryExtended(1, 2025);
    expect(ext.reduccion.tramos.map(etiquetaTramo)).toEqual(['0% temporada']);
    expect(ext.box0150).toBe(0);
  });

  it('larga + temporada · dos chips y el 60 % NO se aplica a la parte de temporada', async () => {
    montarBase({
      contratos: [
        contratoHabitual({ id: 1, fechaFirmaContrato: '2022-01-01', rentaMensual: 1000 }),
        contratoHabitual({ id: 2, modalidad: 'temporada', rentaMensual: 1000 }),
      ],
    });
    sinDeclaracion();

    const ext = await calculateFiscalSummaryExtended(1, 2025);
    expect(ext.reduccion.tramos.map(etiquetaTramo)).toEqual([
      '60% vivienda habitual',
      '0% temporada',
    ]);
    // Mitad y mitad de ingresos: solo la mitad larga se reduce al 60 %.
    expect(ext.box0150).toBeCloseTo(ext.box0149 * 0.5 * 0.6, 2);
  });

  it('SIN contratos no se inventa nada · dato ausente y casilla a cero', async () => {
    // Este era el peor caso del motor B: sin un solo contrato en la base,
    // devolvía 60 % y recalculaba la 0150 sobre el rendimiento entero.
    montarBase({ contratos: [] });
    sinDeclaracion();

    const ext = await calculateFiscalSummaryExtended(1, 2025);
    expect(ext.reduccion.importe).toBeNull();
    expect(ext.reduccion.tramos).toEqual([]);
    expect(ext.box0150).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('año declarado · se lee, no se recalcula', () => {
  const REF = '7949807TP6074N0006YM';

  const declaracionCon = (arrendamientos: any[], reduccion: number, rendimientoNeto: number) => ({
    aeat: {
      declaracionCompleta: {
        inmuebles: [{
          refCatastral: REF,
          arrendamientos,
          rendimientoNeto,
          reduccionVivienda: reduccion,
          rendimientoNetoReducido: rendimientoNeto - reduccion,
        }],
      },
    },
  });

  const rendimientoXML = (reduccion: number, rendimientoNeto: number): void => {
    mocked(getRendimientoFiscal).mockResolvedValue({
      rentasDeclaradas: 19675, diasArrendado: 366, rentaImputada: 0, diasDisposicion: 0,
      totalIngresos: 19675, interesesFinanciacion: 0, reparacionConservacion: 0,
      reparacionAplicada: 0, reparacionExceso: 0, ibiTasas: 0, comunidad: 0,
      suministros: 0, seguros: 0, amortMobiliario: 0, amortInmueble: 0,
      baseAmortizacion: 0, totalGastosDeducibles: 0,
      rendimientoNeto, reduccionVivienda: reduccion, tipoArrendamiento: 1,
      rendimientoNetoReducido: rendimientoNeto - reduccion,
      fuente: 'xml_aeat',
    } as any);
  };

  it('el importe declarado manda, aunque los contratos de ATLAS digan otra cosa', async () => {
    // Un contrato al 50 % en la base y una declaración que redujo 3.200,81 €.
    // Lo presentado es verdad cerrada: no se toca.
    const decl = declaracionCon(
      [{ tipoArrendamiento: 'vivienda', tieneReduccion: true }],
      3200.81,
      5334.69,
    );
    montarBase({ contratos: [contratoHabitual()], refCatastral: REF, declaracion: decl });
    rendimientoXML(3200.81, 5334.69);

    const ext = await calculateFiscalSummaryExtended(1, 2024);

    expect(ext.reduccion.origen).toBe('declarado');
    expect(ext.reduccion.importe).toBe(3200.81);
    expect(ext.box0150).toBe(3200.81);
    // Un solo arrendamiento: 3.200,81 ÷ 5.334,69 da el 60 % clavado.
    expect(ext.reduccion.tramos.map(etiquetaTramo)).toEqual(['60% vivienda habitual']);
  });

  it('el caso mixto real · dos tramos, el importe exacto y NINGÚN 26 %', async () => {
    // FA32 2024: 1.390,94 sobre 5.334,69 sale 26,07 %. Ese número es lo que
    // enseñaba el motor C, y no es el porcentaje de nada.
    const decl = declaracionCon(
      [
        { tipoArrendamiento: 'vivienda', tieneReduccion: true },
        { tipoArrendamiento: 'no_vivienda', tieneReduccion: false },
      ],
      1390.94,
      5334.69,
    );
    montarBase({ contratos: [], refCatastral: REF, declaracion: decl });
    rendimientoXML(1390.94, 5334.69);

    const ext = await calculateFiscalSummaryExtended(1, 2024);

    expect(ext.reduccion.importe).toBe(1390.94);
    expect(ext.reduccion.tramos.map(etiquetaTramo)).toEqual([
      'vivienda habitual',
      '0% temporada/turístico',
    ]);
    expect(JSON.stringify(ext.reduccion)).not.toContain('26');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('el motor B ya no existe', () => {
  it('`porcentajeReduccion` desaparece del resumen · nadie puede volver a leerlo', async () => {
    montarBase({ contratos: [contratoHabitual()] });
    sinDeclaracion();

    const ext = await calculateFiscalSummaryExtended(1, 2025);
    expect((ext as Record<string, unknown>).porcentajeReduccion).toBeUndefined();
  });
});
