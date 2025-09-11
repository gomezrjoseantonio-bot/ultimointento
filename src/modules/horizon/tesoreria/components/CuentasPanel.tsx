import React, { useState, useEffect, useCallback } from 'react';
import { Banknote, Edit, Plus, AlertTriangle, ArrowLeft, Upload, TrendingUp, TrendingDown, Eye, EyeOff, Filter, Trash2, X, Play, Pause, Settings } from 'lucide-react';
import { initDB, Account, Movement } from '../../../../services/db';
import { formatEuro } from '../../../../services/aeatClassificationService';
import { getTreasuryProjections } from '../../../../services/treasuryForecastService';
import { treasuryAPI, validateIBAN, parseEuropeanNumber } from '../../../../services/treasuryApiService';
import { maskIBAN } from '../../../../services/ibanAccountMatchingService';
import { validateLogoFile, processLogoUpload, getLogoFromStorage } from '../../../../services/logoUploadService';
import toast from 'react-hot-toast';

interface AccountProjection {
  currentBalance: number;
  projectedBalance: number;
  projectedBalance7d: number;
  movements: Movement[];
  status: 'healthy' | 'warning' | 'critical';
}

const CuentasPanel: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountProjection, setAccountProjection] = useState<AccountProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [usageFilter, setUsageFilter] = useState<'all' | 'personal' | 'inmuebles' | 'mixto'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active'); // FIX PACK v2.0: Status filter
  const [showIbanFull, setShowIbanFull] = useState<{ [key: number]: boolean }>({});
  const [showUnificationBanner, setShowUnificationBanner] = useState(
    !localStorage.getItem('cuentas-unification-banner-dismissed')
  );
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState<Account | null>(null);
  
  // New account form state
  const [newAccountForm, setNewAccountForm] = useState({
    alias: '',
    bank: '',
    iban: '',
    openingBalance: '',
    minimumBalance: '',
    includeInConsolidated: true,
    usage_scope: 'mixto' as 'personal' | 'inmuebles' | 'mixto',
    logoFile: null as File | null,
    logoPreview: null as string | null
  });

  const loadAccounts = useCallback(async () => {
    try {
      // FIX PACK v2.0: Load accounts based on status filter
      const include_inactive = statusFilter === 'all' || statusFilter === 'inactive';
      const allAccounts = await treasuryAPI.accounts.getAccounts(include_inactive);
      const horizonAccounts = allAccounts.filter(acc => acc.destination === 'horizon');
      setAccounts(horizonAccounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadAccountDetails = async (account: Account) => {
    try {
      const db = await initDB();
      
      // Get movements for this account
      const allMovements = await db.getAll('movements');
      let accountMovements = allMovements.filter(mov => mov.accountId === account.id);
      
      // FIX: Filter out demo movements when displaying account details
      const { isDemoMovement } = await import('../../../../services/demoDataCleanupService');
      accountMovements = accountMovements.filter(mov => !isDemoMovement(mov));
      
      // Get projections for this specific account
      const { accountBalances } = await getTreasuryProjections(30, [account.id!]);
      const { accountBalances: sevenDayBalances } = await getTreasuryProjections(7, [account.id!]);
      
      const currentBalance = account.balance;
      const projectedBalance = accountBalances.get(account.id!)?.projected || currentBalance;
      const projectedBalance7d = sevenDayBalances.get(account.id!)?.projected || currentBalance;
      
      // Determine status
      const minimumBalance = account.minimumBalance || 200;
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      
      if (projectedBalance < 0) status = 'critical';
      else if (projectedBalance < minimumBalance) status = 'warning';
      
      setAccountProjection({
        currentBalance,
        projectedBalance,
        projectedBalance7d,
        movements: accountMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10),
        status
      });
    } catch (error) {
      console.error('Error loading account details:', error);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Filter accounts based on usage and status filters
  useEffect(() => {
    let filtered = accounts;
    
    // Apply usage filter
    if (usageFilter !== 'all') {
      filtered = filtered.filter(account => account.usage_scope === usageFilter);
    }
    
    // Apply status filter (FIX PACK v2.0)
    if (statusFilter === 'active') {
      filtered = filtered.filter(account => account.isActive);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(account => !account.isActive);
    }
    // statusFilter === 'all' shows both active and inactive
    
    setFilteredAccounts(filtered);
  }, [accounts, usageFilter, statusFilter]);

  // Handle editing account - populate form when editingAccount changes
  useEffect(() => {
    if (editingAccount) {
      setNewAccountForm({
        alias: editingAccount.name || '',
        bank: editingAccount.bank,
        iban: editingAccount.iban,
        openingBalance: editingAccount.openingBalance.toString(),
        minimumBalance: editingAccount.minimumBalance?.toString() || '',
        includeInConsolidated: editingAccount.includeInConsolidated ?? true,
        usage_scope: editingAccount.usage_scope || 'mixto',
        logoFile: null,
        logoPreview: editingAccount.logo_url ? getLogoFromStorage(editingAccount.id!) : null
      });
    }
  }, [editingAccount]);

  const getAccountStatus = (account: Account): 'healthy' | 'warning' | 'critical' => {
    const minimumBalance = account.minimumBalance || 200;
    
    if (account.balance < 0) return 'critical';
    if (account.balance < minimumBalance) return 'warning';
    return 'healthy';
  };

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical'): string => {
    switch (status) {
      case 'critical': return 'text-error-600 bg-error-50 border-error-200';
      case 'warning': return 'text-warning-600 bg-orange-50 border-orange-200';
      case 'healthy': return 'text-success-600 bg-success-50 border-success-200';
    }
  };

  const getStatusIcon = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-error-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'healthy': return <Banknote className="w-4 h-4 text-success-500" />;
    }
  };

  // New account form handlers
  const handleNewAccountChange = (field: string, value: string | boolean | File | null) => {
    setNewAccountForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle logo file selection
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateLogoFile(file);
    if (!validation.valid) {
      toast.error(validation.error!);
      return;
    }

    try {
      const previewUrl = URL.createObjectURL(file);
      setNewAccountForm(prev => ({
        ...prev,
        logoFile: file,
        logoPreview: previewUrl
      }));
    } catch (error) {
      toast.error('Error procesando el logo');
    }
  };

  // Remove logo
  const handleRemoveLogo = () => {
    if (newAccountForm.logoPreview) {
      URL.revokeObjectURL(newAccountForm.logoPreview);
    }
    setNewAccountForm(prev => ({
      ...prev,
      logoFile: null,
      logoPreview: null
    }));
  };

  // Usage and display helpers
  const getUsageLabel = (usage: string) => {
    switch (usage) {
      case 'personal': return 'Personal';
      case 'inmuebles': return 'Inmuebles';
      case 'mixto': return 'Mixto';
      default: return 'Mixto';
    }
  };

  const getUsageColor = (usage: string) => {
    switch (usage) {
      case 'personal': return 'bg-primary-100 text-primary-800';
      case 'inmuebles': return 'bg-success-100 text-success-800';
      case 'mixto': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleIbanDisplay = (accountId: number) => {
    setShowIbanFull(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  };

  const renderIban = (account: Account) => {
    if (!account.iban) return 'No especificado';
    
    const showFull = showIbanFull[account.id!];
    const displayIban = showFull ? account.iban : maskIBAN(account.iban);
    
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm">{displayIban}</span>
        <button
          onClick={() => toggleIbanDisplay(account.id!)}
          className="text-gray-400 hover:text-gray-600"
        >
          {showFull ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    );
  };

  const handleCreateAccount = async () => {
    const isEditing = editingAccount !== null;
    
    // Enhanced validation - ALIAS is optional, BANK NAME and IBAN are mandatory
    if (newAccountForm.alias.trim() && (newAccountForm.alias.trim().length < 2 || newAccountForm.alias.trim().length > 50)) {
      toast.error('El alias debe tener entre 2 y 50 caracteres');
      return;
    }
    
    if (!newAccountForm.bank.trim()) {
      toast.error('El banco es obligatorio');
      return;
    }

    if (!newAccountForm.iban.trim()) {
      toast.error('El IBAN es obligatorio');
      return;
    }

    if (!validateIBAN(newAccountForm.iban)) {
      toast.error('Formato de IBAN inválido');
      return;
    }

    try {
      setIsCreatingAccount(true);
      
      let logoUrl = editingAccount?.logo_url; // Keep existing logo for edits
      
      // Handle logo upload if present
      if (newAccountForm.logoFile) {
        try {
          const accountId = editingAccount?.id || Date.now();
          const { logoUrl: uploadedLogoUrl } = await processLogoUpload(newAccountForm.logoFile, accountId);
          logoUrl = uploadedLogoUrl;
        } catch (error) {
          toast.error('Error subiendo el logo, pero la cuenta se guardará sin cambios en el logo');
        }
      }
      
      const accountData = {
        alias: newAccountForm.alias.trim() || undefined,
        bank: newAccountForm.bank.trim(),
        iban: newAccountForm.iban.trim(),
        includeInConsolidated: newAccountForm.includeInConsolidated,
        openingBalance: parseEuropeanNumber(newAccountForm.openingBalance),
        openingBalanceDate: isEditing ? editingAccount!.openingBalanceDate : new Date().toISOString(),
        usage_scope: newAccountForm.usage_scope,
        logo_url: logoUrl
      };

      let updatedAccount: Account;
      
      if (isEditing) {
        updatedAccount = await treasuryAPI.accounts.updateAccount(editingAccount!.id!, accountData);
        toast.success('Cuenta actualizada correctamente');
      } else {
        updatedAccount = await treasuryAPI.accounts.createAccount(accountData);
        toast.success('Cuenta creada correctamente');
      }
      
      // Update minimum balance if specified
      if (newAccountForm.minimumBalance) {
        const db = await initDB();
        const accountWithMinBalance = {
          ...updatedAccount,
          minimumBalance: parseEuropeanNumber(newAccountForm.minimumBalance)
        };
        await db.put('accounts', accountWithMinBalance);
      }
      
      // Reset form and reload accounts
      if (newAccountForm.logoPreview) {
        URL.revokeObjectURL(newAccountForm.logoPreview);
      }
      setNewAccountForm({
        alias: '',
        bank: '',
        iban: '',
        openingBalance: '',
        minimumBalance: '',
        includeInConsolidated: true,
        usage_scope: 'mixto',
        logoFile: null,
        logoPreview: null
      });
      setShowImport(false);
      setShowCreateForm(false);
      setEditingAccount(null);
      await loadAccounts();
      
    } catch (error) {
      console.error('Error saving account:', error);
      toast.error(error instanceof Error ? error.message : `Error al ${isEditing ? 'actualizar' : 'crear'} la cuenta`);
    } finally {
      setIsCreatingAccount(false);
    }
  };

  // Handle account activation/deactivation toggle (FIX PACK v2.0)
  const handleToggleAccountStatus = async (account: Account) => {
    try {
      if (account.isActive) {
        await treasuryAPI.accounts.deactivateAccount(account.id!);
        toast.success('Cuenta desactivada correctamente');
      } else {
        await treasuryAPI.accounts.activateAccount(account.id!);
        toast.success('Cuenta activada correctamente');
      }
      
      // Reload accounts to reflect the change
      await loadAccounts();
      
      // If the modified account was selected, clear selection to refresh
      if (selectedAccount?.id === account.id) {
        setSelectedAccount(null);
        setAccountProjection(null);
      }
      
    } catch (error) {
      console.error('Error toggling account status:', error);
      toast.error(error instanceof Error ? error.message : 'Error al cambiar el estado de la cuenta');
    }
  };

  // Handle account deletion/deactivation (FIX PACK v2.0)
  const handleDeleteAccount = async () => {
    if (!confirmDeleteAccount) return;

    try {
      // Attempt hard delete first
      const result = await treasuryAPI.accounts.deleteAccount(confirmDeleteAccount.id!);
      
      if (result.success) {
        toast.success('Cuenta eliminada correctamente');
      } else if (result.requiresWizard) {
        // TODO: Open deletion wizard
        toast.error(`La cuenta tiene ${result.refs_summary?.movements} movimientos. Se requiere asistente de eliminación.`);
        // For now, just deactivate
        await treasuryAPI.accounts.deactivateAccount(confirmDeleteAccount.id!);
        toast.success('Cuenta desactivada correctamente (eliminación completa pendiente)');
      }
      
      // Reload accounts to reflect the change
      await loadAccounts();
      setConfirmDeleteAccount(null);
      
      // If the deleted account was selected, clear selection
      if (selectedAccount?.id === confirmDeleteAccount.id) {
        setSelectedAccount(null);
        setAccountProjection(null);
      }
      
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error(error instanceof Error ? error.message : 'Error al eliminar la cuenta');
    }
  };

  // Create/Edit Form Modal
  if (showCreateForm) {
    const isEditing = editingAccount !== null;
    const formTitle = isEditing ? 'Editar Cuenta' : 'Nueva Cuenta';
    
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setShowCreateForm(false);
                setEditingAccount(null);
                if (newAccountForm.logoPreview) {
                  URL.revokeObjectURL(newAccountForm.logoPreview);
                }
                setNewAccountForm({
                  alias: '',
                  bank: '',
                  iban: '',
                  openingBalance: '',
                  minimumBalance: '',
                  includeInConsolidated: true,
                  usage_scope: 'mixto',
                  logoFile: null,
                  logoPreview: null
                });
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{formTitle}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {isEditing ? 'Modifica los datos de la cuenta' : 'Crea una nueva cuenta bancaria'}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alias de la cuenta *</label>
              <input
                type="text"
                value={newAccountForm.alias}
                onChange={(e) => handleNewAccountChange('alias', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-navy focus:border-brand-navy"
                placeholder="ej. Cuenta Corriente Principal"
                disabled={isCreatingAccount}
              />
              {newAccountForm.alias && (newAccountForm.alias.length < 2 || newAccountForm.alias.length > 50) && (
                <p className="text-xs text-error-600 mt-1">El alias debe tener entre 2 y 50 caracteres</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banco *</label>
              <input
                type="text"
                value={newAccountForm.bank}
                onChange={(e) => handleNewAccountChange('bank', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-navy focus:border-brand-navy"
                placeholder="ej. Banco Santander"
                disabled={isCreatingAccount}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IBAN (opcional)</label>
              <input
                type="text"
                value={newAccountForm.iban}
                onChange={(e) => handleNewAccountChange('iban', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-navy focus:border-brand-navy"
                placeholder="ES91 2100 0418 4502 0005 1332"
                disabled={isCreatingAccount}
              />
              {newAccountForm.iban && !validateIBAN(newAccountForm.iban) && (
                <p className="text-xs text-error-600 mt-1">Formato de IBAN inválido</p>
              )}
            </div>
            
            {/* Usage/Uso field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Uso *</label>
              <select
                value={newAccountForm.usage_scope}
                onChange={(e) => handleNewAccountChange('usage_scope', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-navy focus:border-brand-navy"
                disabled={isCreatingAccount}
              >
                <option value="personal">Personal</option>
                <option value="inmuebles">Inmuebles</option>
                <option value="mixto">Mixto</option>
              </select>
            </div>

            {/* Logo upload field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo (opcional)</label>
              <div className="space-y-3">
                {!newAccountForm.logoPreview ? (
                  <div className="flex items-center justify-center w-full">
                    <label htmlFor="logo-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-gray-400" />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click para subir</span> o arrastra aquí
                        </p>
                        <p className="text-xs text-gray-500">JPG, PNG (máx. 512KB)</p>
                      </div>
                      <input 
                        id="logo-upload" 
                        type="file" 
                        className="hidden" 
                        accept=".jpg,.jpeg,.png"
                        onChange={handleLogoChange}
                        disabled={isCreatingAccount}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="w-32 h-32 mx-auto border-2 border-gray-200 rounded-lg overflow-hidden">
                      <img 
                        src={newAccountForm.logoPreview} 
                        alt="Logo preview" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 bg-error-500 text-white rounded-full p-1 hover:bg-error-600"
                      disabled={isCreatingAccount}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Inicial</label>
              <input
                type="text"
                value={newAccountForm.openingBalance}
                onChange={(e) => handleNewAccountChange('openingBalance', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-navy focus:border-brand-navy"
                placeholder="1.234,56"
                disabled={isCreatingAccount}
              />
              <p className="text-xs text-gray-500 mt-1">Formato europeo: 1.234,56</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Mínimo</label>
              <input
                type="text"
                value={newAccountForm.minimumBalance}
                onChange={(e) => handleNewAccountChange('minimumBalance', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-navy focus:border-brand-navy"
                placeholder="200,00"
                disabled={isCreatingAccount}
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeInConsolidated"
                checked={newAccountForm.includeInConsolidated}
                onChange={(e) => handleNewAccountChange('includeInConsolidated', e.target.checked)}
                className="h-4 w-4 text-brand-navy focus:ring-brand-navy border-gray-300 rounded"
                disabled={isCreatingAccount}
              />
              <label htmlFor="includeInConsolidated" className="ml-2 block text-sm text-gray-700">
                Incluir en consolidado
              </label>
            </div>
            
            <div className="flex gap-3 pt-4">
              <button 
                onClick={handleCreateAccount}
                disabled={isCreatingAccount || !newAccountForm.alias.trim() || !newAccountForm.bank.trim()}
                className="flex-1 bg-brand-navy text-white py-3 px-4 rounded-lg hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingAccount ? 'Guardando...' : (isEditing ? 'Actualizar Cuenta' : 'Crear Cuenta')}
              </button>
              <button 
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingAccount(null);
                }}
                disabled={isCreatingAccount}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const dismissUnificationBanner = () => {
    localStorage.setItem('cuentas-unification-banner-dismissed', 'true');
    setShowUnificationBanner(false);
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Individual Account View
  if (selectedAccount) {
    return (
      <div className="space-y-6">
        {/* Account Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setSelectedAccount(null);
                setAccountProjection(null);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{selectedAccount.name || `${selectedAccount.bank} - ${selectedAccount.iban.slice(-4)}`}</h2>
              <p className="text-sm text-gray-500">{selectedAccount.bank} • {selectedAccount.iban?.slice(-4)}</p>
            </div>
          </div>
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50">
            <Edit className="w-4 h-4 mr-2" />
            Editar Cuenta
          </button>
        </div>

        {/* Account Overview */}
        {accountProjection && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <Banknote className="w-8 h-8 text-brand-teal mr-3" />
                <div>
                  <div className="text-sm font-medium text-gray-500">Saldo Actual</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatEuro(accountProjection.currentBalance)}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex items-center">
                  {accountProjection.projectedBalance7d > accountProjection.currentBalance ? (
                    <TrendingUp className="w-8 h-8 text-success-500 mr-3" />
                  ) : (
                    <TrendingDown className="w-8 h-8 text-error-500 mr-3" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-500">Proyección 7d</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatEuro(accountProjection.projectedBalance7d)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex items-center">
                  {accountProjection.projectedBalance > accountProjection.currentBalance ? (
                    <TrendingUp className="w-8 h-8 text-success-500 mr-3" />
                  ) : (
                    <TrendingDown className="w-8 h-8 text-error-500 mr-3" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-500">Proyección 30d</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatEuro(accountProjection.projectedBalance)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg ${getStatusColor(accountProjection.status)} mr-3`}>
                  {getStatusIcon(accountProjection.status)}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Estado</div>
                  <div className="text-lg font-semibold">
                    {accountProjection.status === 'healthy' ? 'Saludable' : 
                     accountProjection.status === 'warning' ? 'Atención' : 'Crítico'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Movements */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Movimientos Recientes</h3>
          </div>
          
          {accountProjection && accountProjection.movements.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {accountProjection.movements.map((movement, index) => (
                <div key={movement.id || index} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        {movement.amount > 0 ? (
                          <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-success-600" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-error-100 rounded-full flex items-center justify-center">
                            <TrendingDown className="w-4 h-4 text-error-600" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {movement.description || 'Movimiento'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(movement.date).toLocaleDateString('es-ES')}
                        </div>
                      </div>
                    </div>
                    <div className={`text-lg font-semibold ${
                      movement.amount > 0 ? 'text-success-600' : 'text-error-600'
                    }`}>
                      {movement.amount > 0 ? '+' : ''}{formatEuro(movement.amount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              <p>No hay movimientos recientes para esta cuenta</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Import Modal
  if (showImport) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowImport(false)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Importar Cuenta</h2>
              <p className="text-sm text-gray-500">Añade una nueva cuenta manualmente o importa desde extracto</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Cuenta Manual</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alias de la cuenta (opcional)</label>
                <input
                  type="text"
                  value={newAccountForm.alias}
                  onChange={(e) => handleNewAccountChange('alias', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-navy focus:border-brand-navy"
                  placeholder="ej. Cuenta Corriente Principal"
                  disabled={isCreatingAccount}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banco *</label>
                <input
                  type="text"
                  value={newAccountForm.bank}
                  onChange={(e) => handleNewAccountChange('bank', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-navy focus:border-brand-navy"
                  placeholder="ej. Banco Santander"
                  disabled={isCreatingAccount}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IBAN *</label>
                <input
                  type="text"
                  value={newAccountForm.iban}
                  onChange={(e) => handleNewAccountChange('iban', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-navy focus:border-brand-navy"
                  placeholder="ES91 2100 0418 4502 0005 1332"
                  disabled={isCreatingAccount}
                />
              </div>
              
              {/* Usage/Uso field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Uso *</label>
                <select
                  value={newAccountForm.usage_scope}
                  onChange={(e) => handleNewAccountChange('usage_scope', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-navy focus:border-brand-navy"
                  disabled={isCreatingAccount}
                >
                  <option value="personal">Personal</option>
                  <option value="inmuebles">Inmuebles</option>
                  <option value="mixto">Mixto</option>
                </select>
              </div>

              {/* Logo upload field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo (opcional)</label>
                <div className="space-y-3">
                  {!newAccountForm.logoPreview ? (
                    <div className="flex items-center justify-center w-full">
                      <label htmlFor="logo-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 mb-2 text-gray-400" />
                          <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Click para subir</span> o arrastra aquí
                          </p>
                          <p className="text-xs text-gray-500">JPG, PNG (máx. 512KB)</p>
                        </div>
                        <input 
                          id="logo-upload" 
                          type="file" 
                          className="hidden" 
                          accept=".jpg,.jpeg,.png"
                          onChange={handleLogoChange}
                          disabled={isCreatingAccount}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="w-32 h-32 mx-auto border-2 border-gray-200 rounded-lg overflow-hidden">
                        <img 
                          src={newAccountForm.logoPreview} 
                          alt="Logo preview" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 bg-error-500 text-white rounded-full p-1 hover:bg-error-600"
                        disabled={isCreatingAccount}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Inicial</label>
                <input
                  type="text"
                  value={newAccountForm.openingBalance}
                  onChange={(e) => handleNewAccountChange('openingBalance', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-navy focus:border-brand-navy"
                  placeholder="1.234,56"
                  disabled={isCreatingAccount}
                />
                <p className="text-xs text-gray-500 mt-1">Formato europeo: 1.234,56</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Mínimo</label>
                <input
                  type="text"
                  value={newAccountForm.minimumBalance}
                  onChange={(e) => handleNewAccountChange('minimumBalance', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-navy focus:border-brand-navy"
                  placeholder="200,00"
                  disabled={isCreatingAccount}
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeInConsolidated"
                  checked={newAccountForm.includeInConsolidated}
                  onChange={(e) => handleNewAccountChange('includeInConsolidated', e.target.checked)}
                  className="h-4 w-4 text-brand-navy focus:ring-brand-navy border-gray-300 rounded"
                  disabled={isCreatingAccount}
                />
                <label htmlFor="includeInConsolidated" className="ml-2 block text-sm text-gray-700">
                  Incluir en consolidado
                </label>
              </div>
              <button 
                onClick={handleCreateAccount}
                disabled={isCreatingAccount}
                className="w-full bg-brand-navy text-white py-3 px-4 rounded-lg hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingAccount ? 'Creando...' : 'Crear Cuenta'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Importar desde Extracto</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">Arrastra tu extracto aquí</p>
              <p className="text-sm text-gray-500 mb-4">
                Formatos soportados: PDF, Excel (XLS, XLSX), CSV
              </p>
              <button className="bg-brand-navy text-white py-2 px-4 rounded-lg hover:bg-navy-800">
                Seleccionar Archivo
              </button>
            </div>
            <div className="mt-4 p-4 bg-primary-50 rounded-lg">
              <p className="text-sm text-primary-800">
                💡 <strong>Tip:</strong> El sistema detectará automáticamente el saldo inicial y los movimientos del extracto para configurar la cuenta.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Cuentas Bancarias</h2>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de cuentas, saldos y configuración bancaria
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              const currentUrl = new URL(window.location.href);
              currentUrl.hash = '#/configuracion/cuentas';
              window.location.href = currentUrl.toString();
              toast.success('Crea cuentas en Configuración para una gestión centralizada');
            }}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
          >
            <Settings className="w-4 h-4 mr-2" />
            Crear Cuenta
          </button>
          <button 
            onClick={() => {
              const currentUrl = new URL(window.location.href);
              currentUrl.hash = '#/configuracion/cuentas';
              window.location.href = currentUrl.toString();
              toast.success('Crea cuentas en Configuración para una gestión centralizada');
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-brand-navy hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-navy"
          >
            <Settings className="w-4 h-4 mr-2" />
            Ir a Configuración
          </button>
        </div>
      </div>

      {/* Unification Banner */}
      {showUnificationBanner && (
        <div className="mb-6 p-4 bg-primary-50 border border-primary-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">ℹ</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm text-primary-800">
                  <span className="font-medium">Hemos unificado 'Cuentas'.</span> Ahora se gestionan desde Tesorería con funciones mejoradas: filtros por uso, carga de logos y validación IBAN.
                </p>
              </div>
            </div>
            <button
              onClick={dismissUnificationBanner}
              className="flex-shrink-0 ml-4 text-blue-400 hover:text-primary-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Usage Filter */}
      <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filtrar por uso:</span>
        </div>
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'personal', label: 'Personal' },
            { key: 'inmuebles', label: 'Inmuebles' },
            { key: 'mixto', label: 'Mixto' }
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setUsageFilter(filter.key as typeof usageFilter)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                usageFilter === filter.key
                  ? 'bg-brand-navy text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        
        {/* FIX PACK v2.0: Status filter */}
        <div className="flex items-center gap-2 ml-4 border-l border-gray-300 pl-4">
          <span className="text-sm font-medium text-gray-700">Estado:</span>
        </div>
        <div className="flex gap-2">
          {[
            { key: 'active', label: 'Activas' },
            { key: 'all', label: 'Todas' }, 
            { key: 'inactive', label: 'Desactivadas' }
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setStatusFilter(filter.key as typeof statusFilter)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                statusFilter === filter.key
                  ? 'bg-brand-navy text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        
        <div className="ml-auto text-sm text-gray-500">
          {filteredAccounts.length} de {accounts.length} cuentas
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Banknote className="w-8 h-8 text-brand-teal" />
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Total Saldo</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatEuro(accounts.reduce((sum, acc) => sum + acc.balance, 0))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-brand-teal text-white flex items-center justify-center font-bold">
                {accounts.length}
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Cuentas Activas</div>
              <div className="text-2xl font-bold text-gray-900">{accounts.length}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">En Riesgo</div>
              <div className="text-2xl font-bold text-gray-900">
                {accounts.filter(acc => getAccountStatus(acc) !== 'healthy').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Detalle de Cuentas</h3>
          {accounts.length > 0 && (
            <button 
              onClick={() => setShowImport(true)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-brand-navy hover:bg-navy-800"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Cuenta
            </button>
          )}
        </div>
        
        {accounts.length === 0 ? (
          <div className="p-6 text-center">
            <Banknote className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay cuentas configuradas</h3>
            <p className="text-gray-500 mb-4">Agrega tu primera cuenta bancaria para comenzar.</p>
            <button 
              onClick={() => setShowImport(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-brand-navy hover:bg-navy-800"
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Cuenta
            </button>
          </div>
        ) : filteredAccounts.length === 0 ? (
          /* FIX PACK v2.0: Empty state for filters */
          <div className="p-6 text-center">
            <Filter className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {statusFilter === 'inactive' 
                ? 'No tienes cuentas desactivadas'
                : 'No se encontraron cuentas'
              }
            </h3>
            <p className="text-gray-500 mb-4">
              {statusFilter === 'inactive' 
                ? 'Todas tus cuentas están activas'
                : 'Ajusta los filtros para ver más cuentas'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredAccounts.map(account => {
              const status = getAccountStatus(account);
              const minimumBalance = account.minimumBalance || 200;
              
              return (
                <div 
                  key={account.id} 
                  className="p-6 hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setSelectedAccount(account);
                    loadAccountDetails(account);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {/* Logo or icon */}
                      <div className="flex-shrink-0">
                        {account.logo_url ? (
                          <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-gray-200">
                            <img 
                              src={getLogoFromStorage(account.id!) || account.logo_url} 
                              alt={`${account.bank} logo`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className={`p-3 rounded-lg border ${getStatusColor(status)}`}>
                            {getStatusIcon(status)}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-gray-900">{account.name || `${account.bank} - ${account.iban.slice(-4)}`}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${getUsageColor(account.usage_scope || 'mixto')}`}>
                            {getUsageLabel(account.usage_scope || 'mixto')}
                          </span>
                          {/* FIX PACK v2.0: Status badge */}
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            account.isActive 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {account.isActive ? 'Activa' : 'Desactivada'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {account.bank}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {renderIban(account)}
                        </div>
                        {/* FIX PACK v2.0: Show notice for inactive accounts */}
                        {!account.isActive && (
                          <div className="text-xs text-amber-600 mt-1 font-medium">
                            ⚠️ No se pueden crear nuevos movimientos en esta cuenta
                          </div>
                        )}
                        {account.minimumBalance && (
                          <div className="text-xs text-gray-400 mt-1">
                            Saldo mínimo: {formatEuro(minimumBalance)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900">
                          {formatEuro(account.balance)}
                        </div>
                        <div className={`text-sm px-2 py-1 rounded-full ${getStatusColor(status)}`}>
                          {status === 'healthy' ? 'Saludable' : 
                           status === 'warning' ? 'Atención' : 'Crítico'}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Ver proyección 30d →
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* FIX PACK v2.0: Activate/Deactivate toggle button */}
                        <button 
                          className={`p-2 rounded ${
                            account.isActive 
                              ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50' 
                              : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleAccountStatus(account);
                          }}
                          title={account.isActive ? "Desactivar cuenta" : "Activar cuenta"}
                        >
                          {account.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button 
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            const currentUrl = new URL(window.location.href);
                            currentUrl.hash = '#/configuracion/cuentas';
                            window.location.href = currentUrl.toString();
                            toast.success('Edita cuentas en Configuración para una gestión centralizada');
                          }}
                          title="Editar cuenta en Configuración"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-2 text-gray-400 hover:text-error-600 hover:bg-error-50 rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteAccount(account);
                          }}
                          title="Eliminar cuenta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {confirmDeleteAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-error-100 rounded-full flex items-center justify-center mr-3">
                <AlertTriangle className="w-5 h-5 text-error-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Eliminar Cuenta</h3>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                ¿Estás seguro de que quieres eliminar la cuenta <strong>{confirmDeleteAccount.name || `${confirmDeleteAccount.bank} - ${confirmDeleteAccount.iban.slice(-4)}`}</strong>?
              </p>
              <p className="text-xs text-gray-500">
                Si la cuenta tiene movimientos, se abrirá un asistente para reasignar o archivar los datos antes de eliminarla completamente.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                className="flex-1 bg-error-600 text-white py-2 px-4 rounded-lg hover:bg-error-700 transition-colors"
              >
                Eliminar
              </button>
              <button
                onClick={() => setConfirmDeleteAccount(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CuentasPanel;