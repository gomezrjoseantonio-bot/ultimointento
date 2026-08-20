// V9 · las dos piezas nuevas de la capa de datos del rediseño:
//
//   · `cierrePorCuenta` — LA función canónica de cierre proyectado. El candado
//     que importa es la invariante Σ cierrePorCuenta(cuentas) === KpisHero.cierre:
//     antes había tres cálculos inline (drawer, calendario, móvil) y dos no
//     excluían los traspasos internos, con lo que discrepaban del hero.
//   · `serieDiariaConsolidada` — la serie de 30 días rodantes del gráfico
//     "Lo que viene", con el primer descubierto atribuido a su cuenta.

import {
  calcularKpisHero,
  cierrePorCuenta,
  serieDiariaConsolidada,
} from '../tesoreriaV6Metrics';
import { resumirMes } from '../../modules/tesoreria/v6/calendarioDias';
import type { Account, TreasuryEvent } from '../db';

const ev = (over: Partial<TreasuryEvent> = {}): TreasuryEvent => ({
  type: 'expense',
  amount: 100,
  predictedDate: '2026-08-10',
  description: 'x',
  sourceType: 'manual',
  status: 'predicted',
  createdAt: '',
  updatedAt: '',
  ...over,
});

const cuenta = (id: number, alias?: string): Account =>
  ({
    id,
    alias,
    iban: `ES00${id}`,
    status: 'ACTIVE',
    activa: true,
    createdAt: '',
    updatedAt: '',
  }) as Account;

describe('cierrePorCuenta · la función canónica', () => {
  it('cierre = saldo + entra + sale, solo el mes, sin descartados ni ejecutados', () => {
    const c = cierrePorCuenta({
      saldoHoy: 1000,
      eventos: [
        ev({ type: 'income', amount: 650, predictedDate: '2026-08-20' }),
        ev({ type: 'expense', amount: 74.09, predictedDate: '2026-08-25' }),
        ev({ type: 'expense', amount: 999, predictedDate: '2026-09-01' }), // otro mes
        ev({ type: 'expense', amount: 500, predictedDate: '2026-08-05', descartado: true }),
        ev({ type: 'expense', amount: 500, predictedDate: '2026-08-05', status: 'executed' }),
      ],
      year: 2026,
      month0: 7,
    });
    expect(c).toEqual({ entra: 650, sale: -74.09, cierre: 1575.91 });
  });

  it('los traspasos internos NO entran ni salen', () => {
    const c = cierrePorCuenta({
      saldoHoy: 100,
      eventos: [
        ev({ type: 'expense', amount: 200, categoryKey: 'traspaso_salida' }),
        ev({ type: 'income', amount: 200, categoryKey: 'traspaso_entrada' }),
      ],
      year: 2026,
      month0: 7,
    });
    expect(c).toEqual({ entra: 0, sale: 0, cierre: 100 });
  });

  // La invariante que motivó la función: el total de la columna "Cierre" de la
  // tabla de cuentas tiene que ser EXACTAMENTE el cierre del hero.
  it('Σ cierrePorCuenta === KpisHero.cierre · también con traspasos por medio', () => {
    const cuentas = [cuenta(1), cuenta(2)];
    const saldos = new Map([
      [1, 1000],
      [2, 500],
    ]);
    const eventos = [
      ev({ accountId: 1, type: 'income', amount: 650, predictedDate: '2026-08-20' }),
      ev({ accountId: 1, type: 'expense', amount: 74.09, predictedDate: '2026-08-25' }),
      ev({ accountId: 2, type: 'expense', amount: 33.5, predictedDate: '2026-08-12' }),
      // Un traspaso 1 → 2 · sus patas no deben mover ningún cierre.
      ev({ accountId: 1, type: 'expense', amount: 300, categoryKey: 'traspaso_salida' }),
      ev({ accountId: 2, type: 'income', amount: 300, categoryKey: 'traspaso_entrada' }),
    ];

    const hero = calcularKpisHero({ cuentas, saldoPorCuenta: saldos, eventos, year: 2026, month0: 7 });
    const suma = cuentas.reduce(
      (s, c) =>
        s +
        cierrePorCuenta({
          saldoHoy: saldos.get(c.id as number) ?? 0,
          eventos: eventos.filter((e) => e.accountId === c.id),
          year: 2026,
          month0: 7,
        }).cierre,
      0
    );
    expect(Math.round(suma * 100) / 100).toBe(hero.cierre);
  });

  // El defecto que se arregla: la cabecera del calendario no excluía los
  // traspasos y con uno en el mes discrepaba del hero.
  it('resumirMes (calendario) dice lo mismo que el hero con traspasos en el mes', () => {
    const cuentas = [cuenta(1), cuenta(2)];
    const saldos = new Map([
      [1, 1000],
      [2, 500],
    ]);
    const eventos = [
      ev({ accountId: 1, type: 'income', amount: 650, predictedDate: '2026-08-20' }),
      ev({ accountId: 1, type: 'expense', amount: 300, categoryKey: 'traspaso_salida' }),
      ev({ accountId: 2, type: 'income', amount: 300, categoryKey: 'traspaso_entrada' }),
    ];
    const hero = calcularKpisHero({ cuentas, saldoPorCuenta: saldos, eventos, year: 2026, month0: 7 });
    const resumen = resumirMes({ year: 2026, month0: 7, eventos, saldoTotalHoy: hero.saldo });

    expect(resumen.cierre).toBe(hero.cierre);
    expect(resumen.quedaEntrar).toBe(hero.pendienteEntrar);
    expect(resumen.quedaSalir).toBe(hero.pendienteSalir);
  });
});

