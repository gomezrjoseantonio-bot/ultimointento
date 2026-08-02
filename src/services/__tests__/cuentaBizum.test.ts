// El Bizum vive en UNA cuenta.
//
// No es una regla de ATLAS: el Bizum va atado a un teléfono y un teléfono a una
// cuenta. Permitir dos sería dejar que el usuario describa algo que no puede
// pasar, y luego una línea de Bizum no sabría de cuál es.

import { __private__ } from '../cuentasService';
import type { Account } from '../db';

const cuenta = (id: number, over: Partial<Account> = {}): Account =>
  ({ id, iban: `ES9${id}`, status: 'ACTIVE', activa: true, createdAt: '', updatedAt: '', ...over }) as Account;

describe('el Bizum se guarda en la cuenta', () => {
  it('se activa y se quita', () => {
    const c = cuenta(1);
    __private__.applyExtendedFields(c, { bizum: true });
    expect(c.bizum).toBe(true);

    __private__.applyExtendedFields(c, { bizum: false });
    expect(c.bizum).toBeUndefined();
  });

  it('sin el campo, se queda como estaba', () => {
    const c = cuenta(1, { bizum: true });
    __private__.applyExtendedFields(c, { bic: 'BSCHESMM' });
    expect(c.bizum).toBe(true);
  });
});
