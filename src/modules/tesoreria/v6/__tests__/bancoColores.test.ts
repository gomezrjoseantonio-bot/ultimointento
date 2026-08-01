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
  REJILLA_PUNTO, GRISES_PUNTO,
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

describe('la rejilla de color (§10)', () => {
  it('ningún hex suelto · el valor es CSS calculado, no un color escrito a mano', () => {
    for (const c of [...REJILLA_PUNTO.flat(), ...GRISES_PUNTO]) {
      expect(c.token).not.toMatch(/#[0-9a-f]{3,8}/i);
      expect(c.token).toMatch(/^hsl\(/);
    }
  });

  it('es una rejilla de verdad · todas las filas con las mismas columnas', () => {
    const ancho = REJILLA_PUNTO[0].length;
    expect(ancho).toBeGreaterThan(6);
    for (const fila of REJILLA_PUNTO) expect(fila).toHaveLength(ancho);
  });

  it('cada COLUMNA comparte tono · es lo que deja recorrerla con la vista', () => {
    const tono = (t: string) => t.match(/^hsl\((\d+)/)![1];
    for (let col = 0; col < REJILLA_PUNTO[0].length; col++) {
      const tonos = new Set(REJILLA_PUNTO.map((f) => tono(f[col].token)));
      expect(tonos.size).toBe(1);
    }
  });

  it('cada FILA va de más clara a más oscura', () => {
    const luz = (t: string) => Number(t.match(/(\d+)%\)$/)![1]);
    const porFila = REJILLA_PUNTO.map((f) => luz(f[0].token));
    for (let i = 1; i < porFila.length; i++) {
      expect(porFila[i]).toBeLessThan(porFila[i - 1]);
    }
  });

  it('no repite ningún color · dos muestras iguales no sirven para elegir', () => {
    const todos = [...REJILLA_PUNTO.flat(), ...GRISES_PUNTO].map((c) => c.token);
    expect(new Set(todos).size).toBe(todos.length);
  });

  it('toda muestra tiene nombre · el selector se usa también sin ver', () => {
    for (const c of [...REJILLA_PUNTO.flat(), ...GRISES_PUNTO]) {
      expect(c.nombre.trim().length).toBeGreaterThan(0);
    }
  });

  it('los grises no tienen tono · por eso van aparte de la rejilla', () => {
    for (const c of GRISES_PUNTO) expect(c.token).toMatch(/^hsl\(0 0%/);
  });
});
