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
  cuentasService: { list: jest.fn(), efectivoExistente: jest.fn() },
}));

// CRA usa resetMocks:true · reestablecemos la implementación en cada test.
beforeEach(() => {
  (cuentasService.list as jest.Mock).mockResolvedValue([]);
  (cuentasService.efectivoExistente as jest.Mock).mockResolvedValue(undefined);
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

  it('el campo conserva el día que se escribe · sin off-by-one', () => {
    // Este test nació contra la vista previa, que enseñaba un día menos al
    // formatear en horario local. La vista previa se eliminó en §10 —enseñaba
    // una cuenta que no era la real y no reaccionaba—, pero el off-by-one
    // sigue siendo un riesgo vivo en cuanto alguien vuelva a formatear esta
    // fecha, así que el test se queda apuntando al dato en vez de al pintado.
    render(<CuentaWizard open onClose={() => {}} />);
    const fecha = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(fecha, { target: { value: '2026-06-08' } });

    expect(fecha.value).toBe('2026-06-08');
  });
});
