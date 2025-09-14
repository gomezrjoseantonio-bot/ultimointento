import React, { useState, useEffect } from 'react';
import { Settings, AlertTriangle, Clock, ArrowRight, Plus, Edit2, Trash2, X, ToggleLeft, ToggleRight, Activity } from 'lucide-react';
import { initDB, Account } from '../../../../services/db';
import { formatEuro } from '../../../../services/aeatClassificationService';
import toast from 'react-hot-toast';

interface AutomationRule {
  id?: number;
  name: string;
  type: 'minimum_balance' | 'expected_income' | 'sweep';
  accountId?: number;
  threshold?: number;
  targetAccountId?: number;
  expectedAmount?: number;
  expectedDate?: string;
  isActive: boolean;
  createdAt: string;
}

interface AutomationLog {
  id?: number;
  ruleId: number;
  ruleName: string;
  triggerDate: string;
  action: string;
  result: 'success' | 'warning' | 'error';
  message: string;
}

const AutomatizacionesPanel: React.FC = () => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules');
  const [newRule, setNewRule] = useState<Partial<AutomationRule>>({
    name: '',
    type: 'minimum_balance',
    isActive: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const db = await initDB();
      
      // Load accounts
      const allAccounts = await db.getAll('accounts');
      const horizonAccounts = allAccounts.filter(acc => acc.destination === 'horizon');
      setAccounts(horizonAccounts);
      
      // Load rules (simulate with localStorage for now)
      const savedRules = localStorage.getItem('automationRules');
      if (savedRules) {
        setRules(JSON.parse(savedRules));
      }
      
      // Load logs (simulate with localStorage for now)
      const savedLogs = localStorage.getItem('automationLogs');
      if (savedLogs) {
        setLogs(JSON.parse(savedLogs));
      }
    } catch (error) {
      console.error('Error loading automation data:', error);
    }
  };

  const saveRule = async () => {
    try {
      if (!newRule.name || !newRule.type) {
        toast.error('Por favor, completa todos los campos obligatorios');
        return;
      }

      const rule: AutomationRule = {
        id: editingRule?.id || Date.now(),
        name: newRule.name!,
        type: newRule.type!,
        accountId: newRule.accountId,
        threshold: newRule.threshold,
        targetAccountId: newRule.targetAccountId,
        expectedAmount: newRule.expectedAmount,
        expectedDate: newRule.expectedDate,
        isActive: newRule.isActive ?? true,
        createdAt: editingRule?.createdAt || new Date().toISOString()
      };

      let updatedRules;
      if (editingRule) {
        updatedRules = rules.map(r => r.id === editingRule.id ? rule : r);
      } else {
        updatedRules = [...rules, rule];
      }

      setRules(updatedRules);
      localStorage.setItem('automationRules', JSON.stringify(updatedRules));
      
      toast.success(editingRule ? 'Regla actualizada' : 'Regla creada exitosamente');
      closeModal();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error('Error al guardar la regla');
    }
  };

  const deleteRule = async (ruleId: number) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta regla?')) return;
    
    const updatedRules = rules.filter(r => r.id !== ruleId);
    setRules(updatedRules);
    localStorage.setItem('automationRules', JSON.stringify(updatedRules));
    toast.success('Regla eliminada');
  };

  const toggleRuleStatus = async (ruleId: number) => {
    const updatedRules = rules.map(r => 
      r.id === ruleId ? { ...r, isActive: !r.isActive } : r
    );
    setRules(updatedRules);
    localStorage.setItem('automationRules', JSON.stringify(updatedRules));
    
    const rule = updatedRules.find(r => r.id === ruleId);
    toast.success(`Regla ${rule?.isActive ? 'activada' : 'desactivada'}`);
  };

  const simulateRuleExecution = (rule: AutomationRule) => {
    const log: AutomationLog = {
      id: Date.now(),
      ruleId: rule.id!,
      ruleName: rule.name,
      triggerDate: new Date().toISOString(),
      action: getActionDescription(rule),
      result: 'success',
      message: `Regla ejecutada exitosamente`
    };

    const updatedLogs = [log, ...logs].slice(0, 50); // Keep last 50 logs
    setLogs(updatedLogs);
    localStorage.setItem('automationLogs', JSON.stringify(updatedLogs));
    
    toast.success('Regla ejecutada (simulación)');
  };

  const getActionDescription = (rule: AutomationRule): string => {
    switch (rule.type) {
      case 'minimum_balance':
        return `Verificar saldo mínimo de ${formatEuro(rule.threshold || 0)}`;
      case 'expected_income':
        return `Verificar ingreso esperado de ${formatEuro(rule.expectedAmount || 0)}`;
      case 'sweep':
        return `Transferir exceso de ${formatEuro(rule.threshold || 0)} a cuenta destino`;
      default:
        return 'Acción desconocida';
    }
  };

  const getRuleTypeLabel = (type: string): string => {
    switch (type) {
      case 'minimum_balance':
        return 'Saldo Mínimo';
      case 'expected_income':
        return 'Ingreso Esperado';
      case 'sweep':
        return 'Sweep Automático';
      default:
        return type;
    }
  };

  const getAccountName = (accountId?: number): string => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? `${account.name} - ${account.iban?.slice(-4)}` : 'Cuenta no encontrada';
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingRule(null);
    setNewRule({
      name: '',
      type: 'minimum_balance',
      isActive: true
    });
  };

  const openEditModal = (rule: AutomationRule) => {
    setEditingRule(rule);
    setNewRule(rule);
    setShowCreateModal(true);
  };

  const getRuleTypeIcon = (type: string) => {
    switch (type) {
      case 'minimum_balance':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'expected_income':
        return <Clock className="w-5 h-5 text-primary-500" />;
      case 'sweep':
        return <ArrowRight className="w-5 h-5 text-success-500" />;
      default:
        return <Settings className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Automatizaciones</h2>
          <p className="text-sm text-gray-500 mt-1">
            Reglas automáticas de alertas y transferencias bancarias
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Regla
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('rules')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'rules'
                ? 'border-brand-navy text-brand-navy'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Reglas ({rules.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'logs'
                ? 'border-brand-navy text-brand-navy'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Logs ({logs.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'rules' ? (
        <div className="space-y-4">
          {rules.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay reglas configuradas
              </h3>
              <p className="text-gray-500 mb-6">
                Crea tu primera regla de automatización para gestionar alertas y transferencias.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 transition-colors"
              >
                Crear Primera Regla
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {rules.map((rule) => (
                <div key={rule.id} className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getRuleTypeIcon(rule.type)}
                      <div>
                        <h3 className="font-medium text-gray-900">{rule.name}</h3>
                        <p className="text-sm text-gray-500">{getRuleTypeLabel(rule.type)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleRuleStatus(rule.id!)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {rule.isActive ? (
                          <ToggleRight className="w-6 h-6 text-success-500" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-gray-400" />
                        )}
                      </button>
                      
                      <button
                        onClick={() => simulateRuleExecution(rule)}
                        disabled={!rule.isActive}
                        className="px-3 py-1 text-sm bg-brand-teal text-white rounded hover:bg-brand-teal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Ejecutar
                      </button>
                      
                      <button
                        onClick={() => openEditModal(rule)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => deleteRule(rule.id!)}
                        className="text-gray-400 hover:text-error-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-4 text-sm text-gray-600">
                    {rule.type === 'minimum_balance' && (
                      <p>
                        Cuenta: {getAccountName(rule.accountId)} · 
                        Saldo mínimo: {formatEuro(rule.threshold || 0)}
                      </p>
                    )}
                    {rule.type === 'expected_income' && (
                      <p>
                        Cuenta: {getAccountName(rule.accountId)} · 
                        Importe: {formatEuro(rule.expectedAmount || 0)} · 
                        Fecha: {rule.expectedDate}
                      </p>
                    )}
                    {rule.type === 'sweep' && (
                      <p>
                        De: {getAccountName(rule.accountId)} · 
                        A: {getAccountName(rule.targetAccountId)} · 
                        Si saldo &gt; {formatEuro(rule.threshold || 0)}
                      </p>
                    )}
                  </div>
                  
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    <span>Creada: {new Date(rule.createdAt).toLocaleDateString('es-ES')}</span>
                    <span className={`px-2 py-1 rounded-full ${
                      rule.isActive ? 'bg-success-100 text-success-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {rule.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {logs.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay logs disponibles
              </h3>
              <p className="text-gray-500">
                Los logs de ejecución aparecerán aquí cuando las reglas se ejecuten.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Regla
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acción
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mensaje
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(log.triggerDate).toLocaleString('es-ES')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.ruleName}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {log.action}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            log.result === 'success' ? 'bg-success-100 text-success-800' :
                            log.result === 'warning' ? 'bg-warning-100 text-yellow-800' :
                            'bg-error-100 text-error-800'
                          }`}>
                            {log.result === 'success' ? 'Éxito' :
                             log.result === 'warning' ? 'Advertencia' : 'Error'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {log.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Rule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingRule ? 'Editar Regla' : 'Nueva Regla de Automatización'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la regla *
                </label>
                <input
                  type="text"
                  value={newRule.name || ''}
                  onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ej. Alerta saldo mínimo cuenta principal"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de regla *
                </label>
                <select
                  value={newRule.type || 'minimum_balance'}
                  onChange={(e) => setNewRule(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                >
                  <option value="minimum_balance">Saldo Mínimo</option>
                  <option value="expected_income">Ingreso Esperado</option>
                  <option value="sweep">Sweep Automático</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cuenta {newRule.type === 'sweep' ? 'origen' : ''} *
                </label>
                <select
                  value={newRule.accountId || ''}
                  onChange={(e) => setNewRule(prev => ({ ...prev, accountId: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                >
                  <option value="">Seleccionar cuenta</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} - {account.iban?.slice(-4)}
                    </option>
                  ))}
                </select>
              </div>
              
              {(newRule.type === 'minimum_balance' || newRule.type === 'sweep') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {newRule.type === 'minimum_balance' ? 'Saldo mínimo (€) *' : 'Umbral para transfer (€) *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newRule.threshold || ''}
                    onChange={(e) => setNewRule(prev => ({ ...prev, threshold: parseFloat(e.target.value) }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                  />
                </div>
              )}
              
              {newRule.type === 'expected_income' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Importe esperado (€) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newRule.expectedAmount || ''}
                      onChange={(e) => setNewRule(prev => ({ ...prev, expectedAmount: parseFloat(e.target.value) }))}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha esperada *
                    </label>
                    <input
                      type="date"
                      value={newRule.expectedDate || ''}
                      onChange={(e) => setNewRule(prev => ({ ...prev, expectedDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                    />
                  </div>
                </>
              )}
              
              {newRule.type === 'sweep' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cuenta destino *
                  </label>
                  <select
                    value={newRule.targetAccountId || ''}
                    onChange={(e) => setNewRule(prev => ({ ...prev, targetAccountId: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                  >
                    <option value="">Seleccionar cuenta destino</option>
                    {accounts.filter(acc => acc.id !== newRule.accountId).map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} - {account.iban?.slice(-4)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={newRule.isActive ?? true}
                  onChange={(e) => setNewRule(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Activar regla inmediatamente
                </label>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveRule}
                className="flex-1 px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 transition-colors"
              >
                {editingRule ? 'Actualizar' : 'Crear'} Regla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomatizacionesPanel;