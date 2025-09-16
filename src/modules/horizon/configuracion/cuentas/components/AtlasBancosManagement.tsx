import React, { useState, useEffect, useImperativeHandle, useRef } from 'react';
import { 
  Banknote, 
  Edit2, 
  Trash2, 
  X, 
  AlertTriangle, 
  MoreHorizontal,
  Star,
  Eye,
  EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cuentasService, CreateAccountData, UpdateAccountData } from '../../../../../services/cuentasService';
import { Account } from '../../../../../services/db';
import { 
  formatIban, 
  maskIban, 
  validateIbanEs, 
  generateHashColor, 
  getAvatarInitial 
} from '../../../../../utils/accountHelpers';

interface AccountFormData {
  alias: string;
  iban: string;
  logoFile: File | null;
}

/**
 * AtlasBancosManagement - ATLAS Design System
 * 
 * Complete account management following ATLAS requirements:
 * - Optional alias with "Sin alias" fallback
 * - Bank branding with logo priority: user → catalog → fallback
 * - Symmetric activate/deactivate actions
 * - Hard delete with integrity checks
 * - IBAN masking: ES91 **** **** **** 2715
 * - Row actions menu with proper validations
 */

export interface AtlasBancosManagementRef {
  triggerNewAccount: () => void;
}

