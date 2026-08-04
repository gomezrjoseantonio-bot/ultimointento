// Qué cuentas pueden pagar con cada método · docs/VOCABULARIO-dinero.md §2.
//
// El formulario de gasto recurrente ofrecía las diez cuentas con método
// "efectivo" —que sale del colchón, no del banco— y con "bizum" —que solo
// puede salir de la única cuenta que lo tiene atado al teléfono—. Guardar eso
// deja un dato imposible que luego se proyecta sobre la cuenta equivocada.
//
// Estas son las reglas del vocabulario, escritas una vez.

import {
  cuentaDelCargo,
  cuentaDeLaTarjeta,
  cuentaParaElMetodo,
  cuentasQuePuedenPagar,
  elMetodoDecideLaCuenta,
  sePuedePagarConTarjeta,
  tarjetaParaElPago,
  tarjetasQuePuedenPagar,
} from '../cuentasPorMetodoPago';
import type { Account } from '../db';
import type { Tarjeta } from '../../types/tarjetas';

const corriente = { id: 1, alias: 'Santander', tipo: 'CORRIENTE' } as Account;
const conBizum = { id: 2, alias: 'Sabadell', tipo: 'CORRIENTE', bizum: true } as Account;
const efectivo = { id: 3, alias: 'Efectivo', tipo: 'EFECTIVO' } as Account;

const TODAS = [corriente, conBizum, efectivo];

describe('el método restringe la cuenta', () => {
  it('el efectivo sale del efectivo · de ninguna otra', () => {
    expect(cuentasQuePuedenPagar('efectivo', TODAS)).toEqual([efectivo]);
  });

  it('el Bizum sale de la cuenta que lo tiene · de ninguna otra', () => {
    expect(cuentasQuePuedenPagar('bizum', TODAS)).toEqual([conBizum]);
  });

  it.each(['domiciliacion', 'transferencia', 'tarjeta'] as const)(
    '%s solo desde cuentas bancarias · el colchón no tiene IBAN',
    (metodo) => {
      expect(cuentasQuePuedenPagar(metodo, TODAS)).toEqual([corriente, conBizum]);
    }
  );
});

describe('cuándo NO se puede usar un método', () => {
  it('sin cuenta de efectivo no se paga en efectivo', () => {
    expect(cuentasQuePuedenPagar('efectivo', [corriente, conBizum])).toEqual([]);
  });

  it('sin ninguna cuenta con Bizum no se paga por Bizum', () => {
    expect(cuentasQuePuedenPagar('bizum', [corriente, efectivo])).toEqual([]);
  });
});

describe('cuándo la cuenta no se elige', () => {
  it.each(['efectivo', 'bizum'] as const)('%s la decide el método', (metodo) => {
    expect(elMetodoDecideLaCuenta(metodo)).toBe(true);
  });

  // Ojo con `tarjeta`: aquí es `false` porque el MÉTODO por sí solo no basta
  // para saber la cuenta. Quien la decide es la TARJETA elegida —ver
  // `cuentaDeLaTarjeta` más abajo—, así que tampoco se elige a mano.
  it.each(['domiciliacion', 'transferencia', 'tarjeta'] as const)('%s sí se elige', (metodo) => {
    expect(elMetodoDecideLaCuenta(metodo)).toBe(false);
  });
});

describe('recolocar la cuenta al cambiar de método', () => {
  // Sin esto, cambiar a Efectivo escondía el desplegable y dejaba pegada la
  // cuenta bancaria anterior: mal, y encima invisible.
  it('cambiar a efectivo se lleva la cuenta al efectivo', () => {
    expect(cuentaParaElMetodo('efectivo', TODAS, corriente.id)).toBe(efectivo.id);
  });

  it('cambiar a bizum se lleva la cuenta a la que lo tiene', () => {
    expect(cuentaParaElMetodo('bizum', TODAS, corriente.id)).toBe(conBizum.id);
  });

  // Si la que ya estaba sigue valiendo, no se toca: cambiar de domiciliación a
  // transferencia no tiene por qué mover el dinero de cuenta.
  it('respeta la cuenta que ya valía', () => {
    expect(cuentaParaElMetodo('transferencia', TODAS, conBizum.id)).toBe(conBizum.id);
  });

  it('si la guardada ya no vale, propone una que sí', () => {
    expect(cuentaParaElMetodo('domiciliacion', TODAS, efectivo.id)).toBe(corriente.id);
  });

  it('sin cuenta posible no inventa ninguna', () => {
    expect(cuentaParaElMetodo('efectivo', [corriente], corriente.id)).toBeUndefined();
  });
});

