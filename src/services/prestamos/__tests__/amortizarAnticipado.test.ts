// Adelantar capital · VOCABULARIO §6 bis · quater.
//
// Lo que vigila esto es que amortizar no invente un cuadro. El constructor que
// había liquidaba siempre sobre el mes comercial y con un tipo sin
// bonificaciones ni tramos, así que adelantar capital en la mixta de Unicaja
// rehacía el cuadro al 2,600 % hasta 2043 y borraba el paso a Euríbor.

import { amortizarAnticipado, cancelarAnticipado } from '../amortizarAnticipado';
import { generarCuadro } from '../cuadro';
import type { Prestamo } from '../../../types/prestamos';

const unicaja = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 'u',
    principalInicial: 85000,
    plazoMesesTotal: 240,
    fechaFirma: '2023-08-25',
    fechaPrimerCargo: '2023-09-25',
    diaCargoMes: 25,
    tipo: 'MIXTO',
    tipoNominalAnualMixtoFijo: 2.6,
    tramoFijoMeses: 36,
    indice: 'EURIBOR',
    valorIndiceActual: 2.1,
    diferencial: 1.75,
    baseCalculoIntereses: 'ACT/365',
    esquemaPrimerRecibo: 'NORMAL',
    ...over,
  }) as unknown as Prestamo;

/**
 * El cuadro tal como está cuando se amortiza · con lo anterior YA PAGADO.
 *
 * Un cuadro recién generado tiene todo a `pagado: false`, y sobre ese no se
 * distingue lo que se conserva de lo que se rehace.
 */
const plan = (p: Prestamo, pagadoHasta = '2026-02-25') => {
  const original = generarCuadro(p).plan;
  return {
    ...original,
    periodos: original.periodos.map((x) =>
      x.fechaCargo < pagadoHasta ? { ...x, pagado: true, fechaPagoReal: x.fechaCargo } : x
    ),
  };
};

const cent = (n: number) => Math.round(n * 100);
/** La primera cuota por venir DESPUÉS del adelanto · no la primera sin pagar. */
const primeraRehecha = (periodos: Prestamo['planPagos'] extends infer _ ? any[] : never, desde: string) =>
  periodos.find((x: any) => !x.pagado && x.devengoDesde >= desde && x.cuota > 0 && x.amortizacion > 0);

describe('lo pagado no se toca', () => {
  it('las cuotas anteriores al adelanto quedan idénticas', () => {
    const p = unicaja();
    const antes = plan(p);
    const despues = amortizarAnticipado(p, antes, {
      desde: '2026-02-25',
      importe: 10000,
      modo: 'REDUCIR_CUOTA',
    })!;

    const hasta = antes.periodos.filter((x) => x.devengoDesde < '2026-02-25');
    expect(despues.periodos.slice(0, hasta.length)).toEqual(hasta);
  });

  it('el capital del que parte es el que quedaba vivo ese día', () => {
    const p = unicaja();
    const antes = plan(p);
    const vivoAntes = antes.periodos.filter((x) => x.devengoDesde < '2026-02-25').at(-1)!.principalFinal;

    const despues = amortizarAnticipado(p, antes, {
      desde: '2026-02-25',
      importe: 10000,
      modo: 'REDUCIR_CUOTA',
    })!;
    const laDelAdelanto = despues.periodos.find((x) => x.fechaCargo === '2026-02-25' && x.pagado)!;

    expect(cent(laDelAdelanto.principalFinal)).toBe(cent(vivoAntes - 10000));
    expect(cent(laDelAdelanto.amortizacion)).toBe(cent(10000));
  });
});

// El motor propio rehacía el resto de la vida del préstamo a UN tipo. En un
// mixto eso borra el cambio de tramo, que es lo que más mueve la cuota.
describe('los tramos siguen ahí', () => {
  const p = unicaja();
  const despues = () =>
    amortizarAnticipado(p, plan(p), { desde: '2026-02-25', importe: 10000, modo: 'REDUCIR_CUOTA' })!;

  it('la cuota sigue cambiando el 25 de agosto de 2026', () => {
    const periodos = despues().periodos;
    const antesDelCambio = periodos.filter((x) => x.devengoDesde < '2026-08-25' && !x.pagado).at(-1)!;
    const primeraDelTramo = periodos.find((x) => x.devengoDesde === '2026-08-25')!;

    expect(primeraDelTramo.cuota).not.toBe(antesDelCambio.cuota);
  });

  it('y hasta ese día se sigue pagando el tramo fijo', () => {
    const periodos = despues().periodos.filter(
      (x) => !x.pagado && x.devengoDesde >= '2026-02-25' && x.devengoDesde < '2026-08-25'
    );

    expect(new Set(periodos.map((x) => x.cuota)).size).toBe(1);
  });
});

