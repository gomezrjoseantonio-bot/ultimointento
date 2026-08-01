// §6.3 · rellenar "quién cobra" en las previsiones ya emitidas.
//
// Lo que se prueba aquí no es que rellene —eso es lo fácil— sino que NO toque
// lo que no debe: una corrección a mano, un préstamo, una cuota sin compromiso.

import { indexarProveedores, proveedorParaEvento } from '../post-open';

const idx = indexarProveedores([
  { id: 10, proveedor: { nombre: 'Tecno Oviedo' } },
  { id: 11, proveedor: { nombre: '  Mapfre  ' } },
  { id: 12, proveedor: { nombre: '' } },
  { id: 13 },
]);

describe('el índice de proveedores', () => {
  it('recorta los espacios · el alta los deja al copiar y pegar', () => {
    expect(idx.get(11)).toBe('Mapfre');
  });

  it('un proveedor vacío no entra · escribirlo sería peor que dejarlo sin poner', () => {
    expect(idx.has(12)).toBe(false);
    expect(idx.has(13)).toBe(false);
  });
});

describe('a qué previsiones se les pone', () => {
  it('a un gasto recurrente sin proveedor', () => {
    expect(proveedorParaEvento({ sourceType: 'gasto_recurrente', sourceId: 10 }, idx))
      .toBe('Tecno Oviedo');
  });

  it('también a las reglas opex y a los gastos personales', () => {
    expect(proveedorParaEvento({ sourceType: 'opex_rule', sourceId: 10 }, idx)).toBe('Tecno Oviedo');
    expect(proveedorParaEvento({ sourceType: 'personal_expense', sourceId: 11 }, idx)).toBe('Mapfre');
  });

  it('el sourceId vale como texto · no todos los orígenes lo guardan numérico', () => {
    expect(proveedorParaEvento({ sourceType: 'gasto_recurrente', sourceId: '10' }, idx))
      .toBe('Tecno Oviedo');
  });
});

describe('a cuáles NO se les toca', () => {
  it('a una que YA tiene proveedor · una corrección a mano manda sobre el compromiso', () => {
    expect(
      proveedorParaEvento(
        { sourceType: 'gasto_recurrente', sourceId: 10, proveedor: 'Lo puse yo' },
        idx
      )
    ).toBeNull();
  });

  it('a un préstamo o una nómina · no hay proveedor que copiar', () => {
    expect(proveedorParaEvento({ sourceType: 'prestamo', sourceId: 10 }, idx)).toBeNull();
    expect(proveedorParaEvento({ sourceType: 'nomina', sourceId: 10 }, idx)).toBeNull();
    expect(proveedorParaEvento({ sourceType: 'contrato', sourceId: 10 }, idx)).toBeNull();
  });

  it('a una cuyo compromiso ya no existe o no tiene proveedor', () => {
    expect(proveedorParaEvento({ sourceType: 'gasto_recurrente', sourceId: 999 }, idx)).toBeNull();
    expect(proveedorParaEvento({ sourceType: 'gasto_recurrente', sourceId: 12 }, idx)).toBeNull();
  });

  it('a una sin origen', () => {
    expect(proveedorParaEvento({ sourceId: 10 }, idx)).toBeNull();
    expect(proveedorParaEvento({ sourceType: 'gasto_recurrente' }, idx)).toBeNull();
  });
});

describe('pasarla dos veces', () => {
  it('la segunda no cambia nada · lo que rellenó ya tiene proveedor', () => {
    const ev = { sourceType: 'gasto_recurrente', sourceId: 10 } as {
      sourceType: string; sourceId: number; proveedor?: string;
    };
    const primera = proveedorParaEvento(ev, idx);
    expect(primera).toBe('Tecno Oviedo');

    ev.proveedor = primera!;
    expect(proveedorParaEvento(ev, idx)).toBeNull();
  });
});
