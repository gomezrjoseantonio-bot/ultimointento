import React, { useState, useRef } from 'react';
import { FileText, AlertTriangle, CheckCircle, X, Loader2 } from 'lucide-react';
import { FeinLoanDraft } from '../../types/fein';
import { feinOcrService } from '../../services/feinOcrService';

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
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

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
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = async (file: File) => {
    // Validate file type
    if (file.type !== 'application/pdf') {
      // Use toast instead of alert - ATLAS requirement
      const errorMsg = 'Solo se permiten archivos PDF para documentos FEIN';
      console.error('[FEIN Upload]', errorMsg);
      // For now use console since we don't have toast imported
      // In production this should be: toast.error(errorMsg);
      return;
    }

    // Validate file size (max 20MB as per FEIN requirements)
    if (file.size > 20 * 1024 * 1024) {
      const errorMsg = 'El archivo es demasiado grande. Máximo 20MB permitido.';
      console.error('[FEIN Upload]', errorMsg);
      // For now use console since we don't have toast imported
      // In production this should be: toast.error(errorMsg);
      return;
    }

    try {
      setIsProcessing(true);
      setUploadProgress(0);
      setProcessingStage('Preparando documento...');
      setCurrentPage(0);
      setTotalPages(0);

      // Process with new implementation
      const result = await feinOcrService.processFEINDocument(file, (progress) => {
        // Update progress based on stage
        setCurrentPage(progress.currentPage);
        setTotalPages(progress.totalPages);
        setProcessingStage(progress.message);
        
        // Calculate overall progress
        let overallProgress = 0;
        if (progress.stage === 'extracting') {
          overallProgress = Math.round((progress.currentPage / progress.totalPages) * 60);
        } else if (progress.stage === 'ocr') {
          overallProgress = 60 + Math.round((progress.currentPage / progress.totalPages) * 30);
        } else if (progress.stage === 'parsing') {
          overallProgress = 90;
        } else if (progress.stage === 'complete') {
          overallProgress = 100;
        }
        
        setUploadProgress(Math.min(overallProgress, 100));
      });
      
      setUploadProgress(100);
      setProcessingStage('Procesamiento completado');
      
      // Small delay to show completion
      setTimeout(() => {
        setIsProcessing(false);
        
        if (result.success && result.loanDraft) {
          // Show success message if we have some data extracted
          const hasData = result.loanDraft.prestamo.capitalInicial || 
                          result.loanDraft.prestamo.banco || 
                          result.loanDraft.prestamo.tipo;
          
          if (hasData) {
            console.log('[FEIN] Successfully extracted data:', result.loanDraft);
            onFEINDraftReady(result.loanDraft);
          } else {
            console.warn('[FEIN] No sufficient data extracted, allowing manual completion');
            // Still pass the draft with whatever was extracted
            onFEINDraftReady(result.loanDraft);
          }
        } else {
          // Show error but allow manual creation
          const errorMsg = result.errors.length > 0 
            ? result.errors.join('. ') 
            : 'No se pudo procesar el documento FEIN';
          console.error('[FEIN] Processing error:', errorMsg);
          
          // Create empty draft for manual entry
          const emptyDraft: FeinLoanDraft = {
            metadata: {
              sourceFileName: file.name,
              pagesTotal: result.pagesProcessed || 0,
              pagesProcessed: result.pagesProcessed || 0,
              ocrProvider: 'failed',
              processedAt: new Date().toISOString(),
              warnings: result.warnings
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
              ibanCargoParcial: null
            },
            bonificaciones: []
          };
          
          onFEINDraftReady(emptyDraft);
        }
      }, 1000);

    } catch (error) {
      console.error('Error processing FEIN:', error);
      setIsProcessing(false);
      // Replace alert with console error - ATLAS requirement (no browser alerts)
      console.error('[FEIN] Processing failed - please try again');
    }
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

            {/* Page-specific info */}
            {totalPages > 0 && (
              <div className="text-xs space-y-1" style={{ color: 'var(--text-gray)' }}>
                <p>Página {currentPage} de {totalPages}</p>
                {uploadProgress === 100 && (
                  <p className="text-green-600 font-medium">✓ Análisis completado</p>
                )}
              </div>
            )}
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
              dragActive 
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
              Solo archivos PDF • Máximo 20MB
            </p>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 text-white rounded-md font-medium transition-colors hover:opacity-90"
              style={{ backgroundColor: 'var(--atlas-blue)' }}
            >
              Seleccionar archivo FEIN
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileInput}
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