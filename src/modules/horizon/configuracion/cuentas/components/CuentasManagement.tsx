import React, { useState, useEffect, useImperativeHandle } from 'react';
import { Banknote, Edit2, Trash2, X, AlertTriangle, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { cuentasService, CreateAccountData, UpdateAccountData } from '../../../../../services/cuentasService';
import { Account } from '../../../../../services/db';
import { formatIban, maskIban, validateIbanEs, inferBank, loadBanksCatalog, generateHashColor, getAvatarInitial } from '../../../../../utils/accountHelpers';

interface AccountFormData {
  alias: string;
  iban: string;
  tipo: 'CORRIENTE' | 'AHORRO' | 'OTRA';
  titular: { nombre: string; nif: string; };
}

/**
 * CuentasManagement - ATLAS Design System
 * 
 * Complete account management with IBAN validation, logos, and propagation
 */

export interface CuentasManagementRef {
  triggerNewAccount: () => void;
}

const CuentasManagement = React.forwardRef<CuentasManagementRef>((props, ref) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [banksCatalog, setBanksCatalog] = useState<Record<string, any>>({});

  const [formData, setFormData] = useState<AccountFormData>({
    alias: '',
    iban: '',
    tipo: 'CORRIENTE',
    titular: { nombre: '', nif: '' }
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load accounts and banks catalog on component mount
  useEffect(() => {
    loadAccounts();
    loadCatalog();
    
    // Subscribe to account updates
    const unsubscribe = cuentasService.on((event) => {
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
      console.error('[ACCOUNTS] Failed to load accounts:', error);
      toast.error('Error al cargar las cuentas');
    } finally {
      setLoading(false);
    }
  };

  const loadCatalog = async () => {
    try {
      const catalog = await loadBanksCatalog();
      setBanksCatalog(catalog);
    } catch (error) {
      console.error('[ACCOUNTS] Failed to load banks catalog:', error);
    }
  };

  // Expose API to parent component
  useImperativeHandle(ref, () => ({
    triggerNewAccount: () => openCreateModal()
  }));

  const openCreateModal = () => {
    setEditingAccount(null);
    setFormData({
      alias: '',
      iban: '',
      tipo: 'CORRIENTE',
      titular: { nombre: '', nif: '' }
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      alias: account.alias || '',
      iban: account.iban,
      tipo: account.tipo || 'CORRIENTE',
      titular: { 
        nombre: account.titular?.nombre || '', 
        nif: account.titular?.nif || '' 
      }
    });
    setFormErrors({});
    setShowModal(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate alias
    if (!formData.alias.trim()) {
      errors.alias = 'El alias es requerido';
    } else if (formData.alias.trim().length > 40) {
      errors.alias = 'El alias no puede superar 40 caracteres';
    }

    // Validate IBAN
    const ibanValidation = validateIbanEs(formData.iban);
    if (!ibanValidation.ok) {
      errors.iban = ibanValidation.message!;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      if (editingAccount) {
        // Update existing account
        const updateData: UpdateAccountData = {
          alias: formData.alias.trim(),
          titular: formData.titular.nombre || formData.titular.nif ? formData.titular : undefined
        };
        await cuentasService.update(editingAccount.id!, updateData);
        toast.success('Cuenta actualizada correctamente');
      } else {
        // Create new account
        const createData: CreateAccountData = {
          alias: formData.alias.trim(),
          iban: formData.iban,
          tipo: formData.tipo,
          titular: formData.titular.nombre || formData.titular.nif ? formData.titular : undefined
        };
        await cuentasService.create(createData);
        toast.success('Cuenta creada correctamente');
      }

      setShowModal(false);
      loadAccounts();
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar la cuenta');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (account: Account) => {
    try {
      await cuentasService.update(account.id!, { isDefault: true });
      toast.success('Cuenta marcada como por defecto');
    } catch (error: any) {
      toast.error(error.message || 'Error al marcar cuenta por defecto');
    }
  };

  const handleDeactivate = async (account: Account) => {
    try {
      setDeleting(true);
      await cuentasService.deactivate(account.id!);
      toast.success('Cuenta desactivada');
      setDeleteConfirmation(null);
    } catch (error: any) {
      toast.error(error.message || 'Error al desactivar la cuenta');
    } finally {
      setDeleting(false);
    }
  };

  // Live IBAN formatting and bank detection
  const handleIbanChange = (value: string) => {
    const formattedIban = formatIban(value);
    setFormData(prev => ({ ...prev, iban: formattedIban }));

    // Clear IBAN error on change
    if (formErrors.iban) {
      setFormErrors(prev => ({ ...prev, iban: '' }));
    }
  };

  // Filter accounts based on search term
  const filteredAccounts = accounts.filter(account => 
    (account.alias || 'Sin alias').toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.iban.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.banco?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get bank info for preview in form
  const previewBankInfo = formData.iban ? inferBank(formData.iban, banksCatalog) : null;

  const renderAccountLogo = (account: Account) => {
    if (account.banco?.brand?.logoUrl) {
      return (
        <img 
          src={account.banco.brand.logoUrl} 
          alt={`Logo ${account.banco.name}`}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to avatar
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.setAttribute('style', 'display: flex');
          }}
        />
      );
    }
    
    const color = account.banco?.brand?.color || generateHashColor(account.iban);
    const initial = getAvatarInitial(account.alias || 'Sin alias');
    
    return (
      <div 
        className="w-full h-full flex items-center justify-center font-bold text-sm"
        style={{ backgroundColor: color }}
      >
        {initial}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-atlas-blue border-t-transparent"></div>
        <span className="ml-3 text-sm text-text-gray">Cargando cuentas...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-atlas-navy-1">
            Cuentas bancarias ({filteredAccounts.length})
          </h2>
          
          {/* Search */}
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por alias o IBAN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-atlas-blue focus:border-atlas-blue"
            />
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="divide-y divide-gray-200">
        {filteredAccounts.length === 0 ? (
          <div className="text-center text-text-gray">
            {searchTerm ? 'No se encontraron cuentas que coincidan con la búsqueda.' : 'No hay cuentas configuradas. Añade tu primera cuenta bancaria.'}
          </div>
        ) : (
          filteredAccounts.map((account) => (
            <div key={account.id} className="hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Logo */}
                  <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                    {renderAccountLogo(account)}
                  </div>
                  
                  {/* Account Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-atlas-navy-1">
                        {account.alias || 'Sin alias'}
                      </h3>
                      {account.isDefault && (
                        <span className="inline-flex items-center rounded-full text-xs font-medium bg-atlas-blue">
                          Por defecto
                        </span>
                      )}
                      {!account.activa && (
                        <span className="inline-flex items-center rounded-full text-xs font-medium bg-gray-100 text-gray-600">
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

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  {!account.isDefault && account.activa && (
                    <button
                      onClick={() => handleSetDefault(account)}
                      className="atlas-btn-ghost-horizon text-sm"
                    >
                      Marcar por defecto
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(account)}
                    className="p-2 text-gray-500 hover:text-atlas-blue rounded-lg hover:bg-gray-100"
                    title="Editar cuenta"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  {account.activa && (
                    <button
                      onClick={() => setDeleteConfirmation(account)}
                      className="p-2 text-gray-500 hover:text-error-600 rounded-lg hover:bg-gray-100"
                      title="Desactivar cuenta"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={() => setShowModal(false)}>
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div 
              className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-atlas-navy-1">
                    {editingAccount ? 'Editar cuenta' : 'Nueva cuenta bancaria'}
                  </h3>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Alias */}
                  <div>
                    <label htmlFor="alias" className="block text-sm font-medium text-atlas-navy-1 mb-1">
                      Alias *
                    </label>
                    <input
                      type="text"
                      id="alias"
                      value={formData.alias}
                      onChange={(e) => setFormData(prev => ({ ...prev, alias: e.target.value }))}
                      className={`w-full rounded-atlas border shadow-sm focus:ring-atlas-blue ${
                        formErrors.alias 
                          ? 'border-error-300 focus:border-error-500' 
                          : 'border-gray-300 focus:border-atlas-blue'
                      }`}
                      placeholder="Ej: Cuenta principal"
                      maxLength={40}
                    />
                    {formErrors.alias && (
                      <p className="mt-1 text-sm text-error-600">{formErrors.alias}</p>
                    )}
                  </div>

                  {/* IBAN */}
                  <div>
                    <label htmlFor="iban" className="block text-sm font-medium text-atlas-navy-1 mb-1">
                      IBAN *
                    </label>
                    <input
                      type="text"
                      id="iban"
                      value={formData.iban}
                      onChange={(e) => handleIbanChange(e.target.value)}
                      disabled={!!editingAccount}
                      className={`w-full rounded-atlas border shadow-sm focus:ring-atlas-blue ${
                        formErrors.iban 
                          ? 'border-error-300 focus:border-error-500' 
                          : 'border-gray-300 focus:border-atlas-blue'
                      } ${editingAccount ? 'bg-gray-50 text-gray-500' : ''}`}
                      placeholder="ES91 0049 1500 0512 3456 7892"
                    />
                    {formErrors.iban && (
                      <p className="mt-1 text-sm text-error-600">{formErrors.iban}</p>
                    )}
                  </div>

                  {/* Bank Preview */}
                  {previewBankInfo && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-atlas border border-gray-200">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                          {previewBankInfo.name ? (
                            <div style={{ backgroundColor: previewBankInfo.color || generateHashColor(formData.iban) }}>
                              {getAvatarInitial(previewBankInfo.name)}
                            </div>
                          ) : (
                            <Banknote className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-atlas-navy-1">
                            {previewBankInfo.name || `Banco ${previewBankInfo.code}`}
                          </p>
                          <p className="text-xs text-text-gray">
                            {maskIban(formData.iban)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tipo */}
                  <div>
                    <label htmlFor="tipo" className="block text-sm font-medium text-atlas-navy-1 mb-1">
                      Tipo de cuenta
                    </label>
                    <select
                      id="tipo"
                      value={formData.tipo}
                      onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as any }))}
                      className="w-full rounded-atlas border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
                    >
                      <option value="CORRIENTE">Cuenta corriente</option>
                      <option value="AHORRO">Cuenta de ahorro</option>
                      <option value="OTRA">Otra</option>
                    </select>
                  </div>

                  {/* Titular (opcional) */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-atlas-navy-1">Titular (opcional)</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="nombre" className="block text-xs font-medium text-text-gray mb-1">
                          Nombre
                        </label>
                        <input
                          type="text"
                          id="nombre"
                          value={formData.titular.nombre}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            titular: { ...prev.titular, nombre: e.target.value }
                          }))}
                          className="w-full rounded-atlas border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="nif" className="block text-xs font-medium text-text-gray mb-1">
                          NIF
                        </label>
                        <input
                          type="text"
                          id="nif"
                          value={formData.titular.nif}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            titular: { ...prev.titular, nif: e.target.value }
                          }))}
                          className="w-full rounded-atlas border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="atlas-atlas-btn-primary w-full sm:w-auto"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-atlas border border-gray-300 shadow-sm bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-atlas-blue sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-error-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertTriangle className="h-6 w-6 text-error-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Desactivar cuenta
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        ¿Estás seguro de que quieres desactivar la cuenta "{deleteConfirmation.alias}"? 
                        Esta acción se puede revertir más tarde.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => handleDeactivate(deleteConfirmation)}
                  disabled={deleting}
                  className="w-full inline-flex justify-center rounded-atlas border border-transparent shadow-sm bg-error-600 text-base font-medium  hover:bg-error-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-error-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {deleting ? 'Desactivando...' : 'Desactivar'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmation(null)}
                  className="mt-3 w-full inline-flex justify-center rounded-atlas border border-gray-300 shadow-sm bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-atlas-blue sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default CuentasManagement;