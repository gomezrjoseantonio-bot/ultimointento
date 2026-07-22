// Tests · opexCompromisosEngine (C-PROY-5 · Fase B2)
// La vía directa: expandirPatron + calcularImporte + aplicarVariacion +
// inflación global B1 para compromisos sin variación propia.

import { buildOpexPorMes } from '../opexCompromisosEngine';
import type { CompromisoRecurrente } from '../../../../../../types/compromisosRecurrentes';

const START_YEAR = 2026;
const YEARS = 20;

const aliasMap = new Map<number, string>([[7, 'Piso Sol']]);

function compromisoBase(
  overrides: Partial<CompromisoRecurrente> = {},
): CompromisoRecurrente {
  return {
    id: 1,
    ambito: 'inmueble',
    inmuebleId: 7,
    alias: 'Comunidad',
    tipo: 'comunidad',
    proveedor: { nombre: 'Comunidad Sol' },
    patron: { tipo: 'mensualDiaFijo', dia: 5 },
    importe: { modo: 'fijo', importe: 100 },
    cuentaCargo: 1,
    conceptoBancario: 'COMUNIDAD SOL',
    metodoPago: 'domiciliacion',
    categoria: 'inmueble.comunidad',
    bolsaPresupuesto: 'inmueble',
    responsable: 'titular',
    fechaInicio: '2024-01-01',
    estado: 'activo',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildOpexPorMes · vía directa', () => {
  it('mensual fijo sin variación · inflación global B1 compuesta desde el año base (sin retroactiva)', () => {
    const map = buildOpexPorMes([compromisoBase()], 2.5, aliasMap, START_YEAR, YEARS);

    // Año base: importe registrado tal cual (aunque fechaInicio sea 2024)
    expect(map.get('2026-01')!.total).toBeCloseTo(100, 6);
    // Año +1 y +2: compuesto 2,5 %
    expect(map.get('2027-01')!.total).toBeCloseTo(102.5, 6);
    expect(map.get('2028-01')!.total).toBeCloseTo(105.0625, 6);
    // Último año del horizonte: presente · 12 meses
    expect(map.get('2045-12')!.total).toBeCloseTo(100 * Math.pow(1.025, 19), 6);
    // Desglose con alias del inmueble
    expect(map.get('2026-01')!.desglose).toEqual([
      { propertyId: 7, propertyAlias: 'Piso Sol', concepto: 'Comunidad', importe: expect.closeTo(100, 6) },
    ]);
  });

  it('variacion aniversarioContrato · la variación del compromiso MANDA sobre la inflación global', () => {
    const c = compromisoBase({
      fechaInicio: '2026-01-01',
      variacion: { tipo: 'aniversarioContrato', mesAniversario: 1, porcentajeAnual: 10 },
    });
    const map = buildOpexPorMes([c], 2.5, aliasMap, START_YEAR, YEARS);

    // aplicarVariacion ancla en fechaInicio: 2027 = 1 revisión → ×1.10
    expect(map.get('2027-02')!.total).toBeCloseTo(110, 6);
    // 2028 = 2 revisiones → ×1.21 (compuesto · NO 2,5 % global)
    expect(map.get('2028-02')!.total).toBeCloseTo(121, 6);
  });

  it('variacion sinVariacion es elección explícita · plano los 20 años · sin inflación global', () => {
    const c = compromisoBase({ variacion: { tipo: 'sinVariacion' } });
    const map = buildOpexPorMes([c], 2.5, aliasMap, START_YEAR, YEARS);

    expect(map.get('2026-06')!.total).toBeCloseTo(100, 6);
    expect(map.get('2040-06')!.total).toBeCloseTo(100, 6);
  });

  it('IBI · anualMesesConcretos con porPago · solo esos meses · sin prorrateo (regla #4)', () => {
    const c = compromisoBase({
      alias: 'IBI',
      patron: { tipo: 'anualMesesConcretos', mesesPago: [6, 11], diaPago: 15 },
      importe: { modo: 'porPago', importesPorPago: { 6: 500, 11: 500 } },
      variacion: { tipo: 'sinVariacion' },
    });
    const map = buildOpexPorMes([c], 2.5, aliasMap, START_YEAR, YEARS);

    expect(map.get('2026-06')!.total).toBeCloseTo(500, 6);
    expect(map.get('2026-11')!.total).toBeCloseTo(500, 6);
    expect(map.get('2026-01')).toBeUndefined();
    expect(map.get('2026-07')).toBeUndefined();
  });

  it('porPago sin importe para un mes del patrón NO revienta · se omite el evento', () => {
    const c = compromisoBase({
      patron: { tipo: 'anualMesesConcretos', mesesPago: [6, 11], diaPago: 15 },
      importe: { modo: 'porPago', importesPorPago: { 6: 500 } }, // falta el 11
      variacion: { tipo: 'sinVariacion' },
    });
    const map = buildOpexPorMes([c], 2.5, aliasMap, START_YEAR, YEARS);

    expect(map.get('2026-06')!.total).toBeCloseTo(500, 6);
    expect(map.get('2026-11')).toBeUndefined();
  });

  it('fechaFin corta la vigencia · un compromiso que termina no se cobra 20 años (fallo del adaptador viejo)', () => {
    const c = compromisoBase({
      fechaFin: '2028-06-30',
      variacion: { tipo: 'sinVariacion' },
    });
    const map = buildOpexPorMes([c], 2.5, aliasMap, START_YEAR, YEARS);

    expect(map.get('2028-06')!.total).toBeCloseTo(100, 6);
    expect(map.get('2028-07')).toBeUndefined();
    expect(map.get('2045-12')).toBeUndefined();
  });

  it('puntual dentro del horizonte · un solo mes · no se repite anualmente (fallo del adaptador viejo)', () => {
    const c = compromisoBase({
      alias: 'Derrama fachada',
      patron: { tipo: 'puntual', fecha: '2027-03-10', importe: 3000 },
      importe: { modo: 'fijo', importe: 3000 },
      variacion: { tipo: 'sinVariacion' },
    });
    const map = buildOpexPorMes([c], 2.5, aliasMap, START_YEAR, YEARS);

    expect(map.get('2027-03')!.total).toBeCloseTo(3000, 6);
    expect(map.get('2028-03')).toBeUndefined();
    expect([...map.keys()]).toHaveLength(1);
  });

  it('ignora compromisos personales · pausados · y agrega varios inmuebles con alias fallback', () => {
    const personal = compromisoBase({ id: 2, ambito: 'personal', personalDataId: 1, inmuebleId: undefined });
    const pausado = compromisoBase({ id: 3, estado: 'pausado' });
    const otroInmueble = compromisoBase({
      id: 4,
      inmuebleId: 99, // sin alias en el mapa
      alias: 'Seguro hogar',
      importe: { modo: 'fijo', importe: 30 },
      variacion: { tipo: 'sinVariacion' },
    });
    const map = buildOpexPorMes(
      [compromisoBase({ variacion: { tipo: 'sinVariacion' } }), personal, pausado, otroInmueble],
      2.5,
      aliasMap,
      START_YEAR,
      YEARS,
    );

    const enero = map.get('2026-01')!;
    expect(enero.total).toBeCloseTo(130, 6);
    expect(enero.desglose).toHaveLength(2);
    expect(enero.desglose.find((d) => d.propertyId === 99)!.propertyAlias).toBe('Inmueble #99');
  });
});
