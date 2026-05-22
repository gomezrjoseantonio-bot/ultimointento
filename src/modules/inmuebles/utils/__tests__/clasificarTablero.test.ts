import {
  clasificarTablero,
  diasHastaVencimiento,
} from '../clasificarTablero';
import type { Contract, Property } from '../../../../services/db';

const HOY = new Date('2026-05-21T12:00:00Z');

const dayOffset = (days: number): string => {
  const d = new Date(Date.UTC(2026, 4, 21) + days * 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const property = (id: number, bedrooms = 1): Property =>
  ({
    id,
    alias: `Casa ${id}`,
    address: '',
    postalCode: '',
    province: '',
    municipality: '',
    ccaa: '',
    purchaseDate: '2020-01-01',
    squareMeters: 50,
    bedrooms,
    transmissionRegime: 'usada',
    state: 'activo',
    acquisitionCosts: { price: 100000 },
    documents: [],
  }) as Property;

const contract = (
  id: number,
  overrides: Partial<Contract> = {},
): Contract & { id: number } =>
  ({
    id,
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'A', apellidos: 'B', dni: '1', telefono: '', email: 'x@y.z' },
    fechaInicio: '2024-01-01',
    fechaFin: '2099-12-31',
    rentaMensual: 800,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 800,
    fianzaEstado: 'retenida',
    cuentaCobroId: 1,
    estadoContrato: 'activo',
    firma: { metodo: 'digital', estado: 'firmado' },
    ...overrides,
  }) as Contract & { id: number };

describe('diasHastaVencimiento', () => {
  test('fecha indefinida → null', () => {
    expect(diasHastaVencimiento(contract(1, { fechaFin: '2099-12-31' }), HOY)).toBe(null);
  });

  test('fecha en 15 días → 15', () => {
    expect(diasHastaVencimiento(contract(1, { fechaFin: dayOffset(15) }), HOY)).toBe(15);
  });

  test('fecha pasada → negativo', () => {
    expect(diasHastaVencimiento(contract(1, { fechaFin: dayOffset(-3) }), HOY)).toBe(-3);
  });
});

describe('clasificarTablero', () => {
  test('sin contratos · sin propiedades · todas las categorías a 0', () => {
    const r = clasificarTablero([], [], HOY);
    expect(r.totalCategorias).toBe(0);
    expect(r.urgenteHoy.total).toBe(0);
    expect(r.decisionSemana.total).toBe(0);
    expect(r.planificarMes.total).toBe(0);
    expect(r.buenasNoticias.total).toBe(0);
  });

  test('contrato vence en 8 días · cae en urgenteHoy.venceMuyProximo', () => {
    const cs = [contract(1, { fechaFin: dayOffset(8) })];
    const r = clasificarTablero(cs, [property(1)], HOY);
    expect(r.urgenteHoy.venceMuyProximo).toHaveLength(1);
    expect(r.urgenteHoy.venceMuyProximo[0].diasHastaVencimiento).toBe(8);
  });

  test('contrato vence en 20 días · cae en decisionSemana.vencimientos', () => {
    const cs = [contract(1, { fechaFin: dayOffset(20) })];
    const r = clasificarTablero(cs, [property(1)], HOY);
    expect(r.decisionSemana.vencimientos).toHaveLength(1);
    expect(r.urgenteHoy.venceMuyProximo).toHaveLength(0);
  });

  test('contrato vence en 60 días · cae en planificarMes.items', () => {
    const cs = [contract(1, { fechaFin: dayOffset(60) })];
    const r = clasificarTablero(cs, [property(1)], HOY);
    expect(r.planificarMes.items).toHaveLength(1);
  });

  test('contrato vence en 120 días · NO cae en ninguna · silencioso', () => {
    const cs = [contract(1, { fechaFin: dayOffset(120) })];
    const r = clasificarTablero(cs, [property(1)], HOY);
    expect(r.planificarMes.total).toBe(0);
    expect(r.urgenteHoy.total).toBe(0);
    expect(r.silenciosos.total).toBe(1);
  });

  test('habitación libre · cae en urgenteHoy.libreSinCandidato', () => {
    // 2 bedrooms · 0 contratos activos · 2 unidades libres
    const r = clasificarTablero([], [property(1, 2)], HOY);
    expect(r.urgenteHoy.libreSinCandidato).toHaveLength(2);
  });

  test('contrato no firmado · enviado hace 5 d · firmaAtrasada', () => {
    const cs = [contract(1, {
      firma: { metodo: 'digital', estado: 'enviado', fechaEnvio: dayOffset(-5) },
      fechaFirmaContrato: undefined,
    })];
    const r = clasificarTablero(cs, [property(1)], HOY);
    expect(r.urgenteHoy.firmaAtrasada).toHaveLength(1);
    expect(r.urgenteHoy.firmaAtrasada[0].diasSinFirmar).toBe(5);
  });

  test('contrato no firmado · enviado hace 2 d · firmaPendienteCorta (decisión)', () => {
    const cs = [contract(1, {
      firma: { metodo: 'digital', estado: 'enviado', fechaEnvio: dayOffset(-2) },
      fechaFirmaContrato: undefined,
    })];
    const r = clasificarTablero(cs, [property(1)], HOY);
    expect(r.decisionSemana.firmaPendienteCorta).toHaveLength(1);
    expect(r.urgenteHoy.firmaAtrasada).toHaveLength(0);
  });

  test('contrato con renegociacion reciente · buenasNoticias', () => {
    const cs = [contract(1, {
      historicoRentas: [
        { fechaDesde: dayOffset(-10), importe: 850, origen: 'renegociacion' },
      ],
    })];
    const r = clasificarTablero(cs, [property(1)], HOY);
    expect(r.buenasNoticias.renovaciones).toHaveLength(1);
    expect(r.buenasNoticias.renovaciones[0].nVecesRenovado).toBe(1);
  });

  test('contrato con renegociacion hace 60 días · NO buenas noticias (>30 d)', () => {
    const cs = [contract(1, {
      historicoRentas: [
        { fechaDesde: dayOffset(-60), importe: 850, origen: 'renegociacion' },
      ],
    })];
    const r = clasificarTablero(cs, [property(1)], HOY);
    expect(r.buenasNoticias.renovaciones).toHaveLength(0);
  });

  test('contrato indefinido firmado al día · silencioso', () => {
    const cs = [contract(1, { fechaFin: '2099-12-31' })];
    const r = clasificarTablero(cs, [property(1)], HOY);
    expect(r.totalCategorias).toBe(0);
    expect(r.silenciosos.total).toBe(1);
  });

  test('caso Jose · 6 contratos firmados indefinidos · todo en silenciosos', () => {
    const cs = Array.from({ length: 6 }, (_, i) =>
      contract(i + 1, { inmuebleId: 1, fechaFin: '2099-12-31' }),
    );
    const r = clasificarTablero(cs, [property(1, 6)], HOY);
    expect(r.totalCategorias).toBe(0);
    expect(r.silenciosos.total).toBe(6);
  });

  test('contrato vence exactamente en 15 d · cae en decisionSemana (no urgente)', () => {
    const cs = [contract(1, { fechaFin: dayOffset(15) })];
    const r = clasificarTablero(cs, [property(1)], HOY);
    expect(r.urgenteHoy.venceMuyProximo).toHaveLength(0);
    expect(r.decisionSemana.vencimientos).toHaveLength(1);
  });

  test('contrato vence en 30 d · decisionSemana · 31 d · planificarMes', () => {
    expect(
      clasificarTablero([contract(1, { fechaFin: dayOffset(30) })], [property(1)], HOY).decisionSemana.vencimientos,
    ).toHaveLength(1);
    expect(
      clasificarTablero([contract(2, { fechaFin: dayOffset(31) })], [property(1)], HOY).planificarMes.items,
    ).toHaveLength(1);
  });
});

describe('clasificarTablero · stats analíticos', () => {
  test('sin renegociaciones · tasa null', () => {
    const r = clasificarTablero(
      [contract(1, { historicoRentas: [] })],
      [property(1)],
      HOY,
    );
    expect(r.statsAnaliticos.tasaRenovacionYtd).toBe(null);
  });

  test('1 renegociacion YTD · tasa 100%', () => {
    const cs = [contract(1, {
      historicoRentas: [{ fechaDesde: dayOffset(-10), importe: 850, origen: 'renegociacion' }],
    })];
    const r = clasificarTablero(cs, [property(1)], HOY);
    expect(r.statsAnaliticos.tasaRenovacionYtd).toBe(1);
  });

  test('duracion media con contratos definidos', () => {
    const cs = [
      contract(1, { fechaInicio: '2024-01-01', fechaFin: '2026-01-01' }),
      contract(2, { fechaInicio: '2025-01-01', fechaFin: '2026-01-01' }),
    ];
    const r = clasificarTablero(cs, [property(1)], HOY);
    // (24 + 12) / 2 = 18 meses aprox
    expect(r.statsAnaliticos.duracionMediaContratosMeses).toBeGreaterThan(17);
    expect(r.statsAnaliticos.duracionMediaContratosMeses).toBeLessThan(19);
  });

  test('todos contratos indefinidos · duracion media null', () => {
    const cs = [contract(1, { fechaFin: '2099-12-31' })];
    const r = clasificarTablero(cs, [property(1)], HOY);
    expect(r.statsAnaliticos.duracionMediaContratosMeses).toBe(null);
  });

  test('variacionVsAnoAnteriorPp siempre null en T4 (sin histórico previo)', () => {
    const r = clasificarTablero([], [], HOY);
    expect(r.statsAnaliticos.variacionVsAnoAnteriorPp).toBe(null);
  });
});
