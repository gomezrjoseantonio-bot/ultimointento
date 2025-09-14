import React, { useState, useRef } from 'react';
import { FileText, AlertTriangle, CheckCircle, X, Loader2 } from 'lucide-react';
import { FeinLoanDraft } from '../../types/fein';
import { feinOcrService } from '../../services/feinOcrService';
import { showError } from '../../services/toastService';

interface FEINUploaderProps {
  onFEINDraftReady: (draft: FeinLoanDraft) => void; // Main callback for new implementation
  onCancel: () => void;
}

const FEINUploader: React.FC<FEINUploaderProps> = ({ onFEINDraftReady, onCancel }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [lastPercent, setLastPercent] = useState(0); // For monotonic progress

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    // Prevent drop if already processing
    if (isProcessing || showProgressModal) {
      return;
    }
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Prevent input if already processing
    if (isProcessing || showProgressModal) {
      return;
    }
    
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = async (file: File) => {
    // Prevent duplicate uploads
    if (isProcessing || showProgressModal) {
      return;
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      showError('Solo se permiten archivos PDF para documentos FEIN');
      return;
    }

    // Validate file size (max 8MB as per server limit)
    if (file.size > 8 * 1024 * 1024) {
      showError('El archivo es demasiado grande. Máximo 8MB permitido.');
      return;
    }

    try {
      setIsProcessing(true);
      setUploadProgress(20);
      setProcessingStage('Preparando documento...');

      // Use new implementation
      const response = await feinOcrService.processFEINDocumentNew(file);
      
      if (response.mode === 'sync') {
        // Sync response - no progress panel needed
        setUploadProgress(100);
        setProcessingStage('Procesamiento completado');
        
        setTimeout(() => {
          setIsProcessing(false);
          
          if (response.result?.success && response.result.loanDraft) {
            // Apply to form using new method
            console.log('[FEIN] Successfully extracted data:', response.result.loanDraft);
            onFEINDraftReady(response.result.loanDraft);
          } else {
            handleProcessingError(response.result?.errors || ['Error procesando documento'], file);
          }
        }, 500);
        
      } else if (response.mode === 'background') {
        // Background processing - show unified progress modal
        setIsProcessing(false); // Stop initial processing state
        setShowProgressModal(true);
        setProgressPercent(10); // Start with 10%
        setLastPercent(10); // Initialize monotonic progress
        
        // Simulate progress increase to avoid static UI
        const progressSimulation = setInterval(() => {
          setProgressPercent(prev => {
            const newPercent = Math.min(prev + 2, 70);
            setLastPercent(current => Math.max(current, newPercent)); // Ensure monotonic
            return newPercent;
          });
        }, 1000);
        
        // Start polling
        try {
          const result = await feinOcrService.pollForBackgroundResult(response.jobId!, (progress) => {
            clearInterval(progressSimulation);
            // Ensure monotonic progress - never decrease
            const apiPercent = progress.percent || 0;
            setProgressPercent(prevPercent => {
              const displayPercent = Math.max(lastPercent, apiPercent);
              setLastPercent(displayPercent);
              // Don't exceed 95% until completed
              return progress.percent === 100 ? 100 : Math.min(displayPercent, 95);
            });
          });
          
          clearInterval(progressSimulation);
          
          if (result.success && result.loanDraft) {
            // Set to 100% and show completion
            setProgressPercent(100);
            setLastPercent(100);
            
            // Brief pause to show 100% before closing
            setTimeout(() => {
              setShowProgressModal(false);
              console.log('[FEIN] Background processing completed:', result.loanDraft);
              if (result.loanDraft) {
                onFEINDraftReady(result.loanDraft);
              }
            }, 500);
          } else {
            // Single toast message per requirements
            setShowProgressModal(false);
            handleProcessingError(result.errors, file);
          }
          
        } catch (error) {
          clearInterval(progressSimulation);
          setShowProgressModal(false);
          handleProcessingError(['Tardando más de lo habitual. Inténtalo de nuevo.'], file);
        }
      }

    } catch (error) {
      console.error('Error processing FEIN:', error);
      setIsProcessing(false);
      setShowProgressModal(false);
      handleProcessingError(['Error de conexión. Inténtalo de nuevo.'], file);
    }
  };

  const handleProcessingError = (errors: string[], file: File) => {
    // Show single toast message per requirements - no duplicates
    const errorMessage = errors.length > 0 ? errors[0] : 'No hemos podido procesar la FEIN. Revisa el documento o inténtalo de nuevo.';
    showError(errorMessage);
    
    // Create empty draft for manual entry
    const emptyDraft: FeinLoanDraft = {
      metadata: {
        sourceFileName: file.name,
        pagesTotal: 1,
        pagesProcessed: 1,
        ocrProvider: 'failed',
        processedAt: new Date().toISOString(),
        warnings: errors
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
    
    onFEINDraftReady(emptyDraft);
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="mb-6">
              <Loader2 className="h-12 w-12 mx-auto animate-spin" style={{ color: 'var(--atlas-blue)' }} />
            </div>
            
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--hz-text)' }}>
              Procesando FEIN
            </h3>
            
            <p className="text-sm mb-4" style={{ color: 'var(--text-gray)' }}>
              {processingStage || 'Extrayendo información del préstamo...'}
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div 
                className="h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${uploadProgress}%`,
                  backgroundColor: 'var(--atlas-blue)'
                }}
              />
            </div>

            <p className="text-xs mb-4" style={{ color: 'var(--text-gray)' }}>
              {uploadProgress}% completado
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Background Processing Modal
  if (showProgressModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="mb-6">
              <Loader2 className="h-12 w-12 mx-auto animate-spin" style={{ color: 'var(--atlas-blue)' }} />
            </div>
            
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--hz-text)' }}>
              Procesando FEIN…
            </h3>
            
            <p className="text-sm mb-6" style={{ color: 'var(--text-gray)' }}>
              Estamos extrayendo los datos del documento.
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div 
                className="h-3 rounded-full transition-all duration-300"
                style={{ 
                  width: `${progressPercent}%`,
                  backgroundColor: 'var(--atlas-blue)'
                }}
              />
            </div>

            <p className="text-xs mb-4" style={{ color: 'var(--text-gray)' }}>
              {progressPercent}% completado
            </p>

            <button
              onClick={() => {
                setShowProgressModal(false);
                onCancel();
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 
              className="font-semibold tracking-[-0.01em] text-[24px] leading-[32px]" 
              style={{ color: 'var(--hz-text)' }}
            >
              Crear préstamo desde FEIN
            </h1>
            <p className="text-neutral-600 text-sm leading-5 font-normal mt-1">
              Suba su documento FEIN (PDF) para crear automáticamente el préstamo
            </p>
          </div>
          
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors hover:bg-gray-100"
            style={{ color: 'var(--text-gray)' }}
          >
            <X className="h-4 w-4" />
            Cancelar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          {/* Upload Area - Horizon colors */}
          <div
            className={`border-2 border-dashed rounded-atlas p-12 text-center transition-colors ${
              isProcessing || showProgressModal
                ? 'opacity-50 cursor-not-allowed'
                : dragActive 
                  ? 'bg-primary-50' 
                  : 'hover:border-gray-400'
            }`}
            style={{ 
              borderColor: dragActive ? 'var(--atlas-blue)' : 'var(--text-gray)',
              backgroundColor: dragActive ? 'var(--bg)' : 'transparent'
            }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <FileText 
              className="mx-auto h-16 w-16 mb-4" 
              style={{ color: 'var(--atlas-blue)' }}
            />
            
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--hz-text)' }}>
              Subir documento FEIN
            </h3>
            
            <p className="mb-4" style={{ color: 'var(--text-gray)' }}>
              Arrastra y suelta tu documento FEIN aquí o haz clic para seleccionar
            </p>
            
            <p className="text-sm mb-6" style={{ color: 'var(--text-gray)' }}>
              Solo archivos PDF • Máximo 8MB
            </p>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || showProgressModal}
              className="px-6 py-3 text-white rounded-md font-medium transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--atlas-blue)' }}
            >
              Seleccionar archivo FEIN
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileInput}
              disabled={isProcessing || showProgressModal}
              className="hidden"
            />
          </div>

          {/* Information Panel - Horizon colors */}
          <div className="mt-8 border rounded-atlas p-6" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--atlas-blue)' }}>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 mt-0.5" style={{ color: 'var(--atlas-blue)' }} />
              <div>
                <h4 className="font-medium mb-2" style={{ color: 'var(--atlas-blue)' }}>
                  ¿Qué información extraeremos de su FEIN?
                </h4>
                <ul className="text-sm space-y-1" style={{ color: 'var(--atlas-navy-1)' }}>
                  <li>• Entidad bancaria emisora</li>
                  <li>• Capital inicial del préstamo</li>
                  <li>• TIN y TAE</li>
                  <li>• Plazo en años/meses</li>
                  <li>• Tipo de interés (Fijo/Variable/Mixto)</li>
                  <li>• Bonificaciones (seguros, domiciliaciones, etc.)</li>
                  <li>• Comisiones (apertura, amortización, cancelación)</li>
                  <li>• Cuenta de cargo (IBAN)</li>
                  <li>• Fecha prevista de primer pago</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Improved Information Panel */}
          <div className="mt-4 border rounded-atlas p-4" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--success)' }}>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 mt-0.5" style={{ color: 'var(--success)' }} />
              <div>
                <h4 className="font-medium mb-1" style={{ color: 'var(--atlas-navy-1)' }}>
                  Proceso mejorado
                </h4>
                <p className="text-sm" style={{ color: 'var(--text-gray)' }}>
                  Extraemos primero el texto nativo del PDF. Solo aplicamos OCR a páginas escaneadas, 
                  procesando página por página para evitar errores de tamaño.
                </p>
              </div>
            </div>
          </div>

          {/* Warning Panel - Horizon colors */}
          <div className="mt-4 border rounded-atlas p-4" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--warn)' }}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 mt-0.5" style={{ color: 'var(--warn)' }} />
              <div>
                <h4 className="font-medium mb-1" style={{ color: 'var(--atlas-navy-1)' }}>
                  Importante
                </h4>
                <p className="text-sm" style={{ color: 'var(--text-gray)' }}>
                  Si no se puede extraer toda la información, se abrirá el formulario de préstamo 
                  con los datos detectados pre-rellenados para que puedas completar manualmente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FEINUploader;