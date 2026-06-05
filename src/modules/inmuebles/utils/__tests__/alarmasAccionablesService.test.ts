import { generarAlarmas } from '../alarmasAccionablesService';
import type { Contract, Property } from '../../../../services/db';

const HOY = new Date('2026-06-15T00:00:00Z');

const prop = (over: Partial<Property>): Property =>
  ({ id: 1, alias: 'A', bedrooms: 1, state: 'activo', modoExplotacion: 'piso_completo', ...over } as Property);

const contrato = (over: Partial<Contract>): Contract =>
  ({
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'Juan', apellidos: 'Calvo', dni: '', telefono: '', email: '' },
    fechaInicio: '2025-01-01',
    fechaFin: '2099-12-31',
    rentaMensual: 800,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 800,
    fianzaEstado: 'retenida',
    cuentaCobroId: 0,
    estadoContrato: 'activo',
    documentoFirmado: true,
    ...over,
  }) as Contract;

describe('generarAlarmas · § 1.6 bloque 4', () => {
  it('NUNCA emite la alarma "unidades libres" (era informativa, mal calculada)', () => {
    const props = [prop({ id: 1 }), prop({ id: 2, alias: 'B' })]; // B vacío
    const cs = [contrato({ id: 1, inmuebleId: 1 })];
    const a = generarAlarmas(cs, props, HOY);
    expect(a.every((x) => !/unidades libres/i.test(x.titulo))).toBe(true);
  });

  it('vencimiento sin renovación · vigente que vence en ≤30 días sin próximo', () => {
    const a = generarAlarmas(
      [contrato({ id: 1, fechaInicio: '2025-01-01', fechaFin: '2026-06-30' })],
      [prop({})],
      HOY,
    );
    expect(a).toHaveLength(1);
    expect(a[0].tipo).toBe('vencimiento');
    expect(a[0].icono).toBe('clock');
    expect(a[0].titulo).toMatch(/vence en \d+ días/);
  });

  it('vencimiento cubierto por un próximo en la misma unidad → no alarma', () => {
    const a = generarAlarmas(
      [
        contrato({ id: 1, fechaInicio: '2025-01-01', fechaFin: '2026-06-30' }),
        contrato({ id: 2, fechaInicio: '2026-07-01', fechaFin: '2028-01-01' }), // próximo, misma unidad
      ],
      [prop({})],
      HOY,
    );
    expect(a.filter((x) => x.tipo === 'vencimiento')).toHaveLength(0);
  });

  it('vigente sin firmar hace > 2 meses → alarma sin_firma', () => {
    const a = generarAlarmas(
      [contrato({ id: 1, documentoFirmado: false, fechaInicio: '2026-01-01', fechaFin: '2099-12-31' })],
      [prop({})],
      HOY,
    );
    expect(a.some((x) => x.tipo === 'sin_firma' && x.icono === 'file-warning')).toBe(true);
  });

  it('inmueble vacío > 3 meses → alarma vacio', () => {
    const a = generarAlarmas(
      [contrato({ id: 1, fechaInicio: '2024-01-01', fechaFin: '2025-12-31' })], // finalizó hace ~5 meses
      [prop({})],
      HOY,
    );
    expect(a.some((x) => x.tipo === 'vacio' && x.icono === 'alert-triangle')).toBe(true);
  });

  it('rotación alta · misma unidad con 3+ contratos en 12 meses', () => {
    const cs = [
      contrato({ id: 1, fechaInicio: '2025-08-01', fechaFin: '2025-11-30' }),
      contrato({ id: 2, fechaInicio: '2025-12-01', fechaFin: '2026-02-28' }),
      contrato({ id: 3, fechaInicio: '2026-03-01', fechaFin: '2026-05-31' }),
    ];
    const a = generarAlarmas(cs, [prop({})], HOY);
    expect(a.some((x) => x.tipo === 'rotacion' && x.icono === 'rotate-ccw')).toBe(true);
  });

  it('nada accionable → lista vacía (el empty state lo pinta la UI)', () => {
    const a = generarAlarmas(
      [contrato({ id: 1, fechaInicio: '2025-01-01', fechaFin: '2099-12-31' })],
      [prop({})],
      HOY,
    );
    expect(a).toHaveLength(0);
  });

  it('respeta el máximo de 8 alarmas', () => {
    const props = Array.from({ length: 12 }, (_, i) => prop({ id: i + 1, alias: `Inm ${i + 1}` }));
    const cs = props.map((p, i) =>
      contrato({ id: i + 1, inmuebleId: p.id, fechaInicio: '2025-01-01', fechaFin: '2026-06-30' }),
    );
    const a = generarAlarmas(cs, props, HOY);
    expect(a.length).toBeLessThanOrEqual(8);
  });
});
