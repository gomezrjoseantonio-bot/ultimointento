// H-OCR-ALIGN: OCR Panel for strict 1:1 mapping with Google Document AI
import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  FileText, 
  Calendar, 
  CreditCard,
  Building,
  Hash,
  MapPin,
  Info,
  Loader2,
  Bug,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { OCRResult, OCRField } from '../../services/db';
import { 
  formatCurrency, 
  normalizeDateToSpanish, 
  OCR_ACCEPT_CONFIDENCE, 
  validateInvoiceAmounts, 
  validateInvoiceDates, 
  checkRequiredFieldsForApply,
  selectBestPageForExtraction
} from '../../services/ocrService';
import { alignDocumentAI, AlignedInvoice } from './ocr/alignDocumentAI';
import toast from 'react-hot-toast';

interface OcrPanelProps {
  document: any; // Document with OCR result
  onApplyToExpense?: (ocrData: any) => void;
  onApplyToCAPEX?: (ocrData: any) => void;
  onUpdate?: (documentId: number, updates: any) => void;
  setShowInvoiceBreakdown?: (show: boolean) => void; // H-OCR-REFORM: For invoice breakdown modal
}

interface FieldMapping {
  name: string;
  label: string;
  icon: React.ComponentType<any>;
  format?: 'currency' | 'date' | 'text';
  isCritical: boolean;
}

interface ProcessedField extends FieldMapping {
  value: string;
  confidence: number;
  status: 'valid' | 'pending' | 'empty';
  editable: boolean;
  page?: number;
  rawValue?: string; // H-OCR-ALIGN: Raw value for pending fields
}

// H-OCR-ALIGN: Field mappings for supported entity types (strict 1:1 mapping)
const FIELD_MAPPINGS: FieldMapping[] = [
  { name: 'total_amount', label: 'Total factura', icon: CreditCard, format: 'currency', isCritical: true },
  { name: 'subtotal', label: 'Base imponible', icon: CreditCard, format: 'currency', isCritical: false },
  { name: 'net_amount', label: 'Base imponible', icon: CreditCard, format: 'currency', isCritical: false },
  { name: 'tax_amount', label: 'IVA', icon: CreditCard, format: 'currency', isCritical: false },
  { name: 'tax_rate', label: 'Tipo IVA', icon: CreditCard, format: 'text', isCritical: false },
  { name: 'currency', label: 'Moneda', icon: CreditCard, format: 'text', isCritical: true },
  { name: 'invoice_id', label: 'Nº factura', icon: Hash, format: 'text', isCritical: true },
  { name: 'invoice_date', label: 'Fecha factura', icon: Calendar, format: 'date', isCritical: true },
  { name: 'due_date', label: 'Fecha vencimiento', icon: Calendar, format: 'date', isCritical: false },
  { name: 'supplier_name', label: 'Proveedor', icon: Building, format: 'text', isCritical: true },
  { name: 'supplier_tax_id', label: 'NIF proveedor', icon: FileText, format: 'text', isCritical: false },
];

// H-OCR-ALIGN: Confidence thresholds and colors (strict 0.80 threshold)
const CONFIDENCE_THRESHOLDS = {
  HIGH: OCR_ACCEPT_CONFIDENCE, // 0.80 - Only these fields can be auto-applied
  MEDIUM: 0.60
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'text-success-500 bg-success-50'; // Verde OK según guía
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'text-warning-500 bg-amber-50'; // Amarillo warning según guía
  return 'text-error-500 bg-error-50'; // Rojo error según guía
};

const getConfidenceIcon = (confidence: number) => {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return CheckCircle;
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return AlertTriangle;
  return XCircle;
};

const getConfidenceBadge = (confidence: number): string => {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'OK';
  return 'Pendiente'; // H-OCR-ALIGN: Any field below threshold is "Pendiente"
};

// H-OCR-FIX: Format field value according to its type
const formatFieldValue = (value: string, format?: string): string => {
  if (!value) return '';
  
  switch (format) {
    case 'currency':
      // Parse the value and format as Spanish currency
      const numValue = parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.'));
      return isNaN(numValue) ? value : formatCurrency(numValue);
    
    case 'date':
      // Normalize to Spanish date format
      return normalizeDateToSpanish(value);
    
    case 'text':
    default:
      return value;
  }
};

