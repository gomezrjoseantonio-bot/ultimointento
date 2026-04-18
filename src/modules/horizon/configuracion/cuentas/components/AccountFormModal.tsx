import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Paperclip } from 'lucide-react';
import toast from 'react-hot-toast';
import { cuentasService, CreateAccountData, UpdateAccountData } from '../../../../../services/cuentasService';
import { Account } from '../../../../../services/db';
import {
  formatIban,
  maskIban,
  validateIbanEs,
} from '../../../../../utils/accountHelpers';

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    style={{
      width: 44, height: 24, borderRadius: 12,
      background: checked ? 'var(--navy-900)' : 'var(--grey-200)',
      border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
      transition: 'background .2s', padding: 0,
    }}
  >
    <span style={{
      position: 'absolute', top: 3, left: checked ? 23 : 3,
      width: 18, height: 18, borderRadius: '50%',
      background: 'var(--white)', transition: 'left .2s',
      boxShadow: '0 1px 3px rgba(0,0,0,.2)',
    }} />
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
  mensual: 12, trimestral: 4, semestral: 2, anual: 1,
};

const lbl: React.CSSProperties = {
  fontSize: 'var(--t-xs)', color: 'var(--grey-500)', fontWeight: 500,
  display: 'block', marginBottom: 3,
};

