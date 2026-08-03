// §6.3 · qué dice cada fila.
//
// El test que da sentido al fichero es el de los dos seguros: dos recibos del
// mismo tipo, casi el mismo importe, distinto inmueble. Con la fila delante y
// el móvil del banco en la mano hay que poder decir cuál es cuál sin abrir
// nada. Antes ponía "Seguro hogar / Inmueble 2" en las dos.

import { eventoAItem, movimientoAItem, origenDeEvento } from '../punteoAdapter';
import { agruparHijas } from '../punteoModel';
import type { Movement, TreasuryEvent } from '../../db';

const ev = (over: Partial<TreasuryEvent> = {}): TreasuryEvent & { id: number } =>
  ({
    id: 1,
    accountId: 1,
    type: 'expense',
    amount: 40.29,
    predictedDate: '2026-08-10',
    description: 'Seguro hogar',
    sourceType: 'gasto_recurrente',
    sourceId: 7,
    status: 'predicted',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as TreasuryEvent & { id: number };

describe('la fila dice quién cobra', () => {
  it('el título es el PROVEEDOR · es lo que se leerá en el extracto', () => {
    const it = eventoAItem(ev({ proveedor: 'Mapfre' }));
    expect(it.concepto).toBe('Mapfre');
    expect(it.detalle).toBe('Seguro hogar');
  });

  it('sin proveedor manda la descripción · préstamos, nóminas, previstos viejos', () => {
    const it = eventoAItem(ev({ proveedor: undefined }));
    expect(it.concepto).toBe('Seguro hogar');
    expect(it.detalle).toBeUndefined();
  });

  it('si proveedor y descripción coinciden no se repite abajo', () => {
    const it = eventoAItem(ev({ proveedor: 'Mapfre', description: 'Mapfre' }));
    expect(it.concepto).toBe('Mapfre');
    expect(it.detalle).toBeUndefined();
  });

  it('NUNCA pinta un identificador interno · antes salía "Inmueble 3"', () => {
    const it = eventoAItem(ev({ inmuebleId: 3, inmuebleAlias: undefined }));
    expect(it.activo?.alias).toBeUndefined();
    expect(JSON.stringify(it)).not.toContain('Inmueble 3');
  });

  it('usa el nombre real cuando se puede resolver', () => {
    const it = eventoAItem(ev({ inmuebleId: 3 }), (id) => (id === 3 ? 'Tenderina 64' : undefined));
    expect(it.activo?.alias).toBe('Tenderina 64');
  });
});

// La prueba de aceptación del parte, literal.
describe('los dos seguros de 40,29 € y 40,23 €', () => {
  const alias = (id: number | string) =>
    id === 2 ? 'Tenderina 64 · 4D' : id === 3 ? 'Los Robles 12 · 2B' : undefined;

  it('quedan distinguibles sin abrir nada', () => {
    const a = eventoAItem(
      ev({ id: 1, amount: 40.29, proveedor: 'Mapfre', inmuebleId: 2 }),
      alias
    );
    const b = eventoAItem(
      ev({ id: 2, amount: 40.23, proveedor: 'Mapfre', inmuebleId: 3 }),
      alias
    );

    // El título es el mismo —las dos son de Mapfre, y eso es la verdad—, así
    // que lo que las separa tiene que estar en la fila, no dentro de la ficha.
    expect(a.concepto).toBe(b.concepto);
    expect(a.activo?.alias).toBe('Tenderina 64 · 4D');
    expect(b.activo?.alias).toBe('Los Robles 12 · 2B');
    expect(a.activo?.alias).not.toBe(b.activo?.alias);
    expect(a.importe).not.toBe(b.importe);
  });
});


// §6.3 · las habitaciones cuelgan de su piso.
describe('el anidado piso → habitación', () => {
  const renta = (over: Partial<TreasuryEvent> = {}) =>
    eventoAItem(
      ev({ sourceType: 'contrato', type: 'income', description: 'Renta', ...over }) as
        TreasuryEvent & { id: number }
    );

  it('varias rentas del MISMO piso comparten grupo · aunque sean contratos distintos', () => {
    // Cada habitación tiene su propio contrato: agrupar por contrato dejaba
    // cada renta sola y no se formaba madre.
    const a = renta({ id: 1, inmuebleId: 5, contratoId: 11 });
    const b = renta({ id: 2, inmuebleId: 5, contratoId: 12 });
    const c = renta({ id: 3, inmuebleId: 5, contratoId: 13 });

    expect(a.grupoId).toBe('inmueble-5');
    expect(new Set([a.grupoId, b.grupoId, c.grupoId]).size).toBe(1);
  });

  it('rentas de pisos DISTINTOS no se mezclan', () => {
    expect(renta({ id: 1, inmuebleId: 5 }).grupoId).not.toBe(
      renta({ id: 2, inmuebleId: 6 }).grupoId
    );
  });

  it('un piso completo no forma grupo · agruparHijas descarta los de una sola', () => {
    // Sigue teniendo grupoId, pero al ser hija única `agruparHijas` lo tira, así
    // que no hace falta preguntar si el piso se alquila por habitaciones.
    const sola = renta({ id: 1, inmuebleId: 7 });
    expect(agruparHijas([sola]).size).toBe(0);
    expect(agruparHijas([sola, renta({ id: 2, inmuebleId: 7 })]).size).toBe(1);
  });

  it('lo que no es renta no se agrupa', () => {
    expect(eventoAItem(ev({ sourceType: 'gasto_recurrente', inmuebleId: 5 })).grupoId)
      .toBeUndefined();
  });
});

// Una renta de habitación se lee distinto según dónde caiga, y por eso el ítem
// lleva las dos formas: cuál se pinta depende de cuántas rentas del piso haya
// en la lista, y eso no se sabe hasta pintar.
describe('la renta de una habitación, suelta y bajo su piso', () => {
  const renta = eventoAItem(
    ev({
      id: 1,
      sourceType: 'contrato',
      type: 'income',
      inmuebleId: 4,
      inmuebleAlias: 'Tenderina 64 4IZ',
      unidadInmueble: 'hab-2',
      description: 'Renta – ADNAN PARWEZ',
    }) as TreasuryEvent & { id: number }
  );

  // Con el inquilino de titular, la fila no decía ni que aquello fuera un
  // alquiler; y sin el piso, no se sabe de cuál de ellos entra el dinero.
  it('suelta lo dice TODO · qué es, de qué piso, quién paga y qué habitación', () => {
    expect(renta.concepto).toBe('Alquiler · Tenderina 64 4IZ');
    expect(renta.detalle).toBe('ADNAN PARWEZ · Hab 2');
  });

  // Bajo la madre el piso ya lo encabeza el grupo · repetirlo en cada
  // habitación es escribirlo cuatro veces.
  it('bajo su piso se queda con lo que la distingue de sus hermanas', () => {
    expect(renta.bajoMadre).toEqual({ concepto: 'ADNAN PARWEZ', detalle: 'Hab 2' });
  });

  // Piso completo · no hay habitación que decir, así que tampoco hay una
  // segunda forma de leer la fila.
  it('un piso completo no necesita las dos formas', () => {
    const completa = eventoAItem(
      ev({
        id: 2,
        sourceType: 'contrato',
        type: 'income',
        inmuebleId: 5,
        inmuebleAlias: 'Carles Buigas 15',
        description: 'Renta – CONCEPCION RAMIREZ',
      }) as TreasuryEvent & { id: number }
    );
    expect(completa.concepto).toBe('Alquiler · Carles Buigas 15');
    expect(completa.detalle).toBe('CONCEPCION RAMIREZ');
    expect(completa.bajoMadre).toBeUndefined();
  });
});


// Al confirmar, el movimiento se queda con la descripción del evento pero NO
// con su `sourceType`, así que salía "Renta – ALISSER REAL ESTATE" de un tirón
// mientras el previsto de al lado decía "Alquiler · el piso": el mismo cargo
// con dos formas según si ya había pasado o no.
describe('el movimiento se lee igual que la previsión de la que nació', () => {
  const mov = (over: Partial<Movement> & { id: number }): Movement & { id: number } =>
    ({
      accountId: 1,
      date: '2026-08-01',
      amount: 1350,
      description: 'Compra',
      status: 'pendiente',
      unifiedStatus: 'conciliado',
      source: 'manual',
      category: { tipo: 'Ingresos' },
      type: 'Ingreso',
      origin: 'Manual',
      movementState: 'Confirmado',
      ambito: 'INMUEBLE',
      statusConciliacion: 'sin_match',
      createdAt: '',
      updatedAt: '',
      ...over,
    }) as Movement & { id: number };

  it('un alquiler cobrado dice qué es y de qué piso', () => {
    const it = movimientoAItem(
      mov({ id: 1, description: 'Renta – ALISSER REAL ESTATE', inmuebleId: '5' }),
      () => 'Tenderina 64 4DR'
    );
    expect(it.concepto).toBe('Alquiler · Tenderina 64 4DR');
    expect(it.detalle).toBe('ALISSER REAL ESTATE');
  });

  // La misma regla del guion que en las previsiones: la contraparte al título y
  // lo que es, debajo.
  it('una cuota parte por el guion, igual que su previsión', () => {
    const it = movimientoAItem(mov({ id: 2, description: 'Cuota Hipoteca – Hipoteca Unicaja T64' }));
    expect(it.concepto).toBe('Hipoteca Unicaja T64');
    expect(it.detalle).toBe('Cuota Hipoteca');
  });

  it('lo que no sigue el patrón se queda como está', () => {
    const it = movimientoAItem(mov({ id: 3, description: 'Compra supermercado' }));
    expect(it.concepto).toBe('Compra supermercado');
  });

  // El movimiento no guarda `previsionId` en ningún campo propio: es la huella
  // `treasury_event:{id}` del `reference`, que es la misma por la que se
  // deshace el punteo.
  it('reconoce de qué previsión nació · y cuándo no nació de ninguna', () => {
    expect(movimientoAItem(mov({ id: 4, reference: 'treasury_event:77' })).previsionId).toBe(77);
    expect(movimientoAItem(mov({ id: 5 })).previsionId).toBeUndefined();
    expect(movimientoAItem(mov({ id: 6, reference: 'otra-cosa' })).previsionId).toBeUndefined();
  });
});

// El eje "Tipo" pinta estas etiquetas como cabecera de grupo, así que son
// vocabulario de pantalla: tienen que ser palabras que el producto use.
describe('las etiquetas de tipo hablan el idioma de la aplicación', () => {
  it('un contrato es un ALQUILER · es lo que dice su propia fila', () => {
    expect(origenDeEvento({ sourceType: 'contrato', type: 'income' })).toBe('Alquiler');
  });

  it('un gasto recurrente es un RECIBO · "recurrente" es cómo lo genera ATLAS', () => {
    expect(origenDeEvento({ sourceType: 'gasto_recurrente', type: 'expense' })).toBe('Recibo');
    // Salvo que sea de suministros, que tiene nombre propio.
    expect(
      origenDeEvento({ sourceType: 'gasto_recurrente', type: 'expense', categoryKey: 'suministros.luz' })
    ).toBe('Suministro');
  });
});


// Interna y externa se leen igual de lejos —"Traspaso a ahorro, −2.000 €"— y no
// significan lo mismo: en la interna el dinero no se va, cambia de cuenta. Si la
// fila no lo dice, la interna parece dinero perdido.
describe('un traspaso dice si es interno o externo', () => {
  const cuentas = (id: number) => (id === 3 ? 'Unicaja ahorro' : id === 1 ? 'Santander' : undefined);

  const traspaso = (over: Partial<TreasuryEvent>) =>
    eventoAItem(
      ev({
        id: 1,
        type: 'expense',
        description: 'A la de ahorro · salida',
        categoryKey: 'traspaso_salida',
        transferMetadata: { targetAccountId: 3 },
        ...over,
      }) as TreasuryEvent & { id: number },
      undefined,
      cuentas
    );

  it('la salida dice A QUÉ cuenta va', () => {
    const it = traspaso({});
    expect(it.concepto).toBe('A la de ahorro');
    expect(it.detalle).toBe('Transferencia interna · a Unicaja ahorro');
  });

  // En la pata de entrada `targetAccountId` guarda la cuenta de ORIGEN: en las
  // dos es "la otra".
  it('la entrada dice DESDE cuál viene', () => {
    const it = traspaso({
      type: 'income',
      description: 'A la de ahorro · entrada',
      categoryKey: 'traspaso_entrada',
      transferMetadata: { targetAccountId: 1 },
    });
    expect(it.detalle).toBe('Transferencia interna · desde Santander');
  });

  // §2.2 · sin nombre de cuenta NO se inventa un "Cuenta 3": se dice la
  // dirección, que es lo que sí se sabe.
  it('sin nombre de cuenta se queda en la dirección', () => {
    const it = eventoAItem(
      ev({
        id: 2,
        description: 'Traspaso · salida',
        categoryKey: 'traspaso_salida',
        transferMetadata: { targetAccountId: 99 },
      }) as TreasuryEvent & { id: number },
      undefined,
      cuentas
    );
    expect(it.detalle).toBe('Transferencia interna · salida');
    expect(JSON.stringify(it)).not.toContain('Cuenta 99');
  });
});


// §Bizum · el texto del banco es "BIZUM DE ADNAN PARWEZ" de un tirón. Con él de
// título, la fila grita la forma de pago y esconde a la persona — que es lo
// único que permite reconocer de quién es ese cobro.
describe('un Bizum dice QUIÉN, no cómo', () => {
  const bizum = (over: Partial<Movement> & { id: number }) =>
    movimientoAItem(
      {
        accountId: 1,
        date: '2026-08-01',
        amount: 395,
        description: 'BIZUM DE ADNAN PARWEZ',
        paymentMethod: 'Bizum',
        counterparty: 'ADNAN PARWEZ',
        status: 'pendiente',
        unifiedStatus: 'no_planificado',
        source: 'import',
        category: { tipo: 'Ingresos' },
        type: 'Ingreso',
        origin: 'CSV',
        movementState: 'Confirmado',
        ambito: 'PERSONAL',
        statusConciliacion: 'sin_match',
        createdAt: '',
        updatedAt: '',
        ...over,
      } as Movement & { id: number }
    );

  it('la persona arriba y la forma de pago debajo', () => {
    const it = bizum({ id: 1 });
    expect(it.concepto).toBe('ADNAN PARWEZ');
    expect(it.detalle).toBe('Bizum');
  });

  // Sin nombre leído no se inventa: el texto del banco algo dice.
  it('sin contraparte se queda el texto del banco', () => {
    const it = bizum({ id: 2, counterparty: undefined, description: 'BIZUM 00218832' });
    expect(it.concepto).toBe('BIZUM 00218832');
  });
});

// ============================================================================
// Lo que el usuario clasificó a mano
// ============================================================================
//
// Un gasto anotado con familia "Suministro · Gas" salía con la fila EN BLANCO
// —el título sólo mira descripción y proveedor— y caía en el cajón "Gasto",
// mientras su propia previsión estaba en "Suministro". La clasificación se
// guardaba en `categoryKey`/`subtypeKey` y nadie la leía: ni el título ni el
// grupo. Dos filas de la misma cosa en dos sitios distintos.

describe('un gasto anotado a mano enseña su clasificación', () => {
  const gasto = (over: Partial<Movement> & { id: number }): Movement & { id: number } =>
    ({
      accountId: 1,
      date: '2026-08-03',
      amount: -48,
      status: 'pendiente',
      unifiedStatus: 'no_planificado',
      source: 'manual',
      category: { tipo: 'Gastos' },
      type: 'Gasto',
      origin: 'Manual',
      movementState: 'Confirmado',
      ambito: 'INMUEBLE',
      statusConciliacion: 'sin_match',
      createdAt: '',
      updatedAt: '',
      categoryKey: 'suministro_inmueble',
      subtypeKey: 'gas',
      ...over,
    }) as Movement & { id: number };

  // Sin concepto escrito, la clasificación es lo ÚNICO que hay: titula ella.
  it('sin concepto, titula lo elegido', () => {
    const it = movimientoAItem(gasto({ id: 1, description: undefined }));
    expect(it.concepto).toBe('Gas');
  });

  // Con concepto escrito, manda lo que puso el usuario y la familia baja al
  // subtítulo · el sitio de la traducción de ATLAS.
  it('con concepto, la clasificación baja al subtítulo', () => {
    const it = movimientoAItem(gasto({ id: 2, description: 'Recibo agosto' }));
    expect(it.concepto).toBe('Recibo agosto');
    expect(it.detalle).toBe('Gas');
  });

  // Escribir "Gas" y elegir la familia Gas es lo normal · la fila decía
  // "Gas · Gas" y repetir la palabra no añade nada.
  it('no repite la misma palabra dos veces', () => {
    const it = movimientoAItem(gasto({ id: 7, description: 'Gas' }));
    expect(it.concepto).toBe('Gas');
    expect(it.detalle).toBeUndefined();
  });

  // El cajón es el mismo vocabulario que usa la previsión que lo cumple.
  it('cae en el grupo de su familia, no en "Gasto"', () => {
    expect(movimientoAItem(gasto({ id: 3 })).origen).toBe('Suministro');
  });

  it('sin clasificar sigue siendo un gasto a secas', () => {
    const it = movimientoAItem(
      gasto({ id: 4, categoryKey: undefined, subtypeKey: undefined, description: 'Compra' })
    );
    expect(it.origen).toBe('Gasto');
    expect(it.concepto).toBe('Compra');
  });

  // El catálogo dice "Otros ingresos" donde el evento dice "Ingreso". Con cada
  // uno por su lado, la previsión y el movimiento que la cumple acaban en dos
  // grupos distintos — el mismo fallo, por el otro lado.
  it('un ingreso cae donde cae su previsión', () => {
    const it = movimientoAItem(
      gasto({
        id: 6,
        type: 'Ingreso',
        amount: 400,
        categoryKey: 'otros_ingresos',
        subtypeKey: undefined,
      })
    );
    expect(it.origen).toBe(origenDeEvento({ sourceType: 'otros_ingresos', type: 'income' }));
  });

  // Quien cobra manda sobre la etiqueta: es lo que se lee en el extracto.
  it('con proveedor no lo pisa la clasificación', () => {
    const it = movimientoAItem(
      gasto({ id: 5, providerName: 'Naturgy', description: undefined })
    );
    expect(it.concepto).toBe('Naturgy');
  });
});
