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

  // Un piso por habitaciones se pinta con UNA fila —"Alquiler · el piso"— y las
  // rentas dentro. El concepto de cada renta es el nombre del INQUILINO, así
  // que ordenando por concepto la cabecera del piso caía donde cayera su
  // primera hija: "Tenderina 64 4IZ" en la A de ADNAN, con otras filas en
  // medio. Se ordena por lo que se lee, no por el campo.
  it('un piso agrupado se ordena por SU título, no por el inquilino de la primera hija', () => {
    const piso = (
      key: string,
      inquilino: string,
      grupoId: string,
      alias: string,
      inmuebleId: number
    ) =>
      item({
        key,
        refId: Number(key.slice(1)),
        concepto: inquilino,
        grupoId,
        activo: { inmuebleId, alias },
        importe: 395,
      });

    const grupos = agruparPorEje(
      [
        piso('x1', 'ADNAN PARWEZ', 'g-4iz', 'Tenderina 64 4IZ', 4),
        piso('x2', 'SARA GIL', 'g-4iz', 'Tenderina 64 4IZ', 4),
        piso('x3', 'EMILIO CARRERA RIOS', 'g-4dr', 'Tenderina 64 4DR', 5),
        piso('x4', 'MIGUEL LORENZO', 'g-4dr', 'Tenderina 64 4DR', 5),
        item({ key: 'l', refId: 90, concepto: 'Lotería', importe: -40 }),
        item({ key: 'c', refId: 91, concepto: 'Alquiler · Carles Buigas 15', importe: 330 }),
      ],
      'cuenta',
      CUENTAS
    );

    expect(grupos[0].items.map((i) => i.key)).toEqual([
      'c', // Alquiler · Carles Buigas 15
      'x3', // Alquiler · Tenderina 64 4DR → EMILIO
      'x4', //                            → MIGUEL · dentro del piso, por inquilino
      'x1', // Alquiler · Tenderina 64 4IZ → ADNAN
      'x2', //                            → SARA
      'l', // Lotería
    ]);
  });

  // Una renta suelta no monta grupo, así que no hay cabecera "Alquiler · piso"
  // que la titule: se ordena por lo que enseña, su propio concepto.
  it('una sola renta con grupo no se ordena como si fuera un piso agrupado', () => {
    const grupos = agruparPorEje(
      [
        // "Comunidad" cae ENTRE los dos criterios · con él se ve cuál manda:
        // por título de madre ("Alquiler · …") la renta iría primera; por su
        // concepto ("EMILIO …") va detrás.
        item({ key: 'com', refId: 1, concepto: 'Comunidad', importe: -90 }),
        item({
          key: 'sola',
          refId: 2,
          concepto: 'EMILIO CARRERA RIOS',
          grupoId: 'g-4dr',
          activo: { inmuebleId: 5, alias: 'Tenderina 64 4DR' },
          importe: 395,
        }),
      ],
      'cuenta',
      CUENTAS
    );
    expect(grupos[0].items.map((i) => i.key)).toEqual(['com', 'sola']);
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

  // "Sin nombre" no puede colarse entre las cuentas reales solo porque su S
  // caiga antes que la U de Unicaja: primero lo que el usuario busca.
  it('la dada de baja va DETRÁS de las reales, no en su sitio alfabético', () => {
    const grupos = agruparPorEje(
      [
        item({ key: 'a', cuentaId: 1 }),
        item({ key: 'b', refId: 2, cuentaId: 99 }),
        item({ key: 'c', refId: 3, cuentaId: 3 }),
        item({ key: 'd', refId: 4, cuentaId: null }),
      ],
      'cuenta',
      CUENTAS
    );
    expect(grupos.map((g) => g.titulo)).toEqual([
      'Abanca',
      'Unicaja',
      'Sin nombre',
      'Sin cuenta',
    ]);
  });
});
