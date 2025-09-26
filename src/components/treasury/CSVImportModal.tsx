import React, { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Database, Plus } from 'lucide-react';
import { parseCSV, ParsedMovement } from '../../services/csvParserService';
import { Account, AccountDestination } from '../../services/db';
import { formatEuro } from '../../utils/formatUtils';
import toast from 'react-hot-toast';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (movements: ParsedMovement[], accountId: number, skipDuplicates: boolean, csvFile: File) => Promise<void>;
  accounts: Account[];
  onCreateAccount: (account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Account>;
  destination: AccountDestination;
}

interface ImportPreview {
  movements: ParsedMovement[];
  totalRows: number;
  errors: string[];
  detectedBank: string;
}

const CSVImportModal: React.FC<CSVImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  accounts,
  onCreateAccount,
  destination
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'configure'>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | 'new' | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    bank: '',
    iban: '',
    openingBalance: 0
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const destinationAccounts = accounts.filter(acc => acc.destination === destination && acc.isActive);
  
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Por favor, selecciona un archivo CSV válido');
      return;
    }
    
    setIsLoading(true);
    setCsvFile(file);
    
    try {
      const text = await file.text();
      const result = await parseCSV(text);
      
      setPreview({
        movements: result.movements,
        totalRows: result.totalRows || 0,
        errors: result.errors || [],
        detectedBank: result.detectedBank?.bankKey || 'Generic'
      });
      
      if (result.movements.length > 0) {
        setStep('preview');
      } else {
        toast.error('No se pudieron procesar movimientos del archivo CSV');
      }
      
    } catch (error) {
      toast.error('Error al procesar el archivo CSV');
      console.error('CSV processing error:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCreateAccount = async () => {
    if (!newAccount.name || !newAccount.bank) {
      toast.error('Por favor, completa todos los campos obligatorios');
      return;
    }
    
    try {
      setIsLoading(true);
      const createdAccount = await onCreateAccount({
        alias: newAccount.name, // Map name to alias
        name: newAccount.name,
        bank: newAccount.bank,
        iban: newAccount.iban,
        destination,
        balance: newAccount.openingBalance,
        openingBalance: newAccount.openingBalance,
        currency: 'EUR',
        isActive: true,
        activa: true, // Add required field
        status: 'ACTIVE' // Add required status field
      });
      
      setSelectedAccountId(createdAccount.id!);
      setShowCreateAccount(false);
      setNewAccount({ name: '', bank: '', iban: '', openingBalance: 0 });
      toast.success('Cuenta creada correctamente');
    } catch (error) {
      toast.error('Error al crear la cuenta');
      console.error('Account creation error:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleImport = async () => {
    if (!preview || !csvFile || !selectedAccountId || selectedAccountId === 'new') {
      toast.error('Por favor, completa todos los campos requeridos');
      return;
    }
    
    try {
      setIsLoading(true);
      await onImport(preview.movements, selectedAccountId as number, skipDuplicates, csvFile);
      
      // Reset state
      setStep('upload');
      setCsvFile(null);
      setPreview(null);
      setSelectedAccountId(null);
      onClose();
      
    } catch (error) {
      toast.error('Error al importar movimientos');
      console.error('Import error:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const getBankName = (bankCode: string): string => {
    const bankNames: Record<string, string> = {
      bbva: 'BBVA',
      santander: 'Banco Santander',
      caixa: 'CaixaBank',
      ing: 'ING',
      generic: 'Genérico'
    };
    return bankNames[bankCode] || bankCode;
  };
  
  const resetModal = () => {
    setStep('upload');
    setCsvFile(null);
    setPreview(null);
    setSelectedAccountId(null);
    setShowCreateAccount(false);
    setNewAccount({ name: '', bank: '', iban: '', openingBalance: 0 });
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-gray-200 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">
            Importar extracto (CSV)
          </h2>
          <button
            onClick={() => {
              resetModal();
              onClose();
            }}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'upload' && (
            <div className="p-6">
              <div className="text-center">
                <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 hover:border-neutral-400 transition-colors">
                  <Upload className="mx-auto h-12 w-12 text-neutral-400 mb-4" />
                  <h3 className="text-lg font-medium text-neutral-900 mb-2">
                    Selecciona tu extracto bancario
                  </h3>
                  <p className="text-sm text-neutral-500 mb-4">
                    Formatos soportados: CSV con separador ; o ,<br />
                    Bancos: BBVA, Santander, CaixaBank, ING, o formato genérico
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="px-6 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                  >
                    {isLoading ? 'Procesando...' : 'Seleccionar archivo CSV'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
           onChange={(e) => handleFileUpload(e.target.files)}
                   />
                </div>
              </div>
            </div>
          )}
          
          {step === 'preview' && preview && (
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-success-600" />
                    <span className="font-medium">Archivo procesado:</span>
                    <span className="text-neutral-600">{csvFile?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary-600" />
                    <span className="font-medium">Banco detectado:</span>
                    <span className="text-neutral-600">{getBankName(preview.detectedBank)}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-neutral-50 p-3 rounded-lg">
                    <div className="text-neutral-500">Total filas</div>
                    <div className="text-lg font-semibold">{preview.totalRows}</div>
                  </div>
                  <div className="bg-success-50 p-3 rounded-lg">
                    <div className="text-neutral-500">Movimientos válidos</div>
                    <div className="text-lg font-semibold text-success-600">{preview.movements.length}</div>
                  </div>
                  <div className="bg-error-50 p-3 rounded-lg">
                    <div className="text-neutral-500">Errores</div>
                    <div className="text-lg font-semibold text-error-600">{preview.errors.length}</div>
                  </div>
                </div>
                
                {preview.errors.length > 0 && (
                  <div className="mt-4 p-4 bg-error-50 border border-error-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-5 w-5 text-error-500" />
                      <span className="font-medium text-error-900">Errores encontrados:</span>
                    </div>
                    <ul className="text-sm text-error-700 space-y-1">
                      {preview.errors.slice(0, 10).map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                      {preview.errors.length > 10 && (
                        <li>• ... y {preview.errors.length - 10} errores más</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
              
              {/* Preview Table */}
              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                <div className="bg-neutral-50 px-4 py-2 font-medium text-neutral-900">
                  Vista previa (primeras 20 filas)
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-100">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-neutral-700">Fecha</th>
                        <th className="px-4 py-2 text-left font-medium text-neutral-700">Fecha valor</th>
                        <th className="px-4 py-2 text-right font-medium text-neutral-700">Importe</th>
                        <th className="px-4 py-2 text-left font-medium text-neutral-700">Descripción</th>
                        <th className="px-4 py-2 text-left font-medium text-neutral-700">Contraparte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.movements.slice(0, 20).map((movement, index) => (
                        <tr key={index} className="border-t border-neutral-100">
                          <td className="px-4 py-2">{movement.date.toLocaleDateString('es-ES')}</td>
                          <td className="px-4 py-2">{movement.valueDate ? movement.valueDate.toLocaleDateString('es-ES') : '-'}</td>
                          <td className={`px-4 py-2 text-right font-medium ${
                            movement.amount >= 0 ? 'text-success-600' : 'text-error-600'
                          }`}>
                            {formatEuro(movement.amount)}
                          </td>
                          <td className="px-4 py-2 max-w-xs truncate" title={movement.description}>
                            {movement.description}
                          </td>
                          <td className="px-4 py-2 max-w-xs truncate" title={movement.counterparty}>
                            {movement.counterparty || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {preview.movements.length > 0 && (
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setStep('configure')}
                    className="px-6 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors"
                  >
                    Continuar
                  </button>
                </div>
              )}
            </div>
          )}
          
          {step === 'configure' && (
            <div className="p-6">
              <div className="space-y-6">
                {/* Account Selection */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Cuenta de destino *
                  </label>
                  <div className="space-y-2">
                    {destinationAccounts.map((account) => (
                      <label key={account.id} className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="account"
                          value={account.id}
                          checked={selectedAccountId === account.id}
                          onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                          className="text-neutral-600 focus:ring-neutral-500" />
                        <div className="flex-1">
                          <div className="font-medium">{account.name}</div>
                          <div className="text-sm text-neutral-500">
                            {account.bank} • {formatEuro(account.balance)} • {account.iban}
                          </div>
                        </div>
                      </label>
                    ))}
                    
                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="account"
                        value="new"
                        checked={selectedAccountId === 'new'}
                        onChange={(e) => {
                          setSelectedAccountId('new');
                          setShowCreateAccount(true);
                        }}
                        className="text-neutral-600 focus:ring-neutral-500" />
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        <span className="font-medium">Crear nueva cuenta</span>
                      </div>
                    </label>
                  </div>
                </div>
                
                {/* Create Account Form */}
                {showCreateAccount && selectedAccountId === 'new' && (
                  <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
                    <h4 className="font-medium mb-4">Nueva cuenta</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Nombre de la cuenta *
                        </label>
                        <input
                          type="text"
                          value={newAccount.name}
                          onChange={(e) => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500"
            placeholder="Ej: Cuenta corriente principal"
          />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Banco *
                        </label>
                        <input
                          type="text"
                          value={newAccount.bank}
                          onChange={(e) => setNewAccount(prev => ({ ...prev, bank: e.target.value }))}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500"
            placeholder="Ej: BBVA"
          />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          IBAN (opcional)
                        </label>
                        <input
                          type="text"
                          value={newAccount.iban}
                          onChange={(e) => setNewAccount(prev => ({ ...prev, iban: e.target.value }))}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500"
            placeholder="ES91 2100 0418 4502 0005 1332"
          />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Saldo inicial
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={newAccount.openingBalance}
                          onChange={(e) => setNewAccount(prev => ({ ...prev, openingBalance: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500"
            placeholder="0,00"
          />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={handleCreateAccount}
                        disabled={isLoading}
                        className="px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                      >
                        {isLoading ? 'Creando...' : 'Crear cuenta'}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Options */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Opciones
                  </label>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="rounded text-neutral-600 focus:ring-neutral-500" />
                    <span>Omitir duplicados (recomendado)</span>
                  </label>
                  <p className="text-sm text-neutral-500 mt-1">
                    Los movimientos con la misma fecha, importe y descripción se consideran duplicados
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-neutral-200 bg-neutral-50">
          <div className="flex gap-3">
            {step !== 'upload' && (
              <button
                onClick={() => {
                  if (step === 'configure') setStep('preview');
                  else if (step === 'preview') setStep('upload');
                }}
                className="px-4 py-2 text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Volver
              </button>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                resetModal();
                onClose();
              }}
              className="px-4 py-2 text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Cancelar
            </button>
            
            {step === 'configure' && (
              <button
                onClick={handleImport}
                disabled={isLoading || !selectedAccountId || selectedAccountId === 'new'}
                className="px-6 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                {isLoading ? 'Importando...' : 'Confirmar importación'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CSVImportModal;