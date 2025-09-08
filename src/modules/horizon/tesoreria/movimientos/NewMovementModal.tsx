import React, { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { Account, MovementType, MovementState } from '../../../../services/db';
import { showSuccess, showError } from '../../../../services/toastService';
import { trackMovementCreation } from '../../../../utils/treasuryAnalytics';

interface NewMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onMovementCreated: () => void;
}

interface NewMovementForm {
  date: string;
  accountId: string;
  amount: string;
  type: MovementType;
  description: string;
  category: string;
  counterparty: string;
  state: MovementState;
  // Transfer specific fields
  transferToAccountId: string;
}

const CATEGORIES = [
  'Suministros › Luz',
  'Suministros › Agua', 
  'Suministros › Gas',
  'Suministros › Internet',
  'Seguros › Hogar',
  'Seguros › Vida',
  'Seguros › Responsabilidad Civil',
  'Nómina › Salario',
  'Nómina › Bonus',
  'Alquiler › Ingresos',
  'Mantenimiento › Reparaciones',
  'Mantenimiento › Limpieza',
  'Tributos › IBI',
  'Tributos › Comunidad',
  'Otros'
];

const NewMovementModal: React.FC<NewMovementModalProps> = ({ 
  isOpen, 
  onClose, 
  accounts, 
  onMovementCreated 
}) => {
  const [form, setForm] = useState<NewMovementForm>({
    date: new Date().toISOString().split('T')[0],
    accountId: '',
    amount: '',
    type: 'Gasto',
    description: '',
    category: '',
    counterparty: '',
    state: 'Previsto',
    transferToAccountId: ''
  });

  const [saving, setSaving] = useState(false);

  const handleInputChange = (field: keyof NewMovementForm, value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-update type based on amount for non-transfer movements
    if (field === 'amount' && form.type !== 'Transferencia') {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        setForm(prev => ({
          ...prev,
          type: numValue >= 0 ? 'Ingreso' : 'Gasto'
        }));
      }
    }
  };

  const handleTypeChange = (newType: MovementType) => {
    setForm(prev => ({
      ...prev,
      type: newType,
      // Reset transfer fields if not transfer
      transferToAccountId: newType === 'Transferencia' ? prev.transferToAccountId : ''
    }));
  };

  const toggleAmountSign = () => {
    const currentValue = parseFloat(form.amount);
    if (!isNaN(currentValue)) {
      setForm(prev => ({
        ...prev,
        amount: (-currentValue).toString()
      }));
    }
  };

  const validateForm = (): string | null => {
    if (!form.accountId) return 'Selecciona una cuenta';
    if (!form.amount || isNaN(parseFloat(form.amount))) return 'Introduce un importe válido';
    if (!form.description.trim()) return 'Introduce una descripción';
    if (form.type === 'Transferencia' && !form.transferToAccountId) return 'Selecciona la cuenta de destino';
    if (form.type === 'Transferencia' && form.accountId === form.transferToAccountId) return 'Las cuentas de origen y destino deben ser diferentes';
    
    return null;
  };

  const handleSave = async () => {
    const error = validateForm();
    if (error) {
      showError(error);
      return;
    }

    setSaving(true);
    
    try {
      // FIX PACK v1.0: Implement actual movement creation with optimistic insertion
      const { initDB } = await import('../../../../services/db');
      const db = await initDB();
      
      const amount = parseFloat(form.amount);
      const now = new Date().toISOString();
      
      if (form.type === 'Transferencia') {
        // Create two linked movements for transfers
        const transferGroupId = `transfer_${Date.now()}`;
        
        // Movement from source account (negative)
        const fromMovement = {
          accountId: Number(form.accountId),
          date: form.date,
          amount: -Math.abs(amount), // Always negative for outgoing
          description: `Transferencia a ${accounts.find(a => a.id?.toString() === form.transferToAccountId)?.name || 'cuenta'}`,
          counterparty: form.counterparty || 'Transferencia interna',
          type: 'Transferencia' as 'Transferencia',
          category: 'Transferencias',
          origin: 'Manual' as 'Manual',
          movementState: form.state,
          transferGroupId,
          tags: ['transferencia'],
          isAutoTagged: true,
          createdAt: now,
          updatedAt: now,
          status: 'pendiente' as 'pendiente'
        };
        
        // Movement to destination account (positive)
        const toMovement = {
          accountId: Number(form.transferToAccountId),
          date: form.date,
          amount: Math.abs(amount), // Always positive for incoming
          description: `Transferencia desde ${accounts.find(a => a.id?.toString() === form.accountId)?.name || 'cuenta'}`,
          counterparty: form.counterparty || 'Transferencia interna',
          type: 'Transferencia' as 'Transferencia',
          category: 'Transferencias',
          origin: 'Manual' as 'Manual',
          movementState: form.state,
          transferGroupId,
          tags: ['transferencia'],
          isAutoTagged: true,
          createdAt: now,
          updatedAt: now,
          status: 'pendiente' as 'pendiente'
        };
        
        // Save both movements
        await db.add('movements', fromMovement);
        await db.add('movements', toMovement);
        
        // Track analytics
        trackMovementCreation('manual', 2, { 
          type: 'transfer',
          amount: Math.abs(amount),
          accountFrom: form.accountId,
          accountTo: form.transferToAccountId
        });
        
        showSuccess(`Transferencia de ${Math.abs(amount).toFixed(2)}€ creada correctamente`, {
          actionLabel: 'Ver movimientos',
          actionHandler: () => {
            console.log('Navigate to movements with transfer filter');
          }
        });
        
      } else {
        // Create single movement
        const movement = {
          accountId: Number(form.accountId),
          date: form.date,
          amount: amount,
          description: form.description,
          counterparty: form.counterparty || undefined,
          type: form.type,
          category: form.category || undefined,
          origin: 'Manual' as 'Manual',
          movementState: form.state,
          tags: form.category ? [form.category.split(' › ')[0]] : [],
          isAutoTagged: !!form.category,
          createdAt: now,
          updatedAt: now,
          status: 'pendiente' as 'pendiente'
        };
        
        await db.add('movements', movement);
        
        // Track analytics
        trackMovementCreation('manual', 1, { 
          type: form.type.toLowerCase(),
          amount: Math.abs(amount),
          category: form.category,
          hasCounterparty: !!form.counterparty
        });
        
        showSuccess(`${form.type} de ${Math.abs(amount).toFixed(2)}€ ${form.type === 'Ingreso' ? 'registrado' : 'creado'} correctamente`, {
          actionLabel: 'Ver movimiento',
          actionHandler: () => {
            console.log('Navigate to specific movement');
          }
        });
      }
      
      // FIX PACK v1.0: Optimistic insertion - trigger immediate reload
      onMovementCreated();
      handleClose();
      
    } catch (error) {
      console.error('Error creating movement:', error);
      showError('Error al crear el movimiento', 'Revisa los datos e inténtalo de nuevo');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setForm({
      date: new Date().toISOString().split('T')[0],
      accountId: '',
      amount: '',
      type: 'Gasto',
      description: '',
      category: '',
      counterparty: '',
      state: 'Previsto',
      transferToAccountId: ''
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-hz-text">Nuevo movimiento</h3>
            <button
              onClick={handleClose}
              className="text-hz-neutral-500 hover:text-hz-text"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-hz-text mb-1">
                Fecha valor *
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="w-full border border-hz-neutral-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>

            {/* Account */}
            <div>
              <label className="block text-sm font-medium text-hz-text mb-1">
                Cuenta {form.type === 'Transferencia' ? 'origen' : ''} *
              </label>
              <select
                value={form.accountId}
                onChange={(e) => handleInputChange('accountId', e.target.value)}
                className="w-full border border-hz-neutral-300 rounded-lg px-3 py-2 text-sm"
                required
              >
                <option value="">Seleccionar cuenta...</option>
                {accounts.map(account => (
                  <option 
                    key={account.id} 
                    value={account.id}
                    disabled={!account.isActive}
                    title={!account.isActive ? "No disponible: cuenta desactivada" : ""}
                  >
                    {account.name} ({account.bank}){!account.isActive ? ' - Desactivada' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-hz-text mb-2">
                Tipo *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['Ingreso', 'Gasto', 'Transferencia', 'Ajuste'] as MovementType[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeChange(type)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      form.type === type
                        ? 'bg-hz-primary-dark text-white border-hz-primary-dark'
                        : 'border-hz-neutral-300 text-hz-text hover:border-hz-primary'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Transfer destination account */}
            {form.type === 'Transferencia' && (
              <div>
                <label className="block text-sm font-medium text-hz-text mb-1">
                  Cuenta destino *
                </label>
                <select
                  value={form.transferToAccountId}
                  onChange={(e) => handleInputChange('transferToAccountId', e.target.value)}
                  className="w-full border border-hz-neutral-300 rounded-lg px-3 py-2 text-sm"
                  required
                >
                  <option value="">Seleccionar cuenta destino...</option>
                  {accounts
                    .filter(account => account.id?.toString() !== form.accountId)
                    .map(account => (
                      <option 
                        key={account.id} 
                        value={account.id}
                        disabled={!account.isActive}
                        title={!account.isActive ? "No disponible: cuenta desactivada" : ""}
                      >
                        {account.name} ({account.bank}){!account.isActive ? ' - Desactivada' : ''}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-hz-text mb-1">
                Importe * {form.type === 'Transferencia' && '(cantidad a transferir)'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                  className="flex-1 border border-hz-neutral-300 rounded-lg px-3 py-2 text-sm"
                  required
                />
                {form.type !== 'Transferencia' && (
                  <button
                    type="button"
                    onClick={toggleAmountSign}
                    className="p-2 border border-hz-neutral-300 rounded-lg hover:bg-hz-neutral-50"
                    title="Cambiar signo"
                  >
                    {parseFloat(form.amount) >= 0 ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                  </button>
                )}
              </div>
              {form.type !== 'Transferencia' && (
                <p className="text-xs text-hz-neutral-500 mt-1">
                  {parseFloat(form.amount) >= 0 ? 'Ingreso (+)' : 'Gasto (-)'}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-hz-text mb-1">
                Descripción *
              </label>
              <input
                type="text"
                placeholder="Descripción del movimiento"
                value={form.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full border border-hz-neutral-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-hz-text mb-1">
                Categoría
              </label>
              <select
                value={form.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="w-full border border-hz-neutral-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Sin categoría</option>
                {CATEGORIES.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* Counterparty */}
            <div>
              <label className="block text-sm font-medium text-hz-text mb-1">
                Contrapartida
              </label>
              <input
                type="text"
                placeholder="Nombre de la entidad o persona"
                value={form.counterparty}
                onChange={(e) => handleInputChange('counterparty', e.target.value)}
                className="w-full border border-hz-neutral-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* State */}
            <div>
              <label className="block text-sm font-medium text-hz-text mb-1">
                Estado inicial
              </label>
              <select
                value={form.state}
                onChange={(e) => handleInputChange('state', e.target.value as MovementState)}
                className="w-full border border-hz-neutral-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="Previsto">Previsto</option>
                <option value="Confirmado">Confirmado</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-hz-neutral-300 text-hz-text rounded-lg hover:bg-hz-neutral-50 transition-colors"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-hz-primary-dark text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewMovementModal;