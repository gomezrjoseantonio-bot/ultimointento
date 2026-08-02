// Candado del eje CUENTA (§4.9 · el día del calendario).
//
// En un día conviven cargos de varias cuentas, y la pregunta que se hace uno
// mirándolo es "¿qué le pasa a ESTA cuenta hoy?". Agrupado, cada bloque se lee
// entero de una vez, igual que al entrar por la cuenta.

import { agruparPorEje } from '../punteoAgrupacion';
import type { ItemPunteo } from '../../../../../services/punteo/punteoModel';

const item = (over: Partial<ItemPunteo> = {}): ItemPunteo => ({
  key: 'evt-1',
  kind: 'evento',
  refId: 1,
  estado: 'previsto',
  fecha: '2026-03-05',
  concepto: 'Recibo luz',
  activo: null,
  origen: 'Suministro',
  cuentaId: 1,
  importe: -74.09,
  ...over,
});

// La lista llega en el orden del usuario · el agrupado la reordena por nombre.
const CUENTAS = [
  { id: 3, label: 'Unicaja' },
  { id: 1, label: 'Abanca' },
];

describe('agrupar por cuenta', () => {
  it('junta bajo cada cuenta lo suyo, con su subtotal', () => {
    const grupos = agruparPorEje(
      [
        item({ key: 'a', refId: 1, cuentaId: 1, importe: -100 }),
        item({ key: 'b', refId: 2, cuentaId: 3, importe: 650 }),
        item({ key: 'c', refId: 3, cuentaId: 1, importe: -40 }),
      ],
      'cuenta',
      CUENTAS
    );

    expect(grupos.map((g) => g.titulo)).toEqual(['Abanca', 'Unicaja']);
    expect(grupos[0].items.map((i) => i.key)).toEqual(['a', 'c']);
    expect(grupos[1].items.map((i) => i.key)).toEqual(['b']);
    expect(grupos[0].subtotal).toBe(-140);
  });

  // En un día con seis cuentas y veinte cargos, por nombre se va directo a la
  // que se busca; por importe o por tipo hay que barrer la lista entera.
  it('ordena las cuentas por NOMBRE, llegue como llegue la lista', () => {
    const grupos = agruparPorEje(
      [item({ key: 'a', cuentaId: 3 }), item({ key: 'b', refId: 2, cuentaId: 1 })],
      'cuenta',
      CUENTAS
    );
    expect(grupos.map((g) => g.titulo)).toEqual(['Abanca', 'Unicaja']);
  });

  it('y dentro de cada cuenta, por concepto', () => {
    const grupos = agruparPorEje(
      [
        item({ key: 'z', cuentaId: 1, concepto: 'Zurich', importe: -900 }),
        item({ key: 'a', refId: 2, cuentaId: 1, concepto: 'Agua', importe: -10 }),
        item({ key: 'm', refId: 3, cuentaId: 1, concepto: 'Mapfre', importe: -500 }),
      ],
      'cuenta',
      CUENTAS
    );
    expect(grupos[0].items.map((i) => i.concepto)).toEqual(['Agua', 'Mapfre', 'Zurich']);
  });

  it('lleva el id de la cuenta para que la cabecera pinte su punto de banco', () => {
    const [g] = agruparPorEje([item({ cuentaId: 3 })], 'cuenta', CUENTAS);
    expect(g.cuentaId).toBe(3);
  });

  it('lo que no tiene cuenta va junto y el último, y se dice · no se inventa', () => {
    const grupos = agruparPorEje(
      [
        item({ key: 'sin-1', cuentaId: null }),
        item({ key: 'con', refId: 2, cuentaId: 1 }),
        item({ key: 'sin-2', refId: 3, cuentaId: null }),
      ],
      'cuenta',
      CUENTAS
    );
    // "Sin cuenta" es un cajón, no una cuenta: va al final aunque alfabéticamente
    // le tocara antes.
    expect(grupos.map((g) => g.titulo)).toEqual(['Abanca', 'Sin cuenta']);
    expect(grupos[1].items.map((i) => i.key)).toEqual(['sin-1', 'sin-2']);
  });

  // §2.2 · ningún identificador interno visible. Una cuenta dada de baja se
  // pinta detrás y sin nombre, nunca como "Cuenta 99": un número de fila de
  // base de datos no le dice al lector de qué cuenta sale el cargo.
  it('una cuenta que ya no está en la lista se pinta detrás y sin id', () => {
    const grupos = agruparPorEje(
      [item({ key: 'a', cuentaId: 1 }), item({ key: 'b', refId: 2, cuentaId: 99 })],
      'cuenta',
      CUENTAS
    );
    expect(grupos.map((g) => g.titulo)).toEqual(['Abanca', 'Sin nombre']);
    expect(grupos.map((g) => g.titulo).join(' ')).not.toMatch(/\d/);
  });
});
