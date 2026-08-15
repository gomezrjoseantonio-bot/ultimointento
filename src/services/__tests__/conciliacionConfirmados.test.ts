// Conciliar el extracto contra lo que ya tenías anotado (Confirmado).
//
// Lo que vigila: que "las dos cosas" (anotar a mano Y subir el fichero) no
// duplique. La línea del banco casa con tu confirmado —misma cuenta, mismo
// importe con signo, fecha cerca— y 1:1, sin que dos cargos iguales apunten al
// mismo confirmado.

import { emparejarConfirmados, confirmadosPorLinea } from '../conciliacionConfirmados';
import type { Movement } from '../db';

const mov = (over: Partial<Movement> = {}): Movement =>
  ({
    id: 1,
    accountId: 3,
    date: '2026-08-14',
    amount: -20,
    description: 'REINTEGRO CAJERO',
    source: 'manual',
    unifiedStatus: 'no_planificado',
    movementState: 'Confirmado',
    ...over,
  }) as Movement;

const lineaImport = (over: Partial<Movement> = {}): Movement =>
  mov({ id: 100, source: 'import', description: 'DISPOSICION CAJERO 4521', ...over });

describe('emparejar una línea con lo que ya tenías', () => {
  it('mismo importe y fecha cercana en la misma cuenta · casa', () => {
    const r = emparejarConfirmados([lineaImport({ date: '2026-08-15' })], [mov({ id: 7 })]);
    expect(r.get(100)).toBe(7);
  });

  it('la fecha puede diferir un par de días · el banco valora distinto', () => {
    const r = emparejarConfirmados([lineaImport({ date: '2026-08-17' })], [mov({ id: 7, date: '2026-08-14' })]);
    expect(r.get(100)).toBe(7);
  });

  it('fuera de la ventana no casa', () => {
    const r = emparejarConfirmados([lineaImport({ date: '2026-08-30' })], [mov({ id: 7, date: '2026-08-14' })]);
    expect(r.size).toBe(0);
  });

  it('el signo importa · un ingreso no casa con un gasto del mismo importe', () => {
    const r = emparejarConfirmados([lineaImport({ amount: 20 })], [mov({ id: 7, amount: -20 })]);
    expect(r.size).toBe(0);
  });

  it('otra cuenta no casa', () => {
    const r = emparejarConfirmados([lineaImport()], [mov({ id: 7, accountId: 99 })]);
    expect(r.size).toBe(0);
  });
});

describe('solo lo anotado a mano y suelto', () => {
  it('un importado no es candidato · ya es del banco', () => {
    const r = emparejarConfirmados([lineaImport()], [mov({ id: 7, source: 'import' })]);
    expect(r.size).toBe(0);
  });

  it('uno ya conciliado no vuelve a casar', () => {
    const r = emparejarConfirmados([lineaImport()], [mov({ id: 7, unifiedStatus: 'conciliado' })]);
    expect(r.size).toBe(0);
  });

  it('una pata de traspaso no casa · no es un cargo suelto', () => {
    const r = emparejarConfirmados(
      [lineaImport()],
      [mov({ id: 7, transferMetadata: { targetAccountId: 9 } })]
    );
    expect(r.size).toBe(0);
  });

  it('una compra a crédito no casa · sale en el recibo, no en la cuenta', () => {
    const r = emparejarConfirmados([lineaImport()], [mov({ id: 7, gastoTarjetaCredito: true })]);
    expect(r.size).toBe(0);
  });
});

describe('1:1 · nada se cuenta dos veces', () => {
  it('dos cargos iguales el mismo día · cada uno a un confirmado distinto', () => {
    const r = emparejarConfirmados(
      [lineaImport({ id: 100 }), lineaImport({ id: 101 })],
      [mov({ id: 7 }), mov({ id: 8 })]
    );
    expect(new Set(r.values()).size).toBe(2);
    expect(r.get(100)).not.toBe(r.get(101));
  });

  it('una línea y un solo confirmado · casa una, la otra se queda sin', () => {
    const r = emparejarConfirmados(
      [lineaImport({ id: 100 }), lineaImport({ id: 101 })],
      [mov({ id: 7 })]
    );
    expect(r.size).toBe(1);
  });

  it('gana el más cercano en fecha', () => {
    // La línea del 15 · el confirmado del 14 (1 día) gana al del 10 (5 días).
    const r = emparejarConfirmados(
      [lineaImport({ id: 100, date: '2026-08-15' })],
      [mov({ id: 7, date: '2026-08-10' }), mov({ id: 8, date: '2026-08-14' })]
    );
    expect(r.get(100)).toBe(8);
  });
});

describe('confirmadosPorLinea · la referencia para pintar el cuadre', () => {
  it('devuelve los datos del confirmado y excluye las propias líneas del lote', () => {
    const linea = lineaImport({ id: 100, date: '2026-08-15' });
    const confirmado = mov({ id: 7, description: 'Sacar del cajero', amount: -20, date: '2026-08-14' });
    // `movimientos` incluye la propia línea del lote · no debe casar consigo misma.
    const refs = confirmadosPorLinea([linea], [linea, confirmado], 3);
    expect(refs.get(100)).toEqual({
      id: 7,
      descripcion: 'Sacar del cajero',
      importe: -20,
      fecha: '2026-08-14',
    });
  });
});
