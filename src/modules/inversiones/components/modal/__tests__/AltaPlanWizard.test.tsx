// Smoke test · AltaPlanWizard · PR 3 T-INVERSIONES-V5
// Cobertura mínima (spec §11.1 PR 3) ·
//   - render PPE por defecto
//   - cambiar a PPI muestra art. 51.6 LIRPF
//   - check discapacidad muestra 24.250 €
//
// Mockeamos los services para que el wizard renderice sin tocar IndexedDB.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import AltaPlanWizard from '../AltaPlanWizard';

jest.mock('../../../../../services/fiscalContextService', () => ({
  getFiscalContextSafe: jest.fn(async () => ({ personalDataId: 1 })),
}));

jest.mock('../../../../../services/nominaService', () => ({
  nominaService: { getNominas: jest.fn(async () => []) },
}));

jest.mock('../../../../../services/planesPensionesService', () => ({
  planesPensionesService: { createPlan: jest.fn() },
}));

jest.mock('../../../../../design-system/v5', () => {
  const actual = jest.requireActual('../../../../../design-system/v5');
  return { ...actual, showToastV5: jest.fn() };
});

describe('AltaPlanWizard · §7.1 copy fiscal dinámico', () => {
  it('renderiza con PPE preseleccionado por defecto y muestra el límite art. 51.7', () => {
    render(<AltaPlanWizard onSaved={() => undefined} onClose={() => undefined} />);

    // Card PPE marcada como activa (aria-checked)
    const ppeCard = document.querySelector('button[data-tipo="PPE"]');
    expect(ppeCard).toHaveAttribute('aria-checked', 'true');

    // Preview muestra art. 51.7 (PPE · 10.000 €)
    expect(screen.getByText(/art\. 51\.7 LIRPF/)).toBeInTheDocument();
    expect(screen.getByText(/10\.?000\s*€/)).toBeInTheDocument();
  });

  it('cambiar a PPI muestra art. 51.6 LIRPF · 1.500 €', () => {
    render(<AltaPlanWizard tipoInicial="PPE" onSaved={() => undefined} onClose={() => undefined} />);

    // Click en card PPI
    fireEvent.click(document.querySelector('button[data-tipo="PPI"]')!);

    // Preview ahora muestra art. 51.6 (PPI · 1.500 €)
    expect(screen.getByText(/art\. 51\.6 LIRPF/)).toBeInTheDocument();
    expect(screen.getByText(/1\.?500\s*€/)).toBeInTheDocument();
    // El art. 51.7 ya NO aparece
    expect(screen.queryByText(/art\. 51\.7 LIRPF/)).not.toBeInTheDocument();
  });

  it('cambiar a PPES + subtipo "autonomos" muestra art. 51.8 · 5.750 €', () => {
    render(<AltaPlanWizard tipoInicial="PPES" onSaved={() => undefined} onClose={() => undefined} />);

    // El subtipo default es "sectorial" → 1.500 € (art. 51.6)
    expect(screen.getByText(/art\. 51\.6 LIRPF/)).toBeInTheDocument();

    // Cambia subtipo a autónomos
    const subtipoSelect = screen.getByLabelText('Subtipo PPES') as HTMLSelectElement;
    fireEvent.change(subtipoSelect, { target: { value: 'autonomos' } });

    // Ahora muestra art. 51.8 · 5.750 €
    expect(screen.getByText(/art\. 51\.8 LIRPF.*Ley 12\/2022/)).toBeInTheDocument();
    expect(screen.getByText(/5\.?750\s*€/)).toBeInTheDocument();
  });

  it('check discapacidad ≥33% muestra el límite especial 24.250 € · art. 52.1.c', () => {
    render(<AltaPlanWizard tipoInicial="PPI" onSaved={() => undefined} onClose={() => undefined} />);

    // Sin discapacidad → preview PPI muestra 1.500 €. Hay 2 matches (preview
    // val + ahorro row) · uso getAllByText con length≥1.
    expect(screen.getAllByText(/1\.?500\s*€/).length).toBeGreaterThan(0);

    // Click en el toggle de discapacidad
    fireEvent.click(screen.getByTestId('check-discapacidad'));

    // Ahora muestra 24.250 € · art. 52.1.c LIRPF (gana sobre tipo) ·
    // aparece en preview val + en el checkSub del propio toggle.
    expect(screen.getAllByText(/24\.?250\s*€/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/art\. 52\.1\.c LIRPF/).length).toBeGreaterThan(0);
  });

  it('cambia ahorro estimado IRPF al cambiar tipo (límite × 0.45)', () => {
    render(<AltaPlanWizard tipoInicial="PPE" onSaved={() => undefined} onClose={() => undefined} />);

    // PPE · ahorro estimado = 10.000 × 0.45 = 4.500 €. Aparece como row v
    // del preview.
    expect(screen.getAllByText(/4\.?500\s*€/).length).toBeGreaterThan(0);

    // Cambia a PPI · ahorro = 1.500 × 0.45 = 675 €
    fireEvent.click(document.querySelector('button[data-tipo="PPI"]')!);
    expect(screen.getAllByText(/675\s*€/).length).toBeGreaterThan(0);
  });

  it('cancelar dispara onClose', () => {
    const onClose = jest.fn();
    render(<AltaPlanWizard onSaved={() => undefined} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