// ─── Pagar con tarjeta · §3 ────────────────────────────────────────────────
//
// «Tarjeta» no dice de qué cuenta sale, dice con QUÉ se paga. Guardarlo a secas
// dejaba la cuenta a elección libre, y por ahí un gasto de la Carrefour acababa
// apuntando a Santander cuando su recibo lo paga Bankinter.

describe('pagar con tarjeta', () => {
  const visa = {
    id: 10,
    alias: 'Visa',
    origen: 'banco',
    modalidad: 'credito',
    cuentaLiquidacionId: 1,
    activa: true,
    createdAt: '',
    updatedAt: '',
  } as Tarjeta;
  const carrefour = { ...visa, id: 11, alias: 'Carrefour', cuentaLiquidacionId: 2 } as Tarjeta;
  const debaja = { ...visa, id: 12, alias: 'Vieja', activa: false } as Tarjeta;

  it('sin ninguna tarjeta el medio no se puede usar', () => {
    expect(sePuedePagarConTarjeta([])).toBe(false);
    expect(sePuedePagarConTarjeta([visa])).toBe(true);
  });

  // Una tarjeta dada de baja no paga nada · ofrecerla dejaría un gasto colgado
  // de algo que ya no existe.
  it('las de baja no se ofrecen', () => {
    expect(tarjetasQuePuedenPagar([visa, debaja])).toEqual([visa]);
    expect(sePuedePagarConTarjeta([debaja])).toBe(false);
  });

  it('respeta la ya elegida si sigue valiendo', () => {
    expect(tarjetaParaElPago([visa, carrefour], 11)).toBe(11);
  });

  it('y elige otra si la guardada ya no está', () => {
    expect(tarjetaParaElPago([visa, carrefour], 999)).toBe(10);
    expect(tarjetaParaElPago([], 10)).toBeUndefined();
  });

  it('la cuenta la decide la tarjeta · no se elige', () => {
    expect(cuentaDeLaTarjeta(11, [visa, carrefour])).toBe(2);
  });

  // Devolver la cuenta anterior sería la peor forma de estar mal: invisible.
  it('una tarjeta que ya no existe no deja cuenta pegada', () => {
    expect(cuentaDeLaTarjeta(999, [visa])).toBeUndefined();
    expect(cuentaDeLaTarjeta(undefined, [visa])).toBeUndefined();
  });
});

// ─── De qué cuenta sale de verdad · §2 ─────────────────────────────────────
//
// `cuentaCargo` es lo que se guardó el día que se creó el gasto, y para los
// métodos que NO dejan elegir es una copia que puede mentir. Un recurrente en
// efectivo apuntando a Santander hace que el banco parezca más pobre y que el
// colchón no baje NUNCA: el dinero sale de un sitio del que no salió.

describe('la cuenta que paga de verdad', () => {
  const gasto = (metodoPago: 'domiciliacion' | 'efectivo' | 'bizum', cuentaCargo: number) =>
    ({ metodoPago, cuentaCargo }) as const;

  // El caso de Jose: un gasto en efectivo guardado antes de que existiera la
  // regla, con una cuenta bancaria pegada.
  it('en efectivo sale del colchón · aunque el gasto diga otra cosa', () => {
    expect(cuentaDelCargo(gasto('efectivo', corriente.id!), undefined, TODAS)).toBe(efectivo.id);
  });

  it('por Bizum sale de la cuenta que lo tiene', () => {
    expect(cuentaDelCargo(gasto('bizum', corriente.id!), undefined, TODAS)).toBe(conBizum.id);
  });

  // Aquí el usuario SÍ elige · cambiárselo por nuestra cuenta sería peor que
  // el problema que arregla.
  it('domiciliada se respeta lo que eligió el usuario', () => {
    expect(cuentaDelCargo(gasto('domiciliacion', conBizum.id!), undefined, TODAS)).toBe(conBizum.id);
  });

  // §3 · con tarjeta manda su cuenta de liquidación, por encima de todo.
  it('con tarjeta manda su cuenta de liquidación', () => {
    expect(cuentaDelCargo(gasto('domiciliacion', 1), { cuentaLiquidacionId: 99 }, TODAS)).toBe(99);
  });

  // Sin cuentas a mano —un llamante que no las tiene— mejor la copia que nada.
  it('sin cuentas se respeta lo guardado', () => {
    expect(cuentaDelCargo(gasto('efectivo', 7), undefined, [])).toBe(7);
  });

  // Sin colchón dado de alta no hay a dónde llevarlo · no se inventa una cuenta.
  it('sin colchón se queda donde estaba', () => {
    expect(cuentaDelCargo(gasto('efectivo', 7), undefined, [corriente])).toBe(7);
  });
});
