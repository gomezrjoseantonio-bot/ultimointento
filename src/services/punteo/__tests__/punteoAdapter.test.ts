// §6.3 · qué dice cada fila.
//
// El test que da sentido al fichero es el de los dos seguros: dos recibos del
// mismo tipo, casi el mismo importe, distinto inmueble. Con la fila delante y
// el móvil del banco en la mano hay que poder decir cuál es cuál sin abrir
// nada. Antes ponía "Seguro hogar / Inmueble 2" en las dos.

import { eventoAItem } from '../punteoAdapter';
import type { TreasuryEvent } from '../../db';

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
