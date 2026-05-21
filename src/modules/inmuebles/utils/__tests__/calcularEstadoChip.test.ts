import { calcularEstadoChip, estaFirmado } from '../calcularEstadoChip';
import type { Contract } from '../../../../services/db';

const HOY = new Date('2026-05-21T00:00:00Z');

const dayOffset = (days: number): string => {
  const d = new Date(Date.UTC(2026, 4, 21) + days * 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const make = (overrides: Partial<Contract>): Contract =>
  ({
    estadoContrato: 'activo',
    fechaFin: '2099-12-31',
    firma: { metodo: 'digital', estado: 'firmado' },
    ...overrides,
  }) as Contract;

describe('estaFirmado', () => {
  test('firma.estado === firmado → true', () => {
    expect(estaFirmado(make({ firma: { metodo: 'digital', estado: 'firmado' } }))).toBe(true);
  });

  test('fechaFirmaContrato presente → true', () => {
    expect(
      estaFirmado(
        make({ firma: undefined, fechaFirmaContrato: '2024-01-01' }),
      ),
    ).toBe(true);
  });

  test('sin firma ni fecha → false', () => {
    expect(estaFirmado(make({ firma: undefined, fechaFirmaContrato: undefined }))).toBe(false);
  });

  test('firma.estado === borrador → false', () => {
    expect(
      estaFirmado(
        make({ firma: { metodo: 'digital', estado: 'borrador' }, fechaFirmaContrato: undefined }),
      ),
    ).toBe(false);
  });
});

describe('calcularEstadoChip', () => {
  test('firmado · vence en 200 d · al-dia', () => {
    expect(calcularEstadoChip(make({ fechaFin: dayOffset(200) }), HOY)).toBe('al-dia');
  });

  test('firmado · vence en 15 d · vence-30d', () => {
    expect(calcularEstadoChip(make({ fechaFin: dayOffset(15) }), HOY)).toBe('vence-30d');
  });

  test('NO firmado · cualquier vencimiento · sin-firmar (prioridad)', () => {
    const c = make({
      firma: { metodo: 'digital', estado: 'borrador' },
      fechaFirmaContrato: undefined,
      fechaFin: dayOffset(10),
    });
    expect(calcularEstadoChip(c, HOY)).toBe('sin-firmar');
  });

  test('contrato indefinido (2099-12-31) firmado → al-dia (vence-30d no aplica)', () => {
    expect(calcularEstadoChip(make({ fechaFin: '2099-12-31' }), HOY)).toBe('al-dia');
  });

  test('contrato no activo (finalizado) → al-dia por defecto', () => {
    expect(
      calcularEstadoChip(make({ estadoContrato: 'finalizado', fechaFin: dayOffset(10) }), HOY),
    ).toBe('al-dia');
  });

  test('vencido (ayer) · todavía al-dia (no entra en vence-30d porque dias < 0)', () => {
    expect(calcularEstadoChip(make({ fechaFin: dayOffset(-1) }), HOY)).toBe('al-dia');
  });

  test('exactamente 30 d · vence-30d (límite inclusivo)', () => {
    expect(calcularEstadoChip(make({ fechaFin: dayOffset(30) }), HOY)).toBe('vence-30d');
  });

  test('exactamente 31 d · al-dia', () => {
    expect(calcularEstadoChip(make({ fechaFin: dayOffset(31) }), HOY)).toBe('al-dia');
  });
});
