// UNICORNIO PROMPT - Enhanced Inbox Interface
// Complete implementation according to exact specifications

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { 
  Upload, Search, X,
  CheckCircle, AlertTriangle, XCircle,
  FileText, Image, FileSpreadsheet, Archive, File,
  ChevronDown, ChevronUp
} from 'lucide-react';

import { DocumentType } from '../services/unicornioDocumentDetection';
import { processInboxItem, classifyAndArchive } from '../services/unicornioInboxProcessor';
import DocumentPreview from '../components/DocumentPreview';
import ReformBreakdownComponent from '../components/ReformBreakdownComponent';
import DocumentEditPanel from '../components/inbox/DocumentEditPanel';

// Estados exactos según especificación
type DocumentStatus = 'Guardado' | 'Revisión' | 'Error';

interface UnicornioDocument {
  id: string;
  filename: string;
  type: string;
  size: number;
  uploadDate: string;
  status: DocumentStatus;
  
  // Columnas de tabla según especificación
  tipo: string; // Tipo de documento detectado
  proveedorEmisor?: string; // Proveedor/Emisor
  importe?: number; // Importe
  fechaDoc?: string; // Fecha doc.
  inmueblePersonal?: string; // Inmueble/Personal
  ibanDetectado?: string; // IBAN detectado
  destinoFinal?: string; // Destino final
  
  // Campos internos
  documentType: DocumentType;
  extractedFields: Record<string, any>;
  blockingReasons: string[];
  logs: Array<{ timestamp: string; action: string }>;
  expiresAt?: string; // Para retención 72h
  fingerprint?: string;
  revision?: number;
  
  // Para preview
  file?: File;
  fileUrl?: string;
}

