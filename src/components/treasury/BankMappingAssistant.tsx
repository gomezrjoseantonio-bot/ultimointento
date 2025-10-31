/**
 * Bank Mapping Assistant Modal
 * 2-click experience for manual column mapping when auto-detection fails
 */

import React, { useState, useEffect } from 'react';
import { X, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { ColumnRole } from '../../services/universalBankImporter/columnRoleDetector';
import { MappingAssistantData } from '../../services/universalBankImporter/universalBankImporter';

interface BankMappingAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  data: MappingAssistantData;
  onComplete: (mapping: { [columnIndex: number]: ColumnRole }, profileName?: string) => void;
}

const ROLE_LABELS: { [key in ColumnRole]: string } = {
  date: 'Fecha *',
  valueDate: 'Fecha Valor',
  description: 'Descripción',
  counterparty: 'Contraparte', // Changed from "Proveedor" to "Contraparte"
  debit: 'Cargo/Débito',
  credit: 'Abono/Crédito',
  amount: 'Importe con Signo',
  balance: 'Saldo',
  reference: 'Referencia',
  unknown: '(Sin asignar)'
};

const ROLE_DESCRIPTIONS: { [key in ColumnRole]: string } = {
  date: 'Fecha de la operación (obligatorio)',
  valueDate: 'Fecha valor (opcional)',
  description: 'Descripción del movimiento',
  counterparty: 'Nombre de la contraparte o entidad',
  debit: 'Columna de cargos (solo valores positivos)',
  credit: 'Columna de abonos (solo valores positivos)', 
  amount: 'Importe con signo (+ ingresos, - gastos)',
  balance: 'Saldo tras la operación',
  reference: 'Referencia o número de operación',
  unknown: 'Columna no utilizada'
};

