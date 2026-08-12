import {
  subcontratosDe,
  mesesSolapeEnAño,
  resumenFacturacion,
  ejerciciosConActividad,
} from '../facturacionGestionService';
import type { Contract } from '../../../../services/db';

const c = (over: Partial<Contract>): Contract =>
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
  }) as Contract;

const padre = (over: Partial<Contract> = {}): Contract & { id: number } =>
  ({
    ...c({
      id: 1,
      rentaMensual: 1350,
      fechaInicio: '2026-01-01',
      fechaFin: '2029-01-01',
      gestion: { agenciaNif: 'B1', modeloIngreso: 'garantizada', rentaGarantizada: 1350, honorarios: [] },
    }),
    ...over,
  }) as Contract & { id: number };

describe('facturacionGestionService', () => {
  it('subcontratosDe · filtra por gestionPadreId', () => {
    const contracts = [
      padre(),
      c({ id: 2, gestionPadreId: 1 }),
      c({ id: 3, gestionPadreId: 1 }),
      c({ id: 4, gestionPadreId: 99 }),
      c({ id: 5 }),
    ];
    expect(subcontratosDe(1, contracts).map((x) => x.id)).toEqual([2, 3]);
  });

  it('mesesSolapeEnAño · año completo = 12, parcial prorratea, fuera = 0', () => {
    expect(mesesSolapeEnAño(c({ fechaInicio: '2026-01-01', fechaFin: '2026-12-31' }), 2026)).toBe(12);
    expect(mesesSolapeEnAño(c({ fechaInicio: '2026-07-01', fechaFin: '2026-12-31' }), 2026)).toBe(6);
    expect(mesesSolapeEnAño(c({ fechaInicio: '2025-01-01', fechaFin: '2025-12-31' }), 2026)).toBe(0);
    // Indefinido → hasta fin de año.
    expect(mesesSolapeEnAño(c({ fechaInicio: '2026-10-01', fechaFin: '2099-12-31' }), 2026)).toBe(3);
  });

  it('facturación = Σ subcontratos; comisión = facturación − garantizado', () => {
    const contracts = [
      padre(),
      // 2 habitaciones todo el año: 600×12 + 550×12 = 7200 + 6600 = 13800
      c({ id: 2, gestionPadreId: 1, rentaMensual: 600, fechaInicio: '2026-01-01', fechaFin: '2026-12-31' }),
      c({ id: 3, gestionPadreId: 1, rentaMensual: 550, fechaInicio: '2026-01-01', fechaFin: '2026-12-31' }),
    ];
    const r = resumenFacturacion(padre(), contracts, 2026);
    expect(r.nSubcontratos).toBe(2);
    expect(r.facturacion).toBe(13800);
    expect(r.garantizado).toBe(1350 * 12); // 16200
    expect(r.comision).toBe(0); // garantizado > facturación → comisión no negativa
    expect(r.neto).toBe(13800); // facturación − comisión
  });

  it('comisión por porcentaje · % × facturación', () => {
    const p = padre({
      gestion: {
        agenciaNif: 'B1',
        modeloIngreso: 'traspaso',
        honorarios: [],
        comisionTipo: 'porcentaje',
        comisionPorcentaje: 10,
      },
    });
    const contracts = [
      p,
      c({ id: 2, gestionPadreId: 1, rentaMensual: 600, fechaInicio: '2026-01-01', fechaFin: '2026-12-31' }),
      c({ id: 3, gestionPadreId: 1, rentaMensual: 400, fechaInicio: '2026-01-01', fechaFin: '2026-12-31' }),
    ];
    const r = resumenFacturacion(p, contracts, 2026);
    expect(r.facturacion).toBe(12000); // 1000×12
    expect(r.comision).toBe(1200); // 10%
    expect(r.neto).toBe(10800);
  });

  it('comisión por fees · fee por habitación + fee fijo', () => {
    const p = padre({
      gestion: {
        agenciaNif: 'B1',
        modeloIngreso: 'traspaso',
        comisionTipo: 'fees',
        honorarios: [
          { concepto: 'fee_habitacion', calculo: 'importe', base: 'habitacion', valor: 50, periodicidad: 'mensual' },
          { concepto: 'fee_fijo', calculo: 'importe', base: 'fijo', valor: 20, periodicidad: 'mensual' },
        ],
      },
    });
    const contracts = [
      p,
      c({ id: 2, gestionPadreId: 1, rentaMensual: 600, fechaInicio: '2026-01-01', fechaFin: '2026-12-31' }),
      c({ id: 3, gestionPadreId: 1, rentaMensual: 400, fechaInicio: '2026-01-01', fechaFin: '2026-12-31' }),
    ];
    const r = resumenFacturacion(p, contracts, 2026);
    // fee_habitacion 50 × 2 hab × 12 = 1200 · fee_fijo 20 × 12 = 240 → 1440
    expect(r.comision).toBe(1440);
    expect(r.neto).toBe(12000 - 1440);
  });

  it('comisión positiva cuando la facturación supera el garantizado', () => {
    const contracts = [
      padre(),
      c({ id: 2, gestionPadreId: 1, rentaMensual: 900, fechaInicio: '2026-01-01', fechaFin: '2026-12-31' }),
      c({ id: 3, gestionPadreId: 1, rentaMensual: 900, fechaInicio: '2026-01-01', fechaFin: '2026-12-31' }),
    ];
    const r = resumenFacturacion(padre(), contracts, 2026);
    expect(r.facturacion).toBe(21600); // 1800×12
    expect(r.garantizado).toBe(16200);
    expect(r.comision).toBe(5400);
  });

  it('sin subcontratos anexados · facturación 0', () => {
    const r = resumenFacturacion(padre(), [padre()], 2026);
    expect(r.nSubcontratos).toBe(0);
    expect(r.facturacion).toBe(0);
    expect(r.comision).toBe(0);
  });

  describe('ejerciciosConActividad', () => {
    it('reúne los años con solape de los subcontratos + el año en curso, desc', () => {
      const contracts = [
        padre(),
        c({ id: 2, gestionPadreId: 1, fechaInicio: '2024-06-01', fechaFin: '2024-12-31' }),
        c({ id: 3, gestionPadreId: 1, fechaInicio: '2025-01-01', fechaFin: '2025-12-31' }),
      ];
      expect(ejerciciosConActividad(padre(), contracts, 2026)).toEqual([2026, 2025, 2024]);
    });

    it('incluye siempre el año en curso aunque no haya actividad', () => {
      expect(ejerciciosConActividad(padre(), [padre()], 2026)).toEqual([2026]);
    });

    it('un subcontrato indefinido no genera años futuros más allá del actual', () => {
      const contracts = [
        padre(),
        c({ id: 2, gestionPadreId: 1, fechaInicio: '2025-03-01', fechaFin: '2099-12-31' }),
      ];
      expect(ejerciciosConActividad(padre(), contracts, 2026)).toEqual([2026, 2025]);
    });

    it('no repite años cuando varios subcontratos solapan el mismo ejercicio', () => {
      const contracts = [
        padre(),
        c({ id: 2, gestionPadreId: 1, fechaInicio: '2025-01-01', fechaFin: '2025-12-31' }),
        c({ id: 3, gestionPadreId: 1, fechaInicio: '2025-06-01', fechaFin: '2025-12-31' }),
      ];
      expect(ejerciciosConActividad(padre(), contracts, 2025)).toEqual([2025]);
    });
  });
});