describe('serieDiariaConsolidada · 30 días rodantes', () => {
  const HOY = '2026-08-18';

  it('31 puntos · empieza hoy con el saldo consolidado y acumula día a día', () => {
    const { puntos } = serieDiariaConsolidada({
      cuentas: [cuenta(1), cuenta(2)],
      saldoPorCuenta: new Map([
        [1, 1000],
        [2, 500],
      ]),
      eventos: [
        ev({ accountId: 1, type: 'income', amount: 650, predictedDate: '2026-08-20' }),
        ev({ accountId: 2, type: 'expense', amount: 100, predictedDate: '2026-08-25' }),
      ],
      hoy: HOY,
    });

    expect(puntos).toHaveLength(31);
    expect(puntos[0]).toEqual({ dia: HOY, saldo: 1500 });
    expect(puntos[1].saldo).toBe(1500); // el 19 no pasa nada
    expect(puntos.find((p) => p.dia === '2026-08-20')?.saldo).toBe(2150);
    expect(puntos.find((p) => p.dia === '2026-08-25')?.saldo).toBe(2050);
    expect(puntos[30]).toEqual({ dia: '2026-09-17', saldo: 2050 });
  });

  // El punto de HOY es el saldo de hoy, y manda el mismo número que el hero:
  // dos cifras distintas para el mismo día, una al lado de otra en la misma
  // pantalla, es lo que hacía que el gráfico "no marcara lo mismo".
  //
  // Lo vencido sin confirmar NO desaparece: sigue por venir, y por eso se
  // aplica a partir del día siguiente en vez de descontarse de lo que hay hoy
  // en el banco.
  it('el punto de hoy es el saldo de hoy · lo vencido se ve desde mañana', () => {
    const { puntos } = serieDiariaConsolidada({
      cuentas: [cuenta(1)],
      saldoPorCuenta: new Map([[1, 100]]),
      eventos: [ev({ accountId: 1, type: 'expense', amount: 30, predictedDate: '2026-08-01' })],
      hoy: HOY,
    });
    expect(puntos[0].saldo).toBe(100);
    expect(puntos[1].saldo).toBe(70);
  });

  // Un cargo de hoy que hunde la cuenta se avisa HOY, aunque el punto de hoy
  // enseñe el saldo todavía en positivo: el aviso mira lo que va a pasar.
  it('el descubierto de hoy se detecta aunque el punto de hoy no lo pinte', () => {
    const { puntos, descubierto } = serieDiariaConsolidada({
      cuentas: [cuenta(1, 'Sabadell')],
      saldoPorCuenta: new Map([[1, 20]]),
      eventos: [ev({ accountId: 1, type: 'expense', amount: 50, predictedDate: HOY })],
      hoy: HOY,
    });
    expect(puntos[0].saldo).toBe(20);
    expect(descubierto?.dia).toBe(HOY);
    expect(descubierto?.importe).toBe(-30);
  });

  it('el primer día en que UNA cuenta cruza 0 se atribuye a esa cuenta', () => {
    const { descubierto } = serieDiariaConsolidada({
      cuentas: [cuenta(1, 'Sabadell'), cuenta(2, 'Unicaja')],
      saldoPorCuenta: new Map([
        [1, 778.07],
        [2, 31487.05],
      ]),
      eventos: [ev({ accountId: 1, type: 'expense', amount: 2500, predictedDate: '2026-08-27' })],
      hoy: HOY,
    });
    expect(descubierto).toEqual({
      dia: '2026-08-27',
      cuentaId: 1,
      cuentaAlias: 'Sabadell',
      importe: -1721.93,
    });
  });

  it('un traspaso interno puede dejar corta una cuenta sin mover el consolidado', () => {
    const { puntos, descubierto } = serieDiariaConsolidada({
      cuentas: [cuenta(1, 'A'), cuenta(2, 'B')],
      saldoPorCuenta: new Map([
        [1, 100],
        [2, 1000],
      ]),
      eventos: [
        ev({ accountId: 1, type: 'expense', amount: 300, predictedDate: '2026-08-22', categoryKey: 'traspaso_salida' }),
        ev({ accountId: 2, type: 'income', amount: 300, predictedDate: '2026-08-22', categoryKey: 'traspaso_entrada' }),
      ],
      hoy: HOY,
    });
    // El consolidado no se mueve · las patas se anulan.
    expect(puntos.every((p) => p.saldo === 1100)).toBe(true);
    // Pero la cuenta A cruza a −200 y eso SÍ se avisa.
    expect(descubierto).toMatchObject({ dia: '2026-08-22', cuentaId: 1, importe: -200 });
  });

  it('descartados, ejecutados y piezas de tarjeta no mueven la serie', () => {
    const { puntos } = serieDiariaConsolidada({
      cuentas: [cuenta(1)],
      saldoPorCuenta: new Map([[1, 100]]),
      eventos: [
        ev({ accountId: 1, amount: 30, predictedDate: '2026-08-20', descartado: true }),
        ev({ accountId: 1, amount: 30, predictedDate: '2026-08-20', status: 'executed' }),
        ev({ accountId: 1, amount: 30, predictedDate: '2026-08-20', sourceType: 'gasto_tarjeta' }),
      ],
      hoy: HOY,
    });
    expect(puntos.every((p) => p.saldo === 100)).toBe(true);
  });

  it('una cuenta que YA está en negativo hoy no "cruza"', () => {
    const { descubierto } = serieDiariaConsolidada({
      cuentas: [cuenta(1)],
      saldoPorCuenta: new Map([[1, -50]]),
      eventos: [ev({ accountId: 1, type: 'expense', amount: 30, predictedDate: '2026-08-20' })],
      hoy: HOY,
    });
    expect(descubierto).toBeNull();
  });
});
