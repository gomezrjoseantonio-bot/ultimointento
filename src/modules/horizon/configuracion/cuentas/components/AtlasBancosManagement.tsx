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
    counts?: Record<string, number>;
    reassignToAccountId?: number;
    movementsCount?: number;
    deleteMovements?: boolean;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<AccountFormData>({
    alias: '',
    iban: '',
    logoFile: null
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Upload logo file to storage (mock implementation)
  const uploadLogoFile = async (file: File): Promise<string> => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Solo se permiten archivos de imagen');
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('El archivo no puede superar 2MB');
    }

    // In a real implementation, this would upload to a file storage service
    // For now, we'll create a data URL for local storage
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        resolve(dataUrl);
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsDataURL(file);
    });
  };

  // Handle file input change
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData({ ...formData, logoFile: file });
    
    // Clear any previous errors
    const newErrors = { ...formErrors };
    delete newErrors.logoFile;
    setFormErrors(newErrors);
  };

  // Generate preview URL for uploaded logo
  const getLogoPreviewUrl = (file: File): string => {
    return URL.createObjectURL(file);
  };

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

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showModal) {
          handleCloseModal();
        } else if (deleteConfirmation) {
          setDeleteConfirmation(null);
        } else if (activeDropdown) {
          setActiveDropdown(null);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showModal, deleteConfirmation, activeDropdown]);

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

    // Logo file validation
    if (formData.logoFile) {
      if (!formData.logoFile.type.startsWith('image/')) {
        errors.logoFile = 'Solo se permiten archivos de imagen';
      } else if (formData.logoFile.size > 2 * 1024 * 1024) {
        errors.logoFile = 'El archivo no puede superar 2MB';
      }
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
      let logoUser: string | undefined = undefined;

      // Handle logo file upload
      if (formData.logoFile) {
        try {
          setUploadingLogo(true);
          logoUser = await uploadLogoFile(formData.logoFile);
        } catch (error) {
          console.error('Error uploading logo:', error);
          toast.error(error instanceof Error ? error.message : 'Error al subir el logo. Se guardará la cuenta sin logo personalizado.');
        } finally {
          setUploadingLogo(false);
        }
      }

      const accountData: CreateAccountData | UpdateAccountData = {
        alias: formData.alias.trim() || undefined, // Optional alias
        iban: formData.iban,
        logoUser, // User uploaded logo URL
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
      // Use new status system
      const isActive = account.status === 'ACTIVE' || (!account.status && account.activa);
      
      if (isActive) {
        await cuentasService.deactivate(account.id!);
        toast.success('Cuenta desactivada. Puedes reactivarla cuando quieras; no aparecerá en cálculos ni importaciones.');
      } else {
        await cuentasService.reactivate(account.id!);
        toast.success('Cuenta reactivada');
      }
      
      // Reload accounts to reflect changes
      await loadAccounts();
    } catch (error) {
      console.error('Error toggling account status:', error);
      toast.error('Error al cambiar el estado de la cuenta');
    }
  };

  const handleHardDelete = async (account: Account) => {
    try {
      const canDeleteResult = await cuentasService.canDelete(account.id!);
      
      // Get movements count for deletion UI
      const allMovements = JSON.parse(localStorage.getItem('atlas_movimientos') || '[]');
      const movementsCount = allMovements.filter((m: any) => m.cuentaId === account.id && !m.deleted_at).length;
      
      setDeleteConfirmation({
        account,
        canDelete: canDeleteResult.ok,
        references: canDeleteResult.references,
        counts: canDeleteResult.counts,
        movementsCount,
        deleteMovements: false
      });
    } catch (error) {
      console.error('Error checking hard delete permissions:', error);
      toast.error('Error al verificar permisos de eliminación');
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;

    // Check for loans blocking deletion
    if (deleteConfirmation.references?.includes('préstamos')) {
      toast.error('Esta cuenta está en uso por préstamos. Cambia la cuenta de cargo antes de eliminar.');
      return;
    }

    // Validate movements selection for hard delete
    if ((deleteConfirmation.movementsCount || 0) > 0 && !deleteConfirmation.deleteMovements) {
      toast.error('Selecciona una acción: re-asignar o borrar movimientos.');
      return;
    }

    setDeleting(true);
    try {
      const result = await cuentasService.hardDelete(deleteConfirmation.account.id!, {
        deleteMovements: deleteConfirmation.deleteMovements || false,
        confirmCascade: true
      });

      if (result.success) {
        const summaryParts = [];
        if (result.summary?.removedItems?.movements) {
          summaryParts.push(`${result.summary.removedItems.movements} movimientos eliminados`);
        }
        
        const summaryText = summaryParts.length > 0 ? ` (${summaryParts.join(', ')})` : '';
        toast.success(`Cuenta eliminada definitivamente${summaryText}`);
      }

      await loadAccounts();
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
          className="w-8 h-8 object-cover"
        />
      );
    }
    
    // Priority 2: Catalog logo
    if (account.banco?.brand?.logoUrl) {
      return (
        <img 
          src={account.banco.brand.logoUrl} 
          alt={account.banco.name || 'Banco'} 
          className="w-8 h-8 object-cover"
        />
      );
    }
    
    // Priority 3: Fallback avatar with alias initial
    const initial = getAvatarInitial(account.alias || 'Sin alias');
    const backgroundColor = account.banco?.brand?.color || generateHashColor(account.alias || account.iban);
    
    return (
      <div 
        className="w-8 h-8 flex items-center justify-center text-sm font-bold"
        style={{ backgroundColor }}
      >
        {initial}
      </div>
    );
  };

  const renderRowActions = (account: Account) => {
    const isDropdownOpen = activeDropdown === account.id;

    return (
      <div className="relative">
        <button 
          onClick={() => setActiveDropdown(isDropdownOpen ? null : account.id!)}
          className="p-2"
        >
          <MoreHorizontal className="w-4 h-4 text-gray-500" />
        </button>
        
        {/* Backdrop to close dropdown */}
        {isDropdownOpen && (
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setActiveDropdown(null)}
          />
        )}
        
        {/* Dropdown menu */}
        {isDropdownOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 shadow-lg z-20">
            <div className="py-1">
              <button
                onClick={() => {
                  handleEditAccount(account);
                  setActiveDropdown(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </button>
              
              {!account.isDefault && (
                <button
                  onClick={() => {
                    handleSetDefault(account);
                    setActiveDropdown(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 flex items-center gap-2"
                >
                  <Star className="w-4 h-4" />
                  Marcar como predeterminada
                </button>
              )}
              
              <button
                onClick={() => {
                  handleToggleActive(account);
                  setActiveDropdown(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 flex items-center gap-2"
              >
                {(account.status === 'ACTIVE' || (!account.status && account.activa)) ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Desactivar
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Activar
                  </>
                )}
              </button>
              
              <button
                onClick={() => {
                  handleHardDelete(account);
                  setActiveDropdown(null);
                }}
                className="btn-danger w-full px-4 py-2 text-left text-sm text-red-600 hover: flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar definitivamente…
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin h-8 w-8 border-2 border-atlas-blue border-t-transparent"></div>
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
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium bg-atlas-blue focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-atlas-blue"
              >
                <Banknote className="-ml-1 mr-2 h-5 w-5" />
                Nueva cuenta
              </button>
            </div>
          </div>
        ) : (
          accounts.map((account) => {
            const isActive = account.status === 'ACTIVE' || (!account.status && account.activa);
            const isInactive = account.status === 'INACTIVE' || (!account.status && !account.activa);
            
            return (
              <div
                key={account.id}
                className={`bg-white border p-4 ${
                  isActive 
                    ? 'border-gray-200' 
                    : 'border-gray-300 border-dashed opacity-60 bg-gray-50'
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
                        <h3 className={`text-sm font-medium ${isActive ? 'text-atlas-navy-1' : 'text-gray-500'}`}>
                          {account.alias || 'Sin alias'}
                        </h3>
                        {account.isDefault && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-atlas-blue">
                            Predeterminada
                          </span>
                        )}
                        {isInactive && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-400">
                            Inactiva
                          </span>
                        )}
                      </div>
                      <p className={`text-sm ${isActive ? 'text-text-gray' : 'text-gray-400'}`}>
                        {maskIban(account.iban)}
                      </p>
                      {account.banco?.name && (
                        <p className={`text-xs ${isActive ? 'text-text-gray' : 'text-gray-400'}`}>
                          {account.banco.name}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Row Actions */}
                  {renderRowActions(account)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50" style={{ backgroundColor: 'var(--bg)', opacity: 0.95 }}>
          <div className="bg-white p-6 w-full max-w-md">
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
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-atlas-blue focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-atlas-blue focus:border-transparent"
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
                    onChange={handleLogoFileChange}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-atlas-blue focus:border-transparent"
                  />
                  {formErrors.logoFile && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.logoFile}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Se detectará automáticamente el logo del banco. Puedes subir uno personalizado (máx. 2MB).
                  </p>
                  {formData.logoFile && (
                    <div className="mt-2 flex items-center gap-3">
                      <img 
                        src={getLogoPreviewUrl(formData.logoFile)} 
                        alt="Vista previa del logo" 
                        className="w-8 h-8 object-cover border border-gray-300"
                      />
                      <div className="text-xs">
                        <p className="text-green-600 font-medium">
                          {formData.logoFile.name}
                        </p>
                        <p className="text-gray-500">
                          {(formData.logoFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-atlas-blue"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingLogo}
                  className="px-4 py-2 text-sm font-medium bg-atlas-blue border border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-atlas-blue disabled:opacity-50"
                >
                  {uploadingLogo ? 'Subiendo logo...' : saving ? 'Guardando...' : editingAccount ? 'Actualizar' : 'Crear cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enhanced Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50" style={{ backgroundColor: 'var(--bg)', opacity: 0.95 }}>
          <div className="bg-white p-6 w-full max-w-lg">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 mr-3 text-red-500" />
              <h2 className="text-lg font-semibold text-atlas-navy-1">
                Eliminar cuenta definitivamente
              </h2>
            </div>

            {/* Hard delete modal */}
            <div>
              {/* Check for loans that would block deletion */}
              {deleteConfirmation.references?.includes('préstamos') ? (
                  <div>
                    <p className="text-sm text-gray-700 mb-4">
                      Esta cuenta está en uso por {deleteConfirmation.counts?.['préstamos'] || 0} préstamos. Cambia la cuenta de cargo antes de eliminar.
                    </p>
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => setDeleteConfirmation(null)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="btn-danger   border border-red-200 p-3 mb-4">
                      <p className="text-sm text-red-800">
                        <strong>Acción irreversible:</strong> Esta cuenta será eliminada permanentemente de la base de datos y no se podrá recuperar.
                      </p>
                    </div>

                    {deleteConfirmation.movementsCount && deleteConfirmation.movementsCount > 0 && (
                      <div className="space-y-3 mb-4">
                        <div className="flex items-start">
                          <input
                            type="checkbox"
                            id="deleteMovements"
                            checked={deleteConfirmation.deleteMovements || false}
                            onChange={(e) => setDeleteConfirmation({
                              ...deleteConfirmation,
                              deleteMovements: e.target.checked
                            })}
                            className="mt-0.5 mr-3 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                          />
                          <label htmlFor="deleteMovements" className="text-sm text-gray-700">
                            <strong>También borrar sus {deleteConfirmation.movementsCount} movimientos (irreversible)</strong>
                          </label>
                        </div>
                        
                        {!deleteConfirmation.deleteMovements && (
                          <div className="bg-yellow-50 border border-yellow-200 p-3">
                            <p className="text-sm text-yellow-800">
                              Selecciona una acción: re-asignar o borrar movimientos.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => setDeleteConfirmation(null)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 >
                        Cancelar
                      </button>
                      <button
                        onClick={confirmDelete}
                        disabled={deleting || ((deleteConfirmation.movementsCount || 0) > 0 && !deleteConfirmation.deleteMovements)}
                        className="btn-danger px-4 py-2 text-sm font-medium   border border-transparent disabled:opacity-50"
                      >
                        {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
                      </button>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

AtlasBancosManagement.displayName = 'AtlasBancosManagement';

export default AtlasBancosManagement;