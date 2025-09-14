// FEIN Review Drawer - Shows extracted FEIN fields for review and edit
// Implements requirements for FEIN field display and editing

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
  loanId?: string; // If loan already created
}

const FEINReviewDrawer: React.FC<FEINReviewDrawerProps> = ({
  isOpen,
  onClose,
  feinResult,
  onSave,
  onOpenInFinanciacion,
  readonly = false,
  loanId
}) => {
  const [editableData, setEditableData] = useState<FEINData>(feinResult.rawData || {});
  const [isEditing, setIsEditing] = useState(!readonly && feinResult.fieldsMissing.length > 0);

  if (!isOpen) return null;

  const formatCurrency = (amount?: number) => {
    if (!amount) return '';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatPercentage = (rate?: number) => {
    if (!rate) return '';
    return new Intl.NumberFormat('es-ES', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(rate);
  };

  const updateField = (field: keyof FEINData, value: any) => {
    setEditableData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    onSave(editableData);
    setIsEditing(false);
  };

  const isCriticalFieldMissing = (field: string) => {
    return feinResult.fieldsMissing.includes(field);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* ATLAS light backdrop - no dark overlays */}
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(248, 249, 250, 0.9)' }} onClick={onClose} />
      
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl border-l border-gray-200">
        <div className="flex flex-col h-full">
          {/* Header - ATLAS styling */}
          <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--hz-neutral-300)', backgroundColor: 'var(--bg)' }}>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6" style={{ color: 'var(--atlas-blue)' }} />
              <div>
                <h2 className="atlas-h2">
                  {readonly ? 'Resumen FEIN → Borrador de préstamo' : 'Revisión FEIN'}
                </h2>
                <p className="atlas-caption">
                  Campos extraídos del documento FEIN
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              style={{ color: 'var(--text-gray)' }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Status Badge - Updated for "Pendiente" UX pattern */}
            <div className={`flex items-center gap-3 p-4 rounded-lg border ${
              feinResult.fieldsMissing.length === 0 ? 'atlas-chip-success' : 'atlas-chip-info'
            }`} style={{ 
              backgroundColor: feinResult.fieldsMissing.length === 0 
                ? 'rgba(40, 167, 69, 0.1)' 
                : 'rgba(0, 123, 255, 0.1)',
              borderColor: feinResult.fieldsMissing.length === 0 ? 'var(--ok)' : 'var(--atlas-blue)'
            }}>
              {feinResult.fieldsMissing.length === 0 ? (
                <CheckCircle className="h-5 w-5" style={{ color: 'var(--ok)' }} />
              ) : (
                <AlertTriangle className="h-5 w-5" style={{ color: 'var(--atlas-blue)' }} />
              )}
              <div>
                <div className="font-medium atlas-body">
                  {feinResult.fieldsMissing.length === 0 
                    ? 'FEIN procesada completamente'
                    : 'Datos extraídos del FEIN'
                  }
                </div>
                {feinResult.fieldsMissing.length > 0 && feinResult.pendingFields && (
                  <div className="atlas-caption">
                    Faltan: {feinResult.pendingFields.map(field => {
                      const fieldNames: Record<string, string> = {
                        banco: 'Entidad',
                        capitalInicial: 'Capital inicial',
                        plazoMeses: 'Plazo',
                        tipo: 'Tipo de interés',
                        tin: 'TIN/TAE',
                        cuentaCargo: 'Cuenta de cargo'
                      };
                      return fieldNames[field] || field;
                    }).join(', ')}… Puedes completarlos ahora.
                  </div>
                )}
              </div>
            </div>

            {/* Financial Data */}
            <div className="space-y-4">
              <h3 className="atlas-h2">
                Condiciones Financieras
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Capital Inicial */}
                <div>
                  <label className={`block atlas-caption mb-2 ${isCriticalFieldMissing('capitalInicial') ? 'text-error' : ''}`} style={{ color: isCriticalFieldMissing('capitalInicial') ? 'var(--error)' : 'var(--text-gray)' }}>
                    Capital Inicial *
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editableData.capitalInicial || ''}
                      onChange={(e) => updateField('capitalInicial', parseFloat(e.target.value) || undefined)}
                      className={`w-full px-3 py-2 border rounded-md tabular-nums ${isCriticalFieldMissing('capitalInicial') ? 'border-error' : ''}`}
                      style={{ 
                        borderColor: isCriticalFieldMissing('capitalInicial') ? 'var(--error)' : 'var(--hz-neutral-300)',
                        fontFamily: 'var(--font-sans)'
                      }}
                      placeholder="Ej: 200.000"
                    />
                  ) : (
                    <div className="atlas-kpi">
                      {formatCurrency(editableData.capitalInicial)}
                    </div>
                  )}
                </div>

                {/* Plazo */}
                <div>
                  <label className={`block atlas-caption mb-2 ${isCriticalFieldMissing('plazo') ? 'text-error' : ''}`} style={{ color: isCriticalFieldMissing('plazo') ? 'var(--error)' : 'var(--text-gray)' }}>
                    Plazo *
                  </label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={editableData.plazoAnos || ''}
                        onChange={(e) => updateField('plazoAnos', parseInt(e.target.value) || undefined)}
                        className="flex-1 px-3 py-2 border rounded-md tabular-nums"
                        style={{ 
                          borderColor: 'var(--hz-neutral-300)',
                          fontFamily: 'var(--font-sans)'
                        }}
                        placeholder="Años"
                      />
                      <input
                        type="number"
                        value={editableData.plazoMeses || ''}
                        onChange={(e) => updateField('plazoMeses', parseInt(e.target.value) || undefined)}
                        className="flex-1 px-3 py-2 border rounded-md tabular-nums"
                        style={{ 
                          borderColor: 'var(--hz-neutral-300)',
                          fontFamily: 'var(--font-sans)'
                        }}
                        placeholder="Meses"
                      />
                    </div>
                  ) : (
                    <div className="atlas-kpi">
                      {editableData.plazoAnos ? `${editableData.plazoAnos} años` : ''}
                      {editableData.plazoAnos && editableData.plazoMeses ? ' + ' : ''}
                      {editableData.plazoMeses ? `${editableData.plazoMeses} meses` : ''}
                    </div>
                  )}
                </div>

                {/* Tipo de Interés */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isCriticalFieldMissing('tipo') ? 'text-red-600' : 'text-gray-700'}`}>
                    Tipo de Interés *
                  </label>
                  {isEditing ? (
                    <select
                      value={editableData.tipo || ''}
                      onChange={(e) => updateField('tipo', e.target.value as any)}
                      className={`w-full px-3 py-2 border rounded-md ${isCriticalFieldMissing('tipo') ? 'border-red-300' : 'border-gray-300'}`}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="FIJO">Fijo</option>
                      <option value="VARIABLE">Variable</option>
                      <option value="MIXTO">Mixto</option>
                    </select>
                  ) : (
                    <div className="text-lg font-medium">
                      {editableData.tipo}
                    </div>
                  )}
                </div>

                {/* TIN */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    TIN
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editableData.tin ? (editableData.tin * 100) : ''}
                      onChange={(e) => updateField('tin', parseFloat(e.target.value) / 100 || undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Ej: 3.45"
                    />
                  ) : (
                    <div className="text-lg font-medium">
                      {formatPercentage(editableData.tin)}
                    </div>
                  )}
                </div>

                {/* TAE */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    TAE
                  </label>
                  <div className="text-lg font-medium">
                    {formatPercentage(editableData.tae)}
                  </div>
                </div>

                {/* Banco/Entidad */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Banco/Entidad
                  </label>
                  <div className="text-lg font-medium">
                    {editableData.bancoEntidad || 'No detectado'}
                  </div>
                </div>
              </div>
            </div>

            {/* Variable/Mixed specific fields */}
            {(editableData.tipo === 'VARIABLE' || editableData.tipo === 'MIXTO') && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--hz-text)' }}>
                  Condiciones Variables
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      Índice de Referencia
                    </label>
                    <div className="text-lg font-medium">
                      {editableData.indice || 'No detectado'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      Diferencial
                    </label>
                    <div className="text-lg font-medium">
                      {formatPercentage(editableData.diferencial)}
                    </div>
                  </div>

                  {editableData.tipo === 'MIXTO' && (
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">
                        Tramo Fijo (años)
                      </label>
                      <div className="text-lg font-medium">
                        {editableData.tramoFijoAnos || 'No detectado'}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      Periodicidad Revisión
                    </label>
                    <div className="text-lg font-medium">
                      {editableData.periodicidadRevision ? `${editableData.periodicidadRevision} meses` : 'No detectado'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bonifications */}
            {editableData.bonificaciones && editableData.bonificaciones.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--hz-text)' }}>
                  Bonificaciones
                </h3>
                
                <div className="space-y-2">
                  {editableData.bonificaciones.map((bonif, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg">
                      <div className="font-medium">{bonif.descripcion}</div>
                      {bonif.condicion && (
                        <div className="text-sm text-gray-600">{bonif.condicion}</div>
                      )}
                      {bonif.descuento && (
                        <div className="text-sm font-medium text-green-600">
                          -{formatPercentage(bonif.descuento)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Account Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--hz-text)' }}>
                Información de Cuenta
              </h3>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  IBAN Cuenta de Cargo
                </label>
                <div className="text-lg font-medium font-mono">
                  {editableData.cuentaCargoIban || 'No detectado'}
                  {editableData.ibanMascarado && (
                    <span className="ml-2 text-sm text-amber-600">(Parcialmente enmascarado)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t bg-white" style={{ borderColor: 'var(--hz-neutral-300)' }}>
            <div className="flex gap-3 justify-end">
              {loanId ? (
                <button
                  onClick={() => onOpenInFinanciacion(loanId)}
                  className="atlas-btn-primary"
                >
                  Abrir en Financiación
                </button>
              ) : isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="atlas-btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    className="atlas-btn-primary"
                  >
                    {feinResult.fieldsMissing.length > 0 
                      ? 'Crear borrador igualmente' 
                      : 'Crear borrador'
                    }
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="atlas-btn-secondary"
                >
                  Editar campos
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FEINReviewDrawer;