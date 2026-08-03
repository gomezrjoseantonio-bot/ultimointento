// El recibo de una tarjeta de crédito · VOCABULARIO §3.2 y §6 bis.
//
// Lo que vigila: que cada compra caiga en SU periodo y que el cargo se coloque
// el día en que sale el dinero. El modelo anterior agrupaba por mes natural con
// un único día, así que una compra del 26 con corte el 24 se cobraba un mes
// antes de lo que toca — y una tarjeta de corte semanal era inexpresable.

import { recibosDeTarjeta } from '../reciboDeTarjeta';
import type { Tarjeta } from '../../types/tarjetas';

const credito = (over: Partial<Tarjeta> = {}): Tarjeta & { id: number } =>
  ({
    id: 1,
    alias: 'Visa',
    origen: 'banco',
    modalidad: 'credito',
    cuentaLiquidacionId: 9,
    ciclo: { periodicidad: 'mensual', corte: 24, diaCargo: 31, periodosHastaElCargo: 0 },
    activa: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Tarjeta & { id: number };

describe('un recibo por periodo', () => {
  it('las compras del periodo se suman en un solo cargo', () => {
    const r = recibosDeTarjeta(credito(), [
      { fecha: '2026-01-10', importe: 30 },
      { fecha: '2026-01-15', importe: 20.5 },
    ]);

    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      fechaCorte: '2026-01-24',
      fechaCargo: '2026-01-31',
      importe: 50.5,
      compras: 2,
      cuentaLiquidacionId: 9,
    });
  });

  // El fallo del modelo anterior: agrupaba por mes natural, así que la del 26
  // se cobraba en enero cuando en realidad se cobra en febrero.
  it('la compra pasada el corte va al recibo SIGUIENTE', () => {
    const r = recibosDeTarjeta(credito(), [
      { fecha: '2026-01-20', importe: 100 },
      { fecha: '2026-01-26', importe: 40 },
    ]);

    expect(r.map((x) => [x.fechaCorte, x.importe])).toEqual([
      ['2026-01-24', 100],
      ['2026-02-24', 40],
    ]);
  });

  it('el cargo puede caer en otro mes que el corte', () => {
    const r = recibosDeTarjeta(
      credito({
        ciclo: { periodicidad: 'mensual', corte: 31, diaCargo: 5, periodosHastaElCargo: 1 },
      }),
      [{ fecha: '2026-01-15', importe: 80 }]
    );

    expect(r[0].fechaCorte).toBe('2026-01-31');
    expect(r[0].fechaCargo).toBe('2026-02-05');
  });

  // Lo que rompía la suposición de "un recibo mensual por tarjeta".
  it('con corte semanal hay varios recibos en un mes', () => {
    const r = recibosDeTarjeta(
      credito({
        ciclo: { periodicidad: 'semanal', corte: 7, diaCargo: 1, periodosHastaElCargo: 0 },
      }),
      [
        { fecha: '2026-01-06', importe: 10 },
        { fecha: '2026-01-14', importe: 20 },
        { fecha: '2026-01-21', importe: 30 },
      ]
    );

    expect(r).toHaveLength(3);
    expect(r.map((x) => x.fechaCargo)).toEqual(['2026-01-12', '2026-01-19', '2026-01-26']);
  });

  // La base guarda fechas de las dos formas · un timestamp no puede reventar
  // el cálculo ni, peor, colar la compra en otro periodo.
  it('un timestamp completo se trata como su día', () => {
    const r = recibosDeTarjeta(credito(), [
      { fecha: '2026-01-26T23:30:00.000Z', importe: 40 },
    ]);

    expect(r[0].fechaCorte).toBe('2026-02-24');
  });

  it('los céntimos no se van en coma flotante', () => {
    const r = recibosDeTarjeta(credito(), [
      { fecha: '2026-01-02', importe: 0.1 },
      { fecha: '2026-01-03', importe: 0.2 },
    ]);

    expect(r[0].importe).toBe(0.3);
  });
});

describe('lo que no genera recibo', () => {
  // El débito ya movió el saldo el día de la compra · un recibo suyo sería
  // cobrar dos veces lo mismo.
  it('una tarjeta de débito no acumula nada', () => {
    const r = recibosDeTarjeta(credito({ modalidad: 'debito' }), [
      { fecha: '2026-01-10', importe: 30 },
    ]);

    expect(r).toEqual([]);
  });

  it('sin compras no hay recibo', () => {
    expect(recibosDeTarjeta(credito(), [])).toEqual([]);
  });

  it('un cargo de 0 € es ruido · no se emite', () => {
    expect(recibosDeTarjeta(credito(), [{ fecha: '2026-01-10', importe: 0 }])).toEqual([]);
  });
});
