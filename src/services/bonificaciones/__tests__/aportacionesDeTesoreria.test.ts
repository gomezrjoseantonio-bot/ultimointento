// Lo que sale de una cuenta hacia un plan o un fondo.
//
// «El plan de pensiones y los fondos son MOVIMIENTOS DE TESORERÍA de esa cuenta
// a la aportación del plan de ese banco» *(Jose · 8 ago 2026)*. Y así estaba
// guardado desde el principio: `sourceType: 'inversion_aportacion'` sale de su
// cuenta como cualquier cargo.
//
// Lo que había en su lugar: FONDOS en la lista de lo que no se puede comprobar,
// con la excusa de que «el saldo se prueba con la posición»; y los planes
// mirando un store aparte que, vacío, no decía «no lo sé» sino «no cumples».

import { aportacionesDeTesoreria, aportadoDesde } from '../aportacionesDeTesoreria';
import type { TreasuryEvent } from '../../db';

const aportacion = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 1,
    accountId: 3,
    type: 'expense',
    sourceType: 'inversion_aportacion',
    amount: -300,
    predictedDate: '2026-03-10',
    status: 'executed',
    ...over,
  }) as unknown as TreasuryEvent;

describe('lo que le entra al banco por esa vía', () => {
  it('una aportación cuenta, y en positivo', () => {
    const [a] = aportacionesDeTesoreria([aportacion()]);

    expect(a.cuentaId).toBe(3);
    expect(a.anio).toBe(2026);
    expect(a.importe).toBe(300);
  });

  it('la compra inicial de un fondo también es aportar', () => {
    const [a] = aportacionesDeTesoreria([aportacion({ sourceType: 'inversion_compra' })]);

    expect(a.importe).toBe(300);
  });

  it('se suman las del año y se separan por cuenta', () => {
    const todas = aportacionesDeTesoreria([
      aportacion(),
      aportacion({ id: 2, amount: -200, predictedDate: '2026-09-10' }),
      aportacion({ id: 3, accountId: 9, amount: -50 }),
    ]);

    expect(aportadoDesde(todas, 3, 2026)!.importe).toBe(500);
    expect(aportadoDesde(todas, 9, 2026)!.importe).toBe(50);
  });

  it('y por año · las condiciones de plan se miden por ejercicio', () => {
    const todas = aportacionesDeTesoreria([
      aportacion(),
      aportacion({ id: 2, amount: -900, predictedDate: '2025-03-10' }),
    ]);

    expect(aportadoDesde(todas, 3, 2026)!.importe).toBe(300);
    expect(aportadoDesde(todas, 3, 2025)!.importe).toBe(900);
  });

  // Manda lo aportado de VERDAD sobre lo previsto · igual que en la nómina, y
  // por lo mismo: esta cifra se presume ante un banco.
  it('manda el importe real sobre el previsto', () => {
    const [a] = aportacionesDeTesoreria([aportacion({ actualAmount: -250 } as Partial<TreasuryEvent>)]);

    expect(a.importe).toBe(250);
  });

  it('y la fecha real sobre la prevista', () => {
    const [a] = aportacionesDeTesoreria([
      aportacion({ predictedDate: '2025-12-30', actualDate: '2026-01-02' } as Partial<TreasuryEvent>),
    ]);

    expect(a.anio).toBe(2026);
  });
});

describe('qué NO cuenta', () => {
  // El usuario dijo que no ocurre · ni es real ni prevista. Contarla diría que
  // cumples una condición que no cumples, y eso se paga en el recibo.
  it('una aportación descartada', () => {
    expect(
      aportacionesDeTesoreria([aportacion({ descartado: true } as Partial<TreasuryEvent>)])
    ).toHaveLength(0);
  });

  it('ni un movimiento que no es aportar', () => {
    expect(aportacionesDeTesoreria([aportacion({ sourceType: 'nomina' })])).toHaveLength(0);
    expect(aportacionesDeTesoreria([aportacion({ sourceType: 'gasto_recurrente' })])).toHaveLength(0);
  });

  it('ni una sin cuenta · sin saber de dónde sale no ata a ningún banco', () => {
    expect(
      aportacionesDeTesoreria([aportacion({ accountId: undefined } as Partial<TreasuryEvent>)])
    ).toHaveLength(0);
  });
});

// Una aportación prevista todavía puede no ocurrir · a diferencia del seguro,
// aquí no hay contrato que obligue: la transferencia al plan la haces cuando
// quieres.
describe('lo previsto se distingue de lo hecho', () => {
  it('lo ya salido cierra el año', () => {
    expect(aportacionesDeTesoreria([aportacion()])[0].estado).toBe('cerrado');
  });

  it('lo previsto lo deja abierto', () => {
    expect(
      aportacionesDeTesoreria([aportacion({ status: 'predicted' })])[0].estado
    ).toBe('abierto');
  });

  it('y una hecha con otra por venir deja el año abierto', () => {
    const [a] = aportacionesDeTesoreria([
      aportacion(),
      aportacion({ id: 2, status: 'predicted', predictedDate: '2026-11-10' }),
    ]);

    expect(a.estado).toBe('abierto');
    expect(a.importe).toBe(600);
  });

  // Y no basta con marcar el año · quien juzga la condición necesita la cifra
  // de lo que HA SALIDO, porque es lo único que demuestra algo. Con una sola
  // suma, una aportación puesta para noviembre daba la bonificación por ganada
  // en enero.
  it('lo salido va aparte de lo apuntado', () => {
    const [a] = aportacionesDeTesoreria([
      aportacion(),
      aportacion({ id: 2, status: 'predicted', predictedDate: '2026-11-10' }),
    ]);

    expect(a.importe).toBe(600);
    expect(a.salido).toBe(300);
  });

  it('y lo que aún no ha salido no suma nada a lo salido', () => {
    const [a] = aportacionesDeTesoreria([aportacion({ status: 'predicted' })]);

    expect(a.salido).toBe(0);
  });
});
