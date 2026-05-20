// src/components/valoraciones/__tests__/ImportValoracionesWizard.test.tsx
// T-VALORACIONES PR3 · smoke tests del wizard embebido.
//
// La integración real (CSV → bulkInsert → store) se verifica en
// `valoracionesService.v2.test.ts` (test 'bulkInsert 100 entradas') y
// en pruebas manuales en deploy preview con DB real.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImportValoracionesWizard from '../ImportValoracionesWizard';

// Mock react-hot-toast (no-op para smoke test)
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ImportValoracionesWizard · smoke', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('renderiza el dialog modal con header', () => {
    render(
      <ImportValoracionesWizard
        activoId="42"
        tipoActivo="inversion"
        activoNombre="Fondo Test"
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Importar histórico')).toBeInTheDocument();
    expect(screen.getByText(/Fondo Test/)).toBeInTheDocument();
    expect(screen.getByText(/inversion/)).toBeInTheDocument();
  });

  it('muestra subtipo cuando se pasa subtipoInversion', () => {
    render(
      <ImportValoracionesWizard
        activoId="1"
        tipoActivo="inversion"
        subtipoInversion="fondo"
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );
    expect(screen.getByText(/fondo/)).toBeInTheDocument();
  });

  it('botón cerrar invoca onClose', () => {
    const onClose = jest.fn();
    render(
      <ImportValoracionesWizard
        activoId="1"
        tipoActivo="inmueble"
        activoNombre="Piso Madrid"
        onClose={onClose}
        onSuccess={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText('Cerrar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('click en el overlay (fuera del modal) invoca onClose', () => {
    const onClose = jest.fn();
    render(
      <ImportValoracionesWizard
        activoId="1"
        tipoActivo="inmueble"
        onClose={onClose}
        onSuccess={() => {}}
      />,
    );
    // El dialog tiene onClick en el overlay; clic directo en él lo cierra.
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('muestra dropzone con instrucciones cuando no hay archivo', () => {
    render(
      <ImportValoracionesWizard
        activoId="1"
        tipoActivo="inmueble"
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );
    expect(screen.getByText(/Arrastra el archivo aquí/)).toBeInTheDocument();
    expect(screen.getByText(/Formatos admitidos:/)).toBeInTheDocument();
  });

  it('header refleja tipoActivo plan_pensiones', () => {
    render(
      <ImportValoracionesWizard
        activoId="plan-xyz"
        tipoActivo="plan_pensiones"
        activoNombre="Mi plan jubilación"
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );
    expect(screen.getByText(/plan_pensiones/)).toBeInTheDocument();
    expect(screen.getByText(/Mi plan jubilación/)).toBeInTheDocument();
  });

  it('header refleja tipoActivo inmueble', () => {
    render(
      <ImportValoracionesWizard
        activoId="7"
        tipoActivo="inmueble"
        activoNombre="Piso Madrid"
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );
    expect(screen.getByText(/inmueble/)).toBeInTheDocument();
  });
});
