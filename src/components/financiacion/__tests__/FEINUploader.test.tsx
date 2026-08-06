/**
 * FEIN Uploader Component Tests
 * Tests for UI behavior with new toast notifications and background processing banner
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FEINUploader from '../FEINUploader';

// Mock the toast service
jest.mock('../../../services/toastService', () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showInfo: jest.fn()
}));

// Lo lee Claude · lo que se prueba aquí es la pantalla, no la lectura.
jest.mock('../../../services/fein/leerFeinConClaude', () => ({
  leerFeinConClaude: jest.fn(),
}));

import { showError, showSuccess, showInfo } from '../../../services/toastService';
import { leerFeinConClaude } from '../../../services/fein/leerFeinConClaude';

describe('FEINUploader Component', () => {
  const mockOnFEINDraftReady = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show error toast for invalid file type', async () => {
    render(
      <FEINUploader 
        onFEINDraftReady={mockOnFEINDraftReady} 
        onCancel={mockOnCancel} 
      />
    );

    const fileInput = screen.getByDisplayValue('');
    const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(showError).toHaveBeenCalledWith('Solo se permiten archivos PDF para documentos FEIN');
    });
  });

  it('should show error toast for file too large', async () => {
    render(
      <FEINUploader 
        onFEINDraftReady={mockOnFEINDraftReady} 
        onCancel={mockOnCancel} 
      />
    );

    const fileInput = screen.getByDisplayValue('');
    // Create a file larger than 8MB
    const largeFile = new File(['x'.repeat(9 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(showError).toHaveBeenCalledWith('El archivo es demasiado grande. Máximo 8MB permitido.');
    });
  });

  it('should show success toast for successful processing', async () => {
    const mockLoanDraft = {
      metadata: {
        sourceFileName: 'test.pdf',
        pagesTotal: 1,
        pagesProcessed: 1,
        ocrProvider: 'docai',
        processedAt: new Date().toISOString(),
        warnings: []
      },
      prestamo: {
        tipo: 'FIJO',
        periodicidadCuota: 'MENSUAL',
        revisionMeses: null,
        indiceReferencia: null,
        valorIndiceActual: null,
        diferencial: null,
        tinFijo: 2.5,
        comisionAperturaPct: null,
        comisionMantenimientoMes: null,
        amortizacionAnticipadaPct: null,
        fechaFirmaPrevista: null,
        banco: 'Test Bank',
        capitalInicial: 100000,
        plazoMeses: 240,
        ibanCargoParcial: null
      },
      bonificaciones: []
    };

    (leerFeinConClaude as jest.Mock).mockResolvedValue(mockLoanDraft);

    render(
      <FEINUploader 
        onFEINDraftReady={mockOnFEINDraftReady} 
        onCancel={mockOnCancel} 
      />
    );

    const fileInput = screen.getByDisplayValue('');
    const validFile = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      // Cuántas condiciones se han leído · decirlo es la diferencia entre
      // ayudar y prometer. Una FEIN nunca viene entera.
      expect(showSuccess).toHaveBeenCalledWith(expect.stringContaining('condiciones'));
    }, { timeout: 3000 });

    expect(mockOnFEINDraftReady).toHaveBeenCalledWith(mockLoanDraft);
  });

  it('should show info toast for partial data extraction', async () => {
    const mockLoanDraft = {
      metadata: {
        sourceFileName: 'test.pdf',
        pagesTotal: 1,
        pagesProcessed: 1,
        ocrProvider: 'docai',
        processedAt: new Date().toISOString(),
        warnings: []
      },
      prestamo: {
        tipo: null,
        periodicidadCuota: 'MENSUAL',
        revisionMeses: null,
        indiceReferencia: null,
        valorIndiceActual: null,
        diferencial: null,
        tinFijo: null,
        comisionAperturaPct: null,
        comisionMantenimientoMes: null,
        amortizacionAnticipadaPct: null,
        fechaFirmaPrevista: null,
        banco: null,
        capitalInicial: undefined,
        plazoMeses: undefined,
        ibanCargoParcial: null
      },
      bonificaciones: []
    };

    // Casi nada leído · con mil FEIN distintas esto va a pasar, y hay que
    // decirlo en vez de dar por bueno un formulario vacío.
    (leerFeinConClaude as jest.Mock).mockResolvedValue({
      ...mockLoanDraft,
      prestamo: { tipo: null, banco: 'Test Bank', ibanCargoParcial: null },
    });

    render(
      <FEINUploader 
        onFEINDraftReady={mockOnFEINDraftReady} 
        onCancel={mockOnCancel} 
      />
    );

    const fileInput = screen.getByDisplayValue('');
    const validFile = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('Hemos leído poco'));
    }, { timeout: 3000 });
  });

  it('should show error toast for timeout', async () => {
    (leerFeinConClaude as jest.Mock).mockRejectedValue(
      new Error('Tiempo de espera agotado. Intenta de nuevo')
    );

    render(
      <FEINUploader 
        onFEINDraftReady={mockOnFEINDraftReady} 
        onCancel={mockOnCancel} 
      />
    );

    const fileInput = screen.getByDisplayValue('');
    const validFile = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(showError).toHaveBeenCalledWith(
        expect.any(String),
        'Intenta de nuevo o procesa manualmente'
      );
    }, { timeout: 3000 });
  });
});