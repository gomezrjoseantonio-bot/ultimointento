import React, { useState, useEffect, useRef } from 'react';
import { Save, Building, User, AlertTriangle, CheckCircle } from 'lucide-react';
import { Document, Property } from '../../services/db';
import { suggestAEATClassification, CATEGORY_TO_AEAT, getExerciseStatus, extractExerciseYear } from '../../services/aeatClassificationService';
import { createTreasuryEventFromDocument, updateTreasuryEventFromDocument } from '../../services/treasuryForecastService';
import { refreshFiscalSummariesForDocument } from '../../services/fiscalSummaryService';
import { routeOCRDocumentToTreasury } from '../../services/treasuryCreationService';
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
  const [statusMessage, setStatusMessage] = useState('');
  
  // Refs for accessibility and focus management
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  // Update form data when document changes
  useEffect(() => {
    setFormData(document.metadata);
  }, [document]);

  // Announce status changes to screen readers
  useEffect(() => {
    if (statusMessage) {
      // Announce to screen readers
      const announcement = window.document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = statusMessage;
      window.document.body.appendChild(announcement);
      
      // Clean up after announcement
      setTimeout(() => {
        window.document.body.removeChild(announcement);
      }, 1000);
    }
  }, [statusMessage]);

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
    setStatusMessage('Guardando documento...');
    
    try {
      // Update document status
      const updatedFormData = { ...formData, status: 'Asignado' as const };
      setFormData(updatedFormData);
      onUpdate({ metadata: updatedFormData });
      
      // Save document
      await onSave();
      
      setStatusMessage('Documento guardado correctamente');
      
      // H10: Route document to Treasury containers if it has financial data
      if (updatedFormData.financialData?.amount && document.id) {
        try {
          const updatedDocument = { ...document, metadata: updatedFormData };
          const routingResult = await routeOCRDocumentToTreasury(updatedDocument);
          
          if (routingResult.type !== 'none' && routingResult.recordId) {
            const message = `Documento enrutado a ${routingResult.type === 'ingreso' ? 'Ingresos' : routingResult.type === 'gasto' ? 'Gastos' : 'CAPEX'}: ${routingResult.reason}`;
            toast.success(message);
            setStatusMessage(message);
          }
        } catch (error) {
          console.error('Error routing document to treasury:', error);
          // Don't fail the save if routing fails
          toast.error('Error al enrutar documento a Tesorería');
          setStatusMessage('Documento guardado, pero hubo un error en el enrutado');
        }
      }
      
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
      setStatusMessage('Proceso completado exitosamente');
    } catch (error) {
      console.error('Error saving document:', error);
      const errorMessage = 'Error al guardar el documento';
      toast.error(errorMessage);
      setStatusMessage(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Keyboard navigation handler
  const handleKeyDown = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
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
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-success-100 text-success-700 rounded-full">
          <CheckCircle className="w-3 h-3" />
          Vivo (deducible)
        </span>
      );
    } else if (formData.aeatClassification?.status === 'Prescrito') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-warning-100 text-orange-700 rounded-full">
          <AlertTriangle className="w-3 h-3" />
          Prescrito (histórico)
        </span>
      );
    }
    return null;
  };

  return (
    <section 
      className="p-6 space-y-6"
      role="form"
      aria-labelledby="classification-title"
      aria-describedby="classification-description"
    >
      {/* Hidden screen reader description */}
      <div id="classification-description" className="sr-only">
        Formulario para clasificar y asignar documentos. Complete los campos requeridos y guarde los cambios.
      </div>
      
      {/* Status announcements for screen readers */}
      <div 
        ref={statusRef}
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      >
        {statusMessage}
      </div>

      <header className="flex items-center justify-between">
        <h3 id="classification-title" className="text-lg font-semibold text-gray-900">
          Clasificación y Asignación
        </h3>
        <button
          ref={saveButtonRef}
          onClick={handleSave}
          disabled={saving}
          aria-describedby="save-button-description"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          <Save className="w-4 h-4" aria-hidden="true" />
          {saving ? 'Guardando...' : 'Confirmar y guardar'}
        </button>
        <div id="save-button-description" className="sr-only">
          Guarda la clasificación y asignación del documento
        </div>
      </header>

      {/* Destination */}
      <fieldset className="space-y-2">
        <legend className="block text-sm font-medium text-gray-700">Destino</legend>
        <div className="flex gap-3" role="radiogroup" aria-labelledby="destination-legend">
          <button
            type="button"
            role="radio"
            aria-checked={formData.destino === 'Personal'}
            onClick={() => handleFieldChange('destino', 'Personal')}
            onKeyDown={(e) => handleKeyDown(e, () => handleFieldChange('destino', 'Personal'))}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
              formData.destino === 'Personal'
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
            aria-describedby="personal-description"
          >
            <User className="w-4 h-4" aria-hidden="true" />
            Personal
          </button>
          <div id="personal-description" className="sr-only">
            Asignar documento a gastos personales
          </div>
          
          <button
            type="button"
            role="radio"
            aria-checked={formData.destino === 'Inmueble'}
            onClick={() => handleFieldChange('destino', 'Inmueble')}
            onKeyDown={(e) => handleKeyDown(e, () => handleFieldChange('destino', 'Inmueble'))}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
              formData.destino === 'Inmueble'
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
            aria-describedby="property-description"
          >
            <Building className="w-4 h-4" aria-hidden="true" />
            Inmueble
          </button>
          <div id="property-description" className="sr-only">
            Asignar documento a un inmueble específico
          </div>
        </div>
      </fieldset>

      {/* Property selection if Inmueble */}
      {formData.destino === 'Inmueble' && (
        <div className="space-y-2">
          <label htmlFor="property-select" className="block text-sm font-medium text-gray-700">
            Inmueble
          </label>
          <select
            id="property-select"
            value={formData.entityId || ''}
            onChange={(e) => {
              const propertyId = e.target.value ? parseInt(e.target.value) : undefined;
              handleFieldChange('entityId', propertyId);
              handleFieldChange('entityType', propertyId ? 'property' : undefined);
            }}
            aria-describedby="property-help"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:border-primary-300 focus:ring-2 focus:ring-primary-200 focus:ring-opacity-50 focus:outline-none"
          >
            <option value="">Seleccionar inmueble</option>
            {properties.map(property => (
              <option key={property.id} value={property.id}>
                {property.alias} - {property.address}
              </option>
            ))}
          </select>
          <div id="property-help" className="text-xs text-gray-500">
            Seleccione el inmueble al que corresponde este documento
          </div>
        </div>
      )}

      {/* Provider */}
      <div className="space-y-2">
        <label htmlFor="provider-input" className="block text-sm font-medium text-gray-700">
          Proveedor
        </label>
        <input
          id="provider-input"
          type="text"
          value={formData.proveedor || ''}
          onChange={(e) => handleFieldChange('proveedor', e.target.value)}
          aria-describedby="provider-help"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:border-primary-300 focus:ring-2 focus:ring-primary-200 focus:ring-opacity-50 focus:outline-none"
          placeholder="Nombre del proveedor"
        />
        <div id="provider-help" className="text-xs text-gray-500">
          Ingrese el nombre del proveedor o empresa que emitió el documento
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label htmlFor="category-select" className="block text-sm font-medium text-gray-700">
          Categoría
        </label>
        <select
          id="category-select"
          value={formData.categoria || ''}
          onChange={(e) => handleFieldChange('categoria', e.target.value)}
          aria-describedby="category-help"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:border-primary-300 focus:ring-2 focus:ring-primary-200 focus:ring-opacity-50 focus:outline-none"
        >
          <option value="">Seleccionar categoría</option>
          {getCategoriesForDestination().map(category => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <div id="category-help" className="text-xs text-gray-500">
          Seleccione la categoría que mejor describe el tipo de gasto
        </div>
      </div>

      {/* Financial Data */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-gray-700">Datos Financieros</legend>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="total-amount" className="block text-xs text-gray-500 mb-1">
              Importe Total
            </label>
            <input
              id="total-amount"
              type="number"
              step="0.01"
              value={formData.financialData?.amount || ''}
              onChange={(e) => handleFinancialDataChange('amount', parseFloat(e.target.value) || 0)}
              aria-describedby="total-amount-help"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary-300 focus:ring-2 focus:ring-primary-200 focus:ring-opacity-50 focus:outline-none"
              placeholder="0,00"
            />
            <div id="total-amount-help" className="sr-only">
              Ingrese el importe total del documento en euros
            </div>
          </div>
          <div>
            <label htmlFor="base-amount" className="block text-xs text-gray-500 mb-1">
              Base Imponible
            </label>
            <input
              id="base-amount"
              type="number"
              step="0.01"
              value={formData.financialData?.base || ''}
              onChange={(e) => handleFinancialDataChange('base', parseFloat(e.target.value) || 0)}
              aria-describedby="base-amount-help"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary-300 focus:ring-2 focus:ring-primary-200 focus:ring-opacity-50 focus:outline-none"
              placeholder="0,00"
            />
            <div id="base-amount-help" className="sr-only">
              Ingrese la base imponible sin IVA
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="vat-amount" className="block text-xs text-gray-500 mb-1">
              IVA
            </label>
            <input
              id="vat-amount"
              type="number"
              step="0.01"
              value={formData.financialData?.iva || ''}
              onChange={(e) => handleFinancialDataChange('iva', parseFloat(e.target.value) || 0)}
              aria-describedby="vat-amount-help"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary-300 focus:ring-2 focus:ring-primary-200 focus:ring-opacity-50 focus:outline-none"
              placeholder="0,00"
            />
            <div id="vat-amount-help" className="sr-only">
              Ingrese el importe del IVA
            </div>
          </div>
          <div>
            <label htmlFor="issue-date" className="block text-xs text-gray-500 mb-1">
              Fecha Emisión
            </label>
            <input
              id="issue-date"
              type="date"
              value={formData.financialData?.issueDate || ''}
              onChange={(e) => handleFinancialDataChange('issueDate', e.target.value)}
              aria-describedby="issue-date-help"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary-300 focus:ring-2 focus:ring-primary-200 focus:ring-opacity-50 focus:outline-none"
            />
            <div id="issue-date-help" className="sr-only">
              Seleccione la fecha de emisión del documento
            </div>
          </div>
        </div>
      </fieldset>

      {/* AEAT Classification for Inmueble */}
      {formData.destino === 'Inmueble' && formData.aeatClassification && (
        <section className="space-y-4 p-4 bg-primary-50 rounded-lg" aria-labelledby="aeat-title">
          <div className="flex items-center justify-between">
            <h4 id="aeat-title" className="text-sm font-medium text-primary-900">
              Clasificación Fiscal AEAT
            </h4>
            {getStatusBadge()}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="block text-xs text-primary-700 mb-1" id="aeat-box-label">
                Casilla AEAT
              </div>
              <div 
                className="px-3 py-2 bg-white rounded-lg border text-sm font-medium"
                aria-labelledby="aeat-box-label"
                role="textbox"
                aria-readonly="true"
              >
                {formData.aeatClassification.box}
              </div>
            </div>
            <div>
              <div className="block text-xs text-primary-700 mb-1" id="exercise-year-label">
                Ejercicio de Devengo
              </div>
              <div 
                className="px-3 py-2 bg-white rounded-lg border text-sm"
                aria-labelledby="exercise-year-label"
                role="textbox"
                aria-readonly="true"
              >
                {formData.aeatClassification.exerciseYear}
              </div>
            </div>
          </div>
          
          {formData.aeatClassification.suggested && (
            <div className="text-xs text-primary-600" role="status" aria-live="polite">
              <AlertTriangle className="inline w-3 h-3 mr-1" aria-hidden="true" />
              Clasificación sugerida automáticamente
            </div>
          )}
        </section>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <label htmlFor="notes-textarea" className="block text-sm font-medium text-gray-700">
          Notas
        </label>
        <textarea
          id="notes-textarea"
          value={formData.notas || ''}
          onChange={(e) => handleFieldChange('notas', e.target.value)}
          rows={3}
          aria-describedby="notes-help"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:border-primary-300 focus:ring-2 focus:ring-primary-200 focus:ring-opacity-50 focus:outline-none"
          placeholder="Notas adicionales..."
        />
        <div id="notes-help" className="text-xs text-gray-500">
          Agregue cualquier información adicional relevante para este documento
        </div>
      </div>
    </section>
  );
};

export default DocumentClassificationPanel;