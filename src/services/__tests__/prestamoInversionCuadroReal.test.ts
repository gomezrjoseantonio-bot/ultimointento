// Contraste del cuadro de amortización contra un préstamo REAL.
//
// Fixture · "Cuadro Amortización Préstamo Socio P001-JAG-01032025": 30.000 € de
// un socio a su SL al 3,25% TIN, 60 cuotas mensuales desde el 01/03/2025, con
// retención del 19% sobre los intereses. Las filas de abajo están copiadas del
// Excel que emite la empresa, que es la referencia contra la que el usuario
// compara lo que ATLAS le enseña.
//
// Lo que valida: que ATLAS reproduce el reparto interés/capital periodo a
// periodo y que el "Importe a transferir" del Excel es exactamente el neto que
// prevemos en Tesorería (cuota − retención), no solo los intereses.

import { calcularCuadroPrestamo, cobroPrevistoDelMes } from '../prestamoInversionCuadro';
import type { PosicionInversion } from '../../types/inversiones';

const PARAMS = {
  capital: 30000,
  tinAnual: 3.25,
  duracionMeses: 60,
  frecuencia: 'mensual' as const,
  modalidad: 'capital_e_intereses' as const,
  primerCobro: '2025-03-01',
};

/** Filas del Excel · [nº, fecha, interés, IRPF, a transferir, capital, pendiente]. */
const REAL: Array<[number, string, number, number, number, number, number]> = [
  [1, '2025-03-01', 81.25, 15.4375, 526.962569, 461.150069, 29538.849931],
  [2, '2025-04-01', 80.001052, 15.2002, 527.199869, 462.399017, 29076.450913],
  [3, '2025-05-01', 78.748721, 14.962257, 527.437812, 463.651348, 28612.799565],
  [12, '2026-02-01', 67.32401, 12.791562, 529.608507, 475.076059, 24383.019874],
  [24, '2027-02-01', 51.651958, 9.813872, 532.586197, 490.748112, 18580.743933],
  [36, '2028-02-01', 35.462908, 6.737952, 535.662117, 506.937162, 12587.059543],
  [57, '2029-11-01', 5.83643, 1.108922, 541.291148, 536.56364, 1618.425831],
  [59, '2030-01-01', 2.926108, 0.55596, 541.844109, 539.473962, 540.935037],
  [60, '2030-02-01', 1.465032, 0.278356, 542.121713, 540.935037, 0],
];

/** Totales del encabezado del Excel. */
const TOTAL_INTERESES = 2544.004159;
const TOTAL_RETENCION = 483.36079;

describe('cuadro de amortización · contraste con el préstamo real', () => {
  const cuadro = calcularCuadroPrestamo(PARAMS)!;

  it('genera las 60 cuotas en sus fechas reales', () => {
    expect(cuadro.periodos).toHaveLength(60);
    for (const [numero, fecha] of REAL) {
      expect(cuadro.periodos[numero - 1].fecha).toBe(fecha);
    }
  });

  it('reparte interés y capital como el cuadro que emite la empresa', () => {
    for (const [numero, , interes, , , capital, pendiente] of REAL) {
      const p = cuadro.periodos[numero - 1];
      // El interés cuadra al céntimo. El capital y el saldo arrastran la
      // diferencia de redondear la cuota a un importe transferible (ver abajo):
      // 4 céntimos en las 60 cuotas, en el peor periodo.
      expect(Math.abs(p.interes - interes)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(p.amortizacion - capital)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(p.saldoPendiente - pendiente)).toBeLessThanOrEqual(0.05);
    }
  });

  it('redondea la cuota a un importe transferible y cuadra a cero al final', () => {
    // El Excel arrastra 542,400069 €; nosotros cobramos 542,40 € y la última
    // cuota absorbe el redondeo. La deriva total en 5 años son 4 céntimos.
    expect(cuadro.cuota).toBeCloseTo(542.4, 2);
    expect(cuadro.periodos[59].saldoPendiente).toBe(0);
    const amortizado = cuadro.periodos.reduce((s, p) => s + p.amortizacion, 0);
    expect(amortizado).toBeCloseTo(30000, 2);
    expect(cuadro.totalIntereses).toBeCloseTo(TOTAL_INTERESES, 0);
  });

  it('el neto previsto es el "Importe a transferir", no solo los intereses', () => {
    const posicion = {
      id: 1,
      nombre: 'Préstamo socio Unihouser',
      tipo: 'prestamo_p2p',
      valor_actual: 30000,
      total_aportado: 30000,
      aportaciones: [],
      fecha_compra: '2025-03-01T12:00:00.000Z',
      duracion_meses: 60,
      modalidad_devolucion: 'capital_e_intereses',
      frecuencia_cobro: 'mensual',
      rendimiento: {
        tasa_interes_anual: 3.25,
        frecuencia_pago: 'mensual',
        fecha_primer_cobro: '2025-03-01T12:00:00.000Z',
      },
      activo: true,
    } as unknown as PosicionInversion;

    for (const [, fecha, interes, irpf, aTransferir] of REAL) {
      const cobro = cobroPrevistoDelMes(posicion, fecha.slice(0, 7), 19)!;
      expect(cobro).not.toBeNull();
      expect(cobro.fecha).toBe(fecha);
      expect(Math.abs(cobro.interesBruto - interes)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(cobro.retencion - irpf)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(cobro.neto - aTransferir)).toBeLessThanOrEqual(0.05);
    }

    // La primera cuota son ~527 € en la cuenta, no los 65,81 € que salían de
    // contar solo los intereses netos del capital inicial.
    const primera = cobroPrevistoDelMes(posicion, '2025-03', 19)!;
    expect(primera.neto).toBeGreaterThan(500);
    expect(primera.incluyeCapital).toBe(true);
  });

  it('la retención total del préstamo coincide con la del Excel', () => {
    const retenido = cuadro.periodos.reduce((s, p) => s + p.interes * 0.19, 0);
    expect(retenido).toBeCloseTo(TOTAL_RETENCION, 1);
  });
});
