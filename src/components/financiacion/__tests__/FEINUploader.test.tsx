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

// Mock the FEIN OCR service
jest.mock('../../../services/feinOcrService', () => ({
  feinOcrService: {
    processFEINDocument: jest.fn(),
    processFEINDocumentNew: jest.fn()
  }
}));

import { showError, showSuccess, showInfo } from '../../../services/toastService';
import { feinOcrService } from '../../../services/feinOcrService';

describe('FEINUploader Component', () => {
  const mockOnFEINDraftReady = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock for processFEINDocumentNew
    (feinOcrService.processFEINDocumentNew as jest.Mock).mockResolvedValue({
      mode: 'sync',
      result: {
        success: true,
        loanDraft: {
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
            banco: null,
            capitalInicial: 250000,
            plazoMeses: 300,
            ibanCargoParcial: null
          },
          bonificaciones: []
        },
        errors: [],
        warnings: [],
        fieldsExtracted: ['capitalInicial', 'plazoMeses', 'tinFijo'],
        fieldsMissing: []
      }
    });
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

  it('should call onFEINDraftReady for successful processing', async () => {
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

    (feinOcrService.processFEINDocumentNew as jest.Mock).mockResolvedValue({
      mode: 'sync',
      result: {
        success: true,
        loanDraft: mockLoanDraft,
        confidence: 0.85,
        errors: [],
        warnings: [],
        fieldsExtracted: ['capitalInicial', 'banco', 'tipo'],
        fieldsMissing: [],
        pendingFields: [],
        providerUsed: 'docai'
      }
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
      expect(mockOnFEINDraftReady).toHaveBeenCalledWith(mockLoanDraft);
    }, { timeout: 3000 });
  });

  it('should handle failed processing correctly', async () => {
    (feinOcrService.processFEINDocumentNew as jest.Mock).mockResolvedValue({
      mode: 'sync',
      result: {
        success: false,
        errors: ['Error procesando documento'],
        warnings: [],
        fieldsExtracted: [],
        fieldsMissing: ['all'],
        pendingFields: ['all']
      }
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
      expect(showError).toHaveBeenCalledWith('Error procesando documento');
    }, { timeout: 3000 });

    // Should still call onFEINDraftReady with empty draft for manual entry
    expect(mockOnFEINDraftReady).toHaveBeenCalled();
  });
});