export const BankMappingAssistant: React.FC<BankMappingAssistantProps> = ({
  isOpen,
  onClose,
  data,
  onComplete
}) => {
  const [mapping, setMapping] = useState<{ [columnIndex: number]: ColumnRole }>({});
  const [profileName, setProfileName] = useState<string>('');
  const [previewRows, setPreviewRows] = useState<any[][]>([]);
  const [isValid, setIsValid] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && data) {
      // Initialize with detected mapping
      setMapping({ ...data.detectedMapping });
      setPreviewRows(data.sampleRows.slice(0, 5)); // Show first 5 rows
      validateMapping({ ...data.detectedMapping });
    }
  }, [isOpen, data]);

  const handleRoleChange = (columnIndex: number, role: ColumnRole) => {
    const newMapping = { ...mapping };
    
    // Clear previous assignment of this role (except 'unknown')
    if (role !== 'unknown') {
      Object.keys(newMapping).forEach(key => {
        if (newMapping[parseInt(key)] === role) {
          newMapping[parseInt(key)] = 'unknown';
        }
      });
    }
    
    newMapping[columnIndex] = role;
    setMapping(newMapping);
    validateMapping(newMapping);
  };

  const validateMapping = (currentMapping: { [columnIndex: number]: ColumnRole }) => {
    const errors: string[] = [];
    const roles = Object.values(currentMapping);

    // Must have date column
    if (!roles.includes('date')) {
      errors.push('Debe asignar una columna de Fecha');
    }

    // Must have amount information (either amount column or debit+credit)
    const hasAmount = roles.includes('amount');
    const hasDebitCredit = roles.includes('debit') || roles.includes('credit');
    
    if (!hasAmount && !hasDebitCredit) {
      errors.push('Debe asignar columnas de importe (Importe con Signo, o Cargo/Abono)');
    }

    // Can't have both amount and debit/credit
    if (hasAmount && hasDebitCredit) {
      errors.push('No puede tener tanto Importe con Signo como Cargo/Abono separados');
    }

    setValidationErrors(errors);
    setIsValid(errors.length === 0);
  };

  const handleComplete = () => {
    if (isValid) {
      onComplete(mapping, profileName.trim() || undefined);
    }
  };

  const getColumnPreview = (columnIndex: number): string => {
    const values = previewRows
      .map(row => row[columnIndex])
      .filter(val => val != null && val !== '')
      .slice(0, 3);
    
    return values.map(v => v.toString().substring(0, 20)).join(', ');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50" style={{ backgroundColor: 'var(--bg)', opacity: 0.95 }}>
      <div className="bg-white shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-atlas-blue" />
            <div>
              <h2 className="text-xl font-semibold">Asistente de Mapeo Bancario</h2>
              <p className="text-sm text-gray-600">
                Configure cómo interpretar las columnas del archivo
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row h-full">
          
          {/* Column Mapping Panel */}
          <div className="flex-1 p-6 border-r">
            <h3 className="text-lg font-medium mb-4">Mapeo de Columnas</h3>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {data.headers.map((header, index) => (
                <div key={index} className="border p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        Columna {index + 1}: {header || `(Sin nombre)`}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Ejemplo: {getColumnPreview(index) || '(vacío)'}
                      </div>
                    </div>
                  </div>
                  
                  <select
                    value={mapping[index] || 'unknown'}
                    onChange={(e) => handleRoleChange(index, e.target.value as ColumnRole)}
                    className="w-full mt-2 border border-gray-300 rounded px-3 py-2 text-sm"
                  >
                    {Object.entries(ROLE_LABELS).map(([role, label]) => (
                      <option key={role} value={role}>
                        {label}
                      </option>
                    ))}
                  </select>
                  
                  {mapping[index] && mapping[index] !== 'unknown' && (
                    <div className="text-xs text-gray-600 mt-1">
                      {ROLE_DESCRIPTIONS[mapping[index]]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Preview and Validation Panel */}
          <div className="w-full lg:w-80 p-6 bg-gray-50">
            <h3 className="text-lg font-medium mb-4">Vista Previa</h3>
            
            {/* Validation Status */}
            <div className="mb-4 p-3 border">
              {isValid ? (
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Configuración válida</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Configuración incompleta</span>
                  </div>
                  <ul className="text-xs text-red-600 ml-6 space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Sample Preview */}
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Primeras 5 filas:</h4>
              <div className="bg-white border rounded text-xs overflow-hidden">
                <div className="p-2 bg-gray-100 border-b font-medium">
                  Roles detectados
                </div>
                <div className="p-2 space-y-1 max-h-32 overflow-y-auto">
                  {Object.entries(mapping)
                    .filter(([_, role]) => role !== 'unknown')
                    .map(([colIndex, role]) => (
                      <div key={colIndex} className="flex justify-between">
                        <span>{ROLE_LABELS[role]}:</span>
                        <span className="text-gray-600">Col {parseInt(colIndex) + 1}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Profile Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Nombre del perfil (opcional)
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Ej: MiBanco BBVA v2024"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <div className="text-xs text-gray-500 mt-1">
                Se guardará para futuros archivos similares
              </div>
            </div>

            {/* Suggestions */}
            {data.suggestions.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Sugerencias:</h4>
                <div className="btn-secondary-horizon atlas-atlas-atlas-atlas-btn-primary ">
                  <ul className="text-xs space-y-1">
                    {data.suggestions.map((suggestion, index) => (
                      <li key={index}>• {suggestion}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Ambiguities */}
            {data.ambiguities.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Advertencias:</h4>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                  <ul className="text-xs space-y-1">
                    {data.ambiguities.map((ambiguity, index) => (
                      <li key={index}>• {ambiguity}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300"
            >
            Cancelar
          </button>
          
          <button
            onClick={handleComplete}
            disabled={!isValid}
            className={`px-6 py-2 font-medium ${
              isValid 
                ? "bg-atlas-blue text-white hover:bg-primary-800" 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Continuar Importación
          </button>
        </div>
      </div>
    </div>
  );
};