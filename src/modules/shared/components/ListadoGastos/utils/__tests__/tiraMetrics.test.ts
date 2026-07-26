import { computeTiraMetrics, nombreMes } from '../tiraMetrics';
import type { CompromisoRecurrente } from '../../../../../../types/compromisosRecurrentes';

const base = (over: Partial<CompromisoRecurrente>): CompromisoRecurrente =>
  ({
    id: 1,
    ambito: 'personal',
    alias: 'Gasto',
    tipo: 'suscripcion',
    proveedor: { nombre: 'P' },
    patron: { tipo: 'mensualDiaFijo', dia: 1 },
    importe: { modo: 'fijo', importe: 100 },
    cuentaCargo: 0,
    conceptoBancario: 'P',
    metodoPago: 'domiciliacion',
    categoria: 'personal.suscripciones',
    bolsaPresupuesto: 'deseos',
    responsable: 'titular',
    fechaInicio: '2020-01-01',
    estado: 'activo',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as unknown as CompromisoRecurrente;

describe('computeTiraMetrics · §3.1', () => {
  it('coste anual = suma de los 12 meses de los activos', () => {
    const m = computeTiraMetrics([base({ importe: { modo: 'fijo', importe: 100 } } as Partial<CompromisoRecurrente>)], 2026);
    expect(m.costeAnual).toBeCloseTo(1200, 6); // 100 × 12
    expect(m.vigentes).toBe(1);
  });

  it('un gasto anual solo suma en su mes y ese es el mes más cargado', () => {
    const mensual = base({ id: 1, importe: { modo: 'fijo', importe: 50 } } as Partial<CompromisoRecurrente>);
    const anual = base({
      id: 2,
      patron: { tipo: 'anualMesesConcretos', mesesPago: [6], diaPago: 1 },
      importe: { modo: 'fijo', importe: 900 },
    } as Partial<CompromisoRecurrente>);
    const m = computeTiraMetrics([mensual, anual], 2026);
    // junio (month0=5): 50 + 900 = 950 · resto 50 → junio es el más cargado.
    expect(m.mesMasCargado).toEqual({ month0: 5, total: 950 });
  });

  it('un gasto sin importe NO suma al coste pero SÍ se cuenta en sinImporte', () => {
    const conImporte = base({ id: 1 } as Partial<CompromisoRecurrente>);
    const sinImporte = base({ id: 2, importe: undefined } as unknown as Partial<CompromisoRecurrente>);
    const m = computeTiraMetrics([conImporte, sinImporte], 2026);
    expect(m.sinImporte).toBe(1);
    expect(m.costeAnual).toBeCloseTo(1200, 6); // solo el que tiene importe
    expect(m.vigentes).toBe(2); // ambos activos
  });

  it('los no-activos no cuentan como vigentes ni suman coste', () => {
    const activo = base({ id: 1 } as Partial<CompromisoRecurrente>);
    const preparado = base({ id: 2, estado: 'preparado' } as Partial<CompromisoRecurrente>);
    const m = computeTiraMetrics([activo, preparado], 2026);
    expect(m.vigentes).toBe(1);
    expect(m.costeAnual).toBeCloseTo(1200, 6);
  });

  it('sin ninguna cifra, mesMasCargado es null', () => {
    const m = computeTiraMetrics([], 2026);
    expect(m.mesMasCargado).toBeNull();
    expect(m.costeAnual).toBe(0);
  });

  it('nombreMes', () => {
    expect(nombreMes(0)).toBe('enero');
    expect(nombreMes(5)).toBe('junio');
    expect(nombreMes(11)).toBe('diciembre');
  });
});
