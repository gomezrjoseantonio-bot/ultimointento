// La nómina que entra en una cuenta, mes a mes · VOCABULARIO §6 ter.
//
// Lo que vigila esto: que se mida por MESES y no por un total —«1.200 € al mes»
// no lo cumple un semestre con 7.200 € si un mes vino vacío y otro doble— y que
// no se dé por entrado lo que el banco todavía no ha abonado.

import { cobrosDeNomina, cobrosDeLaCuenta } from '../cobrosDeNomina';
import type { TreasuryEvent } from '../../db';

const evento = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 1,
    type: 'income',
    amount: 1300,
    predictedDate: '2026-03-25',
    description: 'Nómina – Orange',
    sourceType: 'nomina',
    sourceId: 7,
    accountId: 3,
    status: 'executed',
    ...over,
  }) as TreasuryEvent;

describe('lo que entra por nómina', () => {
  it('agrupa por cuenta y mes', () => {
    expect(cobrosDeNomina([evento()])).toEqual([
      { cuentaId: 3, mes: '2026-03', importe: 1300, estado: 'cerrado' },
    ]);
  });

  // Dos trabajos abonados en la misma cuenta: el banco ve entrar los dos.
  it('dos nóminas del mismo mes en la misma cuenta suman', () => {
    const [m] = cobrosDeNomina([
      evento({ id: 1, amount: 900 }),
      evento({ id: 2, sourceId: 8, amount: 600 }),
    ]);

    expect(m.importe).toBe(1500);
  });

  it('cuentas distintas no se mezclan', () => {
    const cobros = cobrosDeNomina([evento(), evento({ id: 2, accountId: 9, amount: 500 })]);

    expect(cobros).toHaveLength(2);
    expect(cobrosDeLaCuenta(cobros, 9)[0].importe).toBe(500);
  });

  // Manda lo COBRADO · una nómina prevista de 1.300 € que entró por 1.150 € no
  // llega al mínimo, y esta cifra se presume ante un banco.
  it('el importe real manda sobre el previsto', () => {
    expect(cobrosDeNomina([evento({ actualAmount: 1150 })])[0].importe).toBe(1150);
  });

  // El banco la vio entrar en mayo, no en abril.
  it('el mes es el del cobro real cuando lo hay', () => {
    expect(cobrosDeNomina([evento({ predictedDate: '2026-04-25', actualDate: '2026-05-02' })])[0].mes)
      .toBe('2026-05');
  });

  it('lo descartado no ha entrado', () => {
    expect(cobrosDeNomina([evento({ descartado: true })])).toEqual([]);
  });

  it('solo mira la nómina, no cualquier ingreso', () => {
    expect(cobrosDeNomina([evento({ sourceType: 'contrato' })])).toEqual([]);
    expect(cobrosDeNomina([evento({ type: 'expense' })])).toEqual([]);
  });

  // Sin cuenta no se puede decir dónde entró, y la cuenta es justo lo que exige
  // el banco.
  it('un cobro sin cuenta no cuenta', () => {
    expect(cobrosDeNomina([evento({ accountId: undefined })])).toEqual([]);
  });
});

describe('cuándo un mes está cerrado', () => {
  it('cobrado y conciliado · cerrado', () => {
    expect(cobrosDeNomina([evento({ status: 'executed' })])[0].estado).toBe('cerrado');
    expect(cobrosDeNomina([evento({ status: 'predicted', movementId: 42 })])[0].estado)
      .toBe('cerrado');
  });

  it('todavía previsto · abierto', () => {
    expect(cobrosDeNomina([evento({ status: 'predicted' })])[0].estado).toBe('abierto');
  });

  // Con una cobrada y otra por venir, el mes todavía puede crecer: darlo por
  // cerrado diría que ese mes se quedó corto cuando aún falta que entre.
  it('un mes con algo pendiente no está cerrado', () => {
    const [m] = cobrosDeNomina([
      evento({ id: 1, amount: 900, status: 'executed' }),
      evento({ id: 2, sourceId: 8, amount: 600, status: 'predicted' }),
    ]);

    expect(m.estado).toBe('abierto');
  });
});

describe('la ventana', () => {
  const cobros = cobrosDeNomina([
    evento({ id: 1, predictedDate: '2026-01-25' }),
    evento({ id: 2, predictedDate: '2026-02-25' }),
    evento({ id: 3, predictedDate: '2026-03-25' }),
  ]);

  // La ventana viene en días y los meses en `YYYY-MM`: comparando sin recortar,
  // "2026-02" nunca sería >= "2026-02-04" y febrero se caería fuera.
  it('el mes en que abre la ventana entra, aunque abra el día 4', () => {
    const meses = cobrosDeLaCuenta(cobros, 3, { desde: '2026-02-04', hasta: '2026-03-31' });

    expect(meses.map((m) => m.mes)).toEqual(['2026-03', '2026-02']);
  });

  it('lo anterior a la ventana queda fuera', () => {
    const meses = cobrosDeLaCuenta(cobros, 3, { desde: '2026-03-01' });

    expect(meses.map((m) => m.mes)).toEqual(['2026-03']);
  });

  it('puede pedirse solo lo cerrado', () => {
    const conAbierto = cobrosDeNomina([
      evento({ id: 1, predictedDate: '2026-01-25', status: 'executed' }),
      evento({ id: 2, predictedDate: '2026-02-25', status: 'predicted' }),
    ]);

    expect(cobrosDeLaCuenta(conAbierto, 3, { soloCerrados: true }).map((m) => m.mes))
      .toEqual(['2026-01']);
  });
});
