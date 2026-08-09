import {
  getContratoResumenOperativo,
  getEstadoFirma,
  getEstadoCobro,
  formatResumenOperativo,
  type ResumenOperativoContrato,
} from '../resumenOperativoContrato';
import type { Contract } from '../../../../services/db';

// Referencia temporal fija · el estado efectivo se calcula por fechas.
const HOY = new Date('2026-05-21T00:00:00Z');

const dayOffset = (days: number): string => {
  const d = new Date(Date.UTC(2026, 4, 21) + days * 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
};

const make = (overrides: Partial<Contract>): Contract =>
  ({
    estadoContrato: 'activo',
    fechaInicio: dayOffset(-100),
    fechaFin: '2099-12-31',
    firma: { metodo: 'digital', estado: 'firmado' },
    ...overrides,
  }) as Contract;

describe('getEstadoFirma', () => {
  test('firma.estado === firmado → firmado', () => {
    expect(getEstadoFirma(make({}))).toBe('firmado');
  });

  test('firma manual (fechaFirmaContrato) → firmado', () => {
    expect(
      getEstadoFirma(make({ firma: undefined, fechaFirmaContrato: '2024-01-01' })),
    ).toBe('firmado');
  });

  test('sin firma ni fecha → sin_firmar', () => {
    expect(
      getEstadoFirma(make({ firma: undefined, fechaFirmaContrato: undefined })),
    ).toBe('sin_firmar');
  });

  test('estadoContrato === sin_firmar → sin_firmar aunque haya firma digital', () => {
    expect(
      getEstadoFirma(
        make({ estadoContrato: 'sin_firmar', firma: { metodo: 'digital', estado: 'firmado' } }),
      ),
    ).toBe('sin_firmar');
  });
});

describe('getEstadoCobro', () => {
  test('sin contexto de Tesorería → sin_datos (no se inventa cobro)', () => {
    expect(getEstadoCobro(make({}))).toBe('sin_datos');
  });

  test('contexto sin estadoCobro → sin_datos', () => {
    expect(getEstadoCobro(make({}), {})).toBe('sin_datos');
  });

  test('refleja el estadoCobro que provee Tesorería', () => {
    expect(getEstadoCobro(make({}), { estadoCobro: 'al_dia' })).toBe('al_dia');
    expect(getEstadoCobro(make({}), { estadoCobro: 'impago' })).toBe('impago');
    expect(getEstadoCobro(make({}), { estadoCobro: 'pendiente' })).toBe('pendiente');
  });
});

describe('getContratoResumenOperativo · tres dimensiones ortogonales', () => {
  test('vigente + firmado + sin_datos (sin Tesorería)', () => {
    const resumen = getContratoResumenOperativo(make({}), undefined, HOY);
    expect(resumen).toEqual<ResumenOperativoContrato>({
      estadoEfectivo: 'vigente',
      estadoFirma: 'firmado',
      estadoCobro: 'sin_datos',
    });
  });

  test('proximo (empieza en el futuro) · firma independiente del efectivo', () => {
    const resumen = getContratoResumenOperativo(
      make({ fechaInicio: dayOffset(10), firma: { metodo: 'digital', estado: 'preparado' } }),
      undefined,
      HOY,
    );
    expect(resumen.estadoEfectivo).toBe('proximo');
    expect(resumen.estadoFirma).toBe('sin_firmar');
  });

  test('finalizado (fechaFin pasada) + firmado + impago (Tesorería)', () => {
    const resumen = getContratoResumenOperativo(
      make({ fechaFin: dayOffset(-1) }),
      { estadoCobro: 'impago' },
      HOY,
    );
    expect(resumen).toEqual<ResumenOperativoContrato>({
      estadoEfectivo: 'finalizado',
      estadoFirma: 'firmado',
      estadoCobro: 'impago',
    });
  });

  test('las dimensiones no se colapsan: sin_firmar NO fuerza un estado efectivo', () => {
    const resumen = getContratoResumenOperativo(
      make({ estadoContrato: 'sin_firmar' }),
      { estadoCobro: 'al_dia' },
      HOY,
    );
    // efectivo sigue vigente (fechas), firma sin_firmar, cobro al_dia · las 3 conviven.
    expect(resumen.estadoEfectivo).toBe('vigente');
    expect(resumen.estadoFirma).toBe('sin_firmar');
    expect(resumen.estadoCobro).toBe('al_dia');
  });
});

describe('formatResumenOperativo', () => {
  test('"Vigente · firmado · al día" con cobro conocido', () => {
    expect(
      formatResumenOperativo({
        estadoEfectivo: 'vigente',
        estadoFirma: 'firmado',
        estadoCobro: 'al_dia',
      }),
    ).toBe('Vigente · firmado · al día');
  });

  test('"Vigente · sin firmar · impago"', () => {
    expect(
      formatResumenOperativo({
        estadoEfectivo: 'vigente',
        estadoFirma: 'sin_firmar',
        estadoCobro: 'impago',
      }),
    ).toBe('Vigente · sin firmar · impago');
  });

  test('cobro sin_datos se OMITE del texto', () => {
    expect(
      formatResumenOperativo({
        estadoEfectivo: 'proximo',
        estadoFirma: 'sin_firmar',
        estadoCobro: 'sin_datos',
      }),
    ).toBe('Próximo · sin firmar');
  });
});
