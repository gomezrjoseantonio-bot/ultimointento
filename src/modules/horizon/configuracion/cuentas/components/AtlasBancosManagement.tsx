import React, { useState, useEffect, useImperativeHandle } from 'react';
import { 
  Banknote, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  MoreHorizontal,
  Star,
  Eye,
  EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cuentasService, UpdateAccountData } from '../../../../../services/cuentasService';
import { Account } from '../../../../../services/db';
import AccountFormModal from './AccountFormModal';
import { 
  maskIban, 
  generateHashColor, 
  getAvatarInitial 
} from '../../../../../utils/accountHelpers';

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
    const unsubscribe = cuentasService.on((event, _data) => {
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
    setShowModal(true);
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingAccount(null);
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
                className="atlas-atlas-atlas-atlas-atlas-btn-destructive w-full px-4 py-2 text-left text-sm text-error-600 hover: flex items-center gap-2"
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {accounts.length === 0 ? (
          <div className="col-span-full text-center py-12">
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
          <>
          {accounts.map((account) => {
            const isActive = account.status === 'ACTIVE' || (!account.status && account.activa);
            const isInactive = account.status === 'INACTIVE' || (!account.status && !account.activa);
            
            return (
              <div
                key={account.id}
                className={`bg-white border p-4 h-full ${
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
                        {account.tipo === 'TARJETA_CREDITO' ? 'Tarjeta de crédito' : maskIban(account.iban)}
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
          })}
          {/* Add new account card */}
          <button
            onClick={handleNewAccount}
            className="border-2 border-dashed border-gray-300 hover:border-atlas-blue hover:bg-blue-50/50 p-4 h-full flex items-center justify-center gap-2 text-gray-500 hover:text-atlas-blue transition-colors duration-200 cursor-pointer min-h-[88px]"
          >
            <Banknote className="w-5 h-5" />
            <span className="text-sm font-medium">Nueva cuenta</span>
          </button>
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AccountFormModal
        open={showModal}
        onClose={handleCloseModal}
        onSuccess={loadAccounts}
        editingAccount={editingAccount}
      />

      {/* Enhanced Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50" style={{ backgroundColor: 'var(--bg)', opacity: 0.95 }}>
          <div className="bg-white p-6 w-full max-w-lg">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 mr-3 text-error-500" />
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
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="atlas-atlas-atlas-atlas-atlas-btn-destructive border border-error-200 p-3 mb-4">
                      <p className="text-sm text-error-800">
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
                            className="mt-0.5 mr-3 h-4 w-4 text-error-600 focus:ring-red-500 border-gray-300 rounded"
                          />
                          <label htmlFor="deleteMovements" className="text-sm text-gray-700">
                            <strong>También borrar sus {deleteConfirmation.movementsCount} movimientos (irreversible)</strong>
                          </label>
                        </div>
                        
                        {!deleteConfirmation.deleteMovements && (
                          <div className="bg-warning-50 border border-yellow-200 p-3">
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
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={confirmDelete}
                        disabled={deleting || ((deleteConfirmation.movementsCount || 0) > 0 && !deleteConfirmation.deleteMovements)}
                        className="atlas-atlas-atlas-atlas-atlas-btn-destructive px-4 py-2 text-sm font-medium border border-transparent disabled:opacity-50"
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
