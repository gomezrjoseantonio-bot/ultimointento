// De gastos con tarjeta a recibos previstos · VOCABULARIO §3.4 y §6 bis.
//
// Lo que vigila: que un gasto pagado con tarjeta de crédito NO se prevea el día
// de la compra sino el día de cargo, y en la cuenta de liquidación. Y que nada
// se pierda por el camino — un gasto que desaparece de la previsión no se nota
// hasta que falta el dinero.

import { claveDeRecibo, previsionDeTarjetas } from '../previsionDeTarjetas';
import type { Tarjeta } from '../../types/tarjetas';

const tarjeta = (over: Partial<Tarjeta> = {}): Tarjeta => ({
  id: 7,
  alias: 'Carrefour',
  origen: 'externa',
  modalidad: 'credito',
  cuentaLiquidacionId: 3,
  ciclo: { periodicidad: 'mensual', corte: 24, diaCargo: 5, periodosHastaElCargo: 1 },
  activa: true,
  createdAt: '',
  updatedAt: '',
  ...over,
});

describe('lo que se paga con tarjeta', () => {
  it('se cobra el día de cargo y en la cuenta de liquidación', () => {
    const { recibos, sueltos } = previsionDeTarjetas(
      [{ fecha: '2026-01-10', importe: 120, tarjetaId: 7 }],
      [tarjeta()]
    );

    expect(sueltos).toEqual([]);
    expect(recibos).toHaveLength(1);
    expect(recibos[0]).toMatchObject({
      fechaCargo: '2026-02-05',
      cuentaLiquidacionId: 3,
      importe: 120,
    });
  });

  it('varias compras del mismo periodo son UN recibo', () => {
    const { recibos } = previsionDeTarjetas(
      [
        { fecha: '2026-01-10', importe: 100, tarjetaId: 7 },
        { fecha: '2026-01-12', importe: 50, tarjetaId: 7 },
      ],
      [tarjeta()]
    );

    expect(recibos).toHaveLength(1);
    expect(recibos[0].importe).toBe(150);
  });

  // Dos tarjetas son dos recibos aunque se liquiden en la misma cuenta: cada
  // una tiene su corte, y sumarlas escondería cuál gastó qué.
  it('cada tarjeta lleva su recibo', () => {
    const { recibos } = previsionDeTarjetas(
      [
        { fecha: '2026-01-10', importe: 100, tarjetaId: 7 },
        { fecha: '2026-01-10', importe: 40, tarjetaId: 8 },
      ],
      [tarjeta(), tarjeta({ id: 8, alias: 'Visa' })]
    );

    expect(recibos.map((r) => [r.tarjetaId, r.importe]).sort()).toEqual([
      [7, 100],
      [8, 40],
    ]);
  });
});

describe('lo que sigue saliendo de la cuenta', () => {
  it('un gasto sin tarjeta no se toca', () => {
    const gasto = { fecha: '2026-01-10', importe: 60 };

    const { recibos, sueltos } = previsionDeTarjetas([gasto], [tarjeta()]);

    expect(recibos).toEqual([]);
    expect(sueltos).toEqual([gasto]);
  });

  // El débito ya movió el saldo el día de la compra · acumularlo lo cobraría
  // dos veces.
  it('el débito no acumula · el gasto se queda donde está', () => {
    const gasto = { fecha: '2026-01-10', importe: 60, tarjetaId: 7 };

    const { recibos, sueltos } = previsionDeTarjetas(
      [gasto],
      [tarjeta({ modalidad: 'debito', ciclo: undefined })]
    );

    expect(recibos).toEqual([]);
    expect(sueltos).toEqual([gasto]);
  });

  // Perder dinero de la vista no tiene arreglo · una tarjeta borrada no puede
  // llevarse por delante la previsión del gasto.
  it('una tarjeta que ya no existe devuelve el gasto a su cuenta', () => {
    const gasto = { fecha: '2026-01-10', importe: 60, tarjetaId: 999 };

    const { recibos, sueltos } = previsionDeTarjetas([gasto], [tarjeta()]);

    expect(recibos).toEqual([]);
    expect(sueltos).toEqual([gasto]);
  });
});

describe('la identidad del recibo', () => {
  // Si la clave dependiera del mes de la sincronización, un cargo que cae en el
  // mes siguiente nacería otra vez en cada pasada.
  it('es la tarjeta y su periodo · no el mes en que se calcula', () => {
    const [recibo] = previsionDeTarjetas(
      [{ fecha: '2026-01-10', importe: 120, tarjetaId: 7 }],
      [tarjeta()]
    ).recibos;

    expect(claveDeRecibo(recibo)).toBe('tarjeta-7-2026-01-24');
  });

  it('dos periodos de la misma tarjeta no comparten clave', () => {
    const { recibos } = previsionDeTarjetas(
      [
        { fecha: '2026-01-10', importe: 100, tarjetaId: 7 },
        { fecha: '2026-01-26', importe: 40, tarjetaId: 7 },
      ],
      [tarjeta()]
    );

    expect(recibos.map(claveDeRecibo)).toEqual([
      'tarjeta-7-2026-01-24',
      'tarjeta-7-2026-02-24',
    ]);
  });
});
