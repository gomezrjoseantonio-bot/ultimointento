// Color del punto de cuenta (§4.2 · §4.8).
//
// El punto es la única identidad cromática de la tarjeta, y para lo que más
// sirve es para distinguir a ojo dos cuentas del MISMO banco — el caso que la
// deducción automática no puede resolver. De ahí que la elección del usuario
// tenga que ganar siempre.

import {
  colorDeBanco,
  colorAutomatico,
  colorSugerido,
  SIN_COLOR,
  CLAVE_SIN_COLOR,
  PALETA_PUNTO,
} from '../bancoColores';
import type { Account } from '../../../../services/db';

const cuenta = (over: Partial<Account> = {}): Account =>
  ({
    id: 1,
    iban: 'ES9100491500051234567891', // 0049 · Santander
    status: 'ACTIVE',
    activa: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Account;

describe('deducción automática', () => {
  it('saca el banco del código de entidad del IBAN', () => {
    expect(colorAutomatico(cuenta())).toBe('var(--atlas-v5-bank-santander)');
  });

  it('cae al nombre del banco si el IBAN no dice nada', () => {
    expect(colorAutomatico(cuenta({ iban: '', bank: 'Banco Bilbao BBVA' }))).toBe(
      'var(--atlas-v5-bank-bbva)'
    );
  });

  it('neutro si no reconoce nada', () => {
    expect(colorAutomatico(cuenta({ iban: '', bank: 'Banco de Marte' }))).toBe(SIN_COLOR);
  });
});

describe('la elección del usuario manda (§4.8)', () => {
  it('un color elegido gana al del banco', () => {
    const c = cuenta({ colorPunto: 'var(--atlas-v5-bank-ing)' });
    expect(colorDeBanco(c)).toBe('var(--atlas-v5-bank-ing)');
  });

  it('"sin color" gana también · es una elección, no la ausencia de una', () => {
    expect(colorDeBanco(cuenta({ colorPunto: CLAVE_SIN_COLOR }))).toBe(SIN_COLOR);
  });

  it('sin elección, se usa el del banco', () => {
    expect(colorDeBanco(cuenta())).toBe('var(--atlas-v5-bank-santander)');
  });

  it('dos cuentas del mismo banco se distinguen si el usuario lo pide', () => {
    const a = cuenta({ id: 1 });
    const b = cuenta({ id: 2, colorPunto: 'var(--atlas-v5-bank-unicaja)' });
    expect(colorDeBanco(a)).not.toBe(colorDeBanco(b));
  });
});

describe('lo que propone el selector', () => {
  it('sugiere el del banco, IGNORANDO lo ya elegido', () => {
    // Si `colorSugerido` mirase `colorPunto`, la ficha propondría como "color
    // del banco" la elección previa del propio usuario · sinsentido circular.
    const c = cuenta({ colorPunto: 'var(--atlas-v5-bank-ing)' });
    expect(colorSugerido(c)).toBe('var(--atlas-v5-bank-santander)');
  });

  it('no sugiere nada si no hay banco reconocible', () => {
    expect(colorSugerido(cuenta({ iban: '', bank: '' }))).toBeNull();
  });
});

describe('la paleta', () => {
  it('solo ofrece tokens · ningún hex suelto (§5)', () => {
    for (const c of PALETA_PUNTO) {
      // §10 · la paleta ya no sale de marcas de banco: entre ellas había dos
      // rojos y cinco azules que a 8px no se distinguen, y el punto existe
      // justo para separar dos cuentas del mismo banco.
      expect(c.token).toMatch(/^var\(--atlas-v5-punto-[a-z]+\)$/);
    }
  });

  it('no repite colores · dos muestras iguales no sirven para distinguir', () => {
    const tokens = PALETA_PUNTO.map((c) => c.token);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('cada muestra tiene nombre · el color solo no es accesible', () => {
    expect(PALETA_PUNTO.every((c) => c.nombre.trim().length > 0)).toBe(true);
  });
});
