import {
  esRentaDeContrato,
  eventosRentaDeContrato,
  estaCobrado,
  calcularEstadoCobroContrato,
  resumenCobrosContrato,
  calcularEstadoCobroPorContrato,
} from '../estadoCobroContratoService';
import type { Contract, TreasuryEvent } from '../../../../services/db';

const HOY = new Date('2026-06-15T00:00:00Z');

const iso = (y: number, m: number, d: number): string =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const contrato = (over: Partial<Contract>): Contract =>
  ({
    id: 1,
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'Real', apellidos: 'Inquilino', dni: 'X', telefono: '', email: '' },
    fechaInicio: '2025-01-01',
    fechaFin: '2099-12-31',
    rentaMensual: 1000,
    diaPago: 1,
    margenGraciaDias: 5,
    estadoContrato: 'activo',
    ...over,
  }) as Contract;

const ev = (over: Partial<TreasuryEvent>): TreasuryEvent =>
  ({
    type: 'income',
    amount: 1000,
    predictedDate: iso(2026, 6, 1),
    description: 'Renta',
    sourceType: 'contract',
    sourceId: 1,
    contratoId: 1,
    status: 'predicted',
    ...over,
  }) as TreasuryEvent;

describe('esRentaDeContrato · enlace evento ↔ contrato', () => {
  it('enlaza por contratoId', () => {
    expect(esRentaDeContrato(ev({ contratoId: 1, sourceId: undefined, sourceType: undefined }), 1)).toBe(true);
  });
  it('enlaza por sourceType contract/contrato + sourceId (legacy)', () => {
    expect(esRentaDeContrato(ev({ contratoId: undefined, sourceType: 'contrato', sourceId: 1 }), 1)).toBe(true);
    expect(esRentaDeContrato(ev({ contratoId: undefined, sourceType: 'contract', sourceId: 1 }), 1)).toBe(true);
  });
  it('excluye gastos (no income)', () => {
    expect(esRentaDeContrato(ev({ type: 'expense' }), 1)).toBe(false);
  });
  it('excluye eventos descartados', () => {
    expect(esRentaDeContrato(ev({ descartado: true }), 1)).toBe(false);
  });
  it('excluye eventos de otro contrato', () => {
    expect(esRentaDeContrato(ev({ contratoId: 2, sourceId: 2 }), 1)).toBe(false);
  });
});

describe('estaCobrado', () => {
  it('confirmed y executed → cobrado; predicted → no', () => {
    expect(estaCobrado(ev({ status: 'confirmed' }))).toBe(true);
    expect(estaCobrado(ev({ status: 'executed' }))).toBe(true);
    expect(estaCobrado(ev({ status: 'predicted' }))).toBe(false);
  });
});