// H-OCR-ALIGN: Process multiple tax amounts - sum only if ALL meet threshold
const processTaxAmounts = (fields: OCRField[]): { value: string; confidence: number; allValid: boolean } => {
  const taxFields = fields.filter(f => f.name === 'tax_amount');
  
  if (taxFields.length === 0) {
    return { value: '', confidence: 0, allValid: false };
  }
  
  if (taxFields.length === 1) {
    const field = taxFields[0];
    const isValid = field.confidence >= CONFIDENCE_THRESHOLDS.HIGH;
    return { 
      value: isValid ? field.value : '', // H-OCR-ALIGN: Only show value if confidence is high enough
      confidence: field.confidence,
      allValid: isValid
    };
  }
  
  // Multiple tax amounts - H-OCR-ALIGN: sum them only if ALL have high confidence
  const allHighConfidence = taxFields.every(f => f.confidence >= CONFIDENCE_THRESHOLDS.HIGH);
  
  if (allHighConfidence) {
    const total = taxFields.reduce((sum, field) => {
      const value = parseFloat(field.value.replace(/[^\d,.-]/g, '').replace(',', '.'));
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
    
    const avgConfidence = taxFields.reduce((sum, f) => sum + f.confidence, 0) / taxFields.length;
    
    return {
      value: formatCurrency(total),
      confidence: avgConfidence,
      allValid: true
    };
  }
  
  // H-OCR-ALIGN: If not all are high confidence, don't sum - leave empty (no "invention")
  return { value: '', confidence: 0, allValid: false };
};

// H-OCR-ALIGN: Get best page for multi-page documents based on monetary entities
const selectBestPage = (ocrResult: OCRResult): number => {
  if (!ocrResult.pageInfo || ocrResult.pageInfo.totalPages <= 1) {
    return 1;
  }
  
  // Use the enhanced page selection with OCR fields
  const { bestPageIndex } = selectBestPageForExtraction([], ocrResult.fields);
  return bestPageIndex + 1; // Convert to 1-based indexing for UI
};

const OcrPanel: React.FC<OcrPanelProps> = ({ document, onApplyToExpense, onApplyToCAPEX, onUpdate, setShowInvoiceBreakdown }) => {
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [editableFields, setEditableFields] = useState<Record<string, string>>({});
  const [editableServiceFields, setEditableServiceFields] = useState<Record<string, string>>({});
  const [editablePaymentFields, setEditablePaymentFields] = useState<Record<string, string>>({});
  const [processingApply, setProcessingApply] = useState(false);
  const [showRawEntities, setShowRawEntities] = useState(false);
  const [showDevJson, setShowDevJson] = useState(false);
  const [aligned, setAligned] = useState<AlignedInvoice | undefined>(undefined);

  const ocrResult = document?.metadata?.ocr as OCRResult;
  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (ocrResult?.pageInfo) {
      setSelectedPage(selectBestPage(ocrResult));
    }
  }, [ocrResult]);

  // Calculate aligned data when OCR result is completed
  useEffect(() => {
    if (ocrResult && ocrResult.status === 'completed') {
      try {
        const alignedData = alignDocumentAI(ocrResult);
        setAligned(alignedData);
        
        // Telemetry for alignment
        const confidenceScores = Object.values(alignedData.meta.rawConfidenceSummary)
          .map(c => c?.score || 0)
          .filter(s => s > 0);
        const minConfidence = confidenceScores.length > 0 ? Math.min(...confidenceScores) : 0;
        
        console.info('[OCR-ALIGN]', { 
          total: alignedData.invoice.total.value, 
          confMin: minConfidence 
        });
      } catch (error) {
        console.error('Error aligning DocumentAI result:', error);
        setAligned(undefined);
      }
    }
  }, [ocrResult]);

  // Early return if no OCR result - moved after hooks to comply with rules of hooks
  if (!ocrResult || ocrResult.status !== 'completed') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <Eye className="mx-auto h-8 w-8 mb-2" />
          <p>No hay datos de OCR disponibles</p>
          {ocrResult?.status === 'processing' && (
            <p className="text-sm mt-1">Procesando documento...</p>
          )}
          {ocrResult?.status === 'error' && (
            <div className="mt-2">
              <p className="text-sm text-error-600">Error en el procesamiento OCR</p>
              {ocrResult.error && (
                <p className="text-xs text-gray-400 mt-1">{ocrResult.error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // H-OCR-DEBUG: Show debug info if no fields were extracted but OCR completed
  if (ocrResult.fields.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <Eye className="mx-auto h-8 w-8 mb-2" />
          <p>OCR completado pero no se encontraron campos</p>
          <p className="text-sm mt-1">Motor: {ocrResult.engine}</p>
          <p className="text-sm">Confianza global: {(ocrResult.confidenceGlobal * 100).toFixed(1)}%</p>
          {isDev && (
            <div className="mt-4 text-left">
              <button
                onClick={() => setShowDevJson(true)}
                className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded"
              >
                Ver respuesta cruda (DEV)
              </button>
              {showDevJson && (
                <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-auto max-h-96 mt-2">
                  {JSON.stringify(ocrResult, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // H-OCR-ALIGN: Process fields with strict 1:1 mapping - NO "invention"
  const processedFields: ProcessedField[] = FIELD_MAPPINGS.map(mapping => {
    // Find the field in OCR results - only exact matches, no substitution
    const ocrField = ocrResult.fields.find(f => f.name === mapping.name);
    
    if (!ocrField) {
      return {
        ...mapping,
        value: '',
        confidence: 0,
        status: 'empty' as const,
        editable: true,
        page: undefined
      };
    }

    // Special handling for tax amounts (sum multiple if all high confidence)
    if (mapping.name === 'tax_amount') {
      const taxResult = processTaxAmounts(ocrResult.fields);
      return {
        ...mapping,
        value: taxResult.value,
        confidence: taxResult.confidence,
        status: taxResult.allValid ? 'valid' : 'pending' as const,
        editable: true,
        page: ocrField.page
      };
    }

    // H-OCR-ALIGN: Only use the field if confidence meets threshold
    const meetsThreshold = ocrField.confidence >= CONFIDENCE_THRESHOLDS.HIGH;
    const formattedValue = meetsThreshold ? formatFieldValue(ocrField.value, mapping.format) : '';
    
    return {
      ...mapping,
      value: formattedValue,
      confidence: ocrField.confidence,
      status: meetsThreshold ? 'valid' : 'pending' as const,
      editable: true,
      page: ocrField.page,
      rawValue: ocrField.value // Keep raw value for display in pending state
    };
  });

  // H-OCR-ALIGN: Check validation rules for Apply button
  const requiredFieldsCheck = checkRequiredFieldsForApply(ocrResult.fields);
  
  // H-OCR-ALIGN: Validate amount harmony if we have the required fields
  let amountValidation = { isValid: true, errorMessage: '' };
  const totalField = processedFields.find(f => f.name === 'total_amount' && f.status === 'valid');
  const subtotalField = processedFields.find(f => (f.name === 'subtotal' || f.name === 'net_amount') && f.status === 'valid');
  const taxField = processedFields.find(f => f.name === 'tax_amount' && f.status === 'valid');
  
  if (totalField && subtotalField && taxField) {
    const total = parseFloat(totalField.value.replace(/[^\d,.-]/g, '').replace(',', '.'));
    const subtotal = parseFloat(subtotalField.value.replace(/[^\d,.-]/g, '').replace(',', '.'));
    const tax = parseFloat(taxField.value.replace(/[^\d,.-]/g, '').replace(',', '.'));
    
    const validation = validateInvoiceAmounts(subtotal, tax, total);
    if (!validation.isValid) {
      amountValidation = {
        isValid: false,
        errorMessage: `Los importes no cuadran: ${subtotal + tax} ≠ ${total} (diferencia: €${validation.difference.toFixed(2)})`
      };
    }
  }
  
  // H-OCR-ALIGN: Validate dates
  let dateValidation = { isValid: true, errorMessage: '' };
  const invoiceDateField = processedFields.find(f => f.name === 'invoice_date' && f.status === 'valid');
  const dueDateField = processedFields.find(f => f.name === 'due_date' && f.status === 'valid');
  
  if (invoiceDateField) {
    const validation = validateInvoiceDates(invoiceDateField.value, dueDateField?.value);
    if (!validation.invoiceDateValid || !validation.dueDateValid) {
      dateValidation = {
        isValid: false,
        errorMessage: validation.errorMessage || 'Fechas no válidas'
      };
    }
  }
  
  // H-OCR-ALIGN: Final check for Apply button
  const canApply = requiredFieldsCheck.canApply && amountValidation.isValid && dateValidation.isValid;

  const handleFieldEdit = (fieldName: string, value: string) => {
    setEditableFields(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleConfirmAndSave = async () => {
    if (!aligned || !onUpdate) return;

    try {
      // Get final values from editable fields
      const finalServiceAddress = editableServiceFields.serviceAddress ?? aligned.service.serviceAddress ?? '';
      const finalSupplyPointId = editableServiceFields.supplyPointId ?? aligned.service.supplyPointId ?? '';
      const finalPaymentMethod = editablePaymentFields.method ?? aligned.payment.method;
      const finalIban = editablePaymentFields.iban ?? aligned.payment.iban ?? '';
      const finalPaymentDate = editablePaymentFields.paymentDate ?? aligned.payment.paymentDate ?? '';

      // Create metadata object
      const extendedMetadata = {
        ...document.metadata,
        service: {
          address: finalServiceAddress,
          cups: finalSupplyPointId
        },
        payment: {
          method: finalPaymentMethod,
          iban: finalIban,
          date: finalPaymentDate
        }
      };

      // Generate automatic tags
      const newTags = [...(document.metadata.tags || [])];
      
      // Provider tag
      if (aligned.supplier.name) {
        const providerTag = `proveedor/${aligned.supplier.name.toLowerCase().replace(/\s+/g, '-')}`;
        if (!newTags.includes(providerTag)) {
          newTags.push(providerTag);
        }
      }

      // Payment method tag
      const paymentTag = `pago/metodo:${finalPaymentMethod}`;
      if (!newTags.includes(paymentTag)) {
        newTags.push(paymentTag);
      }

      // CUPS tag
      if (finalSupplyPointId) {
        const cupsTag = `suministro/cups:${finalSupplyPointId}`;
        if (!newTags.includes(cupsTag)) {
          newTags.push(cupsTag);
        }
      }

      // Payment date forecast tag
      if (finalPaymentDate) {
        try {
          const paymentDateObj = new Date(finalPaymentDate);
          const yearMonth = `${paymentDateObj.getFullYear()}-${String(paymentDateObj.getMonth() + 1).padStart(2, '0')}`;
          const forecastTag = `previsión/${yearMonth}`;
          if (!newTags.includes(forecastTag)) {
            newTags.push(forecastTag);
          }
        } catch (e) {
          console.warn('Error parsing payment date for forecast tag:', e);
        }
      }

      extendedMetadata.tags = newTags;

      // Update document
      await onUpdate(document.id, { metadata: extendedMetadata });
      toast.success('Metadatos OCR guardados correctamente');

    } catch (error) {
      console.error('Error saving OCR metadata:', error);
      toast.error('Error al guardar los metadatos');
    }
  };

  const handleApplyToExpense = async () => {
    if (!canApply || !onApplyToExpense) return;
    
    setProcessingApply(true);
    try {
      // Prepare OCR data for expense creation with metadata
      const ocrData = processedFields.reduce((acc, field) => {
        const finalValue = editableFields[field.name] || field.value;
        if (finalValue) {
          acc[field.name] = finalValue;
        }
        return acc;
      }, {} as Record<string, string>);

      // H-OCR-ALIGN: Add OCR metadata (as JSON string)
      (ocrData as any).ocrMeta = JSON.stringify({
        pageUsed: selectedPage,
        confidences: {
          total: totalField?.confidence || 0,
          subtotal: subtotalField?.confidence || 0,
          tax: taxField?.confidence || 0
        },
        checks: {
          sumOk: amountValidation.isValid,
          datesOk: dateValidation.isValid
        }
      });

      await onApplyToExpense(ocrData);
    } finally {
      setProcessingApply(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Eye className="h-5 w-5 text-current" />
            <h3 className="text-lg font-semibold text-gray-900">Campos extraídos (OCR)</h3>
            {ocrResult.engineInfo && (
              <span className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-800 rounded-md">
                {ocrResult.engineInfo.displayName}
              </span>
            )}
          </div>
          
          {/* Page selector for multi-page documents */}
          {ocrResult.pageInfo && ocrResult.pageInfo.totalPages > 1 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Página:</span>
              <select
                value={selectedPage}
                onChange={(e) => setSelectedPage(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded-md px-2 py-1"
              >
                {Array.from({ length: ocrResult.pageInfo.totalPages }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1} {ocrResult.pageInfo?.allPageScores && 
                      `(Score: ${ocrResult.pageInfo.allPageScores[i]?.toFixed(1) || '0'})`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* H-OCR-ALIGN: Lateral panel for raw entities */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <button
          onClick={() => setShowRawEntities(!showRawEntities)}
          className="flex items-center space-x-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          {showRawEntities ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span>Entidades detectadas (crudo)</span>
          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
            {ocrResult.fields.length} entidades
          </span>
        </button>
        
        {showRawEntities && (
          <div className="mt-4 overflow-hidden border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confianza</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Página</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {ocrResult.fields.map((field, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{field.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={field.value}>
                      {field.value}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-medium rounded-md ${getConfidenceColor(field.confidence)}`}>
                        {(field.confidence * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {field.page || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* H-OCR-ALIGN: DEV-only JSON viewer */}
      {isDev && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={() => setShowDevJson(!showDevJson)}
            className="flex items-center space-x-2 text-sm font-medium text-amber-600 hover:text-amber-700"
          >
            {showDevJson ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Bug className="h-4 w-4" />
            <span>Ver JSON (DEV)</span>
          </button>
          
          {showDevJson && (
            <div className="mt-4">
              <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-auto max-h-96">
                {JSON.stringify(ocrResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Conditional Content: Aligned Sections or Fields Table */}
      <div className="p-6">
        {aligned ? (
          /* Aligned Invoice Data Sections */
          <div className="space-y-6">
            <section>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Proveedor</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Nombre:</span>
                  <span className="text-sm font-medium">{aligned.supplier.name || '—'}</span>
                  {aligned.meta.rawConfidenceSummary.supplier_name && aligned.meta.rawConfidenceSummary.supplier_name.score < 0.80 && (
                    <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded">Revisar</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">NIF:</span>
                  <span className="text-sm font-medium">{aligned.supplier.taxId || '—'}</span>
                  {aligned.meta.rawConfidenceSummary.supplier_tax_id && aligned.meta.rawConfidenceSummary.supplier_tax_id.score < 0.80 && (
                    <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded">Revisar</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Email:</span>
                  <span className="text-sm font-medium">{aligned.supplier.email || '—'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Dirección:</span>
                  <span className="text-sm font-medium">{aligned.supplier.address || '—'}</span>
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Factura</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Nº:</span>
                  <span className="text-sm font-medium">{aligned.invoice.id || '—'}</span>
                  {aligned.meta.rawConfidenceSummary.invoice_id && aligned.meta.rawConfidenceSummary.invoice_id.score < 0.80 && (
                    <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded">Revisar</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Fecha:</span>
                  <span className="text-sm font-medium">{aligned.invoice.date || '—'}</span>
                  {aligned.meta.rawConfidenceSummary.invoice_date && aligned.meta.rawConfidenceSummary.invoice_date.score < 0.80 && (
                    <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded">Revisar</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Vencimiento:</span>
                  <span className="text-sm font-medium">{aligned.invoice.dueDate || '—'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Moneda:</span>
                  <span className="text-sm font-medium">{aligned.invoice.currency}</span>
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Importes</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Base:</span>
                  <span className="text-sm font-medium">{aligned.invoice.net.value.toFixed(2)} {aligned.invoice.currency}</span>
                  {aligned.meta.rawConfidenceSummary.net_amount && aligned.meta.rawConfidenceSummary.net_amount.score < 0.80 && (
                    <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded">Revisar</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Impuestos:</span>
                  <span className="text-sm font-medium">{aligned.invoice.tax.value.toFixed(2)} {aligned.invoice.currency}</span>
                  {aligned.meta.rawConfidenceSummary.total_tax_amount && aligned.meta.rawConfidenceSummary.total_tax_amount.score < 0.80 && (
                    <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded">Revisar</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Total:</span>
                  <span className="text-sm font-bold">{aligned.invoice.total.value.toFixed(2)} {aligned.invoice.currency}</span>
                  {aligned.meta.rawConfidenceSummary.total_amount && aligned.meta.rawConfidenceSummary.total_amount.score < 0.80 && (
                    <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded">Revisar</span>
                  )}
                </div>
                {aligned.meta.blockingErrors.length > 0 && (
                  <div className="mt-2 p-2 bg-error-50 border border-error-200 rounded" role="alert">
                    <span className="text-sm text-error-800">⚠ {aligned.meta.blockingErrors[0]}</span>
                  </div>
                )}
                {/* Amount validation */}
                {aligned.invoice.net.value > 0 && aligned.invoice.tax.value > 0 && aligned.invoice.total.value > 0 && (
                  Math.abs((aligned.invoice.net.value + aligned.invoice.tax.value) - aligned.invoice.total.value) <= 0.02 ? (
                    <div className="mt-2 p-2 bg-success-50 border border-success-200 rounded">
                      <span className="text-sm text-success-800">✓ Los importes cuadran correctamente</span>
                    </div>
                  ) : (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
                      <span className="text-sm text-amber-800">⚠ Revisar importes: {(aligned.invoice.net.value + aligned.invoice.tax.value).toFixed(2)} ≠ {aligned.invoice.total.value.toFixed(2)}</span>
                    </div>
                  )
                )}
              </div>
            </section>

            {/* Service Section */}
            <section>
              <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>Servicio</span>
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Dirección de servicio:</label>
                  <input
                    type="text"
                    value={editableServiceFields.serviceAddress ?? aligned.service.serviceAddress ?? ''}
                    onChange={(e) => setEditableServiceFields(prev => ({ ...prev, serviceAddress: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Dirección de instalación o suministro"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">CUPS / Punto de suministro:</label>
                  <input
                    type="text"
                    value={editableServiceFields.supplyPointId ?? aligned.service.supplyPointId ?? ''}
                    onChange={(e) => setEditableServiceFields(prev => ({ ...prev, supplyPointId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="ES****..."
                  />
                </div>
              </div>
            </section>

            {/* Payment Section */}
            <section>
              <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>Pago</span>
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Método de pago:</label>
                  <select
                    value={editablePaymentFields.method ?? aligned.payment.method}
                    onChange={(e) => setEditablePaymentFields(prev => ({ ...prev, method: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="Desconocido">Desconocido</option>
                    <option value="SEPA">SEPA / Domiciliación</option>
                    <option value="Transfer">Transferencia</option>
                    <option value="Tarjeta">Tarjeta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">IBAN:</label>
                  <input
                    type="text"
                    value={editablePaymentFields.iban ?? aligned.payment.iban ?? ''}
                    onChange={(e) => setEditablePaymentFields(prev => ({ ...prev, iban: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="ES** **** **** ** **********"
                    pattern="ES\d{2}\s?\d{4}\s?\d{4}\s?\d{2}\s?\d{10}"
                  />
                  {(editablePaymentFields.method ?? aligned.payment.method) === 'SEPA' && !(editablePaymentFields.iban ?? aligned.payment.iban) && (
                    <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded">
                      <span className="text-sm text-amber-800">⚠ Falta IBAN para domiciliación SEPA</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Fecha de pago:</label>
                  <input
                    type="date"
                    value={editablePaymentFields.paymentDate ?? aligned.payment.paymentDate ?? ''}
                    onChange={(e) => setEditablePaymentFields(prev => ({ ...prev, paymentDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </section>

            {/* Confirm and Save Button */}
            <section className="pt-6 border-t border-gray-200">
              <button
                onClick={() => handleConfirmAndSave()}
                className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Confirmar y guardar metadatos
              </button>
            </section>
          </div>
        ) : (
          /* Fallback: Original Fields Table */
          <div className="overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Campo</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Valor · Confianza</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Página</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {processedFields.map((field, index) => {
                  const FieldIcon = field.icon;
                  const ConfidenceIcon = getConfidenceIcon(field.confidence);
                  const finalValue = editableFields[field.name] || field.value;
                  const displayValue = field.status === 'pending' && field.rawValue ? field.rawValue : finalValue;
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <FieldIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {field.label}
                            {field.isCritical && (
                              <span className="text-error-500 ml-1">*</span>
                            )}
                          </span>
                        </div>
                      </td>
                      
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {field.editable ? (
                            <input
                              type="text"
                              value={finalValue}
                              onChange={(e) => handleFieldEdit(field.name, e.target.value)}
                              placeholder={field.status === 'empty' ? 'Pendiente' : field.status === 'pending' ? 'Revisar' : ''}
                              className={`w-full text-sm border rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                field.status === 'empty' ? 'border-gray-300 bg-gray-50' : 
                                field.status === 'pending' ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
                              }`}
                            />
                          ) : (
                            <span className="text-sm text-gray-900">{displayValue || '—'}</span>
                          )}
                          
                          {/* H-OCR-ALIGN: Show "value · confidence" format */}
                          {field.confidence > 0 && (
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                              <span>{displayValue || '—'}</span>
                              <span>·</span>
                              <span>{(field.confidence).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-500">
                          {field.page || '—'}
                        </span>
                      </td>
                      
                      <td className="py-3 px-4">
                        {field.confidence > 0 ? (
                          <div className="flex items-center space-x-2">
                            <ConfidenceIcon className={`h-4 w-4 ${getConfidenceColor(field.confidence).split(' ')[0]}`} />
                            <span className={`px-2 py-1 text-xs font-medium rounded-md ${getConfidenceColor(field.confidence)}`}>
                              {getConfidenceBadge(field.confidence)}
                            </span>
                          </div>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-md text-gray-600 bg-gray-50">
                            Pendiente
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          {/* H-OCR-ALIGN: Show validation errors */}
          {!amountValidation.isValid && (
            <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-lg">
              <div className="flex items-center space-x-2 text-error-800">
                <XCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Los importes no cuadran</span>
              </div>
              <p className="text-sm text-error-600 mt-1">{amountValidation.errorMessage}</p>
            </div>
          )}
          
          {!dateValidation.isValid && (
            <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-lg">
              <div className="flex items-center space-x-2 text-error-800">
                <XCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Fechas no plausibles</span>
              </div>
              <p className="text-sm text-error-600 mt-1">{dateValidation.errorMessage}</p>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Info className="h-4 w-4" />
              <span>
                {canApply 
                  ? 'Todos los controles pasados. Listo para aplicar.' 
                  : `Falta: ${requiredFieldsCheck.missingFields.join(', ')}`
                }
              </span>
            </div>
            
            <div className="flex space-x-3">
              {/* H-OCR-REFORM: Invoice breakdown button for reform invoices */}
              <button
                onClick={() => setShowInvoiceBreakdown?.(true)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                title="Desglosar factura en Mejora, R&C y Mobiliario"
              >
                Desglose reforma
              </button>
              
              <button
                onClick={handleApplyToExpense}
                disabled={!canApply || processingApply}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  canApply && !processingApply
                    ? 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-2 focus:ring-primary-500'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title={!canApply ? `Faltan: ${requiredFieldsCheck.missingFields.join(', ')}` : ''}
              >
                {processingApply ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Aplicando...</span>
                  </div>
                ) : (
                  'Aplicar a gasto/CAPEX (borrador)'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OcrPanel;