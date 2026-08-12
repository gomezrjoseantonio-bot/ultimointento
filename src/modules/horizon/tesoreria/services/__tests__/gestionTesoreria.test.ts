import {
  liquidacionDe,
  comisionMensual,
  planificarGestionMes,
} from '../gestionTesoreria';
import type { Contract } from '../../../../../services/db';

const c = (over: Partial<Contract>): Contract & { id?: number } =>
  ({
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'A', apellidos: 'B', dni: 'X', telefono: '', email: '' },
    fechaInicio: '2026-01-01',
    fechaFin: '2026-12-31',
    rentaMensual: 500,
    diaPago: 1,
    estadoContrato: 'activo',
    ...over,
  }) as Contract & { id?: number };

const activo = () => true;

describe('liquidacionDe', () => {
  it('por defecto es agencia_neto', () => {
    expect(liquidacionDe(undefined)).toBe('agencia_neto');
    expect(liquidacionDe({ agenciaNif: 'B1', modeloIngreso: 'garantizada', honorarios: [] })).toBe('agencia_neto');
  });
  it('respeta propietario_bruto', () => {
    expect(
      liquidacionDe({ agenciaNif: 'B1', modeloIngreso: 'traspaso', honorarios: [], liquidacion: 'propietario_bruto' }),
    ).toBe('propietario_bruto');
  });
});

describe('comisionMensual', () => {
  it('garantizada · max(0, facturación − garantizado)', () => {
    const g = { agenciaNif: 'B1', modeloIngreso: 'garantizada' as const, honorarios: [], comisionTipo: 'garantizada' as const };
    expect(comisionMensual(g, 1800, 1350, 2)).toBe(450);
    expect(comisionMensual(g, 1000, 1350, 2)).toBe(0); // no negativa
  });
  it('porcentaje · % × facturación mensual', () => {
    const g = { agenciaNif: 'B1', modeloIngreso: 'traspaso' as const, honorarios: [], comisionTipo: 'porcentaje' as const, comisionPorcentaje: 10 };
    expect(comisionMensual(g, 1000, 0, 2)).toBe(100);
  });
  it('fees · fee habitación × nHab + fee fijo (mensual, sin ×12)', () => {
    const g = {
      agenciaNif: 'B1',
      modeloIngreso: 'traspaso' as const,
      comisionTipo: 'fees' as const,
      honorarios: [
        { concepto: 'fee_habitacion' as const, calculo: 'importe' as const, base: 'habitacion' as const, valor: 50, periodicidad: 'mensual' as const },
        { concepto: 'fee_fijo' as const, calculo: 'importe' as const, base: 'fijo' as const, valor: 20, periodicidad: 'mensual' as const },
      ],
    };
    // 50 × 4 hab + 20 fijo = 220 (mensual, NO anual)
    expect(comisionMensual(g, 2000, 0, 4)).toBe(220);
  });
});

