// La fila de un gasto con varios cargos al año.
//
// La columna de importe pintaba «—» para todo lo que no fuera un importe fijo,
// así que un IBI de junio y noviembre parecía un gasto sin cifra. Y la celda
// era editable solo en `fijo`, que es lo correcto: escribir un número suelto en
// la fila de un gasto por cargos lo convertiría en fijo y se llevaría por
// delante su calendario.

import React from 'react';
import { render, screen } from '@testing-library/react';
import ExpenseRow from '../ExpenseRow';
import type { Account } from '../../../../../../services/db';
import type { CompromisoRecurrente } from '../../../../../../types/compromisosRecurrentes';

jest.mock('../../../../../../services/personal/compromisosRecurrentesService', () => ({
  actualizarCompromiso: jest.fn(),
  importeCompromisoEnMes: () => 0,
}));
jest.mock('../../../../../../design-system/v5', () => ({
  showToastV5: jest.fn(),
  Icons: new Proxy({}, { get: () => () => null }),
}));

const CUENTAS = [{ id: 1, alias: 'Santander', tipo: 'CORRIENTE' }] as Account[];

const gasto = (over: Partial<CompromisoRecurrente> = {}) =>
  ({
    id: 7, alias: 'IBI', proveedor: { nombre: 'Ayuntamiento' },
    patron: { tipo: 'anualMesesConcretos', mesesPago: [6, 11], diaPago: 15, diaPagoPorMes: { 6: 15, 11: 11 } },
    importe: { modo: 'porPago', importesPorPago: { 6: 200, 11: 120 } },
    cuentaCargo: 1, conceptoBancario: 'IBI', metodoPago: 'domiciliacion',
    categoria: 'inmueble.ibi', bolsaPresupuesto: 'inmueble', responsable: 'titular',
    ambito: 'inmueble', inmuebleId: 1, fechaInicio: '2026-01-01', estado: 'activo',
    createdAt: '', updatedAt: '', ...over,
  }) as CompromisoRecurrente & { id: number };

const pintar = (c = gasto()) =>
  render(
    <ExpenseRow
      compromiso={c}
      accounts={CUENTAS}
      account={CUENTAS[0]}
      isExpanded={false}
      onToggle={jest.fn()}
      onDelete={jest.fn()}
      onToggleEstado={jest.fn()}
      onInlineSaved={jest.fn()}
    />,
  );

describe('la fila de un gasto por cargos', () => {
  it('dice cuántos cargos tiene · no pinta «—»', () => {
    pintar();
    expect(screen.getByText('2 cargos')).toBeTruthy();
  });

  it('y el detalle, con día e importe, está a un hover', () => {
    pintar();
    expect(screen.getByText('2 cargos').getAttribute('title')).toBe('15 jun · 200 € — 11 nov · 120 €');
  });

  // Escribir aquí lo pasaría a `fijo` y perdería los dos cargos y sus días.
  it('el importe NO se edita en la fila', () => {
    pintar();
    expect(screen.queryByLabelText(/Importe de IBI/i)).toBeNull();
  });

  // El atajo de calendario reescribe el patrón entero. Sobre un gasto por
  // cargos dejaría meses en el patrón sin importe en el mapa, y eso hace que
  // `calcularImporte` LANCE en las seis pantallas que lo llaman sin try/catch.
  it('el atajo de «cuándo» tampoco · le rompería el calendario', () => {
    pintar();
    const cuando = screen.getByLabelText(/Cuándo se cobra IBI/i) as HTMLSelectElement;
    expect(cuando.disabled).toBe(true);
  });

  it('un gasto fijo sigue editándose en la fila, como siempre', () => {
    pintar(gasto({ importe: { modo: 'fijo', importe: 60 }, patron: { tipo: 'mensualDiaFijo', dia: 10 } }));
    expect(screen.getByLabelText(/Importe de IBI/i)).toBeTruthy();
    expect((screen.getByLabelText(/Cuándo se cobra IBI/i) as HTMLSelectElement).disabled).toBe(false);
  });
});
