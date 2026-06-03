// REORG Contratos · Commit 3 · tests del estado efectivo, filtrado, unidades y KPIs.
import {
  getEstadoEfectivo,
  diasHastaFin,
  filtrarPorEstadoEfectivo,
  calcularUnidadesArrendables,
} from '../estadoEfectivoService';
import { calcularKpisContratos } from '../kpisContratosService';
import type { Contract, Property } from '../../../../services/db';

const HOY = new Date('2026-06-03'); // medianoche UTC

const contrato = (over: Partial<Contract>): Contract =>
  ({
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'Test', apellidos: '', dni: '', telefono: '', email: '' },
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
    status: 'active',
    documents: [],
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...over,
  }) as Contract;

describe('getEstadoEfectivo · 6 escenarios mínimo', () => {
  it('1 · vigente · inicio pasado, fin futuro', () => {
    expect(getEstadoEfectivo(contrato({ fechaInicio: '2025-01-01', fechaFin: '2027-01-01' }), HOY)).toBe('vigente');
  });

  it('2 · proximo · fechaInicio futura', () => {
    expect(getEstadoEfectivo(contrato({ fechaInicio: '2026-07-01', fechaFin: '2028-07-01' }), HOY)).toBe('proximo');
  });

  it('3 · finalizado · fechaFin pasada (caso Rentila)', () => {
    expect(getEstadoEfectivo(contrato({ fechaInicio: '2022-01-01', fechaFin: '2023-04-20' }), HOY)).toBe('finalizado');
  });

  it('4 · fechaFin null/sentinel 2099 → vigente (nunca finalizado)', () => {
    expect(getEstadoEfectivo(contrato({ fechaInicio: '2020-01-01', fechaFin: '2099-12-31' }), HOY)).toBe('vigente');
    expect(getEstadoEfectivo(contrato({ fechaInicio: '2020-01-01', fechaFin: '' as any }), HOY)).toBe('vigente');
  });

  it('5 · fechaFin futura → vigente', () => {
    expect(getEstadoEfectivo(contrato({ fechaInicio: '2025-06-01', fechaFin: '2026-12-31' }), HOY)).toBe('vigente');
  });

  it('6 · fechaInicio futura con fin más lejano → proximo', () => {
    expect(getEstadoEfectivo(contrato({ fechaInicio: '2026-06-15', fechaFin: '2030-06-15' }), HOY)).toBe('proximo');
  });

  it('borde · fechaInicio === hoy → vigente', () => {
    expect(getEstadoEfectivo(contrato({ fechaInicio: '2026-06-03', fechaFin: '2027-06-03' }), HOY)).toBe('vigente');
  });

  it('borde · fechaFin === hoy → vigente (último día contado)', () => {
    expect(getEstadoEfectivo(contrato({ fechaInicio: '2025-06-03', fechaFin: '2026-06-03' }), HOY)).toBe('vigente');
  });
});

describe('diasHastaFin', () => {
  it('positivo para fin futuro', () => {
    expect(diasHastaFin(contrato({ fechaFin: '2026-07-03' }), HOY)).toBe(30);
  });
  it('null para indefinido (2099)', () => {
    expect(diasHastaFin(contrato({ fechaFin: '2099-12-31' }), HOY)).toBeNull();
  });
  it('negativo para fin pasado (no se filtra aquí · el consumidor decide)', () => {
    expect(diasHastaFin(contrato({ fechaFin: '2023-04-20' }), HOY)).toBeLessThan(0);
  });
});

describe('filtrarPorEstadoEfectivo · solo retorna el estado pedido', () => {
  const cs = [
    contrato({ id: 1, fechaInicio: '2025-01-01', fechaFin: '2027-01-01' }), // vigente
    contrato({ id: 2, fechaInicio: '2026-07-01', fechaFin: '2028-07-01' }), // proximo
    contrato({ id: 3, fechaInicio: '2022-01-01', fechaFin: '2023-04-20' }), // finalizado
    contrato({ id: 4, fechaInicio: '2020-01-01', fechaFin: '2099-12-31' }), // vigente (indef)
  ];
  it('vigentes', () => {
    expect(filtrarPorEstadoEfectivo(cs, 'vigente', HOY).map((c) => c.id)).toEqual([1, 4]);
  });
  it('proximos', () => {
    expect(filtrarPorEstadoEfectivo(cs, 'proximo', HOY).map((c) => c.id)).toEqual([2]);
  });
  it('historico', () => {
    expect(filtrarPorEstadoEfectivo(cs, 'finalizado', HOY).map((c) => c.id)).toEqual([3]);
  });
});

describe('calcularUnidadesArrendables', () => {
  const prop = (over: Partial<Property>): Property => ({ id: 1, bedrooms: 1, state: 'activo', ...(over as any) });
  it('piso completo = 1 · por habitaciones = N · excluye no activos', () => {
    const props = [
      prop({ id: 1, modoExplotacion: 'piso_completo' }),
      prop({ id: 2, modoExplotacion: 'por_habitaciones', bedrooms: 5 }),
      prop({ id: 3, modoExplotacion: 'por_habitaciones', bedrooms: 4, explotacion: { unidadesArrendables: 3 } as any }),
      prop({ id: 4, modoExplotacion: 'piso_completo', state: 'vendido' }), // excluido
    ];
    expect(calcularUnidadesArrendables(props)).toBe(1 + 5 + 3); // = 9
  });
});

describe('calcularKpisContratos', () => {
  it('vigentes, ocupación, renta y vencen-30 con sub del inmueble', () => {
    const props: Property[] = [
      { id: 1, alias: 'FA32', bedrooms: 5, state: 'activo', modoExplotacion: 'por_habitaciones' } as any,
      { id: 2, alias: "Sant Joan", bedrooms: 1, state: 'activo', modoExplotacion: 'piso_completo' } as any,
    ];
    const cs = [
      contrato({ id: 1, inmuebleId: 1, fechaInicio: '2025-01-01', fechaFin: '2027-01-01', rentaMensual: 320 }),
      contrato({ id: 2, inmuebleId: 1, fechaInicio: '2022-01-01', fechaFin: '2023-04-20', rentaMensual: 999 }), // finalizado → no cuenta
      contrato({ id: 3, inmuebleId: 2, fechaInicio: '2025-06-01', fechaFin: '2026-06-20', rentaMensual: 420 }), // vence en 17d
    ];
    const k = calcularKpisContratos(cs, props, HOY);
    expect(k.vigentes).toBe(2);
    expect(k.unidadesArrendables).toBe(6); // 5 + 1
    expect(k.ocupacion).toBe(33); // round(2/6*100)
    expect(k.rentaMensual).toBe(740);
    expect(k.rentaAnual).toBe(8880);
    expect(k.venceProx30.count).toBe(1);
    expect(k.venceProx30.firstName).toBe('Sant Joan');
  });

  it('sin vencimientos → sub "sin vencimientos"', () => {
    const props: Property[] = [{ id: 1, alias: 'X', bedrooms: 1, state: 'activo', modoExplotacion: 'piso_completo' } as any];
    const cs = [contrato({ id: 1, inmuebleId: 1, fechaInicio: '2025-01-01', fechaFin: '2099-12-31' })];
    const k = calcularKpisContratos(cs, props, HOY);
    expect(k.venceProx30.count).toBe(0);
    expect(k.venceProx30.firstName).toBe('sin vencimientos');
  });
});
