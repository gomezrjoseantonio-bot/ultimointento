// E3.1 · §7.1 · deduplicar al importar por lo que el banco NO cambia.
import { huellaFuerteDeFila } from '../lineasExtractoService';
import type { ParsedMovement } from '../../types/bankProfiles';

const fila = (extra: Partial<ParsedMovement> = {}): ParsedMovement =>
  ({
    date: new Date('2025-08-29'),
    amount: -58.61,
    description: 'FCC AQUALI447497 874010012213',
    ...extra,
  }) as ParsedMovement;

const d = { accountId: 7, fechaOperacion: '2025-08-29', importe: -58.61 };

describe('E3.1 · §7.1 · la huella fuerte', () => {
  it('UNICAJA · manda el «Nº mov», que es la clave del propio banco', () => {
    expect(huellaFuerteDeFila(fila({ rawData: { 'Nº mov': '628', Saldo: 1768.42 } }), d)).toBe('mov:7|628');
    // Lo escriba como lo escriba.
    expect(huellaFuerteDeFila(fila({ rawData: { 'N. mov': '628' } }), d)).toBe('mov:7|628');
    expect(huellaFuerteDeFila(fila({ rawData: { 'numero movimiento': '628' } }), d)).toBe('mov:7|628');
  });

  it('sin nº de movimiento · fecha + importe + SALDO', () => {
    expect(huellaFuerteDeFila(fila({ balance: 1768.42 }), d)).toBe('saldo:7|2025-08-29|-5861|176842');
  });

  it('el mismo movimiento con el CONCEPTO retocado da la MISMA huella fuerte', () => {
    // Es justo lo que `hashMovement` no puede hacer: lleva el concepto dentro.
    const a = huellaFuerteDeFila(fila({ balance: 1768.42, description: 'FCC AQUALI447497 874010012213' }), d);
    const b = huellaFuerteDeFila(fila({ balance: 1768.42, description: 'FCC AQUALI447497-874010012213' }), d);
    expect(a).toBe(b);
  });

  it('dos cargos IDÉNTICOS el mismo día (la comunidad de dos pisos) siguen siendo DOS', () => {
    // El saldo corrido los separa: es distinto en cada línea de la cuenta.
    const uno = huellaFuerteDeFila(fila({ balance: 199.12 }), { ...d, importe: -139.86 });
    const dos = huellaFuerteDeFila(fila({ balance: 59.26 }), { ...d, importe: -139.86 });
    expect(uno).not.toBe(dos);
  });

  it('si el fichero no da ninguna de las dos cosas, no hay huella fuerte · manda la de siempre', () => {
    expect(huellaFuerteDeFila(fila(), d)).toBeUndefined();
    expect(huellaFuerteDeFila(fila({ balance: 10 }), { ...d, fechaOperacion: '' })).toBeUndefined();
  });
});
