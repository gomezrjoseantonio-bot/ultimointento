// Qué rinde una tarjeta · el cashback · VOCABULARIO §3.7.
//
// No es una curiosidad: es una decisión — por qué tarjeta canalizar el gasto.
// Lo que vigila esto es que la cifra sea comparable entre tarjetas y que no
// cuente lo que todavía no ha ocurrido.

import { rendimientoDeTarjetas } from '../rendimientoDeTarjeta';
import type { GastoDeUnPeriodo } from '../gastoPorTarjeta';
import type { Tarjeta } from '../../types/tarjetas';

const tarjeta = (over: Partial<Tarjeta> = {}): Tarjeta =>
  ({
    id: 11,
    alias: 'Carrefour',
    origen: 'externa',
    modalidad: 'credito',
    cuentaLiquidacionId: 2,
    cashbackPorcentaje: 1,
    limite: 4700,
    activa: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Tarjeta;

const periodo = (over: Partial<GastoDeUnPeriodo> = {}): GastoDeUnPeriodo => ({
  tarjetaId: 11,
  fechaCorte: '2026-01-24',
  fechaCargo: '2026-02-05',
  importe: 1000,
  estado: 'cerrado',
  ...over,
});

describe('lo que ha rendido', () => {
  it('devuelve su porcentaje de lo canalizado', () => {
    const [r] = rendimientoDeTarjetas([tarjeta()], [periodo({ importe: 1000 })]);

    expect(r).toMatchObject({ alias: 'Carrefour', canalizado: 1000, rendimiento: 10 });
  });

  it('suma todos sus periodos', () => {
    const [r] = rendimientoDeTarjetas(
      [tarjeta()],
      [
        periodo({ fechaCorte: '2026-01-24', importe: 1000 }),
        periodo({ fechaCorte: '2026-02-24', importe: 500 }),
      ]
    );

    expect(r.canalizado).toBe(1500);
    expect(r.rendimiento).toBe(15);
  });

  // «Se mide lo REALIZADO, no se prevé» · el periodo abierto todavía puede
  // crecer o quedarse corto, así que no ha rendido nada aún.
  it('el periodo abierto NO cuenta', () => {
    const [r] = rendimientoDeTarjetas(
      [tarjeta()],
      [periodo({ importe: 1000 }), periodo({ fechaCorte: '2026-02-24', estado: 'abierto', importe: 800 })]
    );

    expect(r.canalizado).toBe(1000);
  });

  it('los céntimos no se van en coma flotante', () => {
    const [r] = rendimientoDeTarjetas([tarjeta()], [periodo({ importe: 33.33 })]);

    expect(r.rendimiento).toBe(0.33);
  });
});

describe('el techo de la estrategia', () => {
  // El número de Jose: 4.700 €/mes al 1 % son 564 €/año. Responde «¿hasta
  // dónde llega este camino?», que es lo que decide.
  it('el límite dice lo máximo que puede rendir en un año', () => {
    expect(rendimientoDeTarjetas([tarjeta()], [])[0].techoAnual).toBe(564);
  });

  // El límite es el techo DEL PERIODO, y el periodo no siempre es un mes: la
  // Unicaja corta cada semana. Multiplicar siempre por 12 dejaba su techo
  // cuatro veces por debajo de lo que es.
  it('con corte semanal son 52 periodos, no 12', () => {
    const semanal = tarjeta({
      limite: 100,
      ciclo: { periodicidad: 'semanal', corte: 7, diaCargo: 1, periodosHastaElCargo: 0 },
    });

    expect(rendimientoDeTarjetas([semanal], [])[0].techoAnual).toBe(52);
  });

  it('sin límite dicho no se inventa un techo', () => {
    expect(rendimientoDeTarjetas([tarjeta({ limite: undefined })], [])[0].techoAnual)
      .toBeUndefined();
  });
});

describe('qué tarjetas entran', () => {
  // Enseñar «0 €» junto a las que sí dan invita a compararlas, y no compiten:
  // no es que rindan poco, es que no juegan a esto.
  it('una tarjeta sin cashback no aparece', () => {
    expect(rendimientoDeTarjetas([tarjeta({ cashbackPorcentaje: undefined })], [])).toEqual([]);
    expect(rendimientoDeTarjetas([tarjeta({ cashbackPorcentaje: 0 })], [])).toEqual([]);
  });

  // La comparación es el objetivo · quien más devuelve va primero.
  it('de la que más devuelve a la que menos', () => {
    const visa = tarjeta({ id: 12, alias: 'Visa', cashbackPorcentaje: 3 });

    const orden = rendimientoDeTarjetas(
      [tarjeta(), visa],
      [periodo({ importe: 1000 }), periodo({ tarjetaId: 12, importe: 1000 })]
    ).map((r) => r.alias);

    expect(orden).toEqual(['Visa', 'Carrefour']);
  });
});
