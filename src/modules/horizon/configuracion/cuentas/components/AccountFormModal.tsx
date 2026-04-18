import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { cuentasService, CreateAccountData, UpdateAccountData } from '../../../../../services/cuentasService';
import { Account } from '../../../../../services/db';
import {
  formatIban,
  maskIban,
  validateIbanEs,
} from '../../../../../utils/accountHelpers';

// Simple toggle — navy-900 cuando activo, grey-300 cuando inactivo
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    style={{
      width: 44,
      height: 24,
      borderRadius: 12,
      background: checked ? 'var(--navy-900)' : 'var(--grey-200)',
      border: 'none',
      cursor: 'pointer',
      position: 'relative',
      flexShrink: 0,
      transition: 'background .2s',
      padding: 0,
    }}
  >
    <span
      style={{
        position: 'absolute',
        top: 3,
        left: checked ? 23 : 3,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: 'var(--white)',
        transition: 'left .2s',
        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }}
    />
  </button>
);

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

const FRECUENCIA_PAGOS: Record<string, number> = {
  mensual: 12,
  trimestral: 4,
  semestral: 2,
  anual: 1,
};

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

  // Remuneración state
  const [esRemunerada, setEsRemunerada] = useState(false);
  const [tinAnual, setTinAnual] = useState(2.5);
  const [frecuencia, setFrecuencia] = useState<'mensual' | 'trimestral' | 'semestral' | 'anual'>('mensual');
  const [base, setBase] = useState<'saldo' | 'fijo'>('saldo');
  const [importeFijo, setImporteFijo] = useState(10000);
  const [retencion, setRetencion] = useState(19);
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);

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
        setEsRemunerada(editingAccount.esRemunerada ?? false);
        setTinAnual(editingAccount.remuneracion?.tinAnual ?? 2.5);
        setFrecuencia(editingAccount.remuneracion?.frecuenciaPagos ?? 'mensual');
        setBase(editingAccount.remuneracion?.base ?? 'saldo');
        setImporteFijo(editingAccount.remuneracion?.importeFijo ?? 10000);
        setRetencion(editingAccount.remuneracion?.retencionFiscal ?? 19);
        setFechaInicio(editingAccount.remuneracion?.fechaInicio ?? new Date().toISOString().split('T')[0]);
      } else {
        setFormData(defaultFormData());
        setEsRemunerada(false);
        setTinAnual(2.5);
        setFrecuencia('mensual');
        setBase('saldo');
        setImporteFijo(10000);
        setRetencion(19);
        setFechaInicio(new Date().toISOString().split('T')[0]);
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

  const handleTipoChange = (tipo: AccountFormData['tipo']) => {
    setFormData((prev) => ({ ...prev, tipo }));
    if (tipo === 'AHORRO' && !esRemunerada) {
      setEsRemunerada(true);
    }
  };

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

  // Memoizar el object URL para evitar fugas de memoria en cada render
  const logoPreviewUrl = useMemo(
    () => (formData.logoFile ? URL.createObjectURL(formData.logoFile) : null),
    [formData.logoFile],
  );
  useEffect(() => {
    return () => { if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl); };
  }, [logoPreviewUrl]);

  // Projection calculators — base saldo usa el saldo inicial introducido, no un placeholder
  const calcBaseCalculo = (): number =>
    base === 'fijo' ? (importeFijo || 0) : (parseFloat(formData.openingBalance) || 0);

  const calcBrutoAnual = (): number => calcBaseCalculo() * (tinAnual || 0) / 100;

  const calcRetencion = (): number => calcBrutoAnual() * (retencion || 0) / 100;

  const calcNetoPeriodo = (): number => {
    const pagosAnuales = FRECUENCIA_PAGOS[frecuencia] || 12;
    return (calcBrutoAnual() - calcRetencion()) / pagosAnuales;
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.alias.trim()) {
      errors.alias = 'El alias es obligatorio';
    } else if (formData.alias.trim().length > 40) {
      errors.alias = 'El alias no puede superar 40 caracteres';
    }

    if (formData.tipo !== 'TARJETA_CREDITO') {
      if (formData.iban.trim()) {
        const ibanValidation = validateIbanEs(formData.iban);
        if (!ibanValidation.ok) errors.iban = ibanValidation.message || 'IBAN inválido';
      }
    }

    if (formData.tipo === 'TARJETA_CREDITO') {
      const day = parseInt(formData.cardSettlementDay || '0', 10);
      if (!day || day < 1 || day > 31) errors.cardSettlementDay = 'Indica un día de cargo entre 1 y 31';
      if (!formData.cardChargeAccountId) errors.cardChargeAccountId = 'Selecciona la cuenta bancaria de cargo del recibo';
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
        iban: formData.tipo === 'TARJETA_CREDITO' ? undefined : (formData.iban || undefined),
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
        esRemunerada,
        remuneracion: esRemunerada
          ? {
              tinAnual,
              frecuenciaPagos: frecuencia,
              base,
              importeFijo: base === 'fijo' ? importeFijo : undefined,
              retencionFiscal: retencion,
              fechaInicio,
            }
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
      {/* Modal con header y footer fijos — solo el cuerpo hace scroll */}
      <div
        className="bg-white w-full max-w-md"
        style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh', borderRadius: 8 }}
      >
        {/* Header fijo */}
        <div style={{ padding: '20px 24px 16px', flexShrink: 0, borderBottom: '1px solid var(--grey-200)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-atlas-navy-1">
              {editingAccount ? 'Editar cuenta' : 'Nueva cuenta bancaria'}
            </h2>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Cuerpo scrollable */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px' }}>
          <div className="space-y-4">
            {/* Alias — obligatorio */}
            <div>
              <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                Alias <span style={{ color: 'var(--teal-600)' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.alias}
                onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                className="input"
                placeholder="ej. Cuenta principal, Nómina..."
                maxLength={40}
              />
              {formErrors.alias && <p className="mt-1 text-sm text-error-600">{formErrors.alias}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-atlas-navy-1 mb-1">Tipo de cuenta</label>
              <select
                value={formData.tipo}
                onChange={(e) => handleTipoChange(e.target.value as AccountFormData['tipo'])}
                className="input"
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
                    className="input"
                  />
                  {formErrors.cardSettlementDay && <p className="mt-1 text-sm text-error-600">{formErrors.cardSettlementDay}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-atlas-navy-1 mb-1">Cuenta bancaria de cargo del recibo</label>
                  <select
                    value={formData.cardChargeAccountId}
                    onChange={(e) => setFormData({ ...formData, cardChargeAccountId: e.target.value })}
                    className="input"
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

            {/* IBAN — opcional */}
            {formData.tipo !== 'TARJETA_CREDITO' && (
              <div>
                <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                  IBAN
                </label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  className="input"
                  placeholder="ES91 0049 1500 0512 3456 7892"
                  disabled={!!editingAccount}
                />
                {formErrors.iban && <p className="mt-1 text-sm text-error-600">{formErrors.iban}</p>}
                <p className="mt-1" style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>
                  Opcional — ayuda a vincular movimientos automáticamente
                </p>
              </div>
            )}

            {/* Logo upload — opcional */}
            <div>
              <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                Logo personalizado (opcional)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
                className="input"
              />
              {formErrors.logoFile && <p className="mt-1 text-sm text-error-600">{formErrors.logoFile}</p>}
              <p className="mt-1 text-xs text-gray-500">
                Se detectará automáticamente el logo del banco. Puedes subir uno personalizado (máx. 2MB).
              </p>
              {formData.logoFile && logoPreviewUrl && (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={logoPreviewUrl}
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
                  className="input"
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
                  className="input"
                />
              </div>
            </div>

            {/* Separador */}
            <div style={{ borderTop: '1px solid var(--grey-200)', margin: '8px 0' }} />

            {/* Toggle cuenta remunerada */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <div>
                <p style={{ fontSize: 'var(--t-base)', color: 'var(--grey-900)', fontWeight: 500 }}>
                  Cuenta remunerada
                </p>
                <p style={{ fontSize: 'var(--t-sm)', color: 'var(--grey-500)', marginTop: 2 }}>
                  Esta cuenta genera intereses periódicos
                </p>
              </div>
              <Toggle checked={esRemunerada} onChange={setEsRemunerada} />
            </div>

            {/* Campos de remuneración */}
            {esRemunerada && (
              <div style={{
                background: 'var(--grey-50)',
                border: '1px solid var(--grey-200)',
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}>

                {/* Fila 1: TIN + Frecuencia */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                      TIN anual (%) <span style={{ color: 'var(--teal-600)' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="20"
                      value={tinAnual}
                      onChange={(e) => setTinAnual(parseFloat(e.target.value) || 0)}
                      className="input"
                      style={{ fontFamily: "'IBM Plex Mono'" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                      Frecuencia de cobro <span style={{ color: 'var(--teal-600)' }}>*</span>
                    </label>
                    <select
                      value={frecuencia}
                      onChange={(e) => setFrecuencia(e.target.value as typeof frecuencia)}
                      className="input"
                    >
                      <option value="mensual">Mensual</option>
                      <option value="trimestral">Trimestral</option>
                      <option value="semestral">Semestral</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>
                </div>

                {/* Fila 2: Base + Importe fijo */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                      Base de cálculo <span style={{ color: 'var(--teal-600)' }}>*</span>
                    </label>
                    <select
                      value={base}
                      onChange={(e) => setBase(e.target.value as typeof base)}
                      className="input"
                    >
                      <option value="saldo">Saldo medio</option>
                      <option value="fijo">Importe fijo</option>
                    </select>
                  </div>
                  {base === 'fijo' ? (
                    <div>
                      <label style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                        Importe fijo (€) <span style={{ color: 'var(--teal-600)' }}>*</span>
                      </label>
                      <input
                        type="number"
                        value={importeFijo}
                        onChange={(e) => setImporteFijo(parseFloat(e.target.value) || 0)}
                        className="input"
                        style={{ fontFamily: "'IBM Plex Mono'" }}
                      />
                    </div>
                  ) : (
                    <div style={{ paddingTop: 20 }}>
                      <p style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-400)' }}>
                        ATLAS usará el saldo real para calcular los intereses
                      </p>
                    </div>
                  )}
                </div>

                {/* Fila 3: Retención + Fecha inicio */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                      Retención fiscal (%)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={retencion}
                      onChange={(e) => setRetencion(parseFloat(e.target.value) || 0)}
                      className="input"
                      style={{ fontFamily: "'IBM Plex Mono'" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                      Inicio de remuneración
                    </label>
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>

                {/* Proyección */}
                <div style={{
                  background: 'var(--white)',
                  border: '1px solid var(--grey-200)',
                  borderRadius: 8,
                  padding: '10px 14px',
                }}>
                  <p style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)', fontWeight: 500, marginBottom: 6 }}>
                    Proyección estimada · base {calcBaseCalculo().toLocaleString('es-ES')} €
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-xs)', padding: '2px 0' }}>
                    <span style={{ color: 'var(--grey-500)' }}>Interés bruto anual</span>
                    <span style={{ fontFamily: "'IBM Plex Mono'", color: 'var(--navy-900)', fontWeight: 600 }}>
                      {calcBrutoAnual().toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-xs)', padding: '2px 0' }}>
                    <span style={{ color: 'var(--grey-500)' }}>Retención ({retencion}%)</span>
                    <span style={{ fontFamily: "'IBM Plex Mono'", color: 'var(--grey-700)' }}>
                      {calcRetencion().toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-xs)', padding: '2px 0', borderTop: '1px solid var(--grey-200)', marginTop: 4, paddingTop: 6 }}>
                    <span style={{ color: 'var(--grey-500)' }}>Cobro neto por período ({frecuencia})</span>
                    <span style={{ fontFamily: "'IBM Plex Mono'", color: 'var(--navy-900)', fontWeight: 600 }}>
                      {calcNetoPeriodo().toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                </div>

              </div>
            )}
          </div>
          </div>{/* fin cuerpo scrollable */}

          {/* Footer fijo con botones siempre visibles */}
          <div style={{ padding: '14px 24px', flexShrink: 0, borderTop: '1px solid var(--grey-200)' }}
               className="flex justify-end space-x-3">
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
