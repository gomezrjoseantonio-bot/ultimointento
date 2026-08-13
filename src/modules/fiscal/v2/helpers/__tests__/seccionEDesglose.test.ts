import { buildSeccionE } from '../ejercicioCasillasService';

/**
 * Reconciliación de la Sección E (ganancias patrimoniales) del Modelo 100:
 * el desglose debe DEJAR VER cómo se forma el 0320 (Σ plusvalías) y cómo se
 * compensa hasta el 0325 (integra base del ahorro) — sin tener que intuirlo.
 *
 * Caso real: Sant Joan d'en Coll +38.508,09 · inversiones +4.271,12 ·
 * pérdida del parking Ctra. de Vic −3.527,00 · sin arrastres.
 *   0320 = 38.508,09 + 4.271,12 = 42.779,21
 *   0325 = 42.779,21 − 3.527,00 = 39.252,21
 */
const buildDatos = (): any => ({
  casillas: null,
  declaracionCompleta: {
    ventasInmuebles: [{ alias: 'Sant Joan den Coll 53' }, { alias: 'Ctra. de Vic 178' }],
    baseAhorro: {
      gananciasYPerdidas: { plusvalias: 42779.21, minusvalias: 3527, compensado: 39252.21 },
    },
    compensacionAhorro: {
      fuentes: {
        inmuebles: {
          plusvalias: 38508.09,
          minusvalias: 3527,
          detalle: [
            { alias: "Sant Joan d'en Coll 53", gananciaPatrimonial: 38508.09, fechaVenta: '2026-03-15' },
            { alias: 'Ctra. de Vic 178', gananciaPatrimonial: -3527, fechaVenta: '2026-08-10' },
          ],
        },
        inversiones: { plusvalias: 4271.12, minusvalias: 0, operaciones: 1 },
      },
      totalCompensado: 0,
    },
  },
});

const row = (rows: any[], concepto: string) => rows.find((r) => r.concepto === concepto);

describe('buildSeccionE · desglose visible de 0320 y 0325', () => {
  it('lista las plusvalías (inmueble + inversiones) que forman el 0320', () => {
    const sec = buildSeccionE(buildDatos());
    expect(row(sec.rows, "▸ Sant Joan d'en Coll 53")?.importe).toBeCloseTo(38508.09, 2);
    expect(row(sec.rows, '▸ Inversiones · valores y fondos')?.importe).toBeCloseTo(4271.12, 2);
    const box0320 = sec.rows.find((r) => r.num === '0320');
    expect(box0320?.importe).toBeCloseTo(42779.21, 2);
  });

  it('lista la pérdida compensada y llega al 0325', () => {
    const sec = buildSeccionE(buildDatos());
    const perdida = row(sec.rows, '▸ Ctra. de Vic 178 · pérdida');
    expect(perdida?.importe).toBeCloseTo(3527, 2);
    expect(perdida?.negativeSign).toBe(true);
    const box0325 = sec.rows.find((r) => r.num === '0325');
    expect(box0325?.importe).toBeCloseTo(39252.21, 2);
  });

  it('el desglose cuadra: Σ plusvalías = 0320 y 0320 − pérdidas − arrastres = 0325', () => {
    const sec = buildSeccionE(buildDatos());
    const box0320 = sec.rows.find((r) => r.num === '0320')!.importe as number;
    const box0325 = sec.rows.find((r) => r.num === '0325')!.importe as number;

    const plusItems = sec.rows.filter((r) => r.num === '' && !r.negativeSign);
    const minusItems = sec.rows.filter((r) => r.num === '' && r.negativeSign);
    const sumaPlus = plusItems.reduce((s, r) => s + (r.importe as number), 0);
    const sumaMinus = minusItems.reduce((s, r) => s + (r.importe as number), 0);

    expect(sumaPlus).toBeCloseTo(box0320, 2);
    expect(box0320 - sumaMinus).toBeCloseTo(box0325, 2);
  });
});