const AtlasBancosManagement = React.forwardRef<AtlasBancosManagementRef>((props, ref) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ 
    account: Account; 
    canDelete: boolean; 
    references?: string[]; 
    counts?: Record<string, number> 
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmationAlias, setConfirmationAlias] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<AccountFormData>({
    alias: '',
    iban: '',
    logoFile: null
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Expose ref methods
  useImperativeHandle(ref, () => ({
    triggerNewAccount: () => {
      handleNewAccount();
    }
  }));

  // Load accounts on component mount
  useEffect(() => {
    loadAccounts();
    
    // Listen for account updates
    const unsubscribe = cuentasService.on((event, data) => {
      if (event === 'accounts:updated') {
        loadAccounts();
      }
    });

    return unsubscribe;
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const accountsList = await cuentasService.list();
      setAccounts(accountsList);
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast.error('Error al cargar las cuentas');
    } finally {
      setLoading(false);
    }
  };

  const handleNewAccount = () => {
    setEditingAccount(null);
    setFormData({
      alias: '',
      iban: '',
      logoFile: null
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      alias: account.alias || '',
      iban: formatIban(account.iban),
      logoFile: null
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingAccount(null);
    setFormData({
      alias: '',
      iban: '',
      logoFile: null
    });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // IBAN validation
    if (!formData.iban.trim()) {
      errors.iban = 'El IBAN es obligatorio';
    } else {
      const ibanValidation = validateIbanEs(formData.iban);
      if (!ibanValidation.ok) {
        errors.iban = ibanValidation.message || 'IBAN inválido';
      }
    }

    // Alias validation (optional but if provided, check length)
    if (formData.alias.trim() && formData.alias.trim().length > 40) {
      errors.alias = 'El alias no puede superar 40 caracteres';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      const accountData: CreateAccountData | UpdateAccountData = {
        alias: formData.alias.trim() || undefined, // Optional alias
        iban: formData.iban,
        // TODO: Handle logoFile upload and set logoUser
      };

      if (editingAccount) {
        await cuentasService.update(editingAccount.id!, accountData as UpdateAccountData);
        toast.success('Cuenta actualizada correctamente');
      } else {
        await cuentasService.create(accountData as CreateAccountData);
        toast.success('Cuenta creada correctamente');
      }

      handleCloseModal();
    } catch (error) {
      console.error('Error saving account:', error);
      toast.error(error instanceof Error ? error.message : 'Error al guardar la cuenta');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (account: Account) => {
    try {
      await cuentasService.update(account.id!, { isDefault: true });
      toast.success('Cuenta marcada como predeterminada');
    } catch (error) {
      console.error('Error setting default account:', error);
      toast.error('Error al marcar como predeterminada');
    }
  };

  const handleToggleActive = async (account: Account) => {
    try {
      if (account.activa) {
        await cuentasService.deactivate(account.id!);
        toast.success('Cuenta inactivada');
      } else {
        await cuentasService.reactivate(account.id!);
        toast.success('Cuenta reactivada');
      }
    } catch (error) {
      console.error('Error toggling account status:', error);
      toast.error('Error al cambiar el estado de la cuenta');
    }
  };

  const handleDeleteAccount = async (account: Account) => {
    try {
      const canDeleteResult = await cuentasService.canDelete(account.id!);
      setDeleteConfirmation({
        account,
        canDelete: canDeleteResult.ok,
        references: canDeleteResult.references,
        counts: canDeleteResult.counts
      });
      setConfirmationAlias('');
    } catch (error) {
      console.error('Error checking delete permissions:', error);
      toast.error('Error al verificar permisos de eliminación');
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;

    if (!deleteConfirmation.canDelete) {
      // Offer to inactivate instead
      try {
        await cuentasService.deactivate(deleteConfirmation.account.id!);
        toast.success('Cuenta inactivada debido a referencias activas');
        setDeleteConfirmation(null);
      } catch (error) {
        console.error('Error deactivating account:', error);
        toast.error('Error al inactivar la cuenta');
      }
      return;
    }

    // Validate confirmation alias
    const expectedAlias = deleteConfirmation.account.alias || 'Sin alias';
    if (confirmationAlias !== expectedAlias) {
      toast.error('El alias de confirmación no coincide');
      return;
    }

    setDeleting(true);
    try {
      await cuentasService.deleteAccount(deleteConfirmation.account.id!, confirmationAlias);
      toast.success('Cuenta eliminada definitivamente');
      setDeleteConfirmation(null);
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error(error instanceof Error ? error.message : 'Error al eliminar la cuenta');
    } finally {
      setDeleting(false);
    }
  };

  const renderAccountLogo = (account: Account) => {
    // Priority 1: User uploaded logo
    if (account.logoUser) {
      return (
        <img 
          src={account.logoUser} 
          alt="Logo de banco" 
          className="w-8 h-8 rounded-full object-cover"
        />
      );
    }
    
    // Priority 2: Catalog logo
    if (account.banco?.brand?.logoUrl) {
      return (
        <img 
          src={account.banco.brand.logoUrl} 
          alt={account.banco.name || 'Banco'} 
          className="w-8 h-8 rounded-full object-cover"
        />
      );
    }
    
    // Priority 3: Fallback avatar with alias initial
    const initial = getAvatarInitial(account.alias || 'Sin alias');
    const backgroundColor = account.banco?.brand?.color || generateHashColor(account.alias || account.iban);
    
    return (
      <div 
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
        style={{ backgroundColor }}
      >
        {initial}
      </div>
    );
  };

  const renderRowActions = (account: Account) => {
    return (
      <div className="relative group">
        <button className="p-2 hover:bg-gray-100 rounded-full">
          <MoreHorizontal className="w-4 h-4 text-gray-500" />
        </button>
        
        {/* Dropdown menu - would need proper implementation */}
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-10">
          <div className="py-1">
            <button
              onClick={() => handleEditAccount(account)}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Editar
            </button>
            
            {!account.isDefault && (
              <button
                onClick={() => handleSetDefault(account)}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <Star className="w-4 h-4" />
                Marcar como predeterminada
              </button>
            )}
            
            <button
              onClick={() => handleToggleActive(account)}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              {account.activa ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  Inactivar
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Reactivar
                </>
              )}
            </button>
            
            <button
              onClick={() => handleDeleteAccount(account)}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar definitivamente
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-atlas-blue border-t-transparent"></div>
        <span className="ml-2 text-text-gray">Cargando cuentas...</span>
      </div>
    );
  }

  return (
    <div className="px-6">
      {/* Account List */}
      <div className="space-y-4">
        {accounts.length === 0 ? (
          <div className="text-center py-12">
            <Banknote className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay cuentas bancarias</h3>
            <p className="mt-1 text-sm text-gray-500">
              Comienza agregando tu primera cuenta bancaria.
            </p>
            <div className="mt-6">
              <button
                onClick={handleNewAccount}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-atlas-blue hover:bg-atlas-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-atlas-blue"
              >
                <Banknote className="-ml-1 mr-2 h-5 w-5" />
                Nueva cuenta
              </button>
            </div>
          </div>
        ) : (
          accounts.map((account) => (
            <div
              key={account.id}
              className={`bg-white rounded-lg border border-gray-200 p-4 ${
                !account.activa ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {/* Account Logo */}
                  <div className="flex-shrink-0">
                    {renderAccountLogo(account)}
                  </div>
                  
                  {/* Account Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-atlas-navy-1">
                        {account.alias || 'Sin alias'}
                      </h3>
                      {account.isDefault && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-atlas-blue text-white">
                          Por defecto
                        </span>
                      )}
                      {!account.activa && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Inactiva
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-gray">
                      {maskIban(account.iban)}
                    </p>
                    {account.banco?.name && (
                      <p className="text-xs text-text-gray">
                        {account.banco.name}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Row Actions */}
                {renderRowActions(account)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-atlas-navy-1">
                {editingAccount ? 'Editar cuenta' : 'Nueva cuenta bancaria'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Alias field - Optional */}
                <div>
                  <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                    Alias (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.alias}
                    onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-blue focus:border-transparent"
                    placeholder="ej. Cuenta principal, Nómina..."
                    maxLength={40}
                  />
                  {formErrors.alias && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.alias}</p>
                  )}
                </div>

                {/* IBAN field - Required */}
                <div>
                  <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                    IBAN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-blue focus:border-transparent"
                    placeholder="ES91 0049 1500 0512 3456 7892"
                    required
                    disabled={!!editingAccount} // Cannot edit IBAN
                  />
                  {formErrors.iban && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.iban}</p>
                  )}
                </div>

                {/* Logo upload - Optional */}
                <div>
                  <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                    Logo personalizado (opcional)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFormData({ ...formData, logoFile: e.target.files?.[0] || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-blue focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Se detectará automáticamente el logo del banco. Puedes subir uno personalizado.
                  </p>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-atlas-blue"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-atlas-blue border border-transparent rounded-md hover:bg-atlas-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-atlas-blue disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : editingAccount ? 'Actualizar' : 'Crear cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500 mr-3" />
              <h2 className="text-lg font-semibold text-atlas-navy-1">
                {deleteConfirmation.canDelete ? 'Eliminar cuenta definitivamente' : 'No se puede eliminar'}
              </h2>
            </div>

            {!deleteConfirmation.canDelete ? (
              <div>
                <p className="text-sm text-gray-700 mb-4">
                  No se puede eliminar la cuenta porque tiene referencias activas:
                </p>
                <ul className="text-sm text-gray-600 mb-4 space-y-1">
                  {deleteConfirmation.references?.map((ref, index) => (
                    <li key={index} className="flex items-center">
                      <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                      {ref} ({deleteConfirmation.counts?.[ref] || 0})
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-gray-600 mb-4">
                  ¿Deseas inactivar la cuenta en su lugar?
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setDeleteConfirmation(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md hover:bg-orange-700"
                  >
                    Inactivar cuenta
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-700 mb-4">
                  Esta acción es irreversible. Los movimientos históricos permanecerán, pero sin referencia a esta cuenta.
                </p>
                <p className="text-sm text-gray-700 mb-4">
                  Para confirmar, escribe el alias de la cuenta:{' '}
                  <strong>{deleteConfirmation.account.alias || 'Sin alias'}</strong>
                </p>
                <input
                  type="text"
                  value={confirmationAlias}
                  onChange={(e) => setConfirmationAlias(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
                  placeholder="Escribe el alias aquí"
                />
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setDeleteConfirmation(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={deleting || confirmationAlias !== (deleteConfirmation.account.alias || 'Sin alias')}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

AtlasBancosManagement.displayName = 'AtlasBancosManagement';

export default AtlasBancosManagement;