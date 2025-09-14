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
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-atlas-navy-1" />
              <div>
                <h2 className="text-xl font-semibold" style={{ color: 'var(--hz-text)' }}>
                  {readonly ? 'Resumen FEIN → Borrador de préstamo' : 'Revisión FEIN'}
                </h2>
                <p className="text-sm text-gray-600">
                  Campos extraídos del documento FEIN
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Status Badge */}
            <div className="flex items-center gap-3 p-4 rounded-lg border" 
                 style={{ 
                   backgroundColor: feinResult.fieldsMissing.length === 0 ? 'var(--ok)' : 'var(--warn)',
                   borderColor: feinResult.fieldsMissing.length === 0 ? 'var(--ok)' : 'var(--warn)',
                   opacity: 0.1
                 }}>
              {feinResult.fieldsMissing.length === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              )}
              <div>
                <div className="font-medium">
                  {feinResult.fieldsMissing.length === 0 
                    ? 'FEIN completa - Lista para crear préstamo'
                    : 'FEIN incompleta - Requiere revisión'
                  }
                </div>
                {feinResult.fieldsMissing.length > 0 && (
                  <div className="text-sm text-gray-600">
                    Faltan: {feinResult.fieldsMissing.join(', ')}
                  </div>
                )}
              </div>
            </div>

            {/* Financial Data */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--hz-text)' }}>
                Condiciones Financieras
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Capital Inicial */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isCriticalFieldMissing('capitalInicial') ? 'text-red-600' : 'text-gray-700'}`}>
                    Capital Inicial *
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editableData.capitalInicial || ''}
                      onChange={(e) => updateField('capitalInicial', parseFloat(e.target.value) || undefined)}
                      className={`w-full px-3 py-2 border rounded-md ${isCriticalFieldMissing('capitalInicial') ? 'border-red-300' : 'border-gray-300'}`}
                      placeholder="Ej: 200000"
                    />
                  ) : (
                    <div className="text-lg font-medium">
                      {formatCurrency(editableData.capitalInicial)}
                    </div>
                  )}
                </div>

                {/* Plazo */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isCriticalFieldMissing('plazo') ? 'text-red-600' : 'text-gray-700'}`}>
                    Plazo *
                  </label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={editableData.plazoAnos || ''}
                        onChange={(e) => updateField('plazoAnos', parseInt(e.target.value) || undefined)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Años"
                      />
                      <input
                        type="number"
                        value={editableData.plazoMeses || ''}
                        onChange={(e) => updateField('plazoMeses', parseInt(e.target.value) || undefined)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Meses"
                      />
                    </div>
                  ) : (
                    <div className="text-lg font-medium">
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
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex gap-3 justify-end">
              {loanId ? (
                <button
                  onClick={() => onOpenInFinanciacion(loanId)}
                  className="px-4 py-2 bg-atlas-navy-1 text-white rounded-md hover:bg-atlas-navy-2 transition-colors"
                >
                  Abrir en Financiación
                </button>
              ) : isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-atlas-navy-1 text-white rounded-md hover:bg-atlas-navy-2 transition-colors"
                  >
                    Crear borrador
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
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