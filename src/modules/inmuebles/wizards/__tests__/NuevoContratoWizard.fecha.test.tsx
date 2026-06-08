// FIX P3 · regresión del off-by-one de fechas en el resumen en vivo.
// Se fuerza una TZ por DETRÁS de UTC (donde antes `new Date("YYYY-MM-DD")` caía
// al día anterior al formatear): el resumen debe mostrar el MISMO día que el
// campo (08/06/2026 → "8 jun 2026", nunca "7 jun 2026"). Se guarda y restaura
// la TZ para no filtrarla a otros tests del mismo worker (orden-independencia).
const ORIGINAL_TZ = process.env.TZ;
process.env.TZ = 'America/New_York';

import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import NuevoContratoWizard from '../NuevoContratoWizard';
import type { InmueblesOutletContext } from '../../InmueblesContext';
import type { Property } from '../../../../services/db';

const property = (id: number, alias: string): Property =>
  ({
    id, alias, address: '', postalCode: '', province: '', municipality: '', ccaa: '',
    purchaseDate: '2020-01-01', squareMeters: 50, bedrooms: 1, transmissionRegime: 'usada',
    state: 'activo', acquisitionCosts: { price: 100000 }, documents: [],
  }) as Property;

const ctx: InmueblesOutletContext = {
  properties: [property(1, 'Fuertes Acevedo 32')],
  contracts: [],
  reload: jest.fn(),
};

const renderWizard = () =>
  render(
    <MemoryRouter initialEntries={['/contratos/nuevo?inmueble=1']}>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="/contratos/nuevo" element={<NuevoContratoWizard />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe('NuevoContratoWizard · resumen de fechas (P3)', () => {
  it('el resumen muestra el mismo día que el campo · sin off-by-one', () => {
    renderWizard();

    // Paso "Dónde" · primer input type=date = Fecha inicio.
    const fechaInicio = document.querySelectorAll('input[type="date"]')[0] as HTMLInputElement;
    fireEvent.change(fechaInicio, { target: { value: '2026-06-08' } });

    // El resumen en vivo muestra 8 jun (no 7 jun) pese a la TZ negativa.
    expect(screen.getByText('8 jun 2026')).toBeInTheDocument();
    expect(screen.queryByText('7 jun 2026')).not.toBeInTheDocument();
  });
});
