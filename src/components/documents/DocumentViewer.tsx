import React, { useState, useEffect } from 'react';
import { Eye, Trash2, UserCheck, X, Download, Edit2, Save, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { getDocumentBlob, downloadBlob, initDB, Property } from '../../services/db';
import OcrPanel from '../../features/inbox/OcrPanel';
import InvoiceBreakdownModal from '../InvoiceBreakdownModal';

interface DocumentViewerProps {
  document: any;
  onAssign: (documentId: number, metadata: any) => void;
  onDelete?: (documentId: number) => void;
  onUpdate?: (documentId: number, updates: any) => void;
  onProcessOCR?: (document: any) => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ document, onAssign, onDelete, onUpdate, onProcessOCR }) => {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [documentBlob, setDocumentBlob] = useState<Blob | null>(null);
  const [showInvoiceBreakdown, setShowInvoiceBreakdown] = useState(false); // H-OCR-REFORM: For invoice breakdown modal
  
  // Load document blob for preview
  useEffect(() => {
    const loadDocumentBlob = async () => {
      if (document?.id) {
        try {
          const blob = await getDocumentBlob(document.id);
          setDocumentBlob(blob);
        } catch (error) {
          console.error('Error loading document blob:', error);
        }
      } else if (document?.content) {
        // Fallback to content field if available
        const blob = new Blob([document.content], { type: document.type });
        setDocumentBlob(blob);
      }
    };
    
    loadDocumentBlob();
  }, [document?.id, document?.content, document?.type]);
  
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

  // Load properties when component mounts or when assign modal opens
  useEffect(() => {
    const loadProperties = async () => {
      try {
        const db = await initDB();
        const props = await db.getAll('properties');
        setProperties(props.filter(p => p.state === 'activo')); // Only show active properties
      } catch (error) {
        console.error('Error loading properties:', error);
      }
    };

    if (showAssignModal) {
      loadProperties();
    }
  }, [showAssignModal]);

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

  // OCR Panel Handlers
  const handleApplyToExpense = async (ocrData: any) => {
    try {
      console.log('Applying OCR data to expense:', ocrData);
      toast.success('Datos aplicados al gasto correctamente');
    } catch (error) {
      console.error('Error applying to expense:', error);
      toast.error('Error al aplicar datos al gasto');
    }
  };

  const handleApplyToCAPEX = async (ocrData: any) => {
    try {
      console.log('Applying OCR data to CAPEX:', ocrData);
      toast.success('Datos aplicados al CAPEX correctamente');
    } catch (error) {
      console.error('Error applying to CAPEX:', error);
      toast.error('Error al aplicar datos al CAPEX');
    }
  };

  // H-OCR-REFORM: Handle invoice breakdown save
  const handleInvoiceBreakdownSave = async (breakdown: any) => {
    try {
      // Save breakdown as CAPEX reform with line items
      const db = await initDB();
      
      // Create reform record
      const now = new Date().toISOString();
      const reform = {
        title: `Reforma - ${document.filename}`,
        propertyId: breakdown.inmuebleId,
        startDate: now.split('T')[0],
        endDate: breakdown.fechaFinObra || undefined,
        notes: `Desglose automático de factura. Proveedor: ${breakdown.proveedorSugerido || 'No especificado'}`,
        status: 'abierta' as const,
        createdAt: now,
        updatedAt: now
      };

      const reformId = await db.add('reforms', reform);
      
      // Create line items for each category
      for (const lineItem of breakdown.lineItems) {
        const capexTreatment = lineItem.category === 'mejora' ? 'capex-mejora' :
                             lineItem.category === 'mobiliario' ? 'mobiliario-10-años' :
                             'reparacion-conservacion';
        
        const reformLineItem = {
          reformId,
          source: 'documento' as const,
          documentId: document.id,
          provider: breakdown.proveedorSugerido || 'Proveedor no identificado',
          providerNIF: '',
          concept: lineItem.description,
          amount: lineItem.totalAmount,
          taxIncluded: true,
          treatment: capexTreatment,
          executionDate: lineItem.category === 'mejora' ? (breakdown.fechaFinObra || now.split('T')[0]) :
                        lineItem.category === 'mobiliario' ? (breakdown.fechaAltaMobiliario || now.split('T')[0]) :
                        now.split('T')[0],
          prorationMethod: 'manual' as const,
          prorationDetail: `IVA ${lineItem.ivaRate}%`,
          // H-OCR-REFORM: Enhanced breakdown fields
          baseAmount: lineItem.baseAmount,
          ivaRate: lineItem.ivaRate,
          ivaAmount: lineItem.ivaAmount,
          categorizationConfidence: lineItem.confidence || 0,
          fechaFinObra: lineItem.category === 'mejora' ? breakdown.fechaFinObra : undefined,
          fechaAltaMobiliario: lineItem.category === 'mobiliario' ? breakdown.fechaAltaMobiliario : undefined,
          createdAt: now,
          updatedAt: now
        };

        await db.add('reformLineItems', reformLineItem);
      }

      toast.success('Desglose guardado como reforma CAPEX');
      
      // Update document metadata to link to reform
      if (onUpdate) {
        onUpdate(document.id, {
          metadata: {
            ...document.metadata,
            status: 'Asignado',
            categoria: 'Reforma/CAPEX',
            reformId
          }
        });
      }
    } catch (error) {
      console.error('Error saving invoice breakdown:', error);
      toast.error('Error al guardar el desglose');
    }
  };

  const renderPreviewContent = () => {
    if (!documentBlob) {
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
      const url = URL.createObjectURL(documentBlob);
      
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
      const url = URL.createObjectURL(documentBlob);
      
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
            className="px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors"
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
          className="px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors"
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
                ? 'bg-success-100 text-success-800' 
                : 'bg-warning-100 text-yellow-800'
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
        
        {/* OCR Panel - Show if document has OCR results */}
        {document?.metadata?.ocr?.status === 'completed' && (
          <div className="mt-6 pt-6 border-t border-neutral-200">
            <OcrPanel 
              document={document}
              onUpdate={onUpdate}
              onApplyToExpense={handleApplyToExpense}
              onApplyToCAPEX={handleApplyToCAPEX}
              setShowInvoiceBreakdown={setShowInvoiceBreakdown}
            />
          </div>
        )}
        
        {isEditingMetadata && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSaveMetadata}
              className="px-4 py-2 text-sm bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors"
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
          className="mt-4 px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors"
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
        
        {/* H-OCR: Manual OCR processing button */}
        {onProcessOCR && (document?.type === 'application/pdf' || document?.type?.startsWith('image/')) && (
          <button 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              document?.metadata?.ocr?.status === 'processing'
                ? 'bg-amber-100 text-amber-700 border border-amber-200 cursor-not-allowed'
                : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
            onClick={() => document?.metadata?.ocr?.status !== 'processing' && onProcessOCR(document)}
            disabled={document?.metadata?.ocr?.status === 'processing'}
            title={document?.metadata?.ocr?.status === 'processing' ? 'Procesando OCR...' : 'Procesar documento con OCR'}
          >
            <Zap className={`w-4 h-4 ${document?.metadata?.ocr?.status === 'processing' ? 'animate-pulse' : ''}`} />
            {document?.metadata?.ocr?.status === 'processing' ? 'Procesando...' : 'Procesar con OCR'}
          </button>
        )}
        
        {/* DEV: Show OCR endpoint */}
        {process.env.NODE_ENV === 'development' && onProcessOCR && (
          <div className="flex items-center text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            Endpoint: /.netlify/functions/ocr-documentai
          </div>
        )}
        
        <button 
          className="flex items-center gap-2 px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors"
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
          className="flex items-center gap-2 px-4 py-2 border border-error-200 text-error-600 rounded-lg hover:bg-error-50 transition-colors"
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 className="w-4 h-4" />
          Eliminar
        </button>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-gray-200 flex items-center justify-center z-50 p-4">
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
        <div className="fixed inset-0 bg-gray-200 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h4 className="text-lg font-medium mb-4">¿Eliminar documento?</h4>
            <p className="text-neutral-600 mb-6">
              Se eliminará '{document?.filename || 'el documento'}'. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button 
                className="px-4 py-2 bg-error-600 text-white rounded-lg hover:bg-error-700 transition-colors"
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
        <div className="fixed inset-0 bg-gray-200 flex items-center justify-center z-50 p-4">
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
                    {properties.map(property => (
                      <option key={property.id} value={property.id}>
                        {property.alias} - {property.address}
                      </option>
                    ))}
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
                      {properties.map(property => (
                        <option key={property.id} value={property.id}>
                          {property.alias} - {property.address}
                        </option>
                      ))}
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
                className="px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors"
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

      {/* H-OCR-REFORM: Invoice Breakdown Modal */}
      {showInvoiceBreakdown && (
        <InvoiceBreakdownModal
          isOpen={showInvoiceBreakdown}
          onClose={() => setShowInvoiceBreakdown(false)}
          onSave={handleInvoiceBreakdownSave}
          document={document}
          properties={properties}
          ocrResult={document?.metadata?.ocr}
        />
      )}
    </div>
  );
};

export default DocumentViewer;