import React, { useState, useCallback, useEffect } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { enhancedStatementImportService } from '../../../../services/enhancedStatementImportService';
import { initDB, Account } from '../../../../services/db';
import { ImportResult } from '../../../../types/unifiedTreasury';
import toast from 'react-hot-toast';

interface ImportStatementModalProps {
  onClose: () => void;
  onImportComplete: (result?: ImportResult) => void;
  preselectedAccountId?: number;
}

const ImportStatementModal: React.FC<ImportStatementModalProps> = ({
  onClose,
  onImportComplete,
  preselectedAccountId
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{
    totalMovements: number;
    confirmedMovements: number;
    unplannedMovements: number;
    transferMovements: number;
    detectedAccount?: Account;
    errors: string[];
    warnings: string[];
  } | null>(null);

  // Load real accounts from database
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const db = await initDB();
        const allAccounts = await db.getAll('accounts');
        const activeAccounts = allAccounts.filter(acc => acc.isActive && !acc.deleted_at);
        setAccounts(activeAccounts);
        
        // Set preselected account if provided
        if (preselectedAccountId) {
          const preselected = activeAccounts.find(acc => acc.id === preselectedAccountId);
          if (preselected) {
            setSelectedAccount(preselected.id!.toString());
          }
        }
      } catch (error) {
        console.error('Error loading accounts:', error);
        setAccounts([]);
      }
    };
    
    loadAccounts();
  }, [preselectedAccountId]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = async (file: File) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/x-ofx' // OFX format support as per problem statement
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('Solo se permiten archivos Excel (.xls, .xlsx), CSV y OFX');
      return;
    }
    
    setSelectedFile(file);
    
    // Try to preview the file
    try {
      const previewResult = await enhancedStatementImportService.previewImport(file);
      setPreview(previewResult);
      
      // Auto-select account if detected
      if (previewResult.detectedAccount) {
        setSelectedAccount(previewResult.detectedAccount.id!.toString());
      }
      
      // Show warnings if any
      if (previewResult.warnings.length > 0) {
        previewResult.warnings.forEach(warning => toast.error(warning));
      }
      
    } catch (error) {
      console.error('Error previewing file:', error);
      setPreview(null);
      toast.error('Error analizando el archivo');
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !selectedAccount) {
      toast.error('Por favor selecciona un archivo y una cuenta de destino');
      return;
    }
    
    // Check if selected account is active (problem statement requirement)
    const selectedAccountData = accounts.find(acc => acc.id?.toString() === selectedAccount);
    if (!selectedAccountData || !selectedAccountData.isActive || selectedAccountData.status === 'INACTIVE') {
      toast.error('Activa la cuenta para importar extractos.');
      return;
    }
    
    setImporting(true);
    
    try {
      const result = await enhancedStatementImportService.processImport(
        selectedFile,
        parseInt(selectedAccount)
      );
      
      if (result.success) {
        const totalRows = result.imported + result.duplicates + result.errors;
        const errorRate = totalRows > 0 ? result.errors / totalRows : 0;
        
        // PROBLEM STATEMENT: Discrete toast for massive parsing errors (>20% invalid rows)
        if (errorRate > 0.2) {
          toast.error(
            'No se han podido interpretar algunas filas. Revisa el archivo o usa el asistente de mapeo.',
            { duration: 6000 } // Longer duration for important message
          );
        }
        
        toast.success(`Importados: ${result.imported} | Duplicados: ${result.duplicates} | Errores: ${result.errors}`);
        onImportComplete({
          totalLines: result.imported + result.duplicates + result.errors,
          confirmedMovements: result.confirmed,
          unplannedMovements: result.unplanned,
          detectedTransfers: result.transfers,
          errors: result.errorDetails
        });
        onClose();
      } else {
        toast.error('Error en la importación');
        console.error('Import errors:', result.errorDetails);
      }
      
    } catch (error) {
      console.error('Import failed:', error);
      toast.error(error instanceof Error ? error.message : 'Error durante la importación');
    } finally {
      setImporting(false);
    }
  };

  const resetModal = () => {
    setSelectedFile(null);
    setSelectedAccount('');
    setPreview(null);
    setImporting(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-200 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-hz-neutral-900">Importar extracto</h3>
          <button
            onClick={handleClose}
            className="text-hz-neutral-500 hover:text-hz-neutral-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* File Upload Area */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive 
                ? 'border-hz-primary bg-hz-primary/5' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".xls,.xlsx,.csv"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            
            {selectedFile ? (
              <div className="space-y-2">
                <FileText className="h-8 w-8 text-hz-primary mx-auto" />
                <p className="text-sm font-medium text-hz-neutral-900">{selectedFile.name}</p>
                <p className="text-xs text-hz-neutral-700">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 text-hz-neutral-500 mx-auto" />
                <p className="text-sm text-hz-neutral-700">
                  Arrastra tu archivo aquí o <span className="text-hz-primary">selecciona un archivo</span>
                </p>
                <p className="text-xs text-hz-neutral-700">Excel (.xls, .xlsx) o CSV</p>
              </div>
            )}
          </div>

          {/* Account Selection */}
          {(!preview?.detectedAccount || selectedFile) && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-hz-neutral-900">
                Cuenta de destino
              </label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hz-primary focus:border-transparent"
              >
                <option value="">Seleccionar cuenta...</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name || account.bank || 'Cuenta'} - {account.bank || 'Banco'} ****{account.iban?.slice(-4)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="bg-hz-neutral-100 p-4 rounded-lg space-y-3">
              <h4 className="font-medium text-hz-neutral-900">Vista previa</h4>
              
              {preview.detectedAccount && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-hz-success" />
                  <span className="text-sm text-hz-neutral-700">
                    Cuenta detectada: <span className="font-medium">{preview.detectedAccount.name || preview.detectedAccount.bank}</span>
                  </span>
                </div>
              )}
              
              <div className="text-sm text-hz-neutral-700 space-y-1">
                <p>• {preview.totalMovements} movimientos a importar</p>
                <p>• {preview.confirmedMovements} serán confirmados automáticamente</p>
                <p>• {preview.unplannedMovements} quedarán como no planificados</p>
                {preview.transferMovements > 0 && (
                  <p>• {preview.transferMovements} transferencias detectadas</p>
                )}
              </div>
              
              {preview.warnings.length > 0 && (
                <div className="space-y-1">
                  {preview.warnings.map((warning, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-hz-warning mt-0.5" />
                      <span className="text-sm text-hz-warning">{warning}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {preview.errors.length > 0 && (
                <div className="space-y-1">
                  {preview.errors.map((error, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-hz-error mt-0.5" />
                      <span className="text-sm text-hz-error">{error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-hz-neutral-300">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-hz-neutral-700 bg-hz-card-bg border border-hz-neutral-300 rounded-lg hover:bg-hz-neutral-100"
            disabled={importing}
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={!selectedFile || importing}
            className="px-4 py-2 text-sm font-medium text-white bg-hz-primary rounded-lg hover:bg-hz-primary- light disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {importing && (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            )}
            {importing ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportStatementModal;