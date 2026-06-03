// REORG Contratos · Commit 7 · tests del servicio de Análisis (ranking + alarmas).
import { rankingPorInmueble, alarmasContratos } from '../analisisContratosService';
import type { Contract, Property } from '../../../../services/db';

const HOY = new Date('2026-06-03');

const contrato = (over: Partial<Contract>): Contract =>
  ({
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'T', apellidos: '', dni: '', telefono: '', email: '' },
    fechaInicio: '2025-01-01',
    fechaFin: '2099-12-31',
    rentaMensual: 1000,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 1000,
    fianzaEstado: 'retenida',
    cuentaCobroId: 0,
    estadoContrato: 'activo',
    ...over,
  }) as Contract;

const prop = (over: Partial<Property>): Property =>
  ({ id: 1, alias: 'X', bedrooms: 1, state: 'activo', modoExplotacion: 'piso_completo', ...over } as Property);

describe('rankingPorInmueble', () => {
  it('ordena por renta anual desc y calcula ocupación; ignora finalizados', () => {
    const props = [
      prop({ id: 1, alias: 'FA32', bedrooms: 5, modoExplotacion: 'por_habitaciones' }),
      prop({ id: 2, alias: 'Sant Joan' }),
    ];
    const cs = [
      contrato({ id: 1, inmuebleId: 2, rentaMensual: 500, fechaInicio: '2025-01-01', fechaFin: '2027-01-01' }), // vigente 6000/año
      contrato({ id: 2, inmuebleId: 1, rentaMensual: 300, fechaInicio: '2025-01-01', fechaFin: '2027-01-01' }), // vigente 3600/año
      contrato({ id: 3, inmuebleId: 1, rentaMensual: 999, fechaInicio: '2022-01-01', fechaFin: '2023-01-01' }), // finalizado, no cuenta
    ];
    const r = rankingPorInmueble(cs, props, HOY);
    expect(r.map((x) => x.alias)).toEqual(['Sant Joan', 'FA32']);
    expect(r[0].rentaAnual).toBe(6000);
    expect(r[1].rentaAnual).toBe(3600);
    expect(r[1].ocupacionPct).toBe(20); // 1 de 5 habitaciones
  });
});

describe('alarmasContratos', () => {
  it('prioriza libres > vence30 > vence30-90 > proximos · máx 4', () => {
    const props = [prop({ id: 1, alias: 'A' }), prop({ id: 2, alias: 'B' })];
    const cs = [
      contrato({ id: 1, inmuebleId: 1, fechaInicio: '2025-01-01', fechaFin: '2026-06-20' }), // vence en 17d
      contrato({ id: 2, inmuebleId: 1, fechaInicio: '2026-07-10', fechaFin: '2028-01-01' }), // proximo
      // inmueble 2 sin contrato vigente → libre
    ];
    const a = alarmasContratos(cs, props, HOY);
    expect(a.length).toBeLessThanOrEqual(4);
    expect(a[0].id).toBe('libres');
    expect(a.some((x) => x.id === 'vence30')).toBe(true);
    expect(a.some((x) => x.id === 'proximos')).toBe(true);
  });

  it('sin nada accionable → item "todo en orden"', () => {
    const props = [prop({ id: 1, alias: 'A' })];
    const cs = [contrato({ id: 1, inmuebleId: 1, fechaInicio: '2025-01-01', fechaFin: '2099-12-31' })];
    const a = alarmasContratos(cs, props, HOY);
    expect(a).toHaveLength(1);
    expect(a[0].id).toBe('ok');
    expect(a[0].tono).toBe('ok');
  });
});
