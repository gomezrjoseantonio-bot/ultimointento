// Smoke test · AportarModal · PR 4 T-INVERSIONES-V5
// Cobertura mínima (spec §11.1 PR 4) ·
//   importe 1.500 → preview ahorro 675 € con marginal 45%.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import AportarModal from '../AportarModal';
import { planPensionToCartaItem } from '../../../types/cartaItem';
import type { PlanPensiones } from '../../../../../types/planesPensiones';

jest.mock('../../../../../services/cuentasService', () => ({
  __esModule: true,
  cuentasService: { list: () => Promise.resolve([]) },
}));

jest.mock('../../../../../design-system/v5', () => {
  const actual = jest.requireActual('../../../../../design-system/v5');
  return { ...actual, showToastV5: jest.fn() };
});

const mockPlan: PlanPensiones = {
  id: 'plan-1',
  personalDataId: 1,
  nombre: 'Plan Naranja',
  tipoAdministrativo: 'PPI',
  gestoraActual: 'ING',
  fechaContratacion: '2020-01-01',
  valorActual: 50_000,
  titular: 'yo',
  estado: 'activo',
  origen: 'manual',
  fechaCreacion: '2020-01-01T00:00:00.000Z',
  fechaActualizacion: '2020-01-01T00:00:00.000Z',
};

describe('AportarModal · impacto fiscal', () => {
  it('preview muestra ahorro 675 € cuando importe = 1500 y marginal = 45%', () => {
    render(
      <AportarModal
        posicion={planPensionToCartaItem(mockPlan)}
        marginalIrpf={0.45}
        onClose={() => undefined}
      />,
    );

    // Inicialmente · sin importe · ahorro = 0
    expect(screen.getAllByText(/0\s*€/).length).toBeGreaterThan(0);

    // Introducir 1500 en el importe
    const importeInput = screen.getByLabelText(/Importe a aportar/);
    fireEvent.change(importeInput, { target: { value: '1500' } });

    // Preview muestra 675 € (1500 × 0.45) varias veces (card dark + row)
    expect(screen.getAllByText(/675\s*€/).length).toBeGreaterThan(0);
    expect(screen.getByText(/marginal 45%/)).toBeInTheDocument();
  });

  it('para una inversión NO muestra ahorro IRPF (no deducible)', () => {
    const mockInv = {
      _origen: 'inversiones' as const,
      _idOriginal: 1,
      _original: { id: 1, tipo: 'fondo_inversion' } as never,
      nombre: 'MSCI World',
      tipo: 'fondo_inversion' as const,
      entidad: 'MyInvestor',
      valor_actual: 1000,
      total_aportado: 1000,
      rentabilidad_euros: 0,
      rentabilidad_porcentaje: 0,
    };

    render(<AportarModal posicion={mockInv} marginalIrpf={0.45} onClose={() => undefined} />);

    expect(screen.getByText(/sin deducción IRPF/)).toBeInTheDocument();
    expect(screen.queryByText(/marginal 45%/)).not.toBeInTheDocument();
  });

  it('llama onSavePlan con shape correcto para un plan', async () => {
    const onSavePlan = jest.fn();
    render(
      <AportarModal
        posicion={planPensionToCartaItem(mockPlan)}
        marginalIrpf={0.45}
        onSavePlan={onSavePlan}
        onClose={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Importe a aportar/), {
      target: { value: '1500' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aportar' }));

    await new Promise((r) => setTimeout(r, 50));
    expect(onSavePlan).toHaveBeenCalledTimes(1);
    const [plan, input] = onSavePlan.mock.calls[0];
    expect(plan.id).toBe('plan-1');
    expect(input.importeTitular).toBe(1500);
    expect(input.importeEmpresa).toBe(0);
    expect(input.ejercicioFiscal).toBe(new Date().getUTCFullYear());
  });

  it('cancelar dispara onClose', () => {
    const onClose = jest.fn();
    render(
      <AportarModal
        posicion={planPensionToCartaItem(mockPlan)}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