describe('calcularEstadoCobroContrato', () => {
  it('sin eventos → sin_datos (no se inventa)', () => {
    expect(calcularEstadoCobroContrato(contrato({}), [], HOY)).toBe('sin_datos');
  });

  it('renta futura (no vencida) → al_dia', () => {
    const events = [ev({ predictedDate: iso(2026, 7, 1), status: 'predicted' })];
    expect(calcularEstadoCobroContrato(contrato({}), events, HOY)).toBe('al_dia');
  });

  it('renta vencida y cobrada → al_dia', () => {
    const events = [ev({ predictedDate: iso(2026, 6, 1), status: 'executed', actualDate: iso(2026, 6, 2) })];
    expect(calcularEstadoCobroContrato(contrato({}), events, HOY)).toBe('al_dia');
  });

  it('renta vencida hace 3 días, sin cobrar, gracia 5 → pendiente', () => {
    const events = [ev({ predictedDate: iso(2026, 6, 12), status: 'predicted' })];
    expect(calcularEstadoCobroContrato(contrato({ margenGraciaDias: 5 }), events, HOY)).toBe('pendiente');
  });

  it('renta vencida hace 14 días, sin cobrar, gracia 5 → impago', () => {
    const events = [ev({ predictedDate: iso(2026, 6, 1), status: 'predicted' })];
    expect(calcularEstadoCobroContrato(contrato({ margenGraciaDias: 5 }), events, HOY)).toBe('impago');
  });

  it('impago tiene prioridad sobre pendiente', () => {
    const events = [
      ev({ predictedDate: iso(2026, 6, 1), status: 'predicted' }), // impago (14 d)
      ev({ predictedDate: iso(2026, 6, 13), status: 'predicted' }), // pendiente (2 d)
    ];
    expect(calcularEstadoCobroContrato(contrato({ margenGraciaDias: 5 }), events, HOY)).toBe('impago');
  });

  it('gracia 0 · vencida ayer sin cobrar → impago', () => {
    const events = [ev({ predictedDate: iso(2026, 6, 14), status: 'predicted' })];
    expect(calcularEstadoCobroContrato(contrato({ margenGraciaDias: 0 }), events, HOY)).toBe('impago');
  });

  it('meses previos cobrados + mes actual futuro → al_dia', () => {
    const events = [
      ev({ predictedDate: iso(2026, 4, 1), status: 'executed', actualDate: iso(2026, 4, 1) }),
      ev({ predictedDate: iso(2026, 5, 1), status: 'executed', actualDate: iso(2026, 5, 2) }),
      ev({ predictedDate: iso(2026, 7, 1), status: 'predicted' }),
    ];
    expect(calcularEstadoCobroContrato(contrato({}), events, HOY)).toBe('al_dia');
  });

  it('contrato sin id → sin_datos', () => {
    expect(calcularEstadoCobroContrato(contrato({ id: undefined }), [ev({})], HOY)).toBe('sin_datos');
  });
});

describe('resumenCobrosContrato', () => {
  it('devuelve estado + eventos ordenados por fecha descendente', () => {
    const events = [
      ev({ predictedDate: iso(2026, 4, 1), status: 'executed', actualDate: iso(2026, 4, 1), actualAmount: 1000 }),
      ev({ predictedDate: iso(2026, 6, 1), status: 'predicted' }),
      ev({ predictedDate: iso(2026, 5, 1), status: 'executed', actualDate: iso(2026, 5, 2) }),
    ];
    const r = resumenCobrosContrato(contrato({ margenGraciaDias: 5 }), events, HOY);
    expect(r.estado).toBe('impago'); // junio vencida sin cobrar (14 d > gracia)
    expect(r.eventos.map((e) => e.fecha)).toEqual([iso(2026, 6, 1), iso(2026, 5, 2), iso(2026, 4, 1)]);
    expect(r.eventos[0]).toMatchObject({ cobrado: false, vencido: true, importe: 1000 });
    expect(r.eventos[1]).toMatchObject({ cobrado: true, vencido: true });
  });

  it('sin eventos → estado sin_datos y lista vacía', () => {
    const r = resumenCobrosContrato(contrato({}), [], HOY);
    expect(r.estado).toBe('sin_datos');
    expect(r.eventos).toEqual([]);
  });
});

describe('calcularEstadoCobroPorContrato', () => {
  it('mapea cada contrato a su estado', () => {
    const c1 = contrato({ id: 1 });
    const c2 = contrato({ id: 2, inmuebleId: 2 });
    const events = [
      ev({ contratoId: 1, sourceId: 1, predictedDate: iso(2026, 6, 1), status: 'predicted' }), // impago
      ev({ contratoId: 2, sourceId: 2, predictedDate: iso(2026, 6, 1), status: 'executed', actualDate: iso(2026, 6, 1) }), // al_dia
    ];
    const map = calcularEstadoCobroPorContrato([c1, c2], events, HOY);
    expect(map.get(1)).toBe('impago');
    expect(map.get(2)).toBe('al_dia');
  });

  it('eventosRentaDeContrato filtra por contrato', () => {
    const events = [ev({ contratoId: 1, sourceId: 1 }), ev({ contratoId: 2, sourceId: 2 })];
    expect(eventosRentaDeContrato(events, 1)).toHaveLength(1);
  });
});