// La base del préstamo la dice la escritura · liquidar sobre el mes comercial
// cuando el banco cuenta días reales descuadra el desglose de cada recibo.
describe('la base del préstamo se respeta', () => {
  it('un ACT/365 no liquida como un mes comercial', () => {
    const p = unicaja();
    const comercial = unicaja({ baseCalculoIntereses: '30/360' });

    const conDias = amortizarAnticipado(p, plan(p), {
      desde: '2026-02-25', importe: 10000, modo: 'REDUCIR_CUOTA',
    })!.periodos.find((x) => x.fechaCargo === '2026-03-25')!;
    const conMes = amortizarAnticipado(comercial, plan(comercial), {
      desde: '2026-02-25', importe: 10000, modo: 'REDUCIR_CUOTA',
    })!.periodos.find((x) => x.fechaCargo === '2026-03-25')!;

    expect(conDias.interes).not.toBe(conMes.interes);
  });
});

describe('reducir cuota y reducir plazo', () => {
  const p = unicaja();
  const antes = plan(p);
  const cuotaAntes = antes.periodos.find((x) => x.periodo === 30)!.cuota;

  it('reducir cuota conserva las citas y baja el recibo', () => {
    const d = amortizarAnticipado(p, antes, {
      desde: '2026-02-25', importe: 20000, modo: 'REDUCIR_CUOTA',
    })!;
    expect(primeraRehecha(d.periodos, '2026-02-25')!.cuota).toBeLessThan(cuotaAntes);
    expect(d.resumen.fechaFinalizacion).toBe(antes.resumen.fechaFinalizacion);
  });

  it('reducir plazo conserva el recibo y acorta', () => {
    const d = amortizarAnticipado(p, antes, {
      desde: '2026-02-25', importe: 20000, modo: 'REDUCIR_PLAZO',
    })!;

    expect(d.resumen.fechaFinalizacion < antes.resumen.fechaFinalizacion).toBe(true);
    expect(d.periodos.at(-1)!.principalFinal).toBe(0);
  });

  it('en los dos casos el préstamo termina en cero', () => {
    for (const modo of ['REDUCIR_CUOTA', 'REDUCIR_PLAZO'] as const) {
      const d = amortizarAnticipado(p, antes, { desde: '2026-02-25', importe: 20000, modo })!;
      expect(d.periodos.at(-1)!.principalFinal).toBe(0);
    }
  });
});

// Los intereses corridos se cobran de verdad · iban a cero en el cuadro aunque
// el movimiento sí los cobrara, y de ese total sale la deducción fiscal.
describe('cancelar del todo', () => {
  it('la línea de cierre lleva los intereses corridos, no un cero', () => {
    const p = unicaja();
    const antes = plan(p);
    // Al cancelar manda lo COBRADO · el recibo del 25 no está pagado, así que
    // lo que se debe es el saldo posterior al del 25 de enero.
    const vivo = antes.periodos.filter((x) => x.fechaCargo < '2026-02-25').at(-1)!.principalFinal;

    const d = cancelarAnticipado(p, antes, {
      fecha: '2026-02-25',
      capital: vivo,
      interesesCorridos: 123.45,
    })!;
    const cierre = d.periodos.at(-1)!;

    expect(cierre.fechaCargo).toBe('2026-02-25');
    expect(cent(cierre.interes)).toBe(cent(123.45));
    expect(cierre.principalFinal).toBe(0);
    expect(cent(cierre.cuota)).toBe(cent(vivo + 123.45));
  });

  // El recibo del propio día de la cancelación puede seguir pendiente · lo que
  // no puede quedar es nada DESPUÉS.
  // Un recibo posterior a la cancelación no se gira nunca · tampoco el del
  // propio día si todavía no estaba pagado.
  it('y no deja ninguna cuota por venir', () => {
    const p = unicaja();
    const antes = plan(p);
    // Al cancelar manda lo COBRADO · el recibo del 25 no está pagado, así que
    // lo que se debe es el saldo posterior al del 25 de enero.
    const vivo = antes.periodos.filter((x) => x.fechaCargo < '2026-02-25').at(-1)!.principalFinal;

    const d = cancelarAnticipado(p, antes, { fecha: '2026-02-25', capital: vivo })!;

    expect(d.periodos.some((x) => x.fechaCargo > '2026-02-25')).toBe(false);
    expect(d.periodos.at(-1)!.principalFinal).toBe(0);
  });
});

// Inventar un cuadro es peor que dejar el que había.
describe('cuando no hay nada que hacer', () => {
  const p = unicaja();

  it.each([0, -100])('un importe de %s no toca nada', (importe) => {
    const antes = plan(p);
    expect(amortizarAnticipado(p, antes, { desde: '2026-02-25', importe, modo: 'REDUCIR_CUOTA' }))
      .toBe(antes);
  });

  it('una fecha que no es una fecha tampoco', () => {
    const antes = plan(p);
    expect(amortizarAnticipado(p, antes, { desde: '25/02/2026', importe: 10000, modo: 'REDUCIR_CUOTA' }))
      .toBe(antes);
  });

  it('sin plan no se inventa uno', () => {
    expect(amortizarAnticipado(p, null, { desde: '2026-02-25', importe: 10000, modo: 'REDUCIR_CUOTA' }))
      .toBeNull();
  });
});
