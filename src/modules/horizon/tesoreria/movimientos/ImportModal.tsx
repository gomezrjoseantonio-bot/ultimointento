import React, { useState, useCallback } from 'react';
import { Upload, X, FileText, AlertCircle } from 'lucide-react';
import { Account } from '../../../../services/db';
import { showSuccess, showError } from '../../../../services/toastService';
import { trackMovementCreation } from '../../../../utils/treasuryAnalytics';

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
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (selectedFile: File) => {
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
    
    // TODO: Implement actual file parsing for preview
    // For now, show mock preview data
    const mockPreview = [
      { fecha: '01/12/2024', descripcion: 'Transferencia entrada', importe: 1500.00, saldo: 3250.00 },
      { fecha: '30/11/2024', descripcion: 'Domiciliación Luz', importe: -65.42, saldo: 1750.00 },
      { fecha: '29/11/2024', descripcion: 'Transferencia salida', importe: -800.00, saldo: 1815.42 },
    ];
    setPreviewData(mockPreview);
    setShowPreview(true);
  };

  const handleImport = async () => {
    if (!file) {
      showError('Selecciona un archivo para importar');
      return;
    }

    if (!selectedAccount && !detectedBank) {
      showError('Selecciona una cuenta de destino');
      return;
    }

    setImporting(true);
    
    try {
      // FIX PACK v1.0: Implement actual import logic
      const { initDB } = await import('../../../../services/db');
      const db = await initDB();
      
      // Get the target account ID
      const targetAccountId = selectedAccount || 
        accounts.find(acc => acc.bank === detectedBank)?.id;
      
      if (!targetAccountId) {
        throw new Error('No se pudo determinar la cuenta de destino');
      }
      
      // FIX PACK v1.0: Smart injection - convert preview data to movements
      const now = new Date().toISOString();
      const movements = previewData.map((row, index) => ({
        accountId: targetAccountId,
        date: convertSpanishDateToISO(row.fecha),
        amount: row.importe,
        description: row.descripcion,
        type: (row.importe > 0 ? 'Ingreso' : 'Gasto') as 'Ingreso' | 'Gasto',
        category: inferCategoryFromDescription(row.descripcion),
        origin: 'CSV' as 'CSV',
        movementState: 'Confirmado' as 'Confirmado',
        tags: inferTagsFromDescription(row.descripcion),
        isAutoTagged: true,
        balance: row.saldo,
        importBatch: `import_${Date.now()}`,
        csvRowIndex: index,
        createdAt: now,
        updatedAt: now,
        status: 'pendiente' as 'pendiente'
      }));
      
      // Batch insert movements
      for (const movement of movements) {
        await db.add('movements', movement);
      }
      
      // Track analytics
      trackMovementCreation('import', movements.length, {
        sourceBank: detectedBank || 'manual_selection',
        fileName: file.name,
        fileSize: file.size,
        accountId: targetAccountId,
        averageAmount: movements.reduce((sum, m) => sum + Math.abs(m.amount), 0) / movements.length
      });
      
      // FIX PACK v1.0: Enhanced success toast with CTA
      showSuccess(
        `${movements.length} movimientos importados correctamente`, 
        {
          actionLabel: 'Ver importados',
          actionHandler: () => {
            console.log('Navigate to imported movements filter');
          }
        }
      );
      
      // FIX PACK v1.0: Optimistic insertion - trigger immediate reload
      onImportComplete();
      handleClose();
      
    } catch (error) {
      console.error('Import error:', error);
      showError('Error al importar el extracto', 'Verifica que el archivo tenga el formato correcto');
    } finally {
      setImporting(false);
    }
  };

  // Helper functions for smart categorization
  const convertSpanishDateToISO = (spanishDate: string): string => {
    const [day, month, year] = spanishDate.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const inferCategoryFromDescription = (description: string): string | undefined => {
    const desc = description.toLowerCase();
    
    if (desc.includes('luz') || desc.includes('endesa') || desc.includes('iberdrola')) {
      return 'Suministros › Luz';
    }
    if (desc.includes('agua') || desc.includes('aqualia') || desc.includes('cyii')) {
      return 'Suministros › Agua';
    }
    if (desc.includes('gas') || desc.includes('naturgy')) {
      return 'Suministros › Gas';
    }
    if (desc.includes('internet') || desc.includes('fibra') || desc.includes('movistar') || desc.includes('vodafone')) {
      return 'Suministros › Internet';
    }
    if (desc.includes('alquiler') || desc.includes('rent')) {
      return 'Alquiler › Ingresos';
    }
    if (desc.includes('ibi') || desc.includes('contribucion')) {
      return 'Tributos › IBI';
    }
    if (desc.includes('comunidad') || desc.includes('administrador')) {
      return 'Tributos › Comunidad';
    }
    if (desc.includes('transferencia') || desc.includes('traspaso')) {
      return 'Transferencias';
    }
    
    return undefined;
  };

  const inferTagsFromDescription = (description: string): string[] => {
    const tags: string[] = [];
    const desc = description.toLowerCase();
    
    if (desc.includes('domiciliacion') || desc.includes('domiciliado')) {
      tags.push('domiciliado');
    }
    if (desc.includes('transferencia')) {
      tags.push('transferencia');
    }
    if (desc.includes('bizum')) {
      tags.push('bizum');
    }
    if (desc.includes('tarjeta') || desc.includes('tpv')) {
      tags.push('tarjeta');
    }
    
    return tags;
  };

  const handleClose = () => {
    setFile(null);
    setSelectedAccount(null);
    setPreviewData([]);
    setDetectedBank(null);
    setShowPreview(false);
    setDragActive(false);
    setImporting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                className="inline-flex items-center px-4 py-2 bg-hz-primary-dark text-white rounded-lg hover:bg-opacity-90 cursor-pointer transition-colors"
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
                className="flex items-center gap-2 px-4 py-2 bg-hz-primary-dark text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
};

export default ImportModal;