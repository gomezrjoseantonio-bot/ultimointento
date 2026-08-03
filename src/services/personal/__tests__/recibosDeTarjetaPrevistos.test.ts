// El recibo previsto de una tarjeta · docs/VOCABULARIO-dinero.md §3.4 y §6 bis.
//
// Lo que vigila: que un recibo sea UN cargo por (tarjeta · corte) con la suma
// de TODO lo que se paga con esa tarjeta. El banco no carga la compra, la
// gasolina y la farmacia por separado: carga una vez el día 5.
//
// Por eso esto no cabía en la previsión de un compromiso, que se identifica por
// (gasto · mes · cuenta): un recibo cruza varios gastos.

import {
  eventoDeRecibo,
  pagaConCreditoAplazado,
  recibosPrevistos,
} from '../recibosDeTarjetaPrevistos';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import type { Tarjeta } from '../../../types/tarjetas';

const BANKINTER = 2;

const carrefour = (over: Partial<Tarjeta> = {}): Tarjeta =>
  ({
    id: 11,
    alias: 'Carrefour',
    origen: 'externa',
    modalidad: 'credito',
    cuentaLiquidacionId: BANKINTER,
    ciclo: { periodicidad: 'mensual', corte: 24, diaCargo: 5, periodosHastaElCargo: 1 },
    activa: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Tarjeta;

const gasto = (over: Partial<CompromisoRecurrente> = {}): CompromisoRecurrente =>
  ({
    id: 1,
    ambito: 'personal',
    alias: 'Compra',
    proveedor: { nombre: 'Carrefour' },
    patron: { tipo: 'mensualDiaFijo', dia: 10 },
    importe: { modo: 'fijo', importe: 100 },
    cuentaCargo: BANKINTER,
    conceptoBancario: 'CARREFOUR',
    metodoPago: 'tarjeta',
    tarjetaId: 11,
    categoria: 'personal.dia_a_dia' as never,
    bolsaPresupuesto: 'necesidades',
    responsable: 'titular',
    fechaInicio: '2019-01-01',
    estado: 'activo',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as unknown as CompromisoRecurrente;

const VENTANA = ['2026-01-01', '2026-01-31'] as const;

describe('qué entra en un recibo', () => {
  // El corazón del cambio: el recibo CRUZA gastos. Antes cada uno emitía su
  // cargo por separado y el extracto no cuadraba con la previsión.
  it('varios gastos de la misma tarjeta son UN solo cargo', () => {
    const recibos = recibosPrevistos(
      [
        gasto({ id: 1, alias: 'Compra', importe: { modo: 'fijo', importe: 100 } }),
        gasto({ id: 2, alias: 'Gasolina', importe: { modo: 'fijo', importe: 60 } }),
        gasto({ id: 3, alias: 'Farmacia', importe: { modo: 'fijo', importe: 20 } }),
      ],
      [carrefour()],
      ...VENTANA
    );

    expect(recibos).toHaveLength(1);
    expect(recibos[0]).toMatchObject({
      importe: 180,
      fechaCorte: '2026-01-24',
      fechaCargo: '2026-02-05',
      cuentaLiquidacionId: BANKINTER,
    });
  });

  it('dos tarjetas son dos recibos aunque se liquiden en la misma cuenta', () => {
    const visa = carrefour({ id: 12, alias: 'Visa' });

    const recibos = recibosPrevistos(
      [gasto({ id: 1 }), gasto({ id: 2, tarjetaId: 12, importe: { modo: 'fijo', importe: 40 } })],
      [carrefour(), visa],
      ...VENTANA
    );

    expect(recibos.map((r) => [r.tarjetaId, r.importe]).sort()).toEqual([
      [11, 100],
      [12, 40],
    ]);
  });
});

describe('qué NO entra', () => {
  // El débito ya movió el saldo el día de la compra · meterlo en un recibo lo
  // cobraría dos veces.
  it('un gasto con tarjeta de débito no genera recibo', () => {
    const debito = carrefour({ modalidad: 'debito', ciclo: undefined });

    expect(recibosPrevistos([gasto()], [debito], ...VENTANA)).toEqual([]);
    expect(pagaConCreditoAplazado(gasto(), [debito])).toBe(false);
  });

  it('un gasto domiciliado sigue su camino', () => {
    const domiciliado = gasto({ metodoPago: 'domiciliacion', tarjetaId: undefined });

    expect(recibosPrevistos([domiciliado], [carrefour()], ...VENTANA)).toEqual([]);
    expect(pagaConCreditoAplazado(domiciliado, [carrefour()])).toBe(false);
  });

  // Un «con tarjeta» sin decir cuál no se puede colocar en ningún ciclo.
  it('sin tarjeta dicha no hay recibo', () => {
    expect(pagaConCreditoAplazado(gasto({ tarjetaId: undefined }), [carrefour()])).toBe(false);
  });
});

describe('el cargo que se apunta', () => {
  const [recibo] = recibosPrevistos([gasto()], [carrefour()], ...VENTANA);

  it('sale en negativo y el día de CARGO, no el del corte', () => {
    const ev = eventoDeRecibo(recibo, [carrefour()], '2026-01-01T00:00:00.000Z');

    expect(ev.amount).toBe(-100);
    expect(ev.predictedDate).toBe('2026-02-05');
    expect(ev.año).toBe(2026);
    expect(ev.mes).toBe(2);
  });

  it('se apunta en la cuenta de liquidación · no en la tarjeta', () => {
    expect(eventoDeRecibo(recibo, [carrefour()], '').accountId).toBe(BANKINTER);
  });

  // Si la identidad llevara el mes en que se calcula, un cargo que cae en el
  // mes siguiente nacería otra vez en cada pasada.
  it('se identifica por tarjeta y corte · sin el mes en que se calcula', () => {
    expect(eventoDeRecibo(recibo, [carrefour()], '').sourceId).toBe('tarjeta-11-2026-01-24');
    expect(eventoDeRecibo(recibo, [carrefour()], '').sourceType).toBe('tarjeta_recibo');
  });

  it('se llama por el nombre de la tarjeta, que es lo que verás en el extracto', () => {
    expect(eventoDeRecibo(recibo, [carrefour()], '').description).toBe('Recibo tarjeta Carrefour');
  });
});
