import React, { useState, useCallback, useEffect } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { ImportResult } from '../../../../types/unifiedTreasury';
import { importBankStatement, ImportOptions } from '../../../../services/bankStatementImportService';
import toast from 'react-hot-toast';

interface ImportStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (result: ImportResult) => void;
}

const ImportStatementModal: React.FC<ImportStatementModalProps> = ({
  isOpen,
  onClose,
  onImportComplete
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{
    totalLines: number;
    unplannedLines: number;
    detectedAccount?: string;
  } | null>(null);

  // Load real accounts from settings
  const [accounts, setAccounts] = useState<Array<{id: number, name: string, bank: string, iban: string}>>([]);
  
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const { treasuryAPI } = await import('../../../../services/treasuryApiService');
        const allAccounts = await treasuryAPI.accounts.getAccounts(false); // Only active accounts
        const horizonAccounts = allAccounts.filter(acc => acc.destination === 'horizon');
        
        setAccounts(horizonAccounts.map(acc => ({
          id: acc.id!,
          name: acc.name || `Cuenta ${acc.bank}`,
          bank: acc.bank,
          iban: `***${acc.iban.slice(-4)}`
        })));
      } catch (error) {
        console.error('Error loading accounts:', error);
        setAccounts([]);
      }
    };
    
    if (isOpen) {
      loadAccounts();
    }
  }, [isOpen]);

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
      'text/csv'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('Solo se permiten archivos Excel (.xls, .xlsx) y CSV');
      return;
    }
    
    setSelectedFile(file);
    
    // Try to parse the file to show real preview
    try {
      const { BankParserService } = await import('../../../../features/inbox/importers/bankParser');
      const parser = new BankParserService();
      const parseResult = await parser.parseFile(file);
      
      if (parseResult.success && parseResult.movements) {
        setPreview({
          totalLines: parseResult.movements.length,
          unplannedLines: parseResult.movements.length, // All are unplanned initially
          detectedAccount: undefined // Account will be manually selected
        });
      } else {
        setPreview(null);
        toast.error('No se pudieron leer movimientos del archivo');
      }
    } catch (error) {
      console.error('Error parsing file for preview:', error);
      setPreview(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !selectedAccount) {
      toast.error('Por favor selecciona un archivo y una cuenta de destino');
      return;
    }
    
    setImporting(true);
    
    try {
      // Use the real unified import service
      const options: ImportOptions = {
        file: selectedFile,
        destinationAccountId: parseInt(selectedAccount),
        usuario: 'treasury_ui'
      };
      
      const result = await importBankStatement(options);
      
      // Convert to UnifiedTreasury ImportResult format
      const treasuryResult: ImportResult = {
        totalLines: result.inserted + result.duplicates + result.errors,
        confirmedMovements: result.inserted,
        unplannedMovements: result.inserted, // All imported movements are initially unplanned
        detectedTransfers: 0, // Transfer detection happens separately
        errors: result.errors > 0 ? [`${result.errors} errores durante la importación`] : []
      };
      
      if (result.success && result.inserted > 0) {
        toast.success(`Importados: ${result.inserted} · Duplicados: ${result.duplicates} · Errores: ${result.errors}`);
        onImportComplete(treasuryResult);
        onClose();
      } else if (result.duplicates > 0 && result.inserted === 0) {
        toast.error('Todo eran duplicados: no se insertó ningún movimiento');
        onImportComplete(treasuryResult);
        onClose();
      } else {
        toast.error('No se pudo importar el archivo');
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Importar extracto</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
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
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            {selectedFile ? (
              <div className="space-y-2">
                <FileText className="h-8 w-8 text-hz-primary mx-auto" />
                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                <p className="text-sm text-gray-600">
                  Arrastra tu archivo aquí o <span className="text-hz-primary">selecciona un archivo</span>
                </p>
                <p className="text-xs text-gray-500">Excel (.xls, .xlsx) o CSV</p>
              </div>
            )}
          </div>

          {/* Account Selection */}
          {(!preview?.detectedAccount || selectedFile) && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
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
                    {account.name} - {account.bank} {account.iban}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <h4 className="font-medium text-gray-900">Vista previa</h4>
              
              {preview.detectedAccount && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success-500" />
                  <span className="text-sm text-gray-700">
                    Cuenta detectada: <span className="font-medium">{preview.detectedAccount}</span>
                  </span>
                </div>
              )}
              
              <div className="text-sm text-gray-700 space-y-1">
                <p>• {preview.totalLines} movimientos a importar</p>
                <p>• {preview.totalLines - preview.unplannedLines} serán confirmados automáticamente</p>
                <p>• {preview.unplannedLines} quedarán como no planificados</p>
              </div>
              
              {preview.unplannedLines > 0 && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-warning-500 mt-0.5" />
                  <span className="text-sm text-warning-700">
                    Los movimientos no planificados requerirán clasificación manual
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={importing}
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={!selectedFile || importing}
            className="px-4 py-2 text-sm font-medium text-white bg-hz-primary rounded-lg hover:bg-hz-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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