const AccountFormModal: React.FC<AccountFormModalProps> = ({
  open, onClose, onSuccess, editingAccount,
}) => {
  const [formData, setFormData] = useState<AccountFormData>(defaultFormData());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [esRemunerada, setEsRemunerada] = useState(false);
  const [tinAnual, setTinAnual] = useState(2.5);
  const [frecuencia, setFrecuencia] = useState<'mensual' | 'trimestral' | 'semestral' | 'anual'>('mensual');
  const [base, setBase] = useState<'saldo' | 'fijo'>('saldo');
  const [importeFijo, setImporteFijo] = useState(10000);
  const [retencion, setRetencion] = useState(19);
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    cuentasService.list().then(setAccounts).catch(console.error);
  }, [open]);

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

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open, onClose]);

  const handleTipoChange = (tipo: AccountFormData['tipo']) => {
    setFormData((prev) => ({ ...prev, tipo }));
    if (tipo === 'AHORRO' && !esRemunerada) setEsRemunerada(true);
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

  const logoPreviewUrl = useMemo(
    () => (formData.logoFile ? URL.createObjectURL(formData.logoFile) : null),
    [formData.logoFile],
  );
  useEffect(() => {
    return () => { if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl); };
  }, [logoPreviewUrl]);

  const calcBaseCalculo = (): number =>
    base === 'fijo' ? (importeFijo || 0) : (parseFloat(formData.openingBalance) || 0);
  const calcBrutoAnual = (): number => calcBaseCalculo() * (tinAnual || 0) / 100;
  const calcRetencion = (): number => calcBrutoAnual() * (retencion || 0) / 100;
  const calcNetoPeriodo = (): number => (calcBrutoAnual() - calcRetencion()) / (FRECUENCIA_PAGOS[frecuencia] || 12);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.alias.trim()) errors.alias = 'El alias es obligatorio';
    else if (formData.alias.trim().length > 40) errors.alias = 'El alias no puede superar 40 caracteres';
    if (formData.tipo !== 'TARJETA_CREDITO' && formData.iban.trim()) {
      const v = validateIbanEs(formData.iban);
      if (!v.ok) errors.iban = v.message || 'IBAN inválido';
    }
    if (formData.tipo === 'TARJETA_CREDITO') {
      const day = parseInt(formData.cardSettlementDay || '0', 10);
      if (!day || day < 1 || day > 31) errors.cardSettlementDay = 'Día entre 1 y 31';
      if (!formData.cardChargeAccountId) errors.cardChargeAccountId = 'Selecciona la cuenta de cargo';
    }
    if (formData.logoFile) {
      if (!formData.logoFile.type.startsWith('image/')) errors.logoFile = 'Solo imágenes';
      else if (formData.logoFile.size > 2 * 1024 * 1024) errors.logoFile = 'Máx. 2MB';
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
          toast.error(error instanceof Error ? error.message : 'Error al subir el logo');
        } finally {
          setUploadingLogo(false);
        }
      }
      const accountData: CreateAccountData | UpdateAccountData = {
        alias: formData.alias.trim() || undefined,
        iban: formData.tipo === 'TARJETA_CREDITO' ? undefined : (formData.iban || undefined),
        tipo: formData.tipo,
        cardConfig: formData.tipo === 'TARJETA_CREDITO'
          ? { settlementDay: parseInt(formData.cardSettlementDay || '1', 10), chargeAccountId: parseInt(formData.cardChargeAccountId, 10) }
          : undefined,
        logoUser,
        openingBalance: parseFloat(formData.openingBalance || '0') || 0,
        openingBalanceDate: formData.openingBalanceDate ? new Date(formData.openingBalanceDate).toISOString() : undefined,
        esRemunerada,
        remuneracion: esRemunerada
          ? { tinAnual, frecuenciaPagos: frecuencia, base, importeFijo: base === 'fijo' ? importeFijo : undefined, retencionFiscal: retencion, fechaInicio }
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
      toast.error(error instanceof Error ? error.message : 'Error al guardar la cuenta');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const g12 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };

  return (
    // Overlay — overflowY:auto en el overlay para cubrir pantallas muy pequeñas sin scroll interno en el modal
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-start justify-center z-50"
      style={{ backgroundColor: 'var(--bg)', opacity: 0.95, overflowY: 'auto', padding: '24px 0' }}
    >
      <div className="bg-white w-full max-w-md" style={{ borderRadius: 8, display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--grey-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 'var(--t-base)', fontWeight: 600, color: 'var(--grey-900)', margin: 0 }}>
            {editingAccount ? 'Editar cuenta' : 'Nueva cuenta bancaria'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Cuerpo — sin overflow, el modal crece a su altura natural */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Fila 1: Alias + Tipo */}
            <div style={g12}>
              <div>
                <label style={lbl}>Alias <span style={{ color: 'var(--teal-600)' }}>*</span></label>
                <input
                  type="text"
                  value={formData.alias}
                  onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                  className="input"
                  placeholder="Cuenta principal"
                  maxLength={40}
                />
                {formErrors.alias && <p className="mt-1 text-sm text-error-600">{formErrors.alias}</p>}
              </div>
              <div>
                <label style={lbl}>Tipo</label>
                <select
                  value={formData.tipo}
                  onChange={(e) => handleTipoChange(e.target.value as AccountFormData['tipo'])}
                  className="input"
                  disabled={!!editingAccount}
                >
                  <option value="CORRIENTE">Corriente</option>
                  <option value="AHORRO">Ahorro</option>
                  <option value="OTRA">Otra</option>
                  <option value="TARJETA_CREDITO">Tarjeta crédito</option>
                </select>
              </div>
            </div>

            {/* Campos tarjeta de crédito */}
            {formData.tipo === 'TARJETA_CREDITO' && (
              <div style={g12}>
                <div>
                  <label style={lbl}>Día de cargo (1-31)</label>
                  <input type="number" min={1} max={31} value={formData.cardSettlementDay}
                    onChange={(e) => setFormData({ ...formData, cardSettlementDay: e.target.value })}
                    className="input" />
                  {formErrors.cardSettlementDay && <p className="mt-1 text-sm text-error-600">{formErrors.cardSettlementDay}</p>}
                </div>
                <div>
                  <label style={lbl}>Cuenta de cargo</label>
                  <select value={formData.cardChargeAccountId}
                    onChange={(e) => setFormData({ ...formData, cardChargeAccountId: e.target.value })}
                    className="input">
                    <option value="">Selecciona...</option>
                    {accounts.filter((a) => a.tipo !== 'TARJETA_CREDITO').map((a) => (
                      <option key={a.id} value={a.id}>{a.alias || maskIban(a.iban)}</option>
                    ))}
                  </select>
                  {formErrors.cardChargeAccountId && <p className="mt-1 text-sm text-error-600">{formErrors.cardChargeAccountId}</p>}
                </div>
              </div>
            )}

            {/* IBAN — opcional */}
            {formData.tipo !== 'TARJETA_CREDITO' && (
              <div>
                <label style={lbl}>
                  IBAN <span style={{ color: 'var(--grey-400)', fontWeight: 400 }}>— opcional</span>
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
              </div>
            )}

            {/* Saldo inicial + Fecha + Logo en una fila */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={lbl}>Saldo inicial (€)</label>
                <input type="number" value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                  className="input" placeholder="0,00" step="0.01" />
              </div>
              <div>
                <label style={lbl}>Fecha saldo</label>
                <input type="date" value={formData.openingBalanceDate}
                  onChange={(e) => setFormData({ ...formData, openingBalanceDate: e.target.value })}
                  className="input" />
              </div>
              {/* Logo: botón compacto que dispara el input oculto */}
              <div style={{ paddingBottom: 1 }}>
                <input ref={fileInputRef} type="file" accept="image/*"
                  onChange={handleLogoFileChange} style={{ display: 'none' }} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title={formData.logoFile ? formData.logoFile.name : 'Subir logo del banco (opcional, máx. 2MB)'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 36, height: 36, borderRadius: 6,
                    border: '1.5px solid var(--grey-300)',
                    background: formData.logoFile ? 'var(--grey-50)' : 'var(--white)',
                    cursor: 'pointer', color: formData.logoFile ? 'var(--teal-600)' : 'var(--grey-400)',
                  }}
                >
                  {logoPreviewUrl
                    ? <img src={logoPreviewUrl} alt="" style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 3 }} />
                    : <Paperclip size={15} aria-hidden="true" />}
                </button>
                {formErrors.logoFile && <p className="mt-1 text-sm text-error-600">{formErrors.logoFile}</p>}
              </div>
            </div>

            {/* Separador + Toggle */}
            <div style={{ borderTop: '1px solid var(--grey-200)', marginTop: 2 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 'var(--t-sm)', color: 'var(--grey-900)', fontWeight: 500, margin: 0 }}>
                  Cuenta remunerada
                </p>
                <p style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)', margin: '2px 0 0' }}>
                  Genera intereses periódicos
                </p>
              </div>
              <Toggle checked={esRemunerada} onChange={setEsRemunerada} />
            </div>

            {/* Sección remuneración */}
            {esRemunerada && (
              <div style={{
                background: 'var(--grey-50)', border: '1px solid var(--grey-200)',
                borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                {/* TIN + Frecuencia */}
                <div style={g12}>
                  <div>
                    <label style={lbl}>TIN anual (%) <span style={{ color: 'var(--teal-600)' }}>*</span></label>
                    <input type="number" step="0.01" min="0" max="20" value={tinAnual}
                      onChange={(e) => setTinAnual(parseFloat(e.target.value) || 0)}
                      className="input" style={{ fontFamily: "'IBM Plex Mono'" }} />
                  </div>
                  <div>
                    <label style={lbl}>Frecuencia <span style={{ color: 'var(--teal-600)' }}>*</span></label>
                    <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as typeof frecuencia)} className="input">
                      <option value="mensual">Mensual</option>
                      <option value="trimestral">Trimestral</option>
                      <option value="semestral">Semestral</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>
                </div>

                {/* Base + Importe fijo / Retención + Fecha en una sola fila de 4 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                  <div style={{ gridColumn: base === 'fijo' ? '1' : '1 / 3' }}>
                    <label style={lbl}>Base <span style={{ color: 'var(--teal-600)' }}>*</span></label>
                    <select value={base} onChange={(e) => setBase(e.target.value as typeof base)} className="input">
                      <option value="saldo">Saldo medio</option>
                      <option value="fijo">Importe fijo</option>
                    </select>
                  </div>
                  {base === 'fijo' && (
                    <div>
                      <label style={lbl}>Importe (€) <span style={{ color: 'var(--teal-600)' }}>*</span></label>
                      <input type="number" value={importeFijo}
                        onChange={(e) => setImporteFijo(parseFloat(e.target.value) || 0)}
                        className="input" style={{ fontFamily: "'IBM Plex Mono'" }} />
                    </div>
                  )}
                  <div>
                    <label style={lbl}>Retención (%)</label>
                    <input type="number" step="1" min="0" max="100" value={retencion}
                      onChange={(e) => setRetencion(parseFloat(e.target.value) || 0)}
                      className="input" style={{ fontFamily: "'IBM Plex Mono'" }} />
                  </div>
                  <div>
                    <label style={lbl}>Inicio</label>
                    <input type="date" value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)} className="input" />
                  </div>
                </div>

                {/* Proyección */}
                <div style={{ background: 'var(--white)', border: '1px solid var(--grey-200)', borderRadius: 6, padding: '8px 12px' }}>
                  <p style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)', fontWeight: 500, marginBottom: 4 }}>
                    Proyección · base {calcBaseCalculo().toLocaleString('es-ES')} €
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-xs)', padding: '1px 0' }}>
                    <span style={{ color: 'var(--grey-500)' }}>Interés bruto anual</span>
                    <span style={{ fontFamily: "'IBM Plex Mono'", color: 'var(--navy-900)', fontWeight: 600 }}>
                      {calcBrutoAnual().toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-xs)', padding: '1px 0' }}>
                    <span style={{ color: 'var(--grey-500)' }}>Retención ({retencion}%)</span>
                    <span style={{ fontFamily: "'IBM Plex Mono'", color: 'var(--grey-500)' }}>
                      {calcRetencion().toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-xs)', padding: '3px 0 1px', borderTop: '1px solid var(--grey-200)', marginTop: 3 }}>
                    <span style={{ color: 'var(--grey-500)' }}>Neto por período ({frecuencia})</span>
                    <span style={{ fontFamily: "'IBM Plex Mono'", color: 'var(--navy-900)', fontWeight: 600 }}>
                      {calcNetoPeriodo().toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--grey-200)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-atlas-blue">
              Cancelar
            </button>
            <button type="submit" disabled={saving || uploadingLogo}
              className="px-4 py-2 text-sm font-medium text-white bg-atlas-blue border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-atlas-blue disabled:opacity-50">
              {uploadingLogo ? 'Subiendo logo...' : saving ? 'Guardando...' : editingAccount ? 'Actualizar' : 'Crear cuenta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccountFormModal;
