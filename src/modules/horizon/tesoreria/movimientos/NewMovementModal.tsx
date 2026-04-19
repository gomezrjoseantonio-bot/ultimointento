import React, { useEffect, useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { Account, MovementType, MovementState, Property, TreasuryEvent } from '../../../../services/db';
import { showSuccess, showError } from '../../../../services/toastService';
import { trackMovementCreation } from '../../../../utils/treasuryAnalytics';
import { useFocusTrap } from '../../../../hooks/useFocusTrap';

interface NewMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onMovementCreated: (newMovement?: any) => void; // Allow optimistic update
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
  // PR3: ámbito del movimiento (Personal / Inmueble)
  ambito: 'PERSONAL' | 'INMUEBLE';
  inmuebleId: string;
  categoryLabel: string;
}

const INMUEBLE_CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Reparación inmueble', label: 'Reparación' },
  { value: 'Mejora inmueble', label: 'Mejora' },
  { value: 'Mobiliario inmueble', label: 'Mobiliario' },
  { value: 'Comunidad', label: 'Comunidad' },
  { value: 'Seguro inmueble', label: 'Seguro' },
  { value: 'IBI', label: 'IBI / tributos' },
  { value: 'Suministros', label: 'Suministros' },
  { value: 'Gasto recurrente', label: 'Gasto recurrente (otros)' },
];

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
    transferToAccountId: '',
    ambito: 'PERSONAL',
    inmuebleId: '',
    categoryLabel: '',
  });

  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const containerRef = useFocusTrap(isOpen);

  // PR3: cargar inmuebles activos para el selector
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const { initDB } = await import('../../../../services/db');
        const db = await initDB();
        const all = (await db.getAll('properties')) as Property[];
        if (!cancelled) {
          setProperties(
            all.filter((p) => p.state !== 'vendido' && (p as any).id != null),
          );
        }
      } catch (err) {
        console.warn('[NewMovementModal] error cargando inmuebles:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

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
    // PR3: si ámbito inmueble, validar inmueble + categoría
    if (form.type !== 'Transferencia' && form.ambito === 'INMUEBLE') {
      if (!form.inmuebleId) return 'Selecciona un inmueble';
      if (!form.categoryLabel) return 'Selecciona una categoría de inmueble';
    }

    return null;
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
      transferToAccountId: '',
      ambito: 'PERSONAL',
      inmuebleId: '',
      categoryLabel: '',
    });
    setSaving(false);
    onClose();
  };

  const handleSave = async () => {
    const error = validateForm();
    if (error) {
      showError(error);
      return;
    }

    setSaving(true);

    try {
      // PR3: todo nace como treasuryEvent predicted. El movement real se
      // crea sólo al puntear (ver treasuryConfirmationService). Así la
      // creación desde Tesorería sigue el mismo flujo que Gestión Inmuebles.
      const { initDB } = await import('../../../../services/db');
      const db = await initDB();

      const amount = parseFloat(form.amount);
      const now = new Date().toISOString();

      if (form.type === 'Transferencia') {
        // Transferencias: dos events predicted (uno por cada pata).
        const sourceAccountName = accounts.find(a => a.id?.toString() === form.accountId)?.name || 'cuenta';
        const targetAccountName = accounts.find(a => a.id?.toString() === form.transferToAccountId)?.name || 'cuenta';
        const transferDescription = form.description.trim();

        const fromEvent: Omit<TreasuryEvent, 'id'> = {
          type: 'expense',
          amount: Math.abs(amount),
          predictedDate: form.date,
          description: transferDescription || `Transferencia a ${targetAccountName}`,
          sourceType: 'manual',
          accountId: Number(form.accountId),
          status: 'predicted',
          counterparty: form.counterparty || 'Transferencia interna',
          createdAt: now,
          updatedAt: now,
        };
        const toEvent: Omit<TreasuryEvent, 'id'> = {
          type: 'income',
          amount: Math.abs(amount),
          predictedDate: form.date,
          description: transferDescription || `Transferencia desde ${sourceAccountName}`,
          sourceType: 'manual',
          accountId: Number(form.transferToAccountId),
          status: 'predicted',
          counterparty: form.counterparty || 'Transferencia interna',
          createdAt: now,
          updatedAt: now,
        };
        await db.add('treasuryEvents', fromEvent as any);
        await db.add('treasuryEvents', toEvent as any);

        trackMovementCreation('manual', 2, {
          type: 'transfer',
          amount: Math.abs(amount),
          accountFrom: form.accountId,
          accountTo: form.transferToAccountId,
        });

        showSuccess(
          `Transferencia prevista de ${Math.abs(amount).toFixed(2)}€ creada. Confírmala en Conciliación.`,
          {
            actionLabel: 'Ver movimientos',
            actionHandler: () => {
              console.log('Navigate to conciliacion with pending filter');
            },
          },
        );

        onMovementCreated();
        handleClose();
      } else {
        // Gasto/Ingreso/Ajuste → treasuryEvent predicted.
        const eventType: 'income' | 'expense' =
          form.type === 'Ingreso' || amount >= 0 ? 'income' : 'expense';

        const isInmueble = form.ambito === 'INMUEBLE';
        const event: Omit<TreasuryEvent, 'id'> = {
          type: eventType,
          amount: Math.abs(amount),
          predictedDate: form.date,
          description: form.description,
          sourceType: 'manual',
          accountId: Number(form.accountId),
          status: 'predicted',
          counterparty: form.counterparty || undefined,
          ambito: isInmueble ? 'INMUEBLE' : 'PERSONAL',
          inmuebleId: isInmueble ? Number(form.inmuebleId) : undefined,
          categoryLabel: isInmueble ? form.categoryLabel : form.category || undefined,
          createdAt: now,
          updatedAt: now,
        };

        await db.add('treasuryEvents', event as any);

        trackMovementCreation('manual', 1, {
          type: form.type.toLowerCase(),
          amount: Math.abs(amount),
          category: form.category,
          hasCounterparty: !!form.counterparty,
        });

        showSuccess(
          `${form.type} de ${Math.abs(amount).toFixed(2)}€ añadido como previsto. Confírmalo desde Conciliación.`,
        );

        onMovementCreated();
        handleClose();
      }
    } catch (error) {
      console.error('Error creating treasury event:', error);
      showError('Error al crear el movimiento', 'Revisa los datos e inténtalo de nuevo');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-200 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="new-movement-title">
      <div ref={containerRef} className="bg-white rounded-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 id="new-movement-title" className="text-lg font-semibold text-hz-text">Nuevo movimiento</h3>
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

            {/* PR3: Ámbito Personal / Inmueble */}
            {form.type !== 'Transferencia' && (
              <div>
                <label className="block text-sm font-medium text-hz-text mb-2">
                  Ámbito *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['PERSONAL', 'INMUEBLE'] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setForm((prev) => ({
                        ...prev,
                        ambito: val,
                        inmuebleId: val === 'INMUEBLE' ? prev.inmuebleId : '',
                        categoryLabel: val === 'INMUEBLE' ? prev.categoryLabel : '',
                      }))}
                      className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                        form.ambito === val
                          ? 'bg-hz-primary-dark text-white border-hz-primary-dark'
                          : 'border-hz-neutral-300 text-hz-text hover:border-hz-primary'
                      }`}
                    >
                      {val === 'PERSONAL' ? 'Personal' : 'Inmueble'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.type !== 'Transferencia' && form.ambito === 'INMUEBLE' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-hz-text mb-1">
                    Inmueble *
                  </label>
                  <select
                    value={form.inmuebleId}
                    onChange={(e) => handleInputChange('inmuebleId', e.target.value)}
                    className="w-full border border-hz-neutral-300 rounded-lg px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Seleccionar inmueble…</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.alias}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-hz-text mb-1">
                    Categoría de inmueble *
                  </label>
                  <select
                    value={form.categoryLabel}
                    onChange={(e) => handleInputChange('categoryLabel', e.target.value)}
                    className="w-full border border-hz-neutral-300 rounded-lg px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Seleccionar categoría…</option>
                    {INMUEBLE_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

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
                Contraparte
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
              className="flex items-center gap-2 px-4 py-2 bg-hz-primary- light text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
