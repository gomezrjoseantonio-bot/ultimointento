import React, { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  ArrowLeft
} from 'lucide-react';
import { FEINProcessingResult, FEINData, FEINToLoanMapping } from '../../types/fein';
import { PrestamoFinanciacion } from '../../types/financiacion';

interface FEINValidationProps {
  feinResult: FEINProcessingResult;
  onContinue: (loanData: Partial<PrestamoFinanciacion>) => void;
  onBack: () => void;
}

const FEINValidation = ({ feinResult, onContinue, onBack }: FEINValidationProps) => {
  const [editableData, setEditableData] = useState<FEINData>(feinResult.data || {});
  const [mapping, setMapping] = useState<FEINToLoanMapping>({
    ambito: 'PERSONAL',
    cuentaCargoId: ''
  });

  const handleContinue = () => {
    // Simple conversion for now
    const loanData: Partial<PrestamoFinanciacion> = {
      alias: mapping.alias || 'Préstamo FEIN',
      ambito: mapping.ambito,
      cuentaCargoId: mapping.cuentaCargoId || '1',
      capitalInicial: editableData.capitalInicial || 100000,
      tipo: editableData.tipo || 'FIJO',
      sistema: 'FRANCES',
      fechaFirma: new Date().toISOString().split('T')[0],
      fechaPrimerCargo: new Date().toISOString().split('T')[0],
      diaCobroMes: 1,
      esquemaPrimerRecibo: 'NORMAL',
      carencia: 'NINGUNA',
      plazoTotal: editableData.plazoAnos || 25,
      plazoPeriodo: 'AÑOS',
      revision: 12,
      bonificaciones: []
    };

    onContinue(loanData);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-atlas transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>
                Validar datos FEIN
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-gray)' }}>
                Revise y complete los datos extraídos del documento
              </p>
            </div>
          </div>
          
          <button
            onClick={handleContinue}
            className="px-6 py-2 text-white rounded-atlas font-medium transition-colors"
            style={{ backgroundColor: 'var(--atlas-blue)' }}
          >
            Crear Préstamo
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Processing Status */}
          <div className="bg-white rounded-atlas border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              {feinResult.success ? (
                <CheckCircle className="h-6 w-6" style={{ color: 'var(--ok)' }} />
              ) : (
                <XCircle className="h-6 w-6" style={{ color: 'var(--error)' }} />
              )}
              <h2 className="text-lg font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>
                {feinResult.success ? 'Documento procesado correctamente' : 'Error al procesar documento'}
              </h2>
            </div>

            {feinResult.confidence && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-gray)' }}>
                    Confianza de extracción
                  </span>
                  <span className="text-sm" style={{ color: 'var(--atlas-navy-1)' }}>
                    {Math.round(feinResult.confidence * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all"
                    style={{ 
                      width: `${feinResult.confidence * 100}%`,
                      backgroundColor: feinResult.confidence > 0.7 ? 'var(--ok)' : 'var(--warn)'
                    }}
                  />
                </div>
              </div>
            )}

            <div className="text-sm" style={{ color: 'var(--text-gray)' }}>
              Campos extraídos: {feinResult.fieldsExtracted?.join(', ') || 'Ninguno'}
            </div>
          </div>

          {/* Form Content */}
          <div className="bg-white rounded-atlas border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--atlas-navy-1)' }}>
              Datos extraídos del FEIN
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                  Alias del préstamo
                </label>
                <input
                  type="text"
                  value={mapping.alias || ''}
                  onChange={(e) => setMapping(prev => ({ ...prev, alias: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Nombre del préstamo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                  Entidad bancaria
                </label>
                <input
                  type="text"
                  value={editableData.bancoEntidad || ''}
                  onChange={(e) => setEditableData(prev => ({ ...prev, bancoEntidad: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Nombre del banco"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                  Capital inicial
                </label>
                <input
                  type="number"
                  value={editableData.capitalInicial || ''}
                  onChange={(e) => setEditableData(prev => ({ ...prev, capitalInicial: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Capital inicial"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                  Tipo de préstamo
                </label>
                <select
                  value={editableData.tipo || ''}
                  onChange={(e) => setEditableData(prev => ({ ...prev, tipo: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Seleccionar...</option>
                  <option value="FIJO">Fijo</option>
                  <option value="VARIABLE">Variable</option>
                  <option value="MIXTO">Mixto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                  Plazo (años)
                </label>
                <input
                  type="number"
                  value={editableData.plazoAnos || ''}
                  onChange={(e) => setEditableData(prev => ({ ...prev, plazoAnos: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Plazo en años"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                  TIN (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editableData.tin || ''}
                  onChange={(e) => setEditableData(prev => ({ ...prev, tin: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="TIN en %"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleContinue}
                className="px-6 py-2 text-white rounded-atlas font-medium transition-colors"
                style={{ backgroundColor: 'var(--atlas-blue)' }}
              >
                Continuar con estos datos
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FEINValidation;