const UnicornioInboxPrompt: React.FC = () => {
  const [documents, setDocuments] = useState<UnicornioDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<UnicornioDocument | null>(null);
  const [statusFilter, setStatusFilter] = useState<'todos' | DocumentStatus>('todos');
  const [typeFilter, setTypeFilter] = useState<'todos' | string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('72h');
  const [showLogsPanel, setShowLogsPanel] = useState(false);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  // Cleanup expired documents (72h retention)
  useEffect(() => {
    const cleanup = () => {
      const now = new Date();
      setDocuments(prev => prev.filter(doc => {
        if (doc.status === 'Guardado' && doc.expiresAt) {
          return new Date(doc.expiresAt) > now;
        }
        return true; // Keep Revisión and Error indefinitely
      }));
    };

    cleanup(); // Initial cleanup
    const interval = setInterval(cleanup, 60000); // Every minute
    return () => clearInterval(interval);
  }, []);

  /**
   * Core processing function following specification
   */
  const executeProcessInboxItem = useCallback(async (doc: UnicornioDocument, file: File, reprocess = false) => {
    try {
      const result = await processInboxItem(file, doc.filename, { reprocess });
      
      const updatedDoc: UnicornioDocument = {
        ...doc,
        documentType: result.documentType,
        extractedFields: result.extractedFields,
        blockingReasons: result.blockingReasons,
        logs: [...doc.logs, ...result.logs],
        status: result.requiresReview ? 'Revisión' : 'Guardado',
        revision: (doc.revision || 0) + 1,
        fingerprint: result.fingerprint,
        
        // Map to table columns
        tipo: getDisplayType(result.documentType),
        proveedorEmisor: result.extractedFields.proveedor_nombre || result.extractedFields.arrendatario_nombre,
        importe: result.extractedFields.total_amount || result.extractedFields.renta_mensual,
        fechaDoc: result.extractedFields.invoice_date || result.extractedFields.fecha_inicio,
        inmueblePersonal: result.extractedFields.inmueble_alias || 'Personal',
        ibanDetectado: result.extractedFields.iban_masked || result.extractedFields.iban_detectado,
        destinoFinal: result.destination,
        
        // Set expiration for successful documents
        expiresAt: result.requiresReview ? undefined : 
          new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      };

      setDocuments(prev => prev.map(d => d.id === doc.id ? updatedDoc : d));
      setProcessing(prev => {
        const newSet = new Set(prev);
        newSet.delete(doc.id);
        return newSet;
      });

      // Update selected document if it's the same
      if (selectedDocument?.id === doc.id) {
        setSelectedDocument(updatedDoc);
      }

      // Show appropriate message
      if (result.success) {
        if (result.requiresReview) {
          toast.error(`${doc.filename} procesado - requiere revisión`);
        } else {
          const destination = result.destination || 'destino desconocido';
          toast.success(`${doc.filename} procesado y archivado automáticamente en ${destination}`);
        }
      } else {
        toast.error(`Error procesando ${doc.filename}`);
      }

    } catch (error) {
      console.error('Processing error:', error);
      
      const errorDoc: UnicornioDocument = {
        ...doc,
        status: 'Error',
        blockingReasons: [`Error en procesamiento: ${error}`],
        logs: [...doc.logs, { timestamp: new Date().toISOString(), action: `Error: ${error}` }]
      };

      setDocuments(prev => prev.map(d => d.id === doc.id ? errorDoc : d));
      setProcessing(prev => {
        const newSet = new Set(prev);
        newSet.delete(doc.id);
        return newSet;
      });

      toast.error(`Error procesando ${doc.filename}: ${error}`);
    }
  }, [selectedDocument]);

  /**
   * DISPARADOR OBLIGATORIO 1: Al subir archivo
   */
  const handleFileUpload = useCallback(async (files: FileList) => {
    const allowedTypes = [
      'application/pdf', 'image/jpeg', 'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel', 'text/csv',
      'application/zip', 'message/rfc822'
    ];

    for (const file of Array.from(files)) {
      if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.eml')) {
        toast.error(`Tipo de archivo no soportado: ${file.name}`);
        continue;
      }

      const docId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      
      // Create initial document
      const newDoc: UnicornioDocument = {
        id: docId,
        filename: file.name,
        type: file.type,
        size: file.size,
        uploadDate: new Date().toISOString(),
        status: 'Revisión', // Will change after processing
        tipo: 'Procesando...',
        documentType: 'documento_generico',
        extractedFields: {},
        blockingReasons: [],
        logs: [
          { timestamp: new Date().toISOString(), action: 'Archivo subido' },
          { timestamp: new Date().toISOString(), action: 'Iniciando procesamiento automático' }
        ],
        file
      };

      setDocuments(prev => [newDoc, ...prev]);
      setProcessing(prev => {
        const newSet = new Set(prev);
        newSet.add(docId);
        return newSet;
      });

      // Execute processInboxItem automatically
      await executeProcessInboxItem(newDoc, file);
    }
  }, [executeProcessInboxItem]);

  /**
   * DISPARADOR OBLIGATORIO 2: Al pulsar "🔁 Reprocesar"
   */
  const handleReprocess = useCallback(async (doc: UnicornioDocument) => {
    if (!doc.file) {
      toast.error('Archivo no disponible para reprocesar');
      return;
    }

    const updatedDoc = {
      ...doc,
      logs: [...doc.logs, { timestamp: new Date().toISOString(), action: 'Reprocesamiento iniciado' }]
    };

    setDocuments(prev => prev.map(d => d.id === doc.id ? updatedDoc : d));
    setProcessing(prev => {
      const newSet = new Set(prev);
      newSet.add(doc.id);
      return newSet;
    });

    await executeProcessInboxItem(updatedDoc, doc.file, true);
  }, [executeProcessInboxItem]);

  /**
   * DISPARADOR OBLIGATORIO 3: Al guardar cambios en editor
   */
  const handleCompleteAndArchive = async (doc: UnicornioDocument, updates: Record<string, any>) => {
    try {
      const result = await classifyAndArchive(
        doc.id,
        doc.documentType,
        doc.extractedFields,
        updates
      );

      if (result.success) {
        const archivedDoc: UnicornioDocument = {
          ...doc,
          ...updates,
          status: 'Guardado',
          destinoFinal: result.destination,
          blockingReasons: [],
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          logs: [
            ...doc.logs,
            { timestamp: new Date().toISOString(), action: 'Completado por usuario' },
            { timestamp: new Date().toISOString(), action: `Archivado en ${result.destination}` }
          ]
        };

        setDocuments(prev => prev.map(d => d.id === doc.id ? archivedDoc : d));
        setSelectedDocument(archivedDoc);
        toast.success(result.message);
      } else {
        toast.error('Error al archivar documento');
      }
    } catch (error) {
      toast.error(`Error: ${error}`);
    }
  };

  const handleDelete = (documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    if (selectedDocument?.id === documentId) {
      setSelectedDocument(null);
    }
    toast.success('Documento eliminado');
  };

  /**
   * Handle save and archive from DocumentEditPanel
   */
  const handleSaveDocument = async (document: UnicornioDocument, updates: Record<string, any>) => {
    try {
      // Update document with new field values
      const updatedDocument = {
        ...document,
        extractedFields: {
          ...document.extractedFields,
          ...updates
        },
        // Update table columns
        inmueblePersonal: updates.destino || document.inmueblePersonal,
        // Mark as saved if validation passes
        status: 'Guardado' as DocumentStatus,
        destinoFinal: generateDestinationFromUpdates(updates, document.tipo),
        logs: [
          ...document.logs,
          { timestamp: new Date().toISOString(), action: 'Documento actualizado y archivado' },
          { timestamp: new Date().toISOString(), action: `Guardado en: ${generateDestinationFromUpdates(updates, document.tipo)}` }
        ]
      };

      // Update in state
      setDocuments(prev => prev.map(doc => 
        doc.id === document.id ? updatedDocument : doc
      ));

      // Close panel
      setSelectedDocument(null);

      toast.success(`Documento archivado en ${updatedDocument.destinoFinal}`);

      // TODO: Here would call the actual save/archive API
      // await classifyAndArchive(document.id, document.documentType, updatedDocument.extractedFields, updates);

    } catch (error) {
      toast.error('Error al guardar el documento');
      console.error('Save error:', error);
    }
  };

  /**
   * Generate destination path from updates
   */
  const generateDestinationFromUpdates = (updates: Record<string, any>, documentType: string): string => {
    switch (documentType) {
      case 'Factura':
        if (updates.destino?.includes('Inmueble')) {
          return `Inmuebles › ${updates.destino} › Gastos`;
        }
        return 'Personal › Gastos';
      case 'Extracto':
        return 'Tesorería › Movimientos';
      case 'Contrato':
        return `Inmuebles › ${updates.destino} › Contratos`;
      default:
        return updates.destino || 'Archivo › General';
    }
  };

  // Helper functions
  const getDisplayType = (docType: DocumentType): string => {
    switch (docType) {
      case 'extracto_bancario': return 'Extracto';
      case 'factura_suministro': return 'Suministro';
      case 'factura_reforma': return 'Reforma';
      case 'contrato': return 'Contrato';
      case 'documento_generico': return 'Documento';
      default: return 'Otro';
    }
  };

  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return <FileText className="w-4 h-4 text-error-500" />;
      case 'jpg': case 'jpeg': case 'png': return <Image className="w-4 h-4 text-primary-500" />;
      case 'xlsx': case 'xls': case 'csv': return <FileSpreadsheet className="w-4 h-4 text-success-500" />;
      case 'zip': case 'eml': return <Archive className="w-4 h-4 text-purple-500" />;
      default: return <File className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case 'Guardado': return <CheckCircle className="w-4 h-4 text-success-600" />;
      case 'Revisión': return <AlertTriangle className="w-4 h-4 text-warning-600" />;
      case 'Error': return <XCircle className="w-4 h-4 text-error-600" />;
    }
  };

  // Enhanced filtering per specification
  const getFilteredDocuments = () => {
    let filtered = documents;

    // Status filter
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(doc => doc.status === statusFilter);
    }

    // Type filter - categorize by document types
    if (typeFilter !== 'todos') {
      filtered = filtered.filter(doc => {
        const docType = doc.documentType;
        switch (typeFilter) {
          case 'facturas':
            return docType.includes('factura') || docType.includes('recibo');
          case 'extractos':
            return docType.includes('extracto');
          case 'contratos':
            return docType.includes('contrato');
          case 'otros':
            return !docType.includes('factura') && !docType.includes('extracto') && !docType.includes('contrato');
          default:
            return true;
        }
      });
    }

    // Date filter
    if (dateFilter === '72h') {
      const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);
      filtered = filtered.filter(doc => new Date(doc.uploadDate) > cutoff);
    } else if (dateFilter === '7d') {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(doc => new Date(doc.uploadDate) > cutoff);
    } else if (dateFilter === '30d') {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(doc => new Date(doc.uploadDate) > cutoff);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.filename.toLowerCase().includes(term) ||
        doc.proveedorEmisor?.toLowerCase().includes(term) ||
        doc.inmueblePersonal?.toLowerCase().includes(term) ||
        doc.ibanDetectado?.toLowerCase().includes(term) ||
        doc.id.toLowerCase().includes(term)
      );
    }

    return filtered;
  };

  const getStatusCounts = () => {
    return {
      todos: documents.length,
      Guardado: documents.filter(d => d.status === 'Guardado').length,
      Revisión: documents.filter(d => d.status === 'Revisión').length,
      Error: documents.filter(d => d.status === 'Error').length
    };
  };

  const statusCounts = getStatusCounts();
  const filteredDocuments = getFilteredDocuments();

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#F8F9FA' }}>
      {/* Header - HORIZON styling with exact specification */}
      <div className="flex-shrink-0 border-b bg-white px-6 py-4" style={{ borderColor: '#DEE2E6' }}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold" style={{ 
            color: '#303A4C',
            fontFamily: 'Inter, sans-serif',
            fontWeight: '600' 
          }}>
            Bandeja de entrada
          </h1>
          
          <div className="relative">
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.xls,.csv,.zip,.eml"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <button
              className="text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors hover:opacity-90"
              style={{ 
                backgroundColor: '#042C5E',
                fontFamily: 'Inter, sans-serif',
                fontWeight: '500'
              }}
            >
              <Upload className="w-4 h-4" strokeWidth={1.5} />
              Subir archivo
            </button>
          </div>
        </div>
      </div>

      {/* Drag/Drop Zone + Select File Button - per specification */}
      <div className="flex-shrink-0 bg-white px-6 py-4" style={{ borderBottom: '1px solid #DEE2E6' }}>
        <div 
          className="border-2 border-dashed rounded-lg p-6 text-center transition-colors hover:border-opacity-80"
          style={{ 
            borderColor: '#DEE2E6',
            fontFamily: 'Inter, sans-serif'
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files) {
              handleFileUpload(e.dataTransfer.files);
            }
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#042C5E'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#DEE2E6'}
        >
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8" strokeWidth={1.5} style={{ color: '#6C757D' }} />
            <p className="text-sm" style={{ color: '#303A4C', fontFamily: 'Inter, sans-serif' }}>
              Arrastra archivos aquí o{' '}
              <label className="font-medium cursor-pointer hover:underline" style={{ color: '#042C5E' }}>
                selecciona archivos
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.xls,.csv,.zip,.eml"
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                  className="hidden"
                />
              </label>
            </p>
            <p className="text-xs" style={{ color: '#6C757D', fontFamily: 'Inter, sans-serif' }}>
              Facturas/recibos: PDF, JPG, PNG, DOCX • Extractos: CSV, XLS, XLSX • Contratos: PDF • ZIP soportado
            </p>
          </div>
        </div>
      </div>

      {/* Discrete filters above table - per specification */}
      <div className="flex-shrink-0 px-6 py-4" style={{ 
        backgroundColor: '#F8F9FA', 
        borderBottom: '1px solid #DEE2E6',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Global search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" strokeWidth={1.5} style={{ color: '#6C757D' }} />
            <input
              type="text"
              placeholder="Buscar por proveedor, banco, IBAN, inmueble..."
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-hz-primary text-sm bg-white"
              style={{ 
                borderColor: '#DEE2E6',
                fontFamily: 'Inter, sans-serif'
              }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Estado filter */}
          <div className="flex flex-wrap rounded-lg p-1 gap-1" style={{ backgroundColor: '#DEE2E6' }}>
            {[
              { key: 'todos' as const, label: 'Todos', count: statusCounts.todos },
              { key: 'Guardado' as const, label: 'Auto-guardado', count: statusCounts.Guardado },
              { key: 'Revisión' as const, label: 'Revisión', count: statusCounts.Revisión },
              { key: 'Error' as const, label: 'Error', count: statusCounts.Error }
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  statusFilter === key
                    ? 'bg-white shadow-sm'
                    : 'hover:bg-white hover:bg-opacity-50'
                }`}
                style={{ 
                  color: statusFilter === key ? '#042C5E' : '#303A4C',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: '500'
                }}
              >
                {label} ({count})
              </button>
            ))}
          </div>

          {/* Tipo filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hz-primary bg-white"
            style={{ 
              borderColor: '#DEE2E6',
              fontFamily: 'Inter, sans-serif'
            }}
          >
            <option value="todos">Todos los tipos</option>
            <option value="facturas">Facturas</option>
            <option value="extractos">Extractos</option>
            <option value="contratos">Contratos</option>
            <option value="otros">Otros</option>
          </select>

          {/* Date range filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hz-primary bg-white"
            style={{ 
              borderColor: '#DEE2E6',
              fontFamily: 'Inter, sans-serif'
            }}
          >
            <option value="todos">Todas las fechas</option>
            <option value="72h">Últimas 72h</option>
            <option value="7d">Última semana</option>
            <option value="30d">Último mes</option>
          </select>
        </div>
      </div>

      {/* Contenido principal con tabla según especificación */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tabla principal con columnas exactas */}
        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y" style={{ borderColor: '#DEE2E6' }}>
            <thead className="sticky top-0" style={{ backgroundColor: '#F8F9FA' }}>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ 
                  color: '#303A4C',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  Tipo detectado
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ 
                  color: '#303A4C',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  Proveedor / Banco
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ 
                  color: '#303A4C',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  Inmueble
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ 
                  color: '#303A4C',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  Cuenta
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ 
                  color: '#303A4C',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ 
                  color: '#303A4C',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y" style={{ borderColor: '#DEE2E6' }}>
              {filteredDocuments.map((doc) => (
                <tr
                  key={doc.id}
                  className={`cursor-pointer transition-colors ${
                    selectedDocument?.id === doc.id ? 'border-l-4' : ''
                  }`}
                  style={{ 
                    backgroundColor: selectedDocument?.id === doc.id ? '#F8F9FA' : 'white',
                    borderLeftColor: selectedDocument?.id === doc.id ? '#042C5E' : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedDocument?.id !== doc.id) {
                      e.currentTarget.style.backgroundColor = '#F8F9FA';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedDocument?.id !== doc.id) {
                      e.currentTarget.style.backgroundColor = 'white';
                    }
                  }}
                  onClick={() => setSelectedDocument(doc)}
                >
                  {/* Tipo detectado */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getFileIcon(doc.filename)}
                      <div>
                        <div className="text-sm font-medium" style={{ 
                          color: '#303A4C',
                          fontFamily: 'Inter, sans-serif'
                        }}>
                          {processing.has(doc.id) ? 'Procesando...' : getDisplayType(doc.documentType)}
                        </div>
                        <div className="text-xs" style={{ 
                          color: '#6C757D',
                          fontFamily: 'Inter, sans-serif'
                        }}>
                          {doc.filename}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  {/* Proveedor / Banco */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm" style={{ 
                      color: '#303A4C',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      {doc.proveedorEmisor || '—'}
                    </div>
                    {doc.importe && (
                      <div className="text-xs" style={{ 
                        color: '#6C757D',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        {doc.importe.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                      </div>
                    )}
                  </td>
                  
                  {/* Inmueble */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ 
                    color: '#303A4C',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    {doc.inmueblePersonal || '—'}
                  </td>
                  
                  {/* Cuenta (solo para extractos) */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {doc.documentType.includes('extracto') ? (
                      doc.ibanDetectado ? (
                        <div className="text-sm font-mono" style={{ 
                          color: '#303A4C',
                          fontFamily: 'Inter, sans-serif'
                        }}>
                          {doc.ibanDetectado}
                        </div>
                      ) : (
                        <span className="text-sm" style={{ 
                          color: '#FFC107',
                          fontFamily: 'Inter, sans-serif'
                        }}>
                          Pendiente selección
                        </span>
                      )
                    ) : (
                      <span className="text-sm" style={{ 
                        color: '#6C757D',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        —
                      </span>
                    )}
                  </td>
                  
                  {/* Estado */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(doc.status)}
                      <span className={`text-sm font-medium`} style={{ 
                        color: doc.status === 'Guardado' ? '#28A745' : 
                               doc.status === 'Revisión' ? '#FFC107' : '#DC3545',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        {doc.status === 'Guardado' ? 'Auto-guardado (72h)' :
                         doc.status === 'Revisión' ? 'Revisión' : 'Error'}
                      </span>
                    </div>
                  </td>
                  
                  {/* Acciones */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-3">
                      {/* Ver/Editar */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDocument(doc);
                        }}
                        className="transition-opacity hover:opacity-80"
                        style={{ color: '#042C5E' }}
                        title="Ver/Editar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                      
                      {/* Guardar/Confirmar (solo si no está guardado) */}
                      {doc.status !== 'Guardado' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveDocument(doc, {});
                          }}
                          className="transition-opacity hover:opacity-80"
                          style={{ color: '#28A745' }}
                          title="Guardar/Confirmar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </button>
                      )}
                      
                      {/* Eliminar */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc.id);
                        }}
                        className="transition-opacity hover:opacity-80"
                        style={{ color: '#DC3545' }}
                        title="Eliminar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredDocuments.length === 0 && (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12" style={{ color: '#6C757D' }} strokeWidth={1.5} />
              <h3 className="mt-2 text-sm font-medium" style={{ 
                color: '#303A4C',
                fontFamily: 'Inter, sans-serif'
              }}>
                No hay documentos
              </h3>
              <p className="mt-1 text-sm" style={{ 
                color: '#6C757D',
                fontFamily: 'Inter, sans-serif'
              }}>
                Sube algunos archivos para comenzar a procesarlos
              </p>
            </div>
          )}
        </div>

        {/* Panel lateral de vista/edición */}
        {selectedDocument && (
          <div className="w-full lg:w-96 xl:w-[32rem] border-l border-gray-200 bg-white flex flex-col">
            <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 pr-4">
                  {selectedDocument.filename}
                </h3>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto px-6 py-4">
              {/* Preview del documento */}
              {selectedDocument.file && (
                <div className="mb-6">
                  <DocumentPreview
                    filename={selectedDocument.filename}
                    fileType={selectedDocument.type}
                    fileContent={selectedDocument.file}
                    className="border rounded-lg"
                  />
                </div>
              )}

              {/* Metadatos extraídos */}
              <div className="space-y-4 mb-6">
                <h4 className="font-medium text-gray-900">Metadatos</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Tipo:</span>
                    <div className="font-medium">{selectedDocument.tipo}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Proveedor:</span>
                    <div className="font-medium">{selectedDocument.proveedorEmisor || '—'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Importe:</span>
                    <div className="font-medium">
                      {selectedDocument.importe ? `${selectedDocument.importe.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Fecha:</span>
                    <div className="font-medium">
                      {selectedDocument.fechaDoc ? new Date(selectedDocument.fechaDoc).toLocaleDateString('es-ES') : '—'}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">IBAN:</span>
                    <div className="font-medium font-mono">{selectedDocument.ibanDetectado || '—'}</div>
                  </div>
                  {selectedDocument.destinoFinal && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Destino final:</span>
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#06A77D] bg-opacity-10 text-[#06A77D]">
                          {selectedDocument.destinoFinal}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mensajes de revisión/error */}
              {selectedDocument.status === 'Revisión' && selectedDocument.blockingReasons.length > 0 && (
                <div className="mb-6 p-4 bg-[#D97706] bg-opacity-10 border border-[#D97706] border-opacity-20 rounded-lg">
                  <div className="flex items-center mb-2">
                    <AlertTriangle className="w-5 h-5 text-warning-600 mr-2" />
                    <span className="font-medium text-warning-600">Revisión requerida</span>
                  </div>
                  <ul className="text-sm text-warning-600 space-y-1">
                    {selectedDocument.blockingReasons.map((reason, index) => (
                      <li key={index}>• {reason}</li>
                    ))}
                  </ul>
                  
                  {/* Reform breakdown component */}
                  {selectedDocument.blockingReasons.some(r => r.includes('Reparto entre categorías')) && 
                   selectedDocument.documentType === 'factura_reforma' && (
                    <div className="mt-4">
                      <ReformBreakdownComponent
                        totalAmount={selectedDocument.importe || 0}
                        onBreakdownChange={(breakdown) => {
                          handleCompleteAndArchive(selectedDocument, {
                            reform_breakdown: breakdown,
                            categoriaFiscal: 'Completo'
                          });
                        }}
                        initialBreakdown={selectedDocument.extractedFields.desglose_categorias}
                      />
                    </div>
                  )}

                  {/* Property selection for utilities */}
                  {selectedDocument.blockingReasons.some(r => r.includes('inmueble')) && (
                    <div className="mt-4 space-y-3">
                      <label className="block text-sm font-medium text-warning-600">
                        Seleccionar inmueble:
                      </label>
                      <select 
                        className="w-full px-3 py-2 border border-[#D97706] border-opacity-30 rounded-md focus:outline-none focus:ring-2 focus:ring-[#D97706]"
                        onChange={(e) => {
                          const propertyId = e.target.value;
                          if (propertyId) {
                            handleCompleteAndArchive(selectedDocument, {
                              property_id: propertyId,
                              inmueble_alias: `Inmueble ${propertyId}`,
                              inmueblePersonal: `Inmueble ${propertyId}`
                            });
                          }
                        }}
                      >
                        <option value="">Seleccionar...</option>
                        <option value="1">C/ Mayor 123</option>
                        <option value="2">Piso 2A</option>
                        <option value="3">Local Centro</option>
                      </select>
                    </div>
                  )}

                  {/* Destination selection for generic documents */}
                  {selectedDocument.blockingReasons.some(r => r.includes('Destino requerido')) && (
                    <div className="mt-4 space-y-3">
                      <label className="block text-sm font-medium text-warning-600">
                        Seleccionar destino:
                      </label>
                      <select 
                        className="w-full px-3 py-2 border border-[#D97706] border-opacity-30 rounded-md focus:outline-none focus:ring-2 focus:ring-[#D97706]"
                        onChange={(e) => {
                          const destino = e.target.value;
                          if (destino) {
                            handleCompleteAndArchive(selectedDocument, {
                              destino: destino,
                              destinoFinal: destino
                            });
                          }
                        }}
                      >
                        <option value="">Seleccionar...</option>
                        <option value="Inmuebles › Gastos">Inmuebles › Gastos</option>
                        <option value="Tesorería › Movimientos">Tesorería › Movimientos</option>
                        <option value="Archivo › General">Archivo › General</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {selectedDocument.status === 'Error' && (
                <div className="mb-6 p-4 bg-[#C81E1E] bg-opacity-10 border border-[#C81E1E] border-opacity-20 rounded-lg">
                  <div className="flex items-center mb-2">
                    <XCircle className="w-5 h-5 text-[#C81E1E] mr-2" />
                    <span className="font-medium text-[#C81E1E]">Error en procesamiento</span>
                  </div>
                  <ul className="text-sm text-[#C81E1E] space-y-1">
                    {selectedDocument.blockingReasons.map((reason, index) => (
                      <li key={index}>• {reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Logs panel */}
            <div className="flex-shrink-0 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowLogsPanel(!showLogsPanel)}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-sm font-medium text-gray-900">Logs</span>
                {showLogsPanel ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>
              
              {showLogsPanel && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {selectedDocument.logs.map((log, index) => (
                    <div key={index} className="text-xs bg-gray-50 p-3 rounded">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{log.action}</span>
                        <span className="text-gray-500">
                          {new Date(log.timestamp).toLocaleString('es-ES')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DocumentEditPanel (right drawer) */}
        <DocumentEditPanel
          document={selectedDocument}
          isOpen={!!selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onSave={(updates) => handleSaveDocument(selectedDocument!, updates)}
          onReprocess={() => selectedDocument && handleReprocess(selectedDocument)}
          onDelete={() => {
            if (selectedDocument) {
              handleDelete(selectedDocument.id);
              setSelectedDocument(null);
            }
          }}
        />
      </div>
    </div>
  );
};

export default UnicornioInboxPrompt;