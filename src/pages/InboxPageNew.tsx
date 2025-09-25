import React, { useState, useEffect } from 'react';
import { 
  Upload, Search, Eye, RotateCcw, Trash2, CheckCircle, AlertTriangle, XCircle,
  FileText, Image, FileSpreadsheet, Archive, File, X, ChevronDown, ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';

// Document state types as per requirements
type DocumentStatus = 'guardado_automatico' | 'revision_requerida' | 'error';

interface InboxDocument {
  id: string;
  filename: string;
  type: string;
  size: number;
  uploadDate: string;
  status: DocumentStatus;
  
  // Extracted fields
  tipo: 'Factura' | 'Recibo' | 'Extracto' | 'Contrato' | 'Archivo' | 'Otro';
  proveedor?: string;
  importe?: number;
  fecha?: string;
  inmueble?: string;
  iban?: string;
  destino?: string;
  
  // Metadata
  logs: Array<{
    timestamp: string;
    action: string;
  }>;
  blockingReasons?: string[];
  expiresAt?: string; // For 72h retention
}

type DocumentType = 'Factura' | 'Recibo' | 'Extracto' | 'Contrato' | 'Otro';

const InboxPageNew: React.FC = () => {
  const [documents, setDocuments] = useState<InboxDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<InboxDocument | null>(null);
  const [statusFilter, setStatusFilter] = useState<'todos' | DocumentStatus>('todos');
  const [typeFilter, setTypeFilter] = useState<'todos' | DocumentType>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('72h');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showLogsPanel, setShowLogsPanel] = useState(false);

  // Load initial data
  useEffect(() => {
    loadDocuments();
    
    // Clean up expired documents every minute
    const interval = setInterval(cleanupExpiredDocuments, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadDocuments = () => {
    // Sample data for testing - following the requirements exactly
    const mockDocs: InboxDocument[] = [
      {
        id: '1',
        filename: 'factura_luz_enero.pdf',
        type: 'application/pdf',
        size: 1024576,
        uploadDate: new Date().toISOString(),
        status: 'guardado_automatico',
        tipo: 'Factura',
        proveedor: 'Iberdrola',
        importe: 89.45,
        fecha: '2024-01-15',
        inmueble: 'C/ Mayor 123',
        iban: '****1234',
        destino: 'Inmuebles › Gastos › Suministros',
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        logs: [
          { timestamp: new Date().toISOString(), action: 'OCR realizado' },
          { timestamp: new Date().toISOString(), action: 'Clasificado como suministro' },
          { timestamp: new Date().toISOString(), action: 'Archivado automáticamente' }
        ]
      },
      {
        id: '2',
        filename: 'reforma_cocina.pdf',
        type: 'application/pdf',
        size: 2048576,
        uploadDate: new Date().toISOString(),
        status: 'revision_requerida',
        tipo: 'Factura',
        proveedor: 'Reformas García',
        importe: 2500.00,
        fecha: '2024-01-14',
        inmueble: 'Piso 2A',
        blockingReasons: ['Categoría fiscal requerida: Mejora/Mobiliario/Reparación y Conservación'],
        logs: [
          { timestamp: new Date().toISOString(), action: 'OCR realizado' },
          { timestamp: new Date().toISOString(), action: 'Clasificado como reforma' },
          { timestamp: new Date().toISOString(), action: 'Pendiente de categorización' }
        ]
      },
      {
        id: '3',
        filename: 'extracto_marzo.csv',
        type: 'text/csv',
        size: 512000,
        uploadDate: new Date().toISOString(),
        status: 'error',
        tipo: 'Extracto',
        blockingReasons: ['Formato CSV no reconocido', 'Cabeceras de columnas no detectadas'],
        logs: [
          { timestamp: new Date().toISOString(), action: 'Archivo cargado' },
          { timestamp: new Date().toISOString(), action: 'Error en procesamiento CSV' }
        ]
      },
      {
        id: '4',
        filename: 'contrato_alquiler.pdf',
        type: 'application/pdf',
        size: 3072000,
        uploadDate: new Date().toISOString(),
        status: 'guardado_automatico',
        tipo: 'Contrato',
        proveedor: 'Juan Pérez',
        importe: 950.00,
        fecha: '2024-01-10',
        inmueble: 'Apartamento 1B',
        destino: 'Inmuebles › Contratos',
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        logs: [
          { timestamp: new Date().toISOString(), action: 'OCR realizado' },
          { timestamp: new Date().toISOString(), action: 'Clasificado como contrato' },
          { timestamp: new Date().toISOString(), action: 'Archivado automáticamente' }
        ]
      }
    ];
    
    setDocuments(mockDocs);
  };

  const cleanupExpiredDocuments = () => {
    const now = new Date();
    setDocuments(prev => prev.filter(doc => {
      if (doc.status === 'guardado_automatico' && doc.expiresAt) {
        return new Date(doc.expiresAt) > now;
      }
      return true;
    }));
  };

  const handleFileUpload = (files: FileList) => {
    Array.from(files).forEach(file => {
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/zip',
        'message/rfc822'
      ];
      
      if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().match(/\.(pdf|jpg|jpeg|png|docx|xlsx|xls|zip|eml)$/)) {
        toast.error(`Formato no soportado: ${file.name}`);
        return;
      }

      // Process document according to requirements
      const processed = processDocument(file);
      setDocuments(prev => [processed, ...prev]);
    });
  };

  const processDocument = (file: File): InboxDocument => {
    const filename = file.name.toLowerCase();
    const now = new Date().toISOString();
    
    let processed: InboxDocument = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      filename: file.name,
      type: file.type,
      size: file.size,
      uploadDate: now,
      status: 'guardado_automatico',
      tipo: 'Otro',
      logs: [
        { timestamp: now, action: 'Documento cargado' },
        { timestamp: now, action: 'OCR iniciado' }
      ]
    };

    // 1. Suministros - Auto-save to Inmuebles › Gastos › Suministros
    if (filename.includes('luz') || filename.includes('agua') || filename.includes('gas') || 
        filename.includes('telefon') || filename.includes('internet') || filename.includes('iberdrola') ||
        filename.includes('endesa') || filename.includes('naturgy')) {
      
      processed.tipo = 'Factura';
      processed.proveedor = filename.includes('iberdrola') ? 'Iberdrola' : 
                           filename.includes('endesa') ? 'Endesa' :
                           filename.includes('naturgy') ? 'Naturgy' : 'Proveedor de Suministros';
      processed.importe = 75.50 + Math.random() * 100;
      processed.fecha = new Date().toISOString().split('T')[0];
      processed.inmueble = 'Inmueble detectado';
      processed.iban = `****${Math.floor(1000 + Math.random() * 9000)}`;
      processed.destino = 'Inmuebles › Gastos › Suministros';
      processed.status = 'guardado_automatico';
      processed.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      processed.logs.push(
        { timestamp: new Date().toISOString(), action: 'Clasificado como suministro' },
        { timestamp: new Date().toISOString(), action: 'Archivado automáticamente' }
      );
      toast.success(`${file.name} procesado y archivado automáticamente`);
      
    // 2. Reformas/Compras - Require category selection
    } else if (filename.includes('reforma') || filename.includes('obra') || 
               filename.includes('compra') || filename.includes('material')) {
      
      processed.tipo = 'Factura';
      processed.proveedor = 'Reformas García';
      processed.importe = 1500 + Math.random() * 3000;
      processed.fecha = new Date().toISOString().split('T')[0];
      processed.inmueble = 'Piso 2A';
      processed.blockingReasons = ['Categoría fiscal requerida: Mejora/Mobiliario/Reparación y Conservación'];
      processed.status = 'revision_requerida';
      processed.logs.push(
        { timestamp: new Date().toISOString(), action: 'Clasificado como reforma' },
        { timestamp: new Date().toISOString(), action: 'Pendiente de categorización' }
      );
      toast(`${file.name} requiere categorización fiscal`, {
        icon: '⚠️',
        duration: 4000,
      });
      
    // 3. Recibos simples - Auto-save to Tesorería › Movimientos
    } else if (filename.includes('recibo') || filename.includes('adeudo') || 
               filename.includes('cuota') || filename.includes('cobro')) {
      
      processed.tipo = 'Recibo';
      processed.proveedor = 'Emisor detectado';
      processed.importe = 25 + Math.random() * 200;
      processed.fecha = new Date().toISOString().split('T')[0];
      processed.iban = `****${Math.floor(1000 + Math.random() * 9000)}`;
      processed.destino = 'Tesorería › Movimientos';
      processed.status = 'guardado_automatico';
      processed.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      processed.logs.push(
        { timestamp: new Date().toISOString(), action: 'Clasificado como recibo' },
        { timestamp: new Date().toISOString(), action: 'Movimiento creado en Tesorería' }
      );
      toast.success(`${file.name} procesado - movimiento creado en Tesorería`);
      
    // 4. Extractos bancarios - Process movements, don't block
    } else if (filename.includes('extracto') || filename.includes('.csv') || 
               filename.includes('.xlsx') || filename.includes('movimientos')) {
      
      processed.tipo = 'Extracto';
      processed.destino = 'Tesorería › Movimientos';
      processed.status = 'guardado_automatico';
      processed.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      processed.logs.push(
        { timestamp: new Date().toISOString(), action: 'Extracto bancario procesado' },
        { timestamp: new Date().toISOString(), action: `${3 + Math.floor(Math.random() * 10)} movimientos importados` }
      );
      toast.success(`${file.name} procesado - ${3 + Math.floor(Math.random() * 10)} movimientos importados`);
      
    // 5. Contratos - Auto-save to Inmuebles › Contratos
    } else if (filename.includes('contrato') || filename.includes('contract') ||
               processed.type.includes('docx')) {
      
      processed.tipo = 'Contrato';
      processed.inmueble = 'Propiedad definida';
      processed.destino = 'Inmuebles › Contratos';
      processed.status = 'guardado_automatico';
      processed.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      processed.logs.push(
        { timestamp: new Date().toISOString(), action: 'Clasificado como contrato' },
        { timestamp: new Date().toISOString(), action: 'Archivado en Inmuebles › Contratos' }
      );
      toast.success(`${file.name} archivado en Inmuebles › Contratos`);
      
    // 6. Otros - Require destination selection
    } else {
      processed.tipo = 'Otro';
      processed.blockingReasons = ['Destino requerido: seleccionar Inmueble/Personal'];
      processed.status = 'revision_requerida';
      processed.logs.push(
        { timestamp: new Date().toISOString(), action: 'Clasificación manual requerida' }
      );
      toast(`${file.name} requiere clasificación manual`, {
        icon: '⚠️',
        duration: 4000,
      });
    }

    return processed;
  };

  const handleCompleteAndArchive = (document: InboxDocument) => {
    if (document.blockingReasons?.some(r => r.includes('Categoría fiscal')) && !selectedCategory) {
      toast.error('Selecciona una categoría fiscal');
      return;
    }

    setDocuments(prev => prev.map(doc => {
      if (doc.id === document.id) {
        return {
          ...doc,
          status: 'guardado_automatico',
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          destino: selectedCategory ? `Inmuebles › Gastos › ${selectedCategory}` : 'Documentos',
          blockingReasons: undefined,
          logs: [
            ...doc.logs,
            { timestamp: new Date().toISOString(), action: 'Completado y archivado' }
          ]
        };
      }
      return doc;
    }));
    
    setSelectedDocument(null);
    setSelectedCategory('');
    toast.success('Documento completado y archivado');
  };

  const handleReprocess = (documentId: string) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === documentId) {
        return {
          ...doc,
          status: 'guardado_automatico',
          logs: [
            ...doc.logs,
            { timestamp: new Date().toISOString(), action: 'Reprocesado exitosamente' }
          ]
        };
      }
      return doc;
    }));
    
    toast.success('Documento reprocesado exitosamente');
  };

  const handleDelete = (documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    if (selectedDocument?.id === documentId) {
      setSelectedDocument(null);
    }
    toast.success('Documento eliminado');
  };

  const getStatusCounts = () => {
    const counts = {
      todos: documents.length,
      guardado_automatico: documents.filter(d => d.status === 'guardado_automatico').length,
      revision_requerida: documents.filter(d => d.status === 'revision_requerida').length,
      error: documents.filter(d => d.status === 'error').length
    };
    return counts;
  };

  const getFilteredDocuments = () => {
    let filtered = documents;

    // Status filter
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(doc => doc.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'todos') {
      filtered = filtered.filter(doc => doc.tipo === typeFilter);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.filename.toLowerCase().includes(term) ||
        doc.proveedor?.toLowerCase().includes(term) ||
        doc.inmueble?.toLowerCase().includes(term) ||
        doc.iban?.toLowerCase().includes(term) ||
        doc.id.toLowerCase().includes(term) ||
        doc.importe?.toString().includes(term)
      );
    }

    return filtered;
  };

  const formatAmount = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-ES');
  };

  const getTypeIcon = (tipo: string) => {
    switch (tipo) {
      case 'Factura': return <FileText className="w-4 h-4 text-primary-500" />;
      case 'Recibo': return <FileText className="w-4 h-4 text-success-500" />;
      case 'Extracto': return <FileSpreadsheet className="w-4 h-4 text-orange-500" />;
      case 'Contrato': return <File className="w-4 h-4 text-purple-500" />;
      case 'Archivo': return <Archive className="w-4 h-4 text-gray-500" />;
      default: return <File className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case 'guardado_automatico': return <CheckCircle className="w-4 h-4 text-success-600" />;
      case 'revision_requerida': return <AlertTriangle className="w-4 h-4 text-warning-600" />;
      case 'error': return <XCircle className="w-4 h-4 text-error-600" />;
    }
  };

  const statusCounts = getStatusCounts();
  const filteredDocuments = getFilteredDocuments();

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header compacto */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Bandeja de entrada</h1>
          
          {/* Botón Subir documentos */}
          <div className="relative">
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.xls,.zip,.eml"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          >
            />
            <button
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
              >
              style={{ 
                backgroundColor: '#0A2A57'
              }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Subir documentos
            </button>
          </div>
        </div>
      </div>

      {/* Barra de utilidades */}
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200 px-6 py-4 space-y-4">
        {/* Buscador global */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por proveedor, importe, IBAN, inmueble, ID..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Segmented control de estado con contadores */}
        <div className="flex flex-wrap bg-gray-100 rounded-lg p-1 gap-1">
          {([
            { key: 'todos', label: 'Todos', count: statusCounts.todos },
            { key: 'guardado_automatico', label: 'Guardado ✅', count: statusCounts.guardado_automatico },
            { key: 'revision_requerida', label: 'Revisión ⚠', count: statusCounts.revision_requerida },
            { key: 'error', label: 'Error ⛔', count: statusCounts.error }
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                statusFilter === key
                  ? 'text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              style={{
                backgroundColor: statusFilter === key ? '#0A2A57' : 'transparent'
              }}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {/* Filtros adicionales */}
        <div className="flex flex-wrap gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="todos">Todos los tipos</option>
            <option value="Factura">Factura</option>
            <option value="Recibo">Recibo</option>
            <option value="Extracto">Extracto</option>
            <option value="Contrato">Contrato</option>
            <option value="Otro">Otro</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="72h">Últimas 72h</option>
            <option value="7d">Última semana</option>
            <option value="30d">Último mes</option>
            <option value="all">Todos</option>
          </select>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex min-h-0">
        {/* Tabla principal */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Proveedor/Emisor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Importe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha doc.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inmueble
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IBAN
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Destino final
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.map((doc) => (
                  <tr
                    key={doc.id}
                    className={`hover:bg-gray-50 cursor-pointer ${
                      selectedDocument?.id === doc.id ? 'bg-primary-50' : ''
                    }`}
                    onClick={() => setSelectedDocument(doc)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getTypeIcon(doc.tipo)}
                        <span className="ml-2 text-sm text-gray-900">{doc.tipo}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {doc.proveedor || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatAmount(doc.importe)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(doc.fecha)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {doc.inmueble || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {doc.iban || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {doc.destino ? (
                        <span 
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer text-white"
                          >
                          style={{ backgroundColor: '#0A2A57' }}
                          title={`Ir a ${doc.destino}`}
                        >
                          {doc.destino}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(doc.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDocument(doc);
                          }}
                          className="text-primary-600 hover:text-primary-900"
                          >
                          title="Ver"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {doc.status === 'error' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReprocess(doc.id);
                            }}
                            className="text-success-600 hover:text-success-900"
                            >
                            title="Reprocesar"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(doc.id);
                          }}
                          className="text-error-600 hover:text-error-900"
                          >
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel de detalle */}
        {selectedDocument && (
          <div className="w-96 border-l border-gray-200 bg-white overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Detalle del documento</h3>
              <button
                onClick={() => setSelectedDocument(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Vista previa del documento */}
              <div className="bg-gray-100 rounded-lg p-4 text-center">
                {selectedDocument.type.startsWith('image/') ? (
                  <Image className="w-16 h-16 mx-auto text-gray-400" />
                ) : selectedDocument.type === 'application/pdf' ? (
                  <FileText className="w-16 h-16 mx-auto text-red-400" />
                ) : (
                  <File className="w-16 h-16 mx-auto text-gray-400" />
                )}
                <p className="mt-2 text-sm text-gray-600">{selectedDocument.filename}</p>
              </div>

              {/* Campos extraídos */}
              <div className="space-y-3">
                <div>
                  <span className="text-gray-500">Tipo:</span>
                  <p className="font-medium">{selectedDocument.tipo}</p>
                </div>
                <div>
                  <span className="text-gray-500">Proveedor:</span>
                  <p className="font-medium">{selectedDocument.proveedor || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Importe:</span>
                  <p className="font-medium">{formatAmount(selectedDocument.importe)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Fecha:</span>
                  <p className="font-medium">{formatDate(selectedDocument.fecha)}</p>
                </div>
              </div>

              {/* Revisión requerida - campos editables */}
              {selectedDocument.status === 'revision_requerida' && (
                <div className="mb-6 p-4 bg-warning-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-3">Revisión requerida</h4>
                  
                  {selectedDocument.blockingReasons?.map((reason, index) => (
                    <p key={index} className="text-sm text-warning-700 mb-3">{reason}</p>
                  ))}
                  
                  {/* Example inline editing for reform category */}
                  {selectedDocument.blockingReasons?.some(r => r.includes('Categoría fiscal')) && (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-yellow-800">
                        Categoría fiscal:
                      </label>
                      <select 
                        className="w-full p-2 border border-yellow-300 rounded"
                        >
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                      >
                        <option value="">Seleccionar categoría</option>
                        <option value="Mejora">Mejora</option>
                        <option value="Mobiliario">Mobiliario</option>
                        <option value="Reparación y Conservación">Reparación y Conservación</option>
                      </select>
                    </div>
                  )}
                  
                  <button
                    onClick={() => handleCompleteAndArchive(selectedDocument)}
                    className="mt-4 w-full px-4 py-2 text-white rounded-lg"
                    >
                    style={{ backgroundColor: '#0A2A57' }}
                  >
                    Completar y archivar
                  </button>
                </div>
              )}

              {/* Panel inferior plegable "Logs" */}
              <div className="border-t border-gray-200 pt-4">
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
                  <div className="mt-3 space-y-2">
                    {selectedDocument.logs.map((log, index) => (
                      <div key={index} className="text-xs text-gray-600">
                        <span className="font-medium">
                          {new Date(log.timestamp).toLocaleString('es-ES')}
                        </span>
                        <span className="ml-2">{log.action}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InboxPageNew;