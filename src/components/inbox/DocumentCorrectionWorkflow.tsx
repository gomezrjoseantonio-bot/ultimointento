/**
 * Document Correction Workflow Component
 * 
 * Provides interface for correcting OCR extracted data before
 * sending to treasury integration.
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, Edit3, Save, RefreshCw } from 'lucide-react';
import { DocumentOCRFields } from '../../services/enhancedTreasuryCreationService';
import { convertToPermanentArchive } from '../../services/enhancedAutoSaveService';
import { Property, initDB } from '../../services/db';
import toast from 'react-hot-toast';

interface DocumentCorrectionWorkflowProps {
  documentId: string;
  filename: string;
  originalFields: DocumentOCRFields;
  blockingReasons: string[];
  onCorrectionComplete: (correctedFields: DocumentOCRFields) => void;
  onCancel: () => void;
  className?: string;
}

interface FieldCorrection {
  field: keyof DocumentOCRFields;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  validation?: (value: any) => string | null;
}

const DocumentCorrectionWorkflow: React.FC<DocumentCorrectionWorkflowProps> = ({
  documentId,
  filename,
  originalFields,
  blockingReasons,
  onCorrectionComplete,
  onCancel,
  className = ''
}) => {
  const [correctedFields, setCorrectedFields] = useState<DocumentOCRFields>(originalFields);
  const [editingFields, setEditingFields] = useState<Set<keyof DocumentOCRFields>>(new Set());
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);

  // Load properties for dynamic dropdown
  useEffect(() => {
    const loadProperties = async () => {
      try {
        const db = await initDB();
        const propertiesData = await db.getAll('properties');
        setProperties(propertiesData);
      } catch (error) {
        console.error('Error loading properties:', error);
      }
    };
    loadProperties();
  }, []);

  // Generate field definitions dynamically
  const getFieldDefinitions = (): FieldCorrection[] => [
    {
      field: 'proveedor_nombre',
      label: 'Proveedor/Emisor',
      type: 'text',
      required: true,
      validation: (value) => !value ? 'El proveedor es obligatorio' : null
    },
    {
      field: 'total_amount',
      label: 'Importe total',
      type: 'number',
      required: true,
      validation: (value) => {
        if (!value || value <= 0) return 'El importe debe ser mayor que 0';
        return null;
      }
    },
    {
      field: 'invoice_date',
      label: 'Fecha de emisión',
      type: 'date',
      required: true,
      validation: (value) => !value ? 'La fecha es obligatoria' : null
    },
    {
      field: 'due_date',
      label: 'Fecha de vencimiento',
      type: 'date'
    },
    {
      field: 'inmueble_alias',
      label: 'Inmueble',
      type: 'select',
      options: [
        { value: '', label: 'Personal' },
        ...properties.map(property => ({
          value: property.alias || `property-${property.id}`,
          label: property.alias || property.address
        }))
      ]
    },
    {
      field: 'expense_category',
      label: 'Categoría de gasto',
      type: 'select',
      options: [
        { value: 'Suministros', label: 'Suministros' },
        { value: 'Mantenimiento', label: 'Mantenimiento' },
        { value: 'Administración', label: 'Administración' },
        { value: 'Reforma', label: 'Reforma' },
        { value: 'Mobiliario', label: 'Mobiliario' },
        { value: 'Servicios profesionales', label: 'Servicios profesionales' },
        { value: 'Otros', label: 'Otros' }
      ]
    },
    {
      field: 'expense_category',
      label: 'Categoría de gasto',
      type: 'select',
      options: [
        { value: 'Suministros', label: 'Suministros' },
        { value: 'Mantenimiento', label: 'Mantenimiento' },
        { value: 'Administración', label: 'Administración' },
        { value: 'Reforma', label: 'Reforma' },
        { value: 'Mobiliario', label: 'Mobiliario' },
        { value: 'Servicios profesionales', label: 'Servicios profesionales' },
        { value: 'Otros', label: 'Otros' }
      ]
    },
    {
      field: 'iban_detectado',
      label: 'IBAN',
      type: 'text'
    },
    {
      field: 'is_capex',
      label: '¿Es inversión (CAPEX)?',
      type: 'boolean'
    },
    {
      field: 'iva_rate',
      label: 'Tipo de IVA (%)',
      type: 'select',
      options: [
        { value: '0', label: '0% (Exento)' },
        { value: '4', label: '4% (Súper reducido)' },
        { value: '10', label: '10% (Reducido)' },
        { value: '21', label: '21% (General)' }
      ]
    },
    {
      field: 'iva_amount',
      label: 'Importe IVA',
      type: 'number'
    },
    {
      field: 'base_amount',
      label: 'Base imponible',
      type: 'number'
    }
  ];

  // Validate all fields
  const validateFields = (): boolean => {
    const errors: Record<string, string> = {};
    const fieldDefinitions = getFieldDefinitions();
    
    fieldDefinitions.forEach((fieldDef: FieldCorrection) => {
      if (fieldDef.validation) {
        const value = correctedFields[fieldDef.field];
        const error = fieldDef.validation(value);
        if (error) {
          errors[fieldDef.field] = error;
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle field change
  const handleFieldChange = (field: keyof DocumentOCRFields, value: any) => {
    setCorrectedFields(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Start editing a field
  const startEditing = (field: keyof DocumentOCRFields) => {
    setEditingFields(prev => {
      const newSet = new Set(prev);
      newSet.add(field);
      return newSet;
    });
  };

  // Stop editing a field
  const stopEditing = (field: keyof DocumentOCRFields) => {
    setEditingFields(prev => {
      const newSet = new Set(prev);
      newSet.delete(field);
      return newSet;
    });
  };

  // Handle save
  const handleSave = async () => {
    if (!validateFields()) {
      toast.error('Por favor, corrige los errores antes de guardar');
      return;
    }

    setSaving(true);
    try {
      // Convert to permanent archive with corrections
      const result = await convertToPermanentArchive(documentId, correctedFields);
      
      if (result.success) {
        toast.success('Documento corregido y archivado correctamente');
        onCorrectionComplete(correctedFields);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Error al guardar las correcciones');
      console.error('Error saving corrections:', error);
    } finally {
      setSaving(false);
    }
  };

  // Render field editor
  const renderFieldEditor = (fieldDef: FieldCorrection) => {
    const isEditing = editingFields.has(fieldDef.field);
    const value = correctedFields[fieldDef.field];
    const hasError = validationErrors[fieldDef.field];
    const isBlocking = blockingReasons.some(reason => 
      reason.toLowerCase().includes(fieldDef.field.toLowerCase()) ||
      reason.toLowerCase().includes(fieldDef.label.toLowerCase())
    );

    return (
      <div key={fieldDef.field} className="space-y-2">
        <div className="flex items-center justify-between">
          <label className={`text-sm font-medium ${hasError ? 'text-red-600' : 'text-gray-700'}`}>
            {fieldDef.label}
            {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
            {isBlocking && (
              <AlertTriangle className="inline w-4 h-4 text-amber-500 ml-2" strokeWidth={1.5} />
            )}
          </label>
          
          {!isEditing && (
            <button
              onClick={() => startEditing(fieldDef.field)}
              className="text-blue-600 hover:text-blue-800 p-1"
              >
              title="Editar campo"
            >
              <Edit3 className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2">
            {fieldDef.type === 'text' && (
              <input
                type="text"
                value={String(value || '')}
                onChange={(e) => handleFieldChange(fieldDef.field, e.target.value)}
                className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  hasError 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                style={{ fontFamily: 'Inter, sans-serif' }}
              />
            )}

            {fieldDef.type === 'number' && (
              <input
                type="number"
                step="0.01"
                value={String(value || '')}
                onChange={(e) => handleFieldChange(fieldDef.field, parseFloat(e.target.value) || undefined)}
                className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  hasError 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                style={{ fontFamily: 'Inter, sans-serif' }}
              />
            )}

            {fieldDef.type === 'date' && (
              <input
                type="date"
                value={String(value || '')}
                onChange={(e) => handleFieldChange(fieldDef.field, e.target.value)}
                className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  hasError 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                style={{ fontFamily: 'Inter, sans-serif' }}
              />
            )}

            {fieldDef.type === 'select' && (
              <select
                value={String(value || '')}
                onChange={(e) => handleFieldChange(fieldDef.field, e.target.value)}
                className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  hasError 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {fieldDef.options?.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}

            {fieldDef.type === 'boolean' && (
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) => handleFieldChange(fieldDef.field, e.target.checked)}
                  className="mr-2"
          >
                />
                <span className="text-sm text-gray-600">Sí</span>
              </label>
            )}

            <button
              onClick={() => stopEditing(fieldDef.field)}
              className="text-green-600 hover:text-green-800 p-1"
              >
              title="Confirmar cambio"
            >
              <Check className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <div className={`px-3 py-2 bg-gray-50 rounded-md text-sm ${
            hasError ? 'border border-red-300' : 'border border-gray-200'
          }`}>
            {fieldDef.type === 'boolean' 
              ? (value ? 'Sí' : 'No')
              : (value?.toString() || <span className="text-gray-400 italic">No especificado</span>)
            }
          </div>
        )}

        {hasError && (
          <p className="text-red-600 text-xs">{hasError}</p>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-lg border ${className}`} style={{ 
      borderColor: '#DEE2E6',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold" style={{ color: '#303A4C' }}>
          Corregir datos extraídos
        </h3>
        <p className="mt-1 text-sm" style={{ color: '#6C757D' }}>
          Revisa y corrige los datos extraídos del documento antes de archivar
        </p>
        <p className="mt-1 text-xs font-mono" style={{ color: '#6C757D' }}>
          {filename}
        </p>
      </div>

      {/* Blocking reasons */}
      {blockingReasons.length > 0 && (
        <div className="px-6 py-4 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 mr-2" strokeWidth={1.5} />
            <span className="font-medium text-amber-800">Motivos de revisión</span>
          </div>
          <ul className="text-sm text-amber-700 space-y-1">
            {blockingReasons.map((reason, index) => (
              <li key={index}>• {reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Field editors */}
      <div className="px-6 py-4 space-y-6 max-h-96 overflow-y-auto">
        {getFieldDefinitions().map(renderFieldEditor)}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
          style={{ 
            color: '#6C757D',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          Cancelar
        </button>
        
        <button
          onClick={handleSave}
          disabled={saving || Object.keys(validationErrors).length > 0}
          className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-all flex items-center ${
            saving || Object.keys(validationErrors).length > 0
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:opacity-90 cursor-pointer'
          }`}
          style={{ 
            backgroundColor: '#042C5E',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" strokeWidth={1.5} />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Guardar correcciones
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default DocumentCorrectionWorkflow;