describe('planificarGestionMes', () => {
  it('flujo A garantizada · suprime subcontratos, padre ingresa garantizado sin override, sin comisión', () => {
    const contracts = [
      c({ id: 1, rentaMensual: 1350, gestion: { agenciaNif: 'B1', modeloIngreso: 'garantizada', rentaGarantizada: 1350, honorarios: [], liquidacion: 'agencia_neto', comisionTipo: 'garantizada' } }),
      c({ id: 2, gestionPadreId: 1, rentaMensual: 600 }),
      c({ id: 3, gestionPadreId: 1, rentaMensual: 550 }),
    ];
    const plan = planificarGestionMes(contracts, activo);
    expect([...plan.suprimir].sort()).toEqual([2, 3]); // subcontratos suprimidos
    expect(plan.importePorContrato.has(1)).toBe(false); // padre usa su rentaMensual (garantizado)
    expect(plan.comisiones).toEqual([]); // comisión neteada
  });

  it('flujo A porcentaje · padre (rentaMensual 0) ingresa el neto forzado', () => {
    const contracts = [
      c({ id: 1, rentaMensual: 0, cuentaCobroId: 7, gestion: { agenciaNif: 'B1', modeloIngreso: 'traspaso', honorarios: [], liquidacion: 'agencia_neto', comisionTipo: 'porcentaje', comisionPorcentaje: 10 } }),
      c({ id: 2, gestionPadreId: 1, rentaMensual: 600 }),
      c({ id: 3, gestionPadreId: 1, rentaMensual: 400 }),
    ];
    const plan = planificarGestionMes(contracts, activo);
    expect([...plan.suprimir].sort()).toEqual([2, 3]);
    // facturación 1000 · comisión 100 · neto 900
    expect(plan.importePorContrato.get(1)).toBe(900);
    expect(plan.comisiones).toEqual([]);
  });

  it('flujo B · suprime al padre, subcontratos cobran (heredan cuenta), 1 gasto de comisión', () => {
    const contracts = [
      c({ id: 1, rentaMensual: 1350, cuentaCobroId: 7, inmuebleId: 9, gestion: { agenciaNif: 'B1', modeloIngreso: 'garantizada', rentaGarantizada: 1350, honorarios: [], liquidacion: 'propietario_bruto', comisionTipo: 'garantizada' } }),
      c({ id: 2, gestionPadreId: 1, rentaMensual: 900, cuentaCobroId: 0 }),
      c({ id: 3, gestionPadreId: 1, rentaMensual: 900, cuentaCobroId: 0 }),
    ];
    const plan = planificarGestionMes(contracts, activo);
    expect([...plan.suprimir]).toEqual([1]); // padre suprimido; hijos cobran
    expect(plan.cuentaPorContrato.get(2)).toBe(7); // heredan cuenta del padre
    expect(plan.cuentaPorContrato.get(3)).toBe(7);
    // facturación 1800 − garantizado 1350 = 450 comisión
    expect(plan.comisiones).toEqual([
      { padreId: 1, inmuebleId: 9, agenciaNif: 'B1', importe: 450 },
    ]);
  });

  it('flujo B · comisión 0 → no emite gasto', () => {
    const contracts = [
      c({ id: 1, rentaMensual: 1350, cuentaCobroId: 7, gestion: { agenciaNif: 'B1', modeloIngreso: 'garantizada', rentaGarantizada: 1350, honorarios: [], liquidacion: 'propietario_bruto', comisionTipo: 'garantizada' } }),
      c({ id: 2, gestionPadreId: 1, rentaMensual: 500, cuentaCobroId: 0 }),
    ];
    const plan = planificarGestionMes(contracts, activo);
    // facturación 500 < garantizado 1350 → comisión 0
    expect(plan.comisiones).toEqual([]);
  });

  it('solo considera subcontratos activos ese mes', () => {
    const soloId2Activo = (x: Contract) => (x as Contract & { id?: number }).id !== 3;
    const contracts = [
      c({ id: 1, rentaMensual: 0, cuentaCobroId: 7, gestion: { agenciaNif: 'B1', modeloIngreso: 'traspaso', honorarios: [], liquidacion: 'agencia_neto', comisionTipo: 'porcentaje', comisionPorcentaje: 10 } }),
      c({ id: 2, gestionPadreId: 1, rentaMensual: 600 }),
      c({ id: 3, gestionPadreId: 1, rentaMensual: 400 }),
    ];
    const plan = planificarGestionMes(contracts, soloId2Activo);
    expect(plan.suprimir.has(3)).toBe(false); // no activo → no lo toca el plan
    // solo hijo 2 activo · facturación 600 · comisión 60 · neto 540
    expect(plan.importePorContrato.get(1)).toBe(540);
  });

  it('captación (flujo B) · se suma a la comisión del mes solo para el hijo que empieza', () => {
    const contracts = [
      c({ id: 1, rentaMensual: 0, cuentaCobroId: 7, inmuebleId: 9, gestion: { agenciaNif: 'B1', modeloIngreso: 'traspaso', comisionTipo: 'fees', liquidacion: 'propietario_bruto', honorarios: [
        { concepto: 'fee_fijo', calculo: 'importe', base: 'fijo', valor: 20, periodicidad: 'mensual' },
        { concepto: 'captacion', calculo: 'importe', base: 'fijo', valor: 150, periodicidad: 'por_inquilino_nuevo' },
      ] } }),
      c({ id: 2, gestionPadreId: 1, rentaMensual: 600, cuentaCobroId: 0 }),
      c({ id: 3, gestionPadreId: 1, rentaMensual: 400, cuentaCobroId: 0 }),
    ];
    // Solo el hijo 2 empieza este mes.
    const plan = planificarGestionMes(contracts, activo, (x) => (x as Contract & { id?: number }).id === 2);
    // comisión recurrente (fee_fijo 20) + captación 150 (solo id2) = 170
    expect(plan.comisiones).toEqual([
      { padreId: 1, inmuebleId: 9, agenciaNif: 'B1', importe: 170 },
    ]);
  });

  it('captación (flujo A) · reduce el neto que ingresa el padre el mes del alta', () => {
    const contracts = [
      c({ id: 1, rentaMensual: 0, cuentaCobroId: 7, gestion: { agenciaNif: 'B1', modeloIngreso: 'traspaso', comisionTipo: 'porcentaje', comisionPorcentaje: 10, liquidacion: 'agencia_neto', honorarios: [
        { concepto: 'captacion', calculo: 'importe', base: 'fijo', valor: 150, periodicidad: 'por_inquilino_nuevo' },
      ] } }),
      c({ id: 2, gestionPadreId: 1, rentaMensual: 600 }),
      c({ id: 3, gestionPadreId: 1, rentaMensual: 400 }),
    ];
    const plan = planificarGestionMes(contracts, activo, (x) => (x as Contract & { id?: number }).id === 2);
    // facturación 1000 · comisión 10% = 100 · captación 150 (id2) → neto 1000 − 100 − 150 = 750
    expect(plan.importePorContrato.get(1)).toBe(750);
  });

  it('sin predicado de inicio · no imputa captación (comportamiento previo)', () => {
    const contracts = [
      c({ id: 1, rentaMensual: 0, cuentaCobroId: 7, inmuebleId: 9, gestion: { agenciaNif: 'B1', modeloIngreso: 'traspaso', comisionTipo: 'fees', liquidacion: 'propietario_bruto', honorarios: [
        { concepto: 'captacion', calculo: 'importe', base: 'fijo', valor: 150, periodicidad: 'por_inquilino_nuevo' },
      ] } }),
      c({ id: 2, gestionPadreId: 1, rentaMensual: 600, cuentaCobroId: 0 }),
    ];
    const plan = planificarGestionMes(contracts, activo); // sin iniciaEnMes
    expect(plan.comisiones).toEqual([]); // fee recurrente 0 + captación 0
  });

  it('contrato normal (sin gestión) no se ve afectado', () => {
    const contracts = [c({ id: 1, rentaMensual: 500 })];
    const plan = planificarGestionMes(contracts, activo);
    expect(plan.suprimir.size).toBe(0);
    expect(plan.importePorContrato.size).toBe(0);
    expect(plan.comisiones).toEqual([]);
  });
});
