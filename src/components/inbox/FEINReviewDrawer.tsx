import React, { useState } from 'react';
import { X, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import { FEINData, FEINProcessingResult } from '../../types/fein';

interface FEINReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  feinResult: FEINProcessingResult;
  onSave: (updatedData: FEINData) => void;
  onOpenInFinanciacion: (loanId: string) => void;
  readonly?: boolean;
  loanId?: string;
}

const FEINReviewDrawer: React.FC<FEINReviewDrawerProps> = ({
  isOpen, onClose, feinResult, onSave, onOpenInFinanciacion, readonly = false, loanId
}) => {
  const [editableData, setEditableData] = useState<FEINData>(feinResult.rawData || {});
  const [isEditing, setIsEditing] = useState(!readonly && feinResult.fieldsMissing.length > 0);

  if (!isOpen) return null;

  const fmt = (n?: number) => n ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n) : '';
  const fmtPct = (n?: number) => n ? new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : '';
  const upd = (field: keyof FEINData, value: any) => setEditableData(prev => ({ ...prev, [field]: value }));
  const missing = (f: string) => feinResult.fieldsMissing.includes(f);

  const inputStyle = (hasError?: boolean) => ({
    width: '100%', padding: '8px 12px',
    border: `1.5px solid ${hasError ? 'var(--s-neg)' : 'var(--n-300)'}`,
    borderRadius: 'var(--r-md)',
    fontFamily: 'var(--font-base)',
    fontSize: 'var(--t-sm)',
    color: 'var(--n-900)',
    outline: 'none',
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <button
        className="absolute inset-0"
        style={{ background: 'rgba(26,35,50,.45)' }}
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl border-l" style={{ borderColor: 'var(--n-200)' }}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--n-200)', background: 'var(--n-50)' }}>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6" style={{ color: 'var(--blue)' }} />
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--n-900)', fontFamily: 'var(--font-base)' }}>
                  {readonly ? 'Resumen FEIN → Borrador de préstamo' : 'Revisión FEIN'}
                </h2>
                <p className="text-sm" style={{ color: 'var(--n-500)', fontFamily: 'var(--font-base)' }}>Campos extraídos del documento FEIN</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2" style={{ color: 'var(--n-500)', borderRadius: 'var(--r-md)' }}>
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Status */}
            <div className="flex items-center gap-3 p-4 border" style={{
              borderRadius: 'var(--r-md)',
              background: feinResult.fieldsMissing.length === 0 ? 'var(--s-pos-bg)' : 'var(--n-50)',
              borderColor: feinResult.fieldsMissing.length === 0 ? 'var(--s-pos)' : 'var(--blue)',
            }}>
              {feinResult.fieldsMissing.length === 0
                ? <CheckCircle className="h-5 w-5" style={{ color: 'var(--s-pos)' }} />
                : <AlertTriangle className="h-5 w-5" style={{ color: 'var(--blue)' }} />
              }
              <div>
                <div className="font-medium text-sm" style={{ color: 'var(--n-900)', fontFamily: 'var(--font-base)' }}>
                  {feinResult.fieldsMissing.length === 0 ? 'FEIN procesada completamente' : 'Datos extraídos del FEIN'}
                </div>
                {feinResult.fieldsMissing.length > 0 && feinResult.pendingFields && (
                  <div className="text-xs mt-0.5" style={{ color: 'var(--n-500)', fontFamily: 'var(--font-base)' }}>
                    Faltan: {feinResult.pendingFields.map((f: string) => ({ banco: 'Entidad', capitalInicial: 'Capital inicial', plazoMeses: 'Plazo', tipo: 'Tipo de interés', tin: 'TIN/TAE', cuentaCargo: 'Cuenta de cargo' }[f] || f)).join(', ')}… Puedes completarlos ahora.
                  </div>
                )}
              </div>
            </div>

            {/* Financial Data */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--n-700)', fontFamily: 'var(--font-base)' }}>Condiciones Financieras</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: missing('capitalInicial') ? 'var(--s-neg)' : 'var(--n-500)', fontFamily: 'var(--font-base)' }}>Capital Inicial *</label>
                  {isEditing ? (
                    <input type="number" value={editableData.capitalInicial || ''} onChange={(e) => upd('capitalInicial', parseFloat(e.target.value) || undefined)} style={inputStyle(missing('capitalInicial'))} placeholder="Ej: 200000" />
                  ) : (
                    <div className="text-lg font-semibold" style={{ color: 'var(--n-900)', fontFamily: 'var(--font-mono)' }}>{fmt(editableData.capitalInicial)}</div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--n-500)', fontFamily: 'var(--font-base)' }}>Plazo *</label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input type="number" value={editableData.plazoAnos || ''} onChange={(e) => upd('plazoAnos', parseInt(e.target.value) || undefined)} style={inputStyle()} placeholder="Años" />
                      <input type="number" value={editableData.plazoMeses || ''} onChange={(e) => upd('plazoMeses', parseInt(e.target.value) || undefined)} style={inputStyle()} placeholder="Meses" />
                    </div>
                  ) : (
                    <div className="text-lg font-semibold" style={{ color: 'var(--n-900)' }}>
                      {editableData.plazoAnos ? `${editableData.plazoAnos} años` : ''}{editableData.plazoAnos && editableData.plazoMeses ? ' + ' : ''}{editableData.plazoMeses ? `${editableData.plazoMeses} meses` : ''}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--n-500)', fontFamily: 'var(--font-base)' }}>Tipo de Interés *</label>
                  {isEditing ? (
                    <select value={editableData.tipo || ''} onChange={(e) => upd('tipo', e.target.value)} style={inputStyle(missing('tipo'))}>
                      <option value="">Seleccionar...</option>
                      <option value="FIJO">Fijo</option>
                      <option value="VARIABLE">Variable</option>
                      <option value="MIXTO">Mixto</option>
                    </select>
                  ) : (
                    <div className="text-lg font-semibold" style={{ color: 'var(--n-900)' }}>{editableData.tipo}</div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--n-500)', fontFamily: 'var(--font-base)' }}>TIN</label>
                  {isEditing ? (
                    <input type="number" step="0.01" value={editableData.tin ? editableData.tin * 100 : ''} onChange={(e) => upd('tin', parseFloat(e.target.value) / 100 || undefined)} style={inputStyle()} placeholder="Ej: 3.45" />
                  ) : (
                    <div className="text-lg font-semibold" style={{ color: 'var(--n-900)' }}>{fmtPct(editableData.tin)}</div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--n-500)', fontFamily: 'var(--font-base)' }}>TAE</label>
                  <div className="text-lg font-semibold" style={{ color: 'var(--n-900)' }}>{fmtPct(editableData.tae)}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--n-500)', fontFamily: 'var(--font-base)' }}>Banco/Entidad</label>
                  <div className="text-base" style={{ color: 'var(--n-900)' }}>{editableData.bancoEntidad || 'No detectado'}</div>
                </div>
              </div>
            </div>

            {/* IBAN */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--n-700)', fontFamily: 'var(--font-base)' }}>Cuenta de Cargo</h3>
              <div className="font-mono text-base" style={{ color: 'var(--n-900)' }}>
                {editableData.cuentaCargoIban || 'No detectado'}
                {editableData.ibanMascarado && <span className="ml-2 text-xs" style={{ color: 'var(--s-warn)' }}>(Parcialmente enmascarado)</span>}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t bg-white flex gap-3 justify-end" style={{ borderColor: 'var(--n-200)' }}>
            {loanId ? (
              <button onClick={() => onOpenInFinanciacion(loanId)} className="atlas-btn-primary px-4 py-2">Abrir en Financiación</button>
            ) : isEditing ? (
              <>
                <button onClick={() => setIsEditing(false)} className="atlas-btn-secondary px-4 py-2">Cancelar</button>
                <button onClick={() => { onSave(editableData); setIsEditing(false); }} className="atlas-btn-primary px-4 py-2">
                  {feinResult.fieldsMissing.length > 0 ? 'Crear borrador igualmente' : 'Crear borrador'}
                </button>
              </>
            ) : (
              <button onClick={() => setIsEditing(true)} className="atlas-btn-secondary px-4 py-2">Editar campos</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FEINReviewDrawer;
