// `inversionToCartaItem` · préstamos con cuota francesa.
// El store guarda el capital prestado; la carta debe pintar el capital vivo.

import { inversionToCartaItem } from '../cartaItem';
import type { PosicionInversion } from '../../../../types/inversiones';

const ANIO = new Date().getFullYear();

const prestamo = (extra: Partial<PosicionInversion> = {}): PosicionInversion =>
  ({
    id: 1,
    nombre: 'Prestamo Creación',
    tipo: 'prestamo_p2p',
    entidad: 'Unihouser',
    valor_actual: 30000,
    fecha_valoracion: `${ANIO - 2}-01-15T12:00:00.000Z`,
    aportaciones: [],
    total_aportado: 30000,
    rentabilidad_euros: 0,
    rentabilidad_porcentaje: 0,
    fecha_compra: `${ANIO - 2}-01-15T12:00:00.000Z`,
    duracion_meses: 60,
    modalidad_devolucion: 'capital_e_intereses',
    frecuencia_cobro: 'mensual',
    rendimiento: {
      tasa_interes_anual: 3.25,
      frecuencia_pago: 'mensual',
      fecha_primer_cobro: `${ANIO - 2}-02-15T12:00:00.000Z`,
    },
    activo: true,
    created_at: `${ANIO - 2}-01-15T12:00:00.000Z`,
    updated_at: `${ANIO - 2}-01-15T12:00:00.000Z`,
    ...extra,
  }) as unknown as PosicionInversion;

describe('inversionToCartaItem · préstamo con cuota francesa', () => {
  it('pinta el capital vivo, no el prestado', () => {
    const item = inversionToCartaItem(prestamo());
    expect(item.valor_actual).toBeLessThan(30000);
    expect(item.valor_actual).toBeGreaterThan(0);
    expect(item.capital_inicial).toBe(30000);
  });

  it('expone el porcentaje ya amortizado', () => {
    const item = inversionToCartaItem(prestamo());
    expect(item.pct_amortizado).toBeGreaterThan(0);
    expect(item.pct_amortizado).toBeLessThan(100);
  });

  it('no inventa pérdida latente por el capital devuelto', () => {
    const item = inversionToCartaItem(prestamo());
    expect(item.rentabilidad_euros).toBe(0);
    expect(item.total_aportado).toBe(item.valor_actual);
  });

  it('usa la cuota francesa de la frecuencia elegida', () => {
    const item = inversionToCartaItem(prestamo());
    expect(item.cuota_mensual).toBeCloseTo(542.4, 1);
  });

  it('calcula el interés anual sobre el capital vivo', () => {
    const item = inversionToCartaItem(prestamo());
    expect(item.interes_anual).toBeCloseTo(item.valor_actual * 0.0325, 2);
  });

  it('deja intacto un préstamo solo-intereses', () => {
    const item = inversionToCartaItem(
      prestamo({ modalidad_devolucion: 'solo_intereses' }),
    );
    expect(item.valor_actual).toBe(30000);
    expect(item.total_aportado).toBe(30000);
    expect(item.pct_amortizado).toBeUndefined();
    expect(item.cuota_mensual).toBeUndefined();
  });
});
