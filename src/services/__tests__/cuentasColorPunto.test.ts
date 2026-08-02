// El color del punto de la cuenta · §4.8.
//
// Se elegía en la ficha, la ficha lo mandaba, el servicio decía "guardado"… y
// no se guardaba: `applyExtendedFields` —que es quien copia los campos del
// wizard a la cuenta— no lo tenía en su lista, así que el color se perdía ahí
// en silencio. El mismo patrón de siempre: el dato existe en origen, alguien lo
// declara y nadie lo pasa.
//
// Este candado mira el ESLABÓN que faltaba, no la pantalla: es donde se rompió.

import { __private__ } from '../cuentasService';
import type { Account } from '../db';

const cuenta = (over: Partial<Account> = {}): Account =>
  ({ id: 1, iban: 'ES91', status: 'ACTIVE', activa: true, createdAt: '', updatedAt: '', ...over }) as Account;

describe('el color del punto llega hasta la cuenta', () => {
  it('se copia al elegirlo', () => {
    const c = cuenta();
    __private__.applyExtendedFields(c, { colorPunto: '#B54A4A' });
    expect(c.colorPunto).toBe('#B54A4A');
  });

  // Volver a "el color del banco" es BORRAR la elección propia. Viajaba como
  // `undefined`, que en este servicio significa "no toques este campo", así que
  // una vez elegido un color no había forma de deshacerlo.
  it('la cadena vacía BORRA la elección · no la ignora', () => {
    const c = cuenta({ colorPunto: '#B54A4A' });
    __private__.applyExtendedFields(c, { colorPunto: '' });
    expect(c.colorPunto).toBeUndefined();
  });

  it('sin el campo, el color que hubiera se queda como estaba', () => {
    const c = cuenta({ colorPunto: '#B54A4A' });
    __private__.applyExtendedFields(c, { bic: 'BSCHESMM' });
    expect(c.colorPunto).toBe('#B54A4A');
  });
});
