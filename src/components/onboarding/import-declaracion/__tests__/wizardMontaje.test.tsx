// Wizard import XML V2 · smoke test de montaje (integración ligera).
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { WizardImportarDeclaracion } from '../index';

describe('WizardImportarDeclaracion · montaje', () => {
  it('open=false · no renderiza nada', () => {
    const { container } = render(<WizardImportarDeclaracion open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('open · embebido · renderiza el paso 1 (Fuente)', () => {
    render(<WizardImportarDeclaracion open embedded onClose={() => {}} />);
    expect(screen.getByText('Sube tu declaración IRPF')).toBeInTheDocument();
    expect(screen.getByText(/Arrastra aquí tus archivos/)).toBeInTheDocument();
    // El stepper muestra las píldoras.
    expect(screen.getByText('Fuente')).toBeInTheDocument();
    expect(screen.getAllByText('Inmuebles').length).toBeGreaterThan(0);
    // H5 · aside en pre-estado cuando no hay archivos.
    expect(screen.getByText('Aún no hay archivos')).toBeInTheDocument();
  });

  it('embebido con onBack · muestra "Volver" en el paso 1', () => {
    render(<WizardImportarDeclaracion open embedded onClose={() => {}} onBack={() => {}} />);
    expect(screen.getByText('Volver')).toBeInTheDocument();
  });
});
