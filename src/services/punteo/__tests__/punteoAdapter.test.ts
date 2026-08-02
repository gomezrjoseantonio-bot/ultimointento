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
