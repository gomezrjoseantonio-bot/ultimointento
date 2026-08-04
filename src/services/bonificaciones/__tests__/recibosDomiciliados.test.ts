// Los recibos domiciliados en una cuenta, mes a mes · VOCABULARIO §6 ter.
//
// Lo que vigila esto: que se cuenten recibos DISTINTOS y no cargos —«tres
// recibos domiciliados» son tres servicios, no el de la luz tres meses— y que
// solo cuente lo domiciliado en esa cuenta.

import { recibosDomiciliados, recibosDeLaCuenta } from '../recibosDomiciliados';
import type { TreasuryEvent } from '../../db';

const recibo = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 1,
    type: 'expense',
    amount: -62.4,
    predictedDate: '2026-03-05',
    description: 'Luz',
    sourceType: 'gasto_recurrente',
    sourceId: 11,
    accountId: 3,
    paymentMethod: 'Domiciliado',
    status: 'executed',
    ...over,
  }) as TreasuryEvent;

describe('cuántos recibos hay domiciliados', () => {
  it('agrupa por cuenta y mes', () => {
    expect(recibosDomiciliados([recibo()])).toEqual([
      { cuentaId: 3, mes: '2026-03', cuantos: 1, estado: 'cerrado' },
    ]);
  });

  it('recibos distintos del mismo mes suman', () => {
    const [m] = recibosDomiciliados([
      recibo({ id: 1, sourceId: 11, description: 'Luz' }),
      recibo({ id: 2, sourceId: 12, description: 'Agua' }),
      recibo({ id: 3, sourceId: 13, description: 'Móvil' }),
    ]);

    expect(m.cuantos).toBe(3);
  });

  // «Tres recibos domiciliados» son TRES SERVICIOS. Doce cargos de la luz en un
  // año son UN recibo, y contarlos como doce daría por cumplida una condición
  // que no se cumple.
  it('el mismo recibo dos veces en un mes cuenta una', () => {
    const [m] = recibosDomiciliados([
      recibo({ id: 1, sourceId: 11, predictedDate: '2026-03-05' }),
      recibo({ id: 2, sourceId: 11, predictedDate: '2026-03-20' }),
    ]);

    expect(m.cuantos).toBe(1);
  });

  // Un apunte suelto no tiene origen · lo único que lo distingue es su texto.
  it('sin origen, cada descripción es un recibo', () => {
    const [m] = recibosDomiciliados([
      recibo({ id: 1, sourceId: undefined, description: 'Alarma' }),
      recibo({ id: 2, sourceId: undefined, description: 'Gimnasio' }),
      recibo({ id: 3, sourceId: undefined, description: 'Alarma' }),
    ]);

    expect(m.cuantos).toBe(2);
  });

  it('cuentas distintas no se mezclan', () => {
    const meses = recibosDomiciliados([recibo(), recibo({ id: 2, accountId: 9 })]);

    expect(recibosDeLaCuenta(meses, 9)).toHaveLength(1);
    expect(recibosDeLaCuenta(meses, 3)).toHaveLength(1);
  });
});

describe('qué NO es un recibo domiciliado', () => {
  // El banco bonifica por lo que le pasa a él por domiciliación · una
  // transferencia que haces tú no la ve como recibo.
  it('lo pagado por otro medio no cuenta', () => {
    expect(recibosDomiciliados([recibo({ paymentMethod: 'Transferencia' })])).toEqual([]);
    expect(recibosDomiciliados([recibo({ paymentMethod: undefined })])).toEqual([]);
  });

  it('un ingreso no es un recibo', () => {
    expect(recibosDomiciliados([recibo({ type: 'income' })])).toEqual([]);
  });

  it('lo descartado no está domiciliado ese mes', () => {
    expect(recibosDomiciliados([recibo({ descartado: true })])).toEqual([]);
  });

  it('sin cuenta no se puede decir dónde se domicilia', () => {
    expect(recibosDomiciliados([recibo({ accountId: undefined })])).toEqual([]);
  });
});

describe('cuándo un mes está cerrado', () => {
  it('todos sus cargos cobrados · cerrado', () => {
    expect(recibosDomiciliados([recibo({ status: 'executed' })])[0].estado).toBe('cerrado');
  });

  // Con uno cobrado y otro por pasar, el mes todavía puede sumar recibos:
  // darlo por cerrado diría que ese mes se quedó corto cuando aún falta.
  it('con algo por cargar · abierto', () => {
    const [m] = recibosDomiciliados([
      recibo({ id: 1, sourceId: 11, status: 'executed' }),
      recibo({ id: 2, sourceId: 12, status: 'predicted' }),
    ]);

    expect(m.estado).toBe('abierto');
  });
});

describe('la ventana', () => {
  const meses = recibosDomiciliados([
    recibo({ id: 1, predictedDate: '2026-01-05' }),
    recibo({ id: 2, predictedDate: '2026-02-05' }),
    recibo({ id: 3, predictedDate: '2026-03-05' }),
  ]);

  // Comparando sin recortar a mes, "2026-02" nunca sería >= "2026-02-04".
  it('el mes en que abre la ventana entra, aunque abra el día 4', () => {
    expect(recibosDeLaCuenta(meses, 3, { desde: '2026-02-04' }).map((m) => m.mes))
      .toEqual(['2026-03', '2026-02']);
  });

  it('puede pedirse solo lo cerrado', () => {
    const conAbierto = recibosDomiciliados([
      recibo({ id: 1, predictedDate: '2026-01-05', status: 'executed' }),
      recibo({ id: 2, predictedDate: '2026-02-05', status: 'predicted' }),
    ]);

    expect(recibosDeLaCuenta(conAbierto, 3, { soloCerrados: true }).map((m) => m.mes))
      .toEqual(['2026-01']);
  });
});
