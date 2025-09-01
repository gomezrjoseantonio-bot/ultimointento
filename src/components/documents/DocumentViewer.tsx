import React, { useState, useEffect } from 'react';
import { Eye, Trash2, UserCheck, X, Download, Edit2, Save, Zap, AlertCircle, DollarSign, Building } from 'lucide-react';
import toast from 'react-hot-toast';
import { getDocumentBlob, downloadBlob } from '../../services/db';
import { processDocumentOCR, getOCRConfig, formatPercentage, shouldSuggestExpense, shouldSuggestCAPEX, getHighConfidenceFields, createExpenseFromOCR } from '../../services/ocrService';

interface DocumentViewerProps {
  document: any;
  onAssign: (documentId: number, metadata: any) => void;
  onDelete?: (documentId: number) => void;
  onUpdate?: (documentId: number, updates: any) => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ document, onAssign, onDelete, onUpdate }) => {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  // H-OCR: OCR state management
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [showOCREditModal, setShowOCREditModal] = useState(false);
  const [editableOCRFields, setEditableOCRFields] = useState<any>({});
  
  const [metadata, setMetadata] = useState({
    proveedor: document?.metadata?.proveedor || '',
    tipo: document?.metadata?.tipo || 'Factura',
    categoria: document?.metadata?.categoria || 'Otros',
    destino: document?.metadata?.destino || 'Personal',
    notas: document?.metadata?.notas || '',
    carpeta: document?.metadata?.carpeta || 'otros',
    ...document?.metadata
  });

  const [assignData, setAssignData] = useState({
    destino: 'Personal',
    inmuebleId: '',
    habitacionId: '',
    categoria: 'Otros',
    carpeta: 'otros'
  });

  useEffect(() => {
    if (document?.metadata) {
      setMetadata({
        proveedor: document.metadata.proveedor || '',
        tipo: document.metadata.tipo || 'Factura',
        categoria: document.metadata.categoria || 'Otros',
        destino: document.metadata.destino || 'Personal',
        notas: document.metadata.notas || '',
        carpeta: document.metadata.carpeta || 'otros',
        ...document.metadata
      });
    }
  }, [document]);

  const handleSaveMetadata = () => {
    if (onUpdate) {
      onUpdate(document.id, { metadata });
      setIsEditingMetadata(false);
      toast.success('Metadatos actualizados');
    }
  };

  // H-OCR: Process document with OCR
  const handleOCRProcess = async () => {
    if (!document?.content) {
      toast.error('No se pudo acceder al contenido del documento');
      return;
    }

    setIsProcessingOCR(true);
    
    // Update document status to processing
    if (onUpdate) {
      const updatedMetadata = {
        ...metadata,
        ocr: {
          engine: 'gdocai:invoice',
          timestamp: new Date().toISOString(),
          confidenceGlobal: 0,
          fields: [],
          status: 'processing' as const
        }
      };
      onUpdate(document.id, { metadata: updatedMetadata });
    }

    try {
      const ocrResult = await processDocumentOCR(document.content, document.filename);
      
      // Add to history if there was a previous result
      const ocrHistory = metadata.ocrHistory || [];
      if (metadata.ocr && metadata.ocr.status === 'completed') {
        ocrHistory.push({
          timestamp: metadata.ocr.timestamp,
          engine: metadata.ocr.engine,
          confidenceGlobal: metadata.ocr.confidenceGlobal,
          fieldsCount: metadata.ocr.fields.length,
          status: 'completed'
        });
      }

      const updatedMetadata = {
        ...metadata,
        ocr: ocrResult,
        ocrHistory
      };

      setMetadata(updatedMetadata);
      
      if (onUpdate) {
        onUpdate(document.id, { metadata: updatedMetadata });
      }

      toast.success(`OCR completado: ${ocrResult.fields.length} campos extraídos`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      const updatedMetadata = {
        ...metadata,
        ocr: {
          engine: 'gdocai:invoice',
          timestamp: new Date().toISOString(),
          confidenceGlobal: 0,
          fields: [],
          status: 'error' as const,
          error: errorMessage
        }
      };

      setMetadata(updatedMetadata);
      
      if (onUpdate) {
        onUpdate(document.id, { metadata: updatedMetadata });
      }

      toast.error(`Error en OCR: ${errorMessage}`);
    } finally {
      setIsProcessingOCR(false);
    }
  };

  // H-OCR: Apply all OCR fields
  const handleApplyAllFields = () => {
    if (!metadata.ocr?.fields) return;

    const updatedMetadata = { ...metadata };
    
    metadata.ocr.fields.forEach((field: any) => {
      switch (field.name) {
        case 'proveedor':
          updatedMetadata.proveedor = field.value;
          break;
        case 'numeroFactura':
          updatedMetadata.numeroFactura = field.value;
          break;
        case 'fechaEmision':
          updatedMetadata.fechaEmision = field.value;
          break;
        case 'importe':
          updatedMetadata.importe = parseFloat(field.value);
          break;
        // Add more field mappings as needed
      }
    });

    setMetadata(updatedMetadata);
    if (onUpdate) {
      onUpdate(document.id, { metadata: updatedMetadata });
    }
    
    toast.success('Todos los campos aplicados');
  };

  // H-OCR: Apply only high confidence fields
  const handleApplySuggestions = () => {
    if (!metadata.ocr?.fields) return;

    const config = getOCRConfig();
    const highConfidenceFields = getHighConfidenceFields(metadata.ocr, config.confidenceThreshold);
    
    const updatedMetadata = { ...metadata };
    
    highConfidenceFields.forEach((field: any) => {
      switch (field.name) {
        case 'proveedor':
          updatedMetadata.proveedor = field.value;
          break;
        case 'numeroFactura':
          updatedMetadata.numeroFactura = field.value;
          break;
        case 'fechaEmision':
          updatedMetadata.fechaEmision = field.value;
          break;
        case 'importe':
          updatedMetadata.importe = parseFloat(field.value);
          break;
      }
    });

    setMetadata(updatedMetadata);
    if (onUpdate) {
      onUpdate(document.id, { metadata: updatedMetadata });
    }
    
    toast.success(`${highConfidenceFields.length} campos de alta confianza aplicados`);
  };

  // H-OCR: Open edit modal with OCR fields
  const handleEditBeforeApply = () => {
    if (!metadata.ocr?.fields) return;
    
    const fieldsObject: any = {};
    metadata.ocr.fields.forEach((field: any) => {
      fieldsObject[field.name] = field.value;
    });
    
    setEditableOCRFields(fieldsObject);
    setShowOCREditModal(true);
  };

  // H-OCR: Apply edited OCR fields
  const handleApplyEditedFields = () => {
    const updatedMetadata = { ...metadata };
    
    Object.entries(editableOCRFields).forEach(([fieldName, value]) => {
      switch (fieldName) {
        case 'proveedor':
          updatedMetadata.proveedor = value as string;
          break;
        case 'numeroFactura':
          updatedMetadata.numeroFactura = value as string;
          break;
        case 'fechaEmision':
          updatedMetadata.fechaEmision = value as string;
          break;
        case 'importe':
          updatedMetadata.importe = parseFloat(value as string) || 0;
          break;
      }
    });

    setMetadata(updatedMetadata);
    if (onUpdate) {
      onUpdate(document.id, { metadata: updatedMetadata });
    }
    
    setShowOCREditModal(false);
    toast.success('Campos editados aplicados');
  };

  // H-OCR: Create expense from OCR data
  const handleCreateExpense = () => {
    if (!metadata.ocr) return;
    
    const expenseData = createExpenseFromOCR(metadata.ocr);
    // Here you would typically open an expense creation modal or navigate to expense creation
    toast.success('Función "Crear gasto" - próximamente disponible');
    console.log('Expense data from OCR:', expenseData);
  };

  // H-OCR: Create CAPEX draft from OCR data
  const handleCreateCAPEX = () => {
    if (!metadata.ocr) return;
    
    // Here you would typically create a CAPEX draft
    toast.success('Función "Crear CAPEX (borrador)" - próximamente disponible');
  };

  const handleAssign = () => {
    const assignmentMetadata = {
      ...metadata,
      destino: assignData.destino,
      categoria: assignData.categoria,
      carpeta: assignData.carpeta,
      status: 'Asignado',
      entityType: assignData.destino.toLowerCase(),
      entityId: assignData.destino === 'Personal' ? null : (assignData.inmuebleId || null),
      assignedDate: new Date().toISOString()
    };

    onAssign(document.id, assignmentMetadata);
    setShowAssignModal(false);
    toast.success('Documento asignado correctamente');
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(document.id);
      setShowDeleteConfirm(false);
      toast.success('Documento eliminado.');
    }
  };

  const handlePreview = () => {
    setShowPreviewModal(true);
  };

  const handleDownload = async () => {
    try {
      let blob: Blob | null = null;
      
      if (document?.id) {
        blob = await getDocumentBlob(document.id);
      }
      
      if (!blob && document?.content) {
        blob = new Blob([document.content], { type: document.type });
      }
      
      if (blob) {
        const filename = document?.filename || 'documento';
        downloadBlob(blob, filename);
        toast.success('Descarga iniciada');
      } else {
        toast.error('No se pudo encontrar el archivo para descargar');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Error al descargar el archivo');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderPreviewContent = () => {
    if (!document?.content) {
      return (
        <div className="text-center py-8">
          <p className="text-neutral-500">No se puede cargar el contenido del documento</p>
          <button 
            onClick={handleDownload}
            className="mt-4 px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors"
          >
            <Download className="w-4 h-4 inline mr-2" />
            Descargar
          </button>
        </div>
      );
    }

    if (document.type === 'application/pdf') {
      const blob = new Blob([document.content], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      return (
        <div className="w-full h-96">
          <object
            data={url}
            type="application/pdf"
            className="w-full h-full border border-neutral-200 rounded-lg"
          >
            <div className="text-center py-8">
              <p className="text-neutral-500 mb-4">No se puede previsualizar este PDF en tu navegador</p>
              <button 
                onClick={handleDownload}
                className="px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors"
              >
                <Download className="w-4 h-4 inline mr-2" />
                Descargar
              </button>
            </div>
          </object>
        </div>
      );
    }

    if (document.type.startsWith('image/')) {
      const blob = new Blob([document.content], { type: document.type });
      const url = URL.createObjectURL(blob);
      
      return (
        <div className="text-center">
          <img 
            src={url} 
            alt={document.filename} 
            className="max-w-full max-h-96 mx-auto object-contain border border-neutral-200 rounded-lg"
          />
        </div>
      );
    }

    const isZip = document.type === 'application/zip' || document.filename?.toLowerCase().endsWith('.zip');
    const isNonPreviewable = isZip || (!document.type.startsWith('image/') && document.type !== 'application/pdf');

    if (isNonPreviewable) {
      return (
        <div className="text-center py-8">
          <div className="mb-4">
            <Download className="mx-auto h-12 w-12 text-neutral-400 mb-2" />
            <p className="text-neutral-500 mb-2">
              {isZip ? 'Archivo ZIP' : 'Vista previa no disponible'}
            </p>
            <p className="text-sm text-neutral-400">
              {document.type || 'Tipo de archivo no especificado'}
            </p>
          </div>
          <button 
            onClick={handleDownload}
            className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <Download className="w-4 h-4 inline mr-2" />
            Descargar {document.filename}
          </button>
        </div>
      );
    }

    return (
      <div className="text-center py-8">
        <p className="text-neutral-500 mb-4">No se puede previsualizar este tipo de archivo</p>
        <button 
          onClick={handleDownload}
          className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <Download className="w-4 h-4 inline mr-2" />
          Descargar
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Document Info */}
      <div className="border-b border-neutral-200 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-neutral-900">{document?.filename || 'Documento'}</h3>
          <button
            onClick={() => setIsEditingMetadata(!isEditingMetadata)}
            className="flex items-center gap-2 px-3 py-1 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            {isEditingMetadata ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
            {isEditingMetadata ? 'Guardar' : 'Editar'}
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-neutral-700">Fecha de subida:</span>
            <span className="ml-2 text-neutral-600">
              {new Date(document?.uploadDate || Date.now()).toLocaleDateString('es-ES')}
            </span>
          </div>
          <div>
            <span className="font-medium text-neutral-700">Tamaño:</span>
            <span className="ml-2 text-neutral-600">
              {document?.size ? formatFileSize(document.size) : 'N/A'}
            </span>
          </div>
          
          {/* Editable metadata fields */}
          <div>
            <span className="font-medium text-neutral-700">Proveedor:</span>
            {isEditingMetadata ? (
              <input 
                type="text" 
                className="ml-2 border border-neutral-200 rounded px-2 py-1 text-sm"
                value={metadata.proveedor}
                onChange={(e) => setMetadata({...metadata, proveedor: e.target.value})}
                placeholder="Nombre del proveedor"
              />
            ) : (
              <span className="ml-2 text-neutral-600">{metadata.proveedor || 'Sin especificar'}</span>
            )}
          </div>
          
          <div>
            <span className="font-medium text-neutral-700">Tipo:</span>
            {isEditingMetadata ? (
              <select 
                className="ml-2 border border-neutral-200 rounded px-2 py-1 text-sm"
                value={metadata.tipo}
                onChange={(e) => setMetadata({...metadata, tipo: e.target.value})}
              >
                <option value="Contrato">Contrato</option>
                <option value="Factura">Factura</option>
                <option value="Recibo">Recibo</option>
                <option value="Otro">Otro</option>
              </select>
            ) : (
              <span className="ml-2 text-neutral-600">{metadata.tipo}</span>
            )}
          </div>
          
          <div>
            <span className="font-medium text-neutral-700">Categoría:</span>
            {isEditingMetadata ? (
              <select 
                className="ml-2 border border-neutral-200 rounded px-2 py-1 text-sm"
                value={metadata.categoria}
                onChange={(e) => setMetadata({...metadata, categoria: e.target.value})}
              >
                <option value="Suministros">Suministros</option>
                <option value="Comunidad">Comunidad</option>
                <option value="Seguro">Seguro</option>
                <option value="Mantenimiento">Mantenimiento</option>
                <option value="Reforma/CAPEX">Reforma/CAPEX</option>
                <option value="Fiscal">Fiscal</option>
                <option value="Otros">Otros</option>
              </select>
            ) : (
              <span className="ml-2 text-neutral-600">{metadata.categoria}</span>
            )}
          </div>
          
          <div>
            <span className="font-medium text-neutral-700">Estado:</span>
            <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
              metadata.status === 'Asignado' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {metadata.status || 'Nuevo'}
            </span>
          </div>
          
          <div>
            <span className="font-medium text-neutral-700">Destino:</span>
            <span className="ml-2 text-neutral-600">{metadata.destino || 'Personal'}</span>
          </div>
        </div>
        
        {/* Notes field */}
        <div className="mt-4">
          <span className="font-medium text-neutral-700">Notas:</span>
          {isEditingMetadata ? (
            <textarea 
              className="mt-1 w-full border border-neutral-200 rounded px-3 py-2 text-sm"
              rows={2}
              value={metadata.notas}
              onChange={(e) => setMetadata({...metadata, notas: e.target.value})}
              placeholder="Notas adicionales sobre el documento..."
            />
          ) : (
            <p className="mt-1 text-neutral-600 text-sm">{metadata.notas || 'Sin notas'}</p>
          )}
        </div>
        
        {isEditingMetadata && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSaveMetadata}
              className="px-4 py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              Guardar cambios
            </button>
            <button
              onClick={() => setIsEditingMetadata(false)}
              className="px-4 py-2 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Preview Area */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-8 text-center">
        <Eye className="mx-auto h-12 w-12 text-neutral-500 mb-4" />
        <p className="text-neutral-600">Vista previa del documento</p>
        <p className="text-sm text-neutral-400 mt-2">
          {document?.type || 'Tipo de archivo no especificado'}
        </p>
        <button 
          className="mt-4 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors"
          onClick={handlePreview}
        >
          <Eye className="w-4 h-4 inline mr-2" />
          Abrir vista previa
        </button>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button 
          className="flex items-center gap-2 px-4 py-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
          onClick={handlePreview}
        >
          <Eye className="w-4 h-4" />
          Ver
        </button>
        
        {/* H-OCR: Process with OCR button */}
        <button 
          className="flex items-center gap-2 px-4 py-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
          onClick={handleOCRProcess}
          disabled={isProcessingOCR || metadata.ocr?.status === 'processing'}
        >
          <Zap className="w-4 h-4" />
          {isProcessingOCR || metadata.ocr?.status === 'processing' ? 'Procesando...' : 'Procesar con OCR'}
        </button>
        
        <button 
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors"
          onClick={() => setShowAssignModal(true)}
        >
          <UserCheck className="w-4 h-4" />
          {metadata.status === 'Asignado' ? 'Reasignar' : 'Asignar'}
        </button>
        <button 
          className="flex items-center gap-2 px-4 py-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
          onClick={handleDownload}
        >
          <Download className="w-4 h-4" />
          Descargar
        </button>
        <button 
          className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 className="w-4 h-4" />
          Eliminar
        </button>
      </div>

      {/* H-OCR: OCR Results Panel */}
      {metadata.ocr && (
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <div className="bg-neutral-50 px-4 py-3 border-b border-neutral-200">
            <h4 className="font-medium text-neutral-900">Campos extraídos (OCR)</h4>
            <div className="flex items-center gap-4 mt-1 text-sm text-neutral-600">
              <span>Motor: {metadata.ocr.engine}</span>
              <span>Confianza global: {formatPercentage(metadata.ocr.confidenceGlobal * 100)}</span>
              <span>Procesado: {new Date(metadata.ocr.timestamp).toLocaleString('es-ES')}</span>
            </div>
          </div>
          
          <div className="p-4">
            {metadata.ocr.status === 'completed' && metadata.ocr.fields.length > 0 ? (
              <>
                {/* OCR Fields List */}
                <div className="space-y-3 mb-4">
                  {metadata.ocr.fields.map((field: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                      <div className="flex-1">
                        <span className="font-medium text-neutral-700 capitalize">
                          {field.name.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>
                        <span className="ml-2 text-neutral-900">{field.value}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          field.confidence >= 0.8 ? 'bg-green-100 text-green-700' :
                          field.confidence >= 0.6 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {formatPercentage(field.confidence * 100)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* OCR Action Buttons */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <button
                    onClick={handleApplyAllFields}
                    className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors"
                  >
                    Aplicar todo
                  </button>
                  <button
                    onClick={handleApplySuggestions}
                    className="px-4 py-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    Aplicar sugerencias
                  </button>
                  <button
                    onClick={handleEditBeforeApply}
                    className="px-4 py-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    Editar antes de aplicar
                  </button>
                </div>
                
                {/* Smart CTAs */}
                <div className="flex gap-3 pt-3 border-t border-neutral-200">
                  {shouldSuggestExpense(metadata.ocr) && (
                    <button
                      onClick={handleCreateExpense}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <DollarSign className="w-4 h-4" />
                      Crear gasto
                    </button>
                  )}
                  {shouldSuggestCAPEX(metadata.ocr) && (
                    <button
                      onClick={handleCreateCAPEX}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Building className="w-4 h-4" />
                      Crear CAPEX (borrador)
                    </button>
                  )}
                </div>
              </>
            ) : metadata.ocr.status === 'error' ? (
              <div className="text-center py-6">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-red-600 font-medium">Error al procesar OCR</p>
                <p className="text-sm text-neutral-600 mt-1">{metadata.ocr.error}</p>
                <button
                  onClick={handleOCRProcess}
                  className="mt-3 px-4 py-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-neutral-600">Procesando documento...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* H-OCR: Edit Fields Modal */}
      {showOCREditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h4 className="text-lg font-medium">Editar campos OCR</h4>
              <button 
                onClick={() => setShowOCREditModal(false)}
                className="p-2 hover:bg-neutral-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-4">
                {Object.entries(editableOCRFields).map(([fieldName, value]) => (
                  <div key={fieldName}>
                    <label className="block text-sm font-medium text-neutral-700 mb-1 capitalize">
                      {fieldName.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    <input
                      type="text"
                      value={value as string}
                      onChange={(e) => setEditableOCRFields({
                        ...editableOCRFields,
                        [fieldName]: e.target.value
                      })}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={handleApplyEditedFields}
                className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                Aplicar campos
              </button>
              <button
                onClick={() => setShowOCREditModal(false)}
                className="px-4 py-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h4 className="text-lg font-medium">Vista previa del documento</h4>
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="p-2 hover:bg-neutral-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="mb-4">
                <h5 className="font-medium">{document?.filename || 'Documento'}</h5>
                <p className="text-sm text-neutral-500">{document?.type || 'Tipo desconocido'}</p>
              </div>
              {renderPreviewContent()}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h4 className="text-lg font-medium mb-4">¿Eliminar documento?</h4>
            <p className="text-neutral-600 mb-6">
              Se eliminará '{document?.filename || 'el documento'}'. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button 
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                onClick={handleDelete}
              >
                Eliminar
              </button>
              <button 
                className="px-4 py-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h4 className="text-lg font-medium mb-4">
              {metadata.status === 'Asignado' ? 'Reasignar Documento' : 'Asignar Documento'}
            </h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Destino
                </label>
                <select 
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2"
                  value={assignData.destino}
                  onChange={(e) => setAssignData({...assignData, destino: e.target.value})}
                >
                  <option value="Personal">Personal</option>
                  <option value="Inmueble">Inmueble</option>
                  <option value="Habitación">Habitación</option>
                </select>
              </div>

              {assignData.destino === 'Inmueble' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Inmueble
                  </label>
                  <select 
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2"
                    value={assignData.inmuebleId}
                    onChange={(e) => setAssignData({...assignData, inmuebleId: e.target.value})}
                  >
                    <option value="">Seleccionar inmueble...</option>
                    <option value="1">Inmueble de ejemplo</option>
                  </select>
                </div>
              )}

              {assignData.destino === 'Habitación' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Inmueble
                    </label>
                    <select 
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2"
                      value={assignData.inmuebleId}
                      onChange={(e) => setAssignData({...assignData, inmuebleId: e.target.value})}
                    >
                      <option value="">Seleccionar inmueble...</option>
                      <option value="1">Inmueble de ejemplo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Habitación
                    </label>
                    <select 
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2"
                      value={assignData.habitacionId}
                      onChange={(e) => setAssignData({...assignData, habitacionId: e.target.value})}
                    >
                      <option value="">Seleccionar habitación...</option>
                      <option value="1">Habitación 1</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Categoría
                </label>
                <select 
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2"
                  value={assignData.categoria}
                  onChange={(e) => setAssignData({...assignData, categoria: e.target.value})}
                >
                  <option value="Suministros">Suministros</option>
                  <option value="Comunidad">Comunidad</option>
                  <option value="Seguro">Seguro</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Reforma/CAPEX">Reforma/CAPEX</option>
                  <option value="Fiscal">Fiscal</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Carpeta
                </label>
                <select 
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2"
                  value={assignData.carpeta}
                  onChange={(e) => setAssignData({...assignData, carpeta: e.target.value})}
                >
                  <option value="facturas">Facturas</option>
                  <option value="contratos">Contratos</option>
                  <option value="capex">CAPEX</option>
                  <option value="otros">Otros</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors"
                onClick={handleAssign}
              >
                {metadata.status === 'Asignado' ? 'Reasignar' : 'Asignar'}
              </button>
              <button 
                className="px-4 py-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                onClick={() => setShowAssignModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;