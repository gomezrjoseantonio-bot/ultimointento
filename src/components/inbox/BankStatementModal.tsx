import React, { useState, useEffect } from 'react';
import { X, Upload, Settings, AlertTriangle } from 'lucide-react';
import { Account } from '../../services/db';
import { treasuryAPI } from '../../services/treasuryApiService';
import { formatEuro } from '../../utils/formatUtils';
import { importBankStatement, ImportOptions } from '../../services/bankStatementImportService';
import toast from 'react-hot-toast';

interface BankStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  onImportComplete: (summary: {
    inserted: number;
    duplicates: number;
    failed: number;
    reconciled?: number;
    pendingReview?: number;
    batchId: string;
  }) => void;
}

const BankStatementModal: React.FC<BankStatementModalProps> = ({
  isOpen,
  onClose,
  file,
  onImportComplete
}) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showUnrecognizedIBAN, setShowUnrecognizedIBAN] = useState(false);
  const [detectedIBAN, setDetectedIBAN] = useState<string>('');

  useEffect(() => {
    if (isOpen) loadAccounts();
  }, [isOpen]);

  const loadAccounts = async () => {
    try {
      const allAccounts = await treasuryAPI.accounts.getAccounts();
      setAccounts(allAccounts.filter(acc =>
        acc.isActive &&
        !acc.deleted_at &&
        !acc.name?.toLowerCase().includes('demo') &&
        !acc.name?.toLowerCase().includes('sample') &&
        !acc.name?.toLowerCase().includes('fake') &&
        !acc.bank?.toLowerCase().includes('demo') &&
        !acc.bank?.toLowerCase().includes('sample') &&
        !acc.bank?.toLowerCase().includes('fake')
      ));
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast.error('Error al cargar las cuentas');
    }
  };

  const handleGoToSettings = () => {
    onClose();
    const currentUrl = new URL(window.location.href);
    currentUrl.hash = '#/configuracion/cuentas';
    window.location.href = currentUrl.toString();
    toast.success('Crea la cuenta en Configuración y luego importa de nuevo el extracto');
  };

  const handleImport = async () => {
    if (!file || !selectedAccountId) {
      toast.error('Por favor, selecciona una cuenta de destino');
      return;
    }
    try {
      setIsLoading(true);
      const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);
      if (!selectedAccount) { toast.error('Cuenta seleccionada no encontrada'); return; }
      const options: ImportOptions = { file, destinationAccountId: selectedAccountId as number, usuario: 'inbox_ui' };
      const result = await importBankStatement(options);
      if (!result.success && (result as any).requiresAccountSelection) {
        setDetectedIBAN((result as any).unrecognizedIBAN || 'IBAN no detectado');
        setShowUnrecognizedIBAN(true);
        return;
      }
      if (result.success) {
        onImportComplete({ inserted: result.inserted, duplicates: result.duplicates, failed: result.errors, batchId: result.batchId });
      } else {
        toast.error('Error al importar el extracto');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al importar movimientos';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  if (showUnrecognizedIBAN) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(26,35,50,.45)' }}>
        <div className="bg-white shadow-xl max-w-md w-full mx-4" style={{ borderRadius: 'var(--r-lg)' }}>
          <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--n-200)' }}>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--n-900)' }}>Cuenta no reconocida</h2>
            <button onClick={() => setShowUnrecognizedIBAN(false)} style={{ color: 'var(--n-500)' }}><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: 'var(--s-warn)' }} />
              <div>
                <h3 className="font-medium mb-2" style={{ color: 'var(--n-900)' }}>No se encontró una cuenta para este IBAN</h3>
                <p className="text-sm mb-3" style={{ color: 'var(--n-500)' }}>IBAN detectado: <span className="font-mono font-medium">{detectedIBAN}</span></p>
                <p className="text-sm" style={{ color: 'var(--n-500)' }}>Para importar movimientos, necesitas crear primero la cuenta en Configuración &gt; Cuentas.</p>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={handleGoToSettings} className="atlas-btn-primary flex items-center gap-2 px-4 py-2">
                <Settings className="w-4 h-4" />Ir a Configuración &gt; Cuentas
              </button>
              <button onClick={() => setShowUnrecognizedIBAN(false)} className="atlas-btn-secondary px-4 py-2">Cancelar</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(26,35,50,.45)' }}>
      <div className="bg-white shadow-xl max-w-md w-full mx-4" style={{ borderRadius: 'var(--r-lg)' }}>
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--n-200)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--n-900)' }}>Importar Extracto Bancario</h2>
          <button onClick={onClose} style={{ color: 'var(--n-500)' }}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 border" style={{ borderColor: 'var(--n-200)', borderRadius: 'var(--r-md)', background: 'var(--n-50)' }}>
            <Upload className="w-5 h-5" style={{ color: 'var(--blue)' }} />
            <div>
              <div className="font-medium" style={{ color: 'var(--n-900)' }}>{file?.name}</div>
              <div className="text-sm" style={{ color: 'var(--n-500)' }}>Extracto bancario detectado</div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--n-700)' }}>Seleccionar cuenta destino</label>
            <select
              className="w-full border px-3 py-2"
              style={{ borderColor: 'var(--n-300)', borderRadius: 'var(--r-md)' }}
              value={selectedAccountId || ''}
              onChange={(e) => setSelectedAccountId(Number(e.target.value) || null)}
            >
              <option value="">Selecciona una cuenta...</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} - {account.bank} ({formatEuro(account.balance)})
                </option>
              ))}
            </select>
          </div>

          {accounts.length === 0 ? (
            <div className="p-3 border" style={{ borderColor: 'var(--s-warn)', background: 'var(--s-warn-bg)', borderRadius: 'var(--r-md)' }}>
              <p className="text-sm mb-2" style={{ color: 'var(--s-warn)' }}>⚠️ No hay cuentas configuradas. Debes crear una cuenta antes de poder importar extractos.</p>
              <button onClick={handleGoToSettings} className="atlas-btn-secondary text-sm px-3 py-1">Ir a Configuración &gt; Cuentas</button>
            </div>
          ) : (
            <div className="p-3 border" style={{ borderColor: 'var(--n-200)', background: 'var(--n-50)', borderRadius: 'var(--r-md)' }}>
              <p className="text-sm" style={{ color: 'var(--n-700)' }}>💡 ¿No ves tu cuenta? Ve a <strong>Configuración &gt; Cuentas</strong> para crear una nueva cuenta.</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleImport}
              disabled={!selectedAccountId || isLoading || accounts.length === 0}
              className="atlas-btn-primary flex-1 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Importando...' : accounts.length === 0 ? 'Sin cuentas disponibles' : 'Importar Movimientos'}
            </button>
            <button onClick={onClose} className="atlas-btn-secondary px-4 py-2">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankStatementModal;
