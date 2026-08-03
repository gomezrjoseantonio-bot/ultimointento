// Qué cuentas se ofrecen en la lista · docs/VOCABULARIO-dinero.md §2.
//
// Lo que vigila: que el desplegable de cuenta de la fila ofrezca solo las que
// pueden pagar con ESE medio. Ofrecerlas todas dejaba domiciliar un recibo
// contra el colchón — que no tiene IBAN— y el gasto quedaba apuntando a un
// sitio que no puede pagarlo.

import React from 'react';
import { render, screen } from '@testing-library/react';
import ExpenseRow from '../ExpenseRow';
import type { Account } from '../../../../../../services/db';
import type { CompromisoRecurrente } from '../../../../../../types/compromisosRecurrentes';

jest.mock('../../../../../../services/personal/compromisosRecurrentesService', () => ({
  actualizarCompromiso: jest.fn(),
  importeCompromisoEnMes: () => 60,
  importeCompromisoEnFecha: () => 60,
}));

jest.mock('../../../../../../design-system/v5', () => ({
  showToastV5: jest.fn(),
  Icons: new Proxy({}, { get: () => () => null }),
}));

const CUENTAS = [
  { id: 1, alias: 'Santander', tipo: 'CORRIENTE' },
  { id: 2, alias: 'Sabadell', tipo: 'CORRIENTE', bizum: true },
  { id: 3, alias: 'Efectivo', tipo: 'EFECTIVO' },
] as Account[];

const gasto = (over: Partial<CompromisoRecurrente> = {}) =>
  ({
    id: 7,
    alias: 'Luz',
    proveedor: { nombre: 'Iberdrola' },
    patron: { tipo: 'mensualDiaFijo', dia: 10 },
    importe: { modo: 'fijo', importe: 60 },
    cuentaCargo: 1,
    conceptoBancario: 'IBERDROLA',
    metodoPago: 'domiciliacion',
    categoria: 'suministros.luz',
    bolsaPresupuesto: 'necesidades',
    responsable: 'titular',
    ambito: 'personal',
    fechaInicio: '2026-01-01',
    estado: 'activo',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as CompromisoRecurrente & { id: number };

const pintar = (c = gasto()) =>
  render(
    <ExpenseRow
      compromiso={c}
      accounts={CUENTAS}
      expandido={false}
      onToggle={jest.fn()}
      onChanged={jest.fn()}
      onSuprimir={jest.fn()}
    />
  );

const opciones = () =>
  Array.from(
    (screen.getByLabelText(/Cuenta de cargo/i) as HTMLSelectElement).querySelectorAll('option')
  ).map((o) => o.textContent);

describe('el desplegable de cuenta', () => {
  // El colchón no tiene IBAN · nadie puede girarle un recibo.
  it('domiciliada NO ofrece el efectivo', () => {
    pintar();

    const texto = opciones().join(' · ');
    expect(texto).toContain('Santander');
    expect(texto).not.toContain('Efectivo');
  });
});

describe('los medios que no dejan elegir', () => {
  // Con efectivo, Bizum o tarjeta la cuenta la decide el medio · un desplegable
  // aquí invitaría a cambiarla, y no hay nada que cambiar.
  it.each(['efectivo', 'bizum', 'tarjeta'] as const)('%s enseña el medio, sin desplegable', (m) => {
    pintar(gasto({ metodoPago: m }));

    expect(screen.queryByLabelText(/Cuenta de cargo/i)).toBeNull();
  });
});
