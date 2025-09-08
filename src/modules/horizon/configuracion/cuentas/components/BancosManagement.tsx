import React, { useState, useEffect, useRef } from 'react';
import { Banknote, Info, Plus, Edit2, Trash2, Upload, X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { TreasuryAccountsAPI, validateIBAN } from '../../../../../services/treasuryApiService';
import { processLogoUpload, validateLogoFile, getLogoFromStorage, removeLogoFromStorage } from '../../../../../services/logoUploadService';
import { initDB, Account } from '../../../../../services/db';

interface AccountFormData {
  alias: string;
  bank: string;
  iban: string;
  logoFile: File | null;
  logoUrl: string | null;
}

/**
 * BancosManagement - ATLAS Design System
 * 
 * Full CRUD implementation for bank account management per ATLAS requirements:
 * - Create/Edit with IBAN validation and logo upload
 * - Delete with cascading confirmation dialog
 * - IBAN masking and logo display
 */
const BancosManagement: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<AccountFormData>({
    alias: '',
    bank: '',
    iban: '',
    logoFile: null,
    logoUrl: null
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load accounts on component mount
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const db = await initDB();
      const allAccounts = await db.getAll('accounts');
      // Filter out deleted accounts and sort by creation date
      const activeAccounts = allAccounts
        .filter(account => !account.deleted_at)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAccounts(activeAccounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast.error('Error al cargar las cuentas');
    } finally {
      setLoading(false);
    }
  };

  const maskIBAN = (iban: string | undefined): string => {
    if (!iban) return '';
    const clean = iban.replace(/\s/g, '');
    if (clean.length < 8) return iban;
    const masked = '**** ' + clean.slice(-4);
    return masked;
  };

  const handleNewAccount = () => {
    setEditingAccount(null);
    setFormData({
      alias: '',
      bank: '',
      iban: '',
      logoFile: null,
      logoUrl: null
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      alias: account.name || '',
      bank: account.bank || '',
      iban: account.iban || '',
      logoFile: null,
      logoUrl: account.logo_url || null
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleDeleteAccount = (account: Account) => {
    setDeleteConfirmation(account);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.alias.trim()) {
      errors.alias = 'El alias es obligatorio';
    } else if (formData.alias.trim().length < 2) {
      errors.alias = 'El alias debe tener al menos 2 caracteres';
    }

    if (!formData.bank.trim()) {
      errors.bank = 'El banco es obligatorio';
    }

    if (formData.iban && !validateIBAN(formData.iban)) {
      errors.iban = 'Formato de IBAN inválido';
    }

    // Check IBAN uniqueness
    if (formData.iban) {
      const cleanIban = formData.iban.replace(/\s/g, '').toUpperCase();
      const duplicateAccount = accounts.find(acc => 
        acc.iban?.replace(/\s/g, '').toUpperCase() === cleanIban && 
        acc.id !== editingAccount?.id
      );
      if (duplicateAccount) {
        errors.iban = 'Ya existe una cuenta con este IBAN';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogoUpload = async (file: File) => {
    try {
      const validation = validateLogoFile(file);
      if (!validation.valid) {
        toast.error(validation.error || 'Archivo de logo inválido');
        return;
      }

      setFormData(prev => ({
        ...prev,
        logoFile: file,
        logoUrl: URL.createObjectURL(file)
      }));
    } catch (error) {
      console.error('Error processing logo:', error);
      toast.error('Error al procesar el logo');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      let logoUrl = formData.logoUrl;

      // Process logo upload if a new file was selected
      if (formData.logoFile && editingAccount?.id) {
        const uploadResult = await processLogoUpload(formData.logoFile, editingAccount.id);
        logoUrl = uploadResult.logoUrl;
      }

      const accountData = {
        alias: formData.alias.trim(),
        bank: formData.bank.trim(),
        iban: formData.iban ? formData.iban.replace(/\s/g, '').toUpperCase() : undefined,
        openingBalance: 0,
        includeInConsolidated: true,
        logo_url: logoUrl || undefined
      };

      if (editingAccount) {
        await TreasuryAccountsAPI.updateAccount(editingAccount.id!, accountData);
        toast.success('Cuenta actualizada correctamente');
      } else {
        const newAccount = await TreasuryAccountsAPI.createAccount(accountData);
        
        // Process logo upload for new account
        if (formData.logoFile && newAccount.id) {
          const uploadResult = await processLogoUpload(formData.logoFile, newAccount.id);
          await TreasuryAccountsAPI.updateAccount(newAccount.id, { logo_url: uploadResult.logoUrl });
        }
        
        toast.success('Cuenta creada correctamente');
      }

      await loadAccounts();
      setShowModal(false);
    } catch (error) {
      console.error('Error saving account:', error);
      toast.error(error instanceof Error ? error.message : 'Error al guardar la cuenta');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation?.id) return;

    try {
      setDeleting(true);
      
      // Get related data count for confirmation message
      const db = await initDB();
      const allMovements = await db.getAll('movements');
      const accountMovements = allMovements.filter(m => m.accountId === deleteConfirmation.id);
      
      // Perform cascading delete by removing all related data
      // Delete movements
      for (const movement of accountMovements) {
        await db.delete('movements', movement.id!);
      }

      // Delete the account
      await db.delete('accounts', deleteConfirmation.id);

      // Remove logo from storage if exists
      if (deleteConfirmation.logo_url) {
        removeLogoFromStorage(deleteConfirmation.id);
      }

      toast.success('Cuenta y datos asociados eliminados');
      await loadAccounts();
      setDeleteConfirmation(null);
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Error al eliminar la cuenta');
    } finally {
      setDeleting(false);
    }
  };

  const handleCloseModal = () => {
    if (formData.logoUrl && formData.logoFile) {
      URL.revokeObjectURL(formData.logoUrl);
    }
    setShowModal(false);
    setFormData({
      alias: '',
      bank: '',
      iban: '',
      logoFile: null,
      logoUrl: null
    });
    setFormErrors({});
  };

  if (loading) {
    return (
      <div className="px-6 py-8 text-center">
        <div className="text-text-gray">Cargando cuentas...</div>
      </div>
    );
  }

  return (
    <div className="px-6">
      {/* ATLAS Info Banner */}
      <div className="mb-6 bg-blue-50 border border-atlas-blue/20 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-6 h-6 text-atlas-blue mt-0.5 mr-3 flex-shrink-0" style={{ strokeWidth: 1.5 }} />
          <div>
            <h3 className="font-medium text-atlas-navy-1 mb-1">Cuentas simplificadas</h3>
            <p className="text-sm text-text-gray">
              Las cuentas ya no tienen tipos (Personal/Inmuebles/Mixto). 
              La clasificación de movimientos se realiza mediante reglas automáticas y presupuesto.
            </p>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-atlas-navy-1">
              Cuentas bancarias ({accounts.length})
            </h2>
            <button
              onClick={handleNewAccount}
              className="inline-flex items-center px-4 py-2 bg-atlas-blue text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" style={{ strokeWidth: 1.5 }} />
              Nueva cuenta
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {accounts.length === 0 ? (
            <div className="px-6 py-8 text-center text-text-gray">
              No hay cuentas configuradas. Añade tu primera cuenta bancaria.
            </div>
          ) : (
            accounts.map((account) => (
              <div key={account.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                      {account.logo_url ? (
                        <img 
                          src={getLogoFromStorage(account.id!) || account.logo_url} 
                          alt={`Logo ${account.bank}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Banknote className="w-6 h-6 text-gray-500" style={{ strokeWidth: 1.5 }} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-atlas-navy-1">{account.name}</h3>
                      <p className="text-sm text-text-gray">{account.bank}</p>
                      <p className="text-sm text-text-gray font-mono">
                        {maskIBAN(account.iban)}
                      </p>
                      <p className="text-xs text-text-gray">
                        {new Date(account.createdAt).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEditAccount(account)}
                      className="p-2 text-text-gray hover:text-atlas-blue transition-colors"
                      title="Editar cuenta"
                    >
                      <Edit2 className="w-5 h-5" style={{ strokeWidth: 1.5 }} />
                    </button>
                    <button
                      onClick={() => handleDeleteAccount(account)}
                      className="p-2 text-text-gray hover:text-red-600 transition-colors"
                      title="Eliminar cuenta"
                    >
                      <Trash2 className="w-5 h-5" style={{ strokeWidth: 1.5 }} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-atlas-navy-1">
                  {editingAccount ? 'Editar cuenta' : 'Nueva cuenta'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-text-gray hover:text-atlas-navy-1"
                >
                  <X className="w-6 h-6" style={{ strokeWidth: 1.5 }} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              {/* Alias Field */}
              <div>
                <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                  Alias *
                </label>
                <input
                  type="text"
                  value={formData.alias}
                  onChange={(e) => setFormData(prev => ({ ...prev, alias: e.target.value }))}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue ${
                    formErrors.alias ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="ej. Cuenta Principal"
                  disabled={saving}
                />
                {formErrors.alias && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.alias}</p>
                )}
              </div>

              {/* Bank Field */}
              <div>
                <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                  Banco *
                </label>
                <input
                  type="text"
                  value={formData.bank}
                  onChange={(e) => setFormData(prev => ({ ...prev, bank: e.target.value }))}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue ${
                    formErrors.bank ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="ej. Banco Santander"
                  disabled={saving}
                />
                {formErrors.bank && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.bank}</p>
                )}
              </div>

              {/* IBAN Field */}
              <div>
                <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                  IBAN (opcional)
                </label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) => setFormData(prev => ({ ...prev, iban: e.target.value }))}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue font-mono ${
                    formErrors.iban ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="ES91 2100 0418 4502 0005 1332"
                  disabled={saving}
                />
                {formErrors.iban && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.iban}</p>
                )}
              </div>

              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                  Logo (opcional)
                </label>
                <div className="flex items-center space-x-4">
                  {formData.logoUrl && (
                    <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={formData.logoUrl}
                        alt="Logo preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm text-text-gray hover:bg-gray-50"
                    disabled={saving}
                  >
                    <Upload className="w-4 h-4 mr-2" style={{ strokeWidth: 1.5 }} />
                    {formData.logoUrl ? 'Cambiar logo' : 'Subir logo'}
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                  }}
                  className="hidden"
                />
                <p className="text-xs text-text-gray mt-1">
                  PNG/JPG, máximo 2MB
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-text-gray hover:text-atlas-navy-1"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 bg-atlas-blue text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>Guardando...</>
                  ) : (
                    editingAccount ? 'Actualizar' : 'Crear'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <AlertTriangle className="w-6 h-6 text-red-600 mr-3" style={{ strokeWidth: 1.5 }} />
                <h3 className="text-lg font-medium text-atlas-navy-1">
                  Eliminar cuenta y datos asociados
                </h3>
              </div>
            </div>

            <div className="px-6 py-4">
              <p className="text-text-gray mb-4">
                Vas a eliminar esta cuenta y <strong>TODOS los datos vinculados</strong> (movimientos, previstos, reglas, alertas, documentos OCR y enlaces). 
                Esta acción no se puede deshacer.
              </p>
              
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-atlas-navy-1">{deleteConfirmation.name}</p>
                <p className="text-sm text-text-gray">{deleteConfirmation.bank}</p>
                <p className="text-sm text-text-gray font-mono">{maskIBAN(deleteConfirmation.iban)}</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 text-text-gray hover:text-atlas-navy-1"
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BancosManagement;