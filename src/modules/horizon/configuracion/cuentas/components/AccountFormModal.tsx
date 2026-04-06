import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { cuentasService, CreateAccountData, UpdateAccountData } from '../../../../../services/cuentasService';
import { Account } from '../../../../../services/db';
import {
  formatIban,
  maskIban,
  validateIbanEs,
} from '../../../../../utils/accountHelpers';

interface AccountFormData {
  alias: string;
  iban: string;
  tipo: 'CORRIENTE' | 'AHORRO' | 'OTRA' | 'TARJETA_CREDITO';
  cardSettlementDay: string;
  cardChargeAccountId: string;
  logoFile: File | null;
  openingBalance: string;
  openingBalanceDate: string;
}

interface AccountFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingAccount?: Account | null;
}

const defaultFormData = (): AccountFormData => ({
  alias: '',
  iban: '',
  tipo: 'CORRIENTE',
  cardSettlementDay: '1',
  cardChargeAccountId: '',
  logoFile: null,
  openingBalance: '',
  openingBalanceDate: new Date().toISOString().split('T')[0],
});

const AccountFormModal: React.FC<AccountFormModalProps> = ({
  open,
  onClose,
  onSuccess,
  editingAccount,
}) => {
  const [formData, setFormData] = useState<AccountFormData>(defaultFormData());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load accounts for TARJETA_CREDITO charge account selector
  useEffect(() => {
    cuentasService.list().then(setAccounts).catch((err) => {
      console.error('Error loading accounts for modal:', err);
    });
  }, [open]);

  // Populate form when editing an account
  useEffect(() => {
    if (open) {
      if (editingAccount) {
        setFormData({
          alias: editingAccount.alias || '',
          iban: editingAccount.tipo === 'TARJETA_CREDITO' ? '' : formatIban(editingAccount.iban),
          tipo: editingAccount.tipo || 'CORRIENTE',
          cardSettlementDay: editingAccount.cardConfig?.settlementDay?.toString() || '1',
          cardChargeAccountId: editingAccount.cardConfig?.chargeAccountId?.toString() || '',
          logoFile: null,
          openingBalance: editingAccount.openingBalance?.toString() ?? '',
          openingBalanceDate: editingAccount.openingBalanceDate
            ? editingAccount.openingBalanceDate.split('T')[0]
            : new Date().toISOString().split('T')[0],
        });
      } else {
        setFormData(defaultFormData());
      }
      setFormErrors({});
    }
  }, [open, editingAccount]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const uploadLogoFile = async (file: File): Promise<string> => {
    if (!file.type.startsWith('image/')) throw new Error('Solo se permiten archivos de imagen');
    if (file.size > 2 * 1024 * 1024) throw new Error('El archivo no puede superar 2MB');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsDataURL(file);
    });
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({ ...prev, logoFile: file }));
    setFormErrors((prev) => { const n = { ...prev }; delete n.logoFile; return n; });
  };

  const getLogoPreviewUrl = (file: File) => URL.createObjectURL(file);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (formData.tipo !== 'TARJETA_CREDITO') {
      if (!formData.iban.trim()) {
        errors.iban = 'El IBAN es obligatorio';
      } else {
        const ibanValidation = validateIbanEs(formData.iban);
        if (!ibanValidation.ok) errors.iban = ibanValidation.message || 'IBAN inválido';
      }
    }

    if (formData.tipo === 'TARJETA_CREDITO') {
      const day = parseInt(formData.cardSettlementDay || '0', 10);
      if (!day || day < 1 || day > 31) errors.cardSettlementDay = 'Indica un día de cargo entre 1 y 31';
      if (!formData.cardChargeAccountId) errors.cardChargeAccountId = 'Selecciona la cuenta bancaria de cargo del recibo';
    }

    if (formData.alias.trim() && formData.alias.trim().length > 40) {
      errors.alias = 'El alias no puede superar 40 caracteres';
    }

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
    if (!validateForm()) return;

    setSaving(true);
    try {
      let logoUser: string | undefined;

      if (formData.logoFile) {
        try {
          setUploadingLogo(true);
          logoUser = await uploadLogoFile(formData.logoFile);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Error al subir el logo. Se guardará la cuenta sin logo personalizado.');
        } finally {
          setUploadingLogo(false);
        }
      }

      const accountData: CreateAccountData | UpdateAccountData = {
        alias: formData.alias.trim() || undefined,
        iban: formData.tipo === 'TARJETA_CREDITO' ? undefined : formData.iban,
        tipo: formData.tipo,
        cardConfig: formData.tipo === 'TARJETA_CREDITO'
          ? {
              settlementDay: parseInt(formData.cardSettlementDay || '1', 10),
              chargeAccountId: parseInt(formData.cardChargeAccountId, 10),
            }
          : undefined,
        logoUser,
        openingBalance: parseFloat(formData.openingBalance || '0') || 0,
        openingBalanceDate: formData.openingBalanceDate
          ? new Date(formData.openingBalanceDate).toISOString()
          : undefined,
      };

      if (editingAccount) {
        await cuentasService.update(editingAccount.id!, accountData as UpdateAccountData);
        toast.success('Cuenta actualizada correctamente');
      } else {
        await cuentasService.create(accountData as CreateAccountData);
        toast.success('Cuenta creada correctamente');
      }

      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('Error saving account:', error);
      toast.error(error instanceof Error ? error.message : 'Error al guardar la cuenta');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50"
      style={{ backgroundColor: 'var(--bg)', opacity: 0.95 }}
    >
      <div className="bg-white p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-atlas-navy-1">
            {editingAccount ? 'Editar cuenta' : 'Nueva cuenta bancaria'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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
              {formErrors.alias && <p className="mt-1 text-sm text-error-600">{formErrors.alias}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-atlas-navy-1 mb-1">Tipo de cuenta</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as AccountFormData['tipo'] })}
                className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-atlas-blue focus:border-transparent"
                disabled={!!editingAccount}
              >
                <option value="CORRIENTE">Cuenta corriente</option>
                <option value="AHORRO">Cuenta ahorro</option>
                <option value="OTRA">Otra cuenta</option>
                <option value="TARJETA_CREDITO">Tarjeta de crédito</option>
              </select>
            </div>

            {formData.tipo === 'TARJETA_CREDITO' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-atlas-navy-1 mb-1">Día de cargo del recibo (1-31)</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={formData.cardSettlementDay}
                    onChange={(e) => setFormData({ ...formData, cardSettlementDay: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-atlas-blue focus:border-transparent"
                  />
                  {formErrors.cardSettlementDay && <p className="mt-1 text-sm text-error-600">{formErrors.cardSettlementDay}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-atlas-navy-1 mb-1">Cuenta bancaria de cargo del recibo</label>
                  <select
                    value={formData.cardChargeAccountId}
                    onChange={(e) => setFormData({ ...formData, cardChargeAccountId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-atlas-blue focus:border-transparent"
                  >
                    <option value="">Selecciona una cuenta</option>
                    {accounts
                      .filter((acc) => acc.tipo !== 'TARJETA_CREDITO')
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>{acc.alias || maskIban(acc.iban)}</option>
                      ))}
                  </select>
                  {formErrors.cardChargeAccountId && <p className="mt-1 text-sm text-error-600">{formErrors.cardChargeAccountId}</p>}
                </div>
              </>
            )}

            {/* IBAN field - Required */}
            {formData.tipo !== 'TARJETA_CREDITO' && (
              <div>
                <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                  IBAN <span className="text-error-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-atlas-blue focus:border-transparent"
                  placeholder="ES91 0049 1500 0512 3456 7892"
                  required
                  disabled={!!editingAccount}
                />
                {formErrors.iban && <p className="mt-1 text-sm text-error-600">{formErrors.iban}</p>}
              </div>
            )}

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
              {formErrors.logoFile && <p className="mt-1 text-sm text-error-600">{formErrors.logoFile}</p>}
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
                    <p className="text-success-600 font-medium">{formData.logoFile.name}</p>
                    <p className="text-gray-500">{(formData.logoFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                  Saldo inicial (€)
                </label>
                <input
                  type="number"
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-atlas-blue focus:border-transparent"
                  placeholder="0,00"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                  Fecha saldo inicial
                </label>
                <input
                  type="date"
                  value={formData.openingBalanceDate}
                  onChange={(e) => setFormData({ ...formData, openingBalanceDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-atlas-blue focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-atlas-blue"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || uploadingLogo}
              className="px-4 py-2 text-sm font-medium text-white bg-atlas-blue border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-atlas-blue disabled:opacity-50"
            >
              {uploadingLogo ? 'Subiendo logo...' : saving ? 'Guardando...' : editingAccount ? 'Actualizar' : 'Crear cuenta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccountFormModal;
