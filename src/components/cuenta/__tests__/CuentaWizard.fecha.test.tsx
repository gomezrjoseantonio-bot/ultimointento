// FIX PUNTO 4 (P3) · off-by-one del saldo inicial. Se fuerza una TZ por DETRÁS
// de UTC (donde antes `new Date("YYYY-MM-DD")` caía al día anterior al
// formatear): la vista previa debe mostrar el MISMO día que el campo
// (08/06/2026 → "8 jun 2026", nunca "7 jun 2026") y "A fecha" defaultea a HOY.
const ORIGINAL_TZ = process.env.TZ;
process.env.TZ = 'America/New_York';

import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import CuentaWizard from '../CuentaWizard';
import { cuentasService } from '../../../services/cuentasService';

// Evita tocar IndexedDB · el efecto de montaje sólo necesita la lista de cuentas.
jest.mock('../../../services/cuentasService', () => ({
  cuentasService: { list: jest.fn() },
}));

// CRA usa resetMocks:true · reestablecemos la implementación en cada test.
beforeEach(() => {
  (cuentasService.list as jest.Mock).mockResolvedValue([]);
});

afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

const todayISO = () => new Date().toISOString().split('T')[0];

describe('CuentaWizard · saldo inicial · fechas (P3)', () => {
  it('"A fecha" defaultea a HOY', () => {
    render(<CuentaWizard open onClose={() => {}} />);
    const fecha = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(fecha.value).toBe(todayISO());
  });

  it('la vista previa muestra el mismo día que el campo · sin off-by-one', () => {
    render(<CuentaWizard open onClose={() => {}} />);
    const fecha = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(fecha, { target: { value: '2026-06-08' } });

    expect(screen.getByText(/8 jun 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/7 jun 2026/)).not.toBeInTheDocument();
  });
});
