// Lo que TIENES en un producto del banco · la otra mitad de las condiciones de
// inversión.
//
// «Es aportación en este caso, pero habrá otros que será tener X en el fondo o
// en el plan de pensiones del banco — por eso era clave la modelación de las
// bonificaciones» *(Jose · 9 ago 2026)*.

import { saldoEnElBanco, saldoCon } from '../saldoEnElBanco';
import type { PosicionInversion } from '../../../types/inversiones';

const posicion = (over: Partial<PosicionInversion> = {}): PosicionInversion =>
  ({
    id: 1,
    nombre: 'Unifond Moderado',
    tipo: 'fondo_inversion',
    entidad: 'Unicaja',
    valor_actual: 30000,
    activo: true,
    ...over,
  }) as PosicionInversion;

describe('lo que hay en cada banco', () => {
  it('un fondo se cuenta como fondo', () => {
    const [s] = saldoEnElBanco([posicion()]);

    expect(s.familia).toBe('fondo');
    expect(s.valor).toBe(30000);
  });

  it('un plan de pensiones y uno de empleo son la misma familia', () => {
    const saldos = saldoEnElBanco([
      posicion({ tipo: 'plan_pensiones', valor_actual: 8000 }),
      posicion({ id: 2, tipo: 'plan_empleo', valor_actual: 2000 }),
    ]);

    expect(saldos).toHaveLength(1);
    expect(saldos[0].familia).toBe('plan');
    expect(saldos[0].valor).toBe(10000);
  });

  it('fondos y planes del mismo banco NO se mezclan · son condiciones distintas', () => {
    const saldos = saldoEnElBanco([
      posicion(),
      posicion({ id: 2, tipo: 'plan_pensiones', valor_actual: 5000 }),
    ]);

    expect(saldos).toHaveLength(2);
  });

  // Si lo rescataste ya no tienes nada con ese banco · contarlo daría por
  // cumplida una condición que se perdió el día del rescate.
  it('una posición dada de baja no cuenta', () => {
    expect(saldoEnElBanco([posicion({ activo: false })])).toHaveLength(0);
  });

  it('ni lo que no es fondo ni plan · una acción no es un producto suyo', () => {
    expect(saldoEnElBanco([posicion({ tipo: 'accion' })])).toHaveLength(0);
  });
});

describe('el banco, comparable', () => {
  it('«Unicaja Banco, S.A.» es el mismo banco que «unicaja»', () => {
    const saldos = saldoEnElBanco([posicion({ entidad: 'Unicaja Banco, S.A.' })]);

    expect(saldoCon(saldos, 'unicaja', 'fondo')).toBe(30000);
  });

  it('y el de al lado no', () => {
    const saldos = saldoEnElBanco([posicion({ entidad: 'Santander' })]);

    expect(saldoCon(saldos, 'Unicaja', 'fondo')).toBeNull();
  });

  // `null` y no cero · no haber apuntado ninguna posición no es tenerla vacía,
  // y de un cero saldría un «no cumples» sobre algo que ATLAS no ha mirado.
  it('sin posiciones no se dice cero, se dice que no consta', () => {
    expect(saldoCon([], 'Unicaja', 'plan')).toBeNull();
  });

  it('ni se responde sin saber de qué banco es el préstamo', () => {
    const saldos = saldoEnElBanco([posicion()]);

    expect(saldoCon(saldos, undefined, 'fondo')).toBeNull();
  });
});
