// E2.4.2-fix2b · lo que entra en la cuenta por cada cuota de un préstamo
// concedido · la misma aritmética que la previsión del mes.

import { cobrosDelCuadro, cobroPrevistoDelMes, idDePagoDeCuota, retencionDePosicion } from '../prestamoInversionCuadro';
import type { PosicionInversion } from '../../types/inversiones';

const prestamoSocio = (over: Record<string, unknown> = {}) =>
  ({
    id: 7,
    nombre: 'Préstamo Socio',
    tipo: 'prestamo_p2p',
    total_aportado: 30000,
    duracion_meses: 60,
    modalidad_devolucion: 'capital_e_intereses',
    frecuencia_cobro: 'mensual',
    retencion_fiscal: 19,
    rendimiento: { tasa_interes_anual: 3.25, frecuencia_pago: 'mensual', fecha_primer_cobro: '2025-03-01T12:00:00.000Z', retencion_porcentaje: 19 },
    ...over,
  }) as unknown as PosicionInversion;

describe('cobrosDelCuadro', () => {
  it('60 cobros, con su número, y el neto = capital + interés − retención', () => {
    const cobros = cobrosDelCuadro(prestamoSocio(), 19);
    expect(cobros).toHaveLength(60);
    expect(cobros[4]).toEqual({
      periodo: 5, fecha: '2025-07-01', neto: 527.92, interesBruto: 76.23, retencion: 14.48, amortizacion: 466.17, incluyeCapital: true,
    });
    expect(cobros[5]).toMatchObject({ periodo: 6, fecha: '2025-08-01', neto: 528.16 });
  });

  it('es la misma cuota que ve la previsión del mes · una sola fuente', () => {
    expect(cobroPrevistoDelMes(prestamoSocio(), '2025-07', 19)).toEqual(cobrosDelCuadro(prestamoSocio(), 19)[4]);
  });

  it('sin datos para el cuadro no hay cobros', () => {
    expect(cobrosDelCuadro(prestamoSocio({ duracion_meses: undefined }), 19)).toEqual([]);
  });
});

describe('retencionDePosicion', () => {
  it('manda la del rendimiento, luego la de la posición, y si no el 19 %', () => {
    expect(retencionDePosicion(prestamoSocio())).toBe(19);
    expect(retencionDePosicion(prestamoSocio({ rendimiento: { tasa_interes_anual: 3.25, retencion_porcentaje: 21 } }))).toBe(21);
    expect(retencionDePosicion(prestamoSocio({ rendimiento: { tasa_interes_anual: 3.25 }, retencion_fiscal: 0 }))).toBe(0);
    expect(retencionDePosicion(prestamoSocio({ rendimiento: { tasa_interes_anual: 3.25 }, retencion_fiscal: undefined }))).toBe(19);
  });
});

describe('idDePagoDeCuota', () => {
  it('es estable · el mismo id al dar de alta y al conciliar', () => {
    expect(idDePagoDeCuota(5, '2025-07-01')).toBe(idDePagoDeCuota(5, '2025-07-01'));
    expect(idDePagoDeCuota(5, '2025-07-01')).not.toBe(idDePagoDeCuota(6, '2025-08-01'));
  });
});
