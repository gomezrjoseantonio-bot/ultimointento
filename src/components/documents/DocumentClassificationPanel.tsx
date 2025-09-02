import React, { useState, useEffect } from 'react';
import { Save, Building, User, AlertTriangle, CheckCircle } from 'lucide-react';
import { Document, Property } from '../../services/db';
import { suggestAEATClassification, CATEGORY_TO_AEAT, getExerciseStatus, extractExerciseYear } from '../../services/aeatClassificationService';
import { createTreasuryEventFromDocument, updateTreasuryEventFromDocument } from '../../services/treasuryForecastService';
import { refreshFiscalSummariesForDocument } from '../../services/fiscalSummaryService';
import toast from 'react-hot-toast';

interface DocumentClassificationPanelProps {
  document: Document;
  properties: Property[];
  onUpdate: (updates: Partial<Document>) => void;
  onSave: () => void;
}

const DocumentClassificationPanel: React.FC<DocumentClassificationPanelProps> = ({
  document,
  properties,
  onUpdate,
  onSave
}) => {
  const [formData, setFormData] = useState(document.metadata);
  const [saving, setSaving] = useState(false);

  // Update form data when document changes
  useEffect(() => {
    setFormData(document.metadata);
  }, [document]);

  const handleFieldChange = (field: string, value: any) => {
    const newFormData = { ...formData, [field]: value };
    
    // Auto-suggest AEAT classification when provider changes
    if (field === 'proveedor' && value && newFormData.financialData?.amount) {
      const suggestion = suggestAEATClassification(
        value,
        newFormData.financialData.amount,
        newFormData.title
      );
      
      const exerciseYear = extractExerciseYear(
        newFormData.financialData?.issueDate,
        newFormData.financialData?.servicePeriod?.to
      );
      
      newFormData.aeatClassification = {
        fiscalType: suggestion.fiscalType,
        box: suggestion.box,
        suggested: true,
        exerciseYear,
        status: getExerciseStatus(exerciseYear)
      };
    }
    
    setFormData(newFormData);
    onUpdate({ metadata: newFormData });
  };

  const handleFinancialDataChange = (field: string, value: any) => {
    const newFinancialData = { ...formData.financialData, [field]: value };
    
    // Recalculate AEAT suggestion when amount changes
    if (field === 'amount' && value && formData.proveedor) {
      const suggestion = suggestAEATClassification(
        formData.proveedor,
        value,
        formData.title
      );
      
      const exerciseYear = extractExerciseYear(
        newFinancialData.issueDate,
        newFinancialData.servicePeriod?.to
      );
      
      const newFormData = {
        ...formData,
        financialData: newFinancialData,
        aeatClassification: {
          fiscalType: suggestion.fiscalType,
          box: suggestion.box,
          suggested: true,
          exerciseYear,
          status: getExerciseStatus(exerciseYear)
        }
      };
      
      setFormData(newFormData);
      onUpdate({ metadata: newFormData });
    } else {
      handleFieldChange('financialData', newFinancialData);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update document status
      const updatedFormData = { ...formData, status: 'Asignado' as const };
      setFormData(updatedFormData);
      onUpdate({ metadata: updatedFormData });
      
      // Save document
      await onSave();
      
      // Create/update treasury events if it's an assigned expense document
      if (updatedFormData.destino === 'Inmueble' && updatedFormData.financialData?.amount) {
        const updatedDocument = { ...document, metadata: updatedFormData };
        if (document.id) {
          await updateTreasuryEventFromDocument(updatedDocument);
        } else {
          await createTreasuryEventFromDocument(updatedDocument);
        }
      }
      
      // Refresh fiscal summaries if assigned to property
      if (updatedFormData.destino === 'Inmueble' && updatedFormData.entityId && updatedFormData.aeatClassification?.exerciseYear) {
        const updatedDocument = { ...document, metadata: updatedFormData };
        await refreshFiscalSummariesForDocument(updatedDocument);
      }
      
      toast.success('Documento asignado y clasificado correctamente');
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error('Error al guardar el documento');
    } finally {
      setSaving(false);
    }
  };

  const getCategoriesForDestination = () => {
    if (formData.destino === 'Inmueble') {
      return Object.keys(CATEGORY_TO_AEAT);
    } else {
      return ['Nómina', 'Seguros', 'Suministros', 'Impuestos', 'Suscripciones', 'Otros'];
    }
  };

  const getStatusBadge = () => {
    if (formData.aeatClassification?.status === 'Vivo') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
          <CheckCircle className="w-3 h-3" />
          Vivo (deducible)
        </span>
      );
    } else if (formData.aeatClassification?.status === 'Prescrito') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full">
          <AlertTriangle className="w-3 h-3" />
          Prescrito (histórico)
        </span>
      );
    }
    return null;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Clasificación y Asignación</h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Confirmar y guardar'}
        </button>
      </div>

      {/* Destination */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Destino</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleFieldChange('destino', 'Personal')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              formData.destino === 'Personal'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <User className="w-4 h-4" />
            Personal
          </button>
          <button
            type="button"
            onClick={() => handleFieldChange('destino', 'Inmueble')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              formData.destino === 'Inmueble'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Building className="w-4 h-4" />
            Inmueble
          </button>
        </div>
      </div>

      {/* Property selection if Inmueble */}
      {formData.destino === 'Inmueble' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Inmueble</label>
          <select
            value={formData.entityId || ''}
            onChange={(e) => {
              const propertyId = e.target.value ? parseInt(e.target.value) : undefined;
              handleFieldChange('entityId', propertyId);
              handleFieldChange('entityType', propertyId ? 'property' : undefined);
            }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50"
          >
            <option value="">Seleccionar inmueble</option>
            {properties.map(property => (
              <option key={property.id} value={property.id}>
                {property.alias} - {property.address}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Provider */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Proveedor</label>
        <input
          type="text"
          value={formData.proveedor || ''}
          onChange={(e) => handleFieldChange('proveedor', e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50"
          placeholder="Nombre del proveedor"
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Categoría</label>
        <select
          value={formData.categoria || ''}
          onChange={(e) => handleFieldChange('categoria', e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50"
        >
          <option value="">Seleccionar categoría</option>
          {getCategoriesForDestination().map(category => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {/* Financial Data */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700">Datos Financieros</h4>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Importe Total</label>
            <input
              type="number"
              step="0.01"
              value={formData.financialData?.amount || ''}
              onChange={(e) => handleFinancialDataChange('amount', parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50"
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Base Imponible</label>
            <input
              type="number"
              step="0.01"
              value={formData.financialData?.base || ''}
              onChange={(e) => handleFinancialDataChange('base', parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50"
              placeholder="0,00"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">IVA</label>
            <input
              type="number"
              step="0.01"
              value={formData.financialData?.iva || ''}
              onChange={(e) => handleFinancialDataChange('iva', parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50"
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fecha Emisión</label>
            <input
              type="date"
              value={formData.financialData?.issueDate || ''}
              onChange={(e) => handleFinancialDataChange('issueDate', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50"
            />
          </div>
        </div>
      </div>

      {/* AEAT Classification for Inmueble */}
      {formData.destino === 'Inmueble' && formData.aeatClassification && (
        <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-blue-900">Clasificación Fiscal AEAT</h4>
            {getStatusBadge()}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-blue-700 mb-1">Casilla AEAT</label>
              <div className="px-3 py-2 bg-white rounded-lg border text-sm font-medium">
                {formData.aeatClassification.box}
              </div>
            </div>
            <div>
              <label className="block text-xs text-blue-700 mb-1">Ejercicio de Devengo</label>
              <div className="px-3 py-2 bg-white rounded-lg border text-sm">
                {formData.aeatClassification.exerciseYear}
              </div>
            </div>
          </div>
          
          {formData.aeatClassification.suggested && (
            <div className="text-xs text-blue-600">
              <AlertTriangle className="inline w-3 h-3 mr-1" />
              Clasificación sugerida automáticamente
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Notas</label>
        <textarea
          value={formData.notas || ''}
          onChange={(e) => handleFieldChange('notas', e.target.value)}
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50"
          placeholder="Notas adicionales..."
        />
      </div>
    </div>
  );
};

export default DocumentClassificationPanel;