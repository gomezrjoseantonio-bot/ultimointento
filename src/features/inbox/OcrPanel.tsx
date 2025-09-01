// H-OCR-FIX: OCR Panel for Google Document AI integration
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
  Loader2
} from 'lucide-react';
import { OCRResult, OCRField } from '../../services/db';
import { formatCurrency, normalizeDateToSpanish } from '../../services/ocrService';

interface OcrPanelProps {
  document: any; // Document with OCR result
  onApplyToExpense?: (ocrData: any) => void;
  onApplyToCAPEX?: (ocrData: any) => void;
}

interface FieldMapping {
  name: string;
  label: string;
  icon: React.ComponentType<any>;
  format?: 'currency' | 'date' | 'text';
  isCritical: boolean;
}

// H-OCR-FIX: Field mappings for entity types to display names
const FIELD_MAPPINGS: FieldMapping[] = [
  { name: 'total_amount', label: 'Total factura', icon: CreditCard, format: 'currency', isCritical: true },
  { name: 'purchase_total', label: 'Total factura', icon: CreditCard, format: 'currency', isCritical: true },
  { name: 'total_monto', label: 'Total factura', icon: CreditCard, format: 'currency', isCritical: true },
  { name: 'subtotal', label: 'Base imponible', icon: CreditCard, format: 'currency', isCritical: false },
  { name: 'net_amount', label: 'Base imponible', icon: CreditCard, format: 'currency', isCritical: false },
  { name: 'tax_amount', label: 'IVA', icon: CreditCard, format: 'currency', isCritical: false },
  { name: 'invoice_id', label: 'Nº factura', icon: Hash, format: 'text', isCritical: true },
  { name: 'invoice_date', label: 'Fecha factura', icon: Calendar, format: 'date', isCritical: true },
  { name: 'date', label: 'Fecha factura', icon: Calendar, format: 'date', isCritical: true },
  { name: 'supplier_name', label: 'Proveedor', icon: Building, format: 'text', isCritical: true },
  { name: 'receiver_name', label: 'Proveedor', icon: Building, format: 'text', isCritical: true },
  { name: 'supplier_tax_id', label: 'NIF proveedor', icon: FileText, format: 'text', isCritical: false },
  { name: 'tax_id', label: 'NIF proveedor', icon: FileText, format: 'text', isCritical: false },
  { name: 'iban', label: 'IBAN', icon: CreditCard, format: 'text', isCritical: false },
];

// H-OCR-FIX: Confidence thresholds and colors
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.80,
  MEDIUM: 0.60
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'text-green-600 bg-green-50';
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
};

const getConfidenceIcon = (confidence: number) => {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return CheckCircle;
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return AlertTriangle;
  return XCircle;
};

const getConfidenceBadge = (confidence: number): string => {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'OK';
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'Pendiente';
  return 'Pendiente';
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

// H-OCR-FIX: Merge and process multiple tax amounts
const processTaxAmounts = (fields: OCRField[]): { value: string; confidence: number; allValid: boolean } => {
  const taxFields = fields.filter(f => f.name === 'tax_amount');
  
  if (taxFields.length === 0) {
    return { value: '', confidence: 0, allValid: false };
  }
  
  if (taxFields.length === 1) {
    return { 
      value: taxFields[0].value, 
      confidence: taxFields[0].confidence,
      allValid: taxFields[0].confidence >= CONFIDENCE_THRESHOLDS.HIGH
    };
  }
  
  // Multiple tax amounts - sum them only if all have high confidence
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
  
  // If not all are high confidence, mark as pending
  return { value: '', confidence: 0, allValid: false };
};

// H-OCR-FIX: Get best page for multi-page documents
const selectBestPage = (ocrResult: OCRResult): number => {
  if (!ocrResult.pageInfo || ocrResult.pageInfo.totalPages <= 1) {
    return 1;
  }
  
  // Find page with most high-confidence entities
  const { allPageScores } = ocrResult.pageInfo;
  const maxScore = Math.max(...allPageScores);
  return allPageScores.indexOf(maxScore) + 1; // 1-based indexing
};

const OcrPanel: React.FC<OcrPanelProps> = ({ document, onApplyToExpense, onApplyToCAPEX }) => {
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [editableFields, setEditableFields] = useState<Record<string, string>>({});
  const [processingApply, setProcessingApply] = useState(false);

  const ocrResult = document?.metadata?.ocr as OCRResult;

  useEffect(() => {
    if (ocrResult?.pageInfo) {
      setSelectedPage(selectBestPage(ocrResult));
    }
  }, [ocrResult]);

  if (!ocrResult) {
    return (
      <div className="bg-gray-50 rounded-xl p-6">
        <div className="flex items-center space-x-3 text-gray-500">
          <FileText className="h-5 w-5" />
          <span className="text-sm">No hay datos OCR disponibles</span>
        </div>
      </div>
    );
  }

  if (ocrResult.status === 'processing') {
    return (
      <div className="bg-blue-50 rounded-xl p-6">
        <div className="flex items-center space-x-3 text-blue-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Procesando documento OCR...</span>
        </div>
      </div>
    );
  }

  if (ocrResult.status === 'error') {
    return (
      <div className="bg-red-50 rounded-xl p-6">
        <div className="flex items-center space-x-3 text-red-600">
          <XCircle className="h-5 w-5" />
          <div>
            <p className="text-sm font-medium">Error en procesamiento OCR</p>
            {ocrResult.error && (
              <p className="text-xs text-red-500 mt-1">{ocrResult.error}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // H-OCR-FIX: Process fields and create display data
  const processedFields = FIELD_MAPPINGS.map(mapping => {
    // Find the field in OCR results
    const ocrField = ocrResult.fields.find(f => f.name === mapping.name);
    
    if (!ocrField) {
      return {
        ...mapping,
        value: '',
        confidence: 0,
        status: 'empty' as const,
        editable: true
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
        editable: true
      };
    }

    const formattedValue = formatFieldValue(ocrField.value, mapping.format);
    const isValid = ocrField.confidence >= CONFIDENCE_THRESHOLDS.HIGH && ocrField.value.trim() !== '';
    
    return {
      ...mapping,
      value: formattedValue,
      confidence: ocrField.confidence,
      status: isValid ? 'valid' : 'pending' as const,
      editable: true
    };
  });

  // H-OCR-FIX: Check if critical fields are valid for "Apply" button
  const criticalFields = processedFields.filter(f => f.isCritical);
  const criticalFieldsValid = criticalFields.filter(f => f.status === 'valid');
  const hasRequiredFields = criticalFieldsValid.some(f => f.name.includes('total')) && 
                           criticalFieldsValid.some(f => f.name.includes('date'));

  const handleFieldEdit = (fieldName: string, value: string) => {
    setEditableFields(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleApplyToExpense = async () => {
    if (!hasRequiredFields || !onApplyToExpense) return;
    
    setProcessingApply(true);
    try {
      // Prepare OCR data for expense creation
      const ocrData = processedFields.reduce((acc, field) => {
        const finalValue = editableFields[field.name] || field.value;
        if (finalValue) {
          acc[field.name] = finalValue;
        }
        return acc;
      }, {} as Record<string, string>);

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
            <Eye className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">Campos extraídos (OCR)</h3>
            {ocrResult.engineInfo && (
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-md">
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

      {/* Fields Table */}
      <div className="p-6">
        <div className="overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Campo</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Valor propuesto</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Confianza</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Fuente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {processedFields.map((field, index) => {
                const FieldIcon = field.icon;
                const ConfidenceIcon = getConfidenceIcon(field.confidence);
                const finalValue = editableFields[field.name] || field.value;
                
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <FieldIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {field.label}
                          {field.isCritical && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </span>
                      </div>
                    </td>
                    
                    <td className="py-3 px-4">
                      {field.editable ? (
                        <input
                          type="text"
                          value={finalValue}
                          onChange={(e) => handleFieldEdit(field.name, e.target.value)}
                          placeholder={field.status === 'empty' ? 'Pendiente' : ''}
                          className={`w-full text-sm border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            field.status === 'empty' ? 'border-gray-300 bg-gray-50' : 'border-gray-300'
                          }`}
                        />
                      ) : (
                        <span className="text-sm text-gray-900">{finalValue || '—'}</span>
                      )}
                    </td>
                    
                    <td className="py-3 px-4">
                      {field.confidence > 0 ? (
                        <div className="flex items-center space-x-2">
                          <ConfidenceIcon className={`h-4 w-4 ${getConfidenceColor(field.confidence).split(' ')[0]}`} />
                          <span className={`px-2 py-1 text-xs font-medium rounded-md ${getConfidenceColor(field.confidence)}`}>
                            {getConfidenceBadge(field.confidence)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {(field.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-md text-gray-600 bg-gray-50">
                          Pendiente
                        </span>
                      )}
                    </td>
                    
                    <td className="py-3 px-4">
                      <span className="text-xs text-gray-500 font-mono">
                        {field.name}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Info className="h-4 w-4" />
              <span>
                {hasRequiredFields 
                  ? 'Campos críticos disponibles. Listo para aplicar.' 
                  : 'Faltan campos confiables (≥ 0,80) para aplicar automáticamente.'
                }
              </span>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleApplyToExpense}
                disabled={!hasRequiredFields || processingApply}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  hasRequiredFields && !processingApply
                    ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title={!hasRequiredFields ? 'Faltan campos confiables (≥ 0,80)' : ''}
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