import React, { useState, useCallback } from 'react';
import { Upload, X, FileText, AlertCircle } from 'lucide-react';
import { Account } from '../../../../services/db';
import { showError } from '../../../../services/toastService';
import { trackMovementCreation } from '../../../../utils/treasuryAnalytics';
import AccountSelectionModal from '../../../../components/modals/AccountSelectionModal';
import { importBankStatement, ImportOptions } from '../../../../services/bankStatementImportService';
import toast from 'react-hot-toast';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onImportComplete: () => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, accounts, onImportComplete }) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [detectedBank, setDetectedBank] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showAccountSelection, setShowAccountSelection] = useState(false);
  const [unrecognizedIBAN, setUnrecognizedIBAN] = useState<string | null>(null);

  const handleFile = useCallback(async (selectedFile: File) => {
    const fileType = selectedFile.type;
    const fileName = selectedFile.name.toLowerCase();
    
    if (!fileType.includes('csv') && 
        !fileType.includes('spreadsheet') && 
        !fileName.endsWith('.csv') && 
        !fileName.endsWith('.xls') && 
        !fileName.endsWith('.xlsx')) {
      showError('Solo se admiten archivos CSV, XLS o XLSX');
      return;
    }

    setFile(selectedFile);
    
    // Basic bank detection by filename
    let detected = null;
    if (fileName.includes('santander')) detected = 'Santander';
    else if (fileName.includes('bbva')) detected = 'BBVA';
    else if (fileName.includes('caixa') || fileName.includes('lacaixa')) detected = 'CaixaBank';
    else if (fileName.includes('ing')) detected = 'ING';
    else if (fileName.includes('sabadell')) detected = 'Sabadell';
    
    setDetectedBank(detected);
    setShowPreview(false); // Simplified - no preview for now
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      showError('Selecciona un archivo para importar');
      return;
    }

    setImporting(true);
    
    try {
      // Use the unified import service  
      if (!selectedAccount) {
        toast.error('Debe seleccionar una cuenta de destino');
        setImporting(false);
        return;
      }

      const options: ImportOptions = {
        file,
        destinationAccountId: selectedAccount,
        usuario: 'tesoreria_ui'
      };
      
      const result = await importBankStatement(options);
      
      if (result.requiresAccountSelection) {
        // Show account selection modal
        setUnrecognizedIBAN(result.unrecognizedIBAN || null);
        setShowAccountSelection(true);
        setImporting(false);
        return;
      }
      
      if (result.success) {
        // Track analytics
        trackMovementCreation('import', result.inserted, {
          sourceBank: detectedBank || 'manual_selection',
          fileName: file.name,
          fileSize: file.size,
          accountId: selectedAccount || 0,
          duplicatesFound: result.duplicates,
          errorsFound: result.errors
        });
        
        // Trigger immediate reload
        onImportComplete();
        handleClose();
      } else {
        // More specific error messages
        const errorMsg = result.errors > 0 
          ? `Se produjeron ${result.errors} errores durante la importación`
          : 'No se pudieron procesar los movimientos del archivo';
        showError('Error al importar el extracto', errorMsg);
      }
      
    } catch (error) {
      console.error('Import error:', error);
      // Better error message based on error type
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      if (errorMessage.includes('No se pudo detectar la cuenta')) {
        showError('Cuenta no detectada', 'No se pudo detectar la cuenta automáticamente. Selecciónala manualmente.');
      } else if (errorMessage.includes('archivo no soportado') || errorMessage.includes('formato')) {
        showError('Formato no soportado', 'Verifica que el archivo sea un extracto bancario válido (CSV, XLS, XLSX)');
      } else if (errorMessage.includes('suficientes datos')) {
        showError('Archivo vacío o incompleto', 'El archivo no contiene movimientos válidos para importar');
      } else {
        showError('Error al importar el extracto', errorMessage);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleAccountSelected = (accountId: number) => {
    setSelectedAccount(accountId);
    setShowAccountSelection(false);
    setUnrecognizedIBAN(null);
    // Continue with import using the selected account
    setTimeout(() => {
      handleImport();
    }, 100);
  };

  const handleClose = () => {
    setFile(null);
    setSelectedAccount(null);
    setPreviewData([]);
    setDetectedBank(null);
    setShowPreview(false);
    setDragActive(false);
    setImporting(false);
    setShowAccountSelection(false);
    setUnrecognizedIBAN(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-gray-200 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-hz-text">Importar extracto bancario</h3>
              <button
                onClick={handleClose}
                className="text-hz-neutral-500 hover:text-hz-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* File Upload Area */}
            {!file && (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive 
                    ? 'border-hz-primary bg-hz-primary-50' 
                    : 'border-hz-neutral-300 hover:border-hz-primary'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 text-hz-neutral-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-hz-text mb-2">
                  Arrastra tu extracto bancario aquí
                </p>
                <p className="text-sm text-hz-neutral-500 mb-4">
                  o haz clic para seleccionar archivo
                </p>
                <input
                  type="file"
                  accept=".csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileInput}
                  className="hidden"
            id="file-upload"
          />
                <label
                  htmlFor="file-upload"
                  className="inline-flex items-center px-4 py-2 bg-hz-primary text-white rounded-lg hover:bg-hz-primary-600 cursor-pointer transition-colors"
                >
                  Seleccionar archivo
                </label>
                <p className="text-xs text-hz-neutral-500 mt-2">
                  Formatos soportados: CSV, XLS, XLSX
                </p>
              </div>
            )}

            {/* File Selected */}
            {file && !showPreview && (
              <div className="border border-hz-neutral-300 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-hz-primary" />
                  <div className="flex-1">
                    <h4 className="font-medium text-hz-text">{file.name}</h4>
                    <p className="text-sm text-hz-neutral-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                    {detectedBank && (
                      <p className="text-sm text-hz-success font-medium">
                        Banco detectado: {detectedBank}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="text-hz-neutral-500 hover:text-hz-error"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Account Selection */}
            {file && !detectedBank && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-hz-text mb-2">
                  ¿A qué cuenta pertenece este extracto? *
                </label>
                <select
                  value={selectedAccount || ''}
                  onChange={(e) => setSelectedAccount(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-hz-neutral-300 rounded-lg px-3 py-2 text-sm"
            required
          >
                  <option value="">Seleccionar cuenta...</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.bank})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2 mt-2 text-sm text-hz-warning">
                  <AlertCircle className="w-4 h-4" />
                  <span>No se pudo detectar la cuenta automáticamente</span>
                </div>
              </div>
            )}

            {/* Preview */}
            {showPreview && (
              <div className="mb-6">
                <h4 className="font-medium text-hz-text mb-3">
                  Vista previa - Primeras {previewData.length} filas
                </h4>
                <div className="border border-hz-neutral-300 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-hz-neutral-100">
                      <tr>
                        <th className="px-3 py-2 text-left">Fecha</th>
                        <th className="px-3 py-2 text-left">Descripción</th>
                        <th className="px-3 py-2 text-right">Importe</th>
                        <th className="px-3 py-2 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hz-neutral-200">
                      {previewData.map((row, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2">{row.fecha}</td>
                          <td className="px-3 py-2">{row.descripcion}</td>
                          <td className={`px-3 py-2 text-right font-medium ${
                            row.importe >= 0 ? 'text-hz-success' : 'text-hz-error'
                          }`}>
                            {row.importe.toFixed(2)} €
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.saldo.toFixed(2)} €
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-hz-neutral-500 mt-2">
                  Se crearán {previewData.length} movimientos con estado "Confirmado"
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-hz-neutral-300 text-hz-text rounded-lg hover:bg-hz-neutral-50 transition-colors"
            disabled={importing}
          >
                Cancelar
              </button>
              {file && (
                <button
                  onClick={handleImport}
                  disabled={importing || (!selectedAccount && !detectedBank)}
                  className="flex items-center gap-2 px-4 py-2 bg-hz-primary text-white rounded-lg hover:bg-hz-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Importando...
                    </>
                  ) : (
                    'Confirmar importación'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Account Selection Modal */}
      <AccountSelectionModal
        isOpen={showAccountSelection}
        onClose={() => setShowAccountSelection(false)}
        onSelectAccount={handleAccountSelected}
        accounts={accounts}
        filename={file?.name}
        unrecognizedIBAN={unrecognizedIBAN || undefined}
      />
    </>
  );
};

export default ImportModal;