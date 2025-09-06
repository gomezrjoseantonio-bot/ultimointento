// ATLAS HORIZON - Enhanced Inbox Page with Exact Requirements  
// Implements all UI requirements from problem statement

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  Search, 
  Filter, 
  Eye, 
  Archive, 
  RefreshCw, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText
} from 'lucide-react';

interface SimpleInboxDocument {
  id: string;
  filename: string;
  type: string;
  size: number;
  uploadDate: string;
  status: 'guardado_automatico' | 'revision_requerida' | 'ocr_error' | 'ocr_running';
  tipo: 'Factura' | 'Recibo' | 'Extracto' | 'Otro';
  
  // OCR extracted fields
  supplier_name?: string;
  supplier_tax_id?: string;
  total_amount?: number;
  issue_date?: string;
  due_date?: string;
  service_address?: string;
  iban_mask?: string;
  
  // Validation and confidence
  validation?: {
    isValid: boolean;
    criticalFieldsMissing: string[];
  };
  confidence?: {
    global: number;
    fields: { [key: string]: number };
  };
  
  // Auto-destination
  destino_sugerido?: string;
  inmueble_id?: string;
  
  // Logs
  logs: Array<{
    timestamp: string;
    code: string;
    message: string;
    meta?: any;
  }>;
  
  // 72h retention
  expiresAt?: string;
}

const EnhancedInboxPageNew: React.FC = () => {
  const [documents, setDocuments] = useState<SimpleInboxDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<SimpleInboxDocument | null>(null);
  const [filter, setFilter] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [showLogsPanel, setShowLogsPanel] = useState(false);

  // Load mock data
  useEffect(() => {
    loadMockDocuments();
  }, []);

  const loadMockDocuments = () => {
    const mockDocs: SimpleInboxDocument[] = [
      {
        id: '1',
        filename: 'factura_wekiwi_enero.pdf',
        type: 'application/pdf',
        size: 1024576,
        uploadDate: new Date().toISOString(),
        status: 'guardado_automatico',
        tipo: 'Factura',
        supplier_name: 'Wekiwi Energía',
        supplier_tax_id: 'B86446943',
        total_amount: 29.35,
        issue_date: '2024-01-15',
        due_date: '2024-02-15',
        service_address: 'C/ Mayor 123, Madrid',
        iban_mask: '****1234',
        destino_sugerido: 'Inmuebles › Gastos › Suministros',
        inmueble_id: 'inmueble_1',
        validation: { isValid: true, criticalFieldsMissing: [] },
        confidence: {
          global: 92,
          fields: {
            supplier_name: 95,
            total_amount: 98,
            issue_date: 90,
            service_address: 88
          }
        },
        logs: [
          {
            timestamp: new Date(Date.now() - 5000).toISOString(),
            code: 'INBOX_RECEIVED',
            message: 'Documento subido por usuario'
          },
          {
            timestamp: new Date(Date.now() - 4000).toISOString(),
            code: 'OCR_STARTED',
            message: 'Iniciando OCR con DocumentAI'
          },
          {
            timestamp: new Date(Date.now() - 3000).toISOString(),
            code: 'OCR_SUCCEEDED',
            message: 'OCR completado exitosamente',
            meta: { confianza_media: 92, n_campos: 6 }
          },
          {
            timestamp: new Date(Date.now() - 2000).toISOString(),
            code: 'AUTO_DESTINATION_INFERRED',
            message: 'Destino inferido por dirección de servicio',
            meta: { inmueble_id: 'inmueble_1' }
          },
          {
            timestamp: new Date(Date.now() - 1000).toISOString(),
            code: 'ARCHIVED_TO',
            message: 'Archivado automáticamente en Inmuebles › Gastos › Suministros'
          }
        ],
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '2',
        filename: 'recibo_sepa_seguro.pdf',
        type: 'application/pdf',
        size: 512000,
        uploadDate: new Date().toISOString(),
        status: 'guardado_automatico',
        tipo: 'Recibo',
        supplier_name: 'Seguros Mapfre',
        total_amount: 45.67,
        issue_date: '2024-01-10',
        iban_mask: '****5678',
        destino_sugerido: 'Tesorería › Movimientos',
        validation: { isValid: true, criticalFieldsMissing: [] },
        confidence: {
          global: 85,
          fields: {
            supplier_name: 90,
            total_amount: 95,
            iban_mask: 88
          }
        },
        logs: [
          {
            timestamp: new Date(Date.now() - 3000).toISOString(),
            code: 'INBOX_RECEIVED',
            message: 'Recibido por email'
          },
          {
            timestamp: new Date(Date.now() - 2000).toISOString(),
            code: 'OCR_SUCCEEDED',
            message: 'OCR completado para recibo SEPA',
            meta: { confianza_media: 85 }
          },
          {
            timestamp: new Date(Date.now() - 1000).toISOString(),
            code: 'ARCHIVED_TO',
            message: 'Archivado en Tesorería por IBAN detectado'
          }
        ],
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '3',
        filename: 'factura_reforma.pdf',
        type: 'application/pdf', 
        size: 2048000,
        uploadDate: new Date().toISOString(),
        status: 'revision_requerida',
        tipo: 'Factura',
        supplier_name: 'Reformas García SL',
        total_amount: 1250.00,
        issue_date: '2024-01-12',
        validation: { 
          isValid: false, 
          criticalFieldsMissing: ['due_date'] 
        },
        confidence: {
          global: 75,
          fields: {
            supplier_name: 80,
            total_amount: 85,
            issue_date: 70
          }
        },
        logs: [
          {
            timestamp: new Date(Date.now() - 2000).toISOString(),
            code: 'INBOX_RECEIVED',
            message: 'Documento subido'
          },
          {
            timestamp: new Date(Date.now() - 1000).toISOString(),
            code: 'OCR_SUCCEEDED',
            message: 'OCR completado con campos faltantes'
          },
          {
            timestamp: new Date().toISOString(),
            code: 'CLASSIFICATION_NEEDS_REVIEW',
            message: 'Revisión requerida: falta fecha de vencimiento'
          }
        ]
      },
      {
        id: '4',
        filename: 'documento_error.pdf',
        type: 'application/pdf',
        size: 256000,
        uploadDate: new Date().toISOString(),
        status: 'ocr_error',
        tipo: 'Otro',
        validation: { isValid: false, criticalFieldsMissing: ['total_amount', 'supplier_name'] },
        logs: [
          {
            timestamp: new Date(Date.now() - 1000).toISOString(),
            code: 'INBOX_RECEIVED',
            message: 'Documento subido'
          },
          {
            timestamp: new Date().toISOString(),
            code: 'OCR_FAILED',
            message: 'Error en OCR: documento ilegible'
          }
        ]
      }
    ];
    
    setDocuments(mockDocs);
  };

  const getConfidenceChip = (confidence: number, fieldName?: string) => {
    let bgColor = 'bg-red-100 text-red-800';
    let label = 'Baja';
    
    if (confidence >= 85) {
      bgColor = 'bg-green-100 text-green-800';
      label = 'Alta';
    } else if (confidence >= 70) {
      bgColor = 'bg-yellow-100 text-yellow-800';
      label = 'Media';
    }
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${bgColor}`}>
        {label} ({confidence}%)
      </span>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'guardado_automatico':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'revision_requerida':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'ocr_error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'ocr_running':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const filteredDocuments = documents.filter(doc => {
    if (filter === 'guardado_auto' && doc.status !== 'guardado_automatico') return false;
    if (filter === 'revision' && doc.status !== 'revision_requerida') return false;
    if (filter === 'error' && doc.status !== 'ocr_error') return false;
    if (filter === 'ultimas_72h' && doc.expiresAt && new Date(doc.expiresAt) < new Date()) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return doc.filename.toLowerCase().includes(term) ||
             doc.supplier_name?.toLowerCase().includes(term) ||
             doc.tipo.toLowerCase().includes(term);
    }
    
    return true;
  });

  const handleRetryOCR = (documentId: string) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === documentId) {
        return {
          ...doc,
          status: 'ocr_running' as const,
          logs: [
            ...doc.logs,
            {
              timestamp: new Date().toISOString(),
              code: 'OCR_QUEUED',
              message: 'OCR reintentado por usuario',
              meta: { retry: true }
            }
          ]
        };
      }
      return doc;
    }));
    
    // Simulate OCR retry
    setTimeout(() => {
      setDocuments(prev => prev.map(doc => {
        if (doc.id === documentId) {
          return {
            ...doc,
            status: 'guardado_automatico' as const,
            supplier_name: 'Proveedor Recuperado',
            total_amount: 150.75,
            validation: { isValid: true, criticalFieldsMissing: [] },
            confidence: {
              global: 88,
              fields: { supplier_name: 90, total_amount: 95 }
            },
            logs: [
              ...doc.logs,
              {
                timestamp: new Date().toISOString(),
                code: 'OCR_SUCCEEDED',
                message: 'OCR reintentado exitosamente',
                meta: { retry: true, confianza_media: 88 }
              }
            ]
          };
        }
        return doc;
      }));
      toast.success('OCR reintentado exitosamente');
    }, 3000);
    
    toast(`Reintentando OCR...`, { icon: '🔄' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with filters */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#0B2C4A' }}>
                Bandeja de Entrada
              </h1>
              <p className="text-gray-600">
                {filteredDocuments.length} documentos
              </p>
            </div>
            
            {/* Filters */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar documentos..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="guardado_auto">Guardado auto</option>
                <option value="revision">Revisión</option>
                <option value="error">Error</option>
                <option value="ultimas_72h">Últimas 72h</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Document List */}
          <div className="lg:col-span-1 space-y-4">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className={`bg-white rounded-lg shadow-sm border p-4 cursor-pointer transition-colors ${
                  selectedDocument?.id === doc.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedDocument(doc)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(doc.status)}
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {doc.filename}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {doc.tipo} • {(doc.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                    {doc.supplier_name && (
                      <p className="text-sm font-medium text-gray-700 mt-1">
                        {doc.supplier_name}
                      </p>
                    )}
                    {doc.total_amount && (
                      <p className="text-lg font-bold text-gray-900 mt-1">
                        {doc.total_amount.toFixed(2)} €
                      </p>
                    )}
                  </div>
                  <Eye className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>

          {/* Document Details */}
          <div className="lg:col-span-2">
            {selectedDocument ? (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedDocument.filename}
                    </h2>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(selectedDocument.status)}
                      <span className="text-sm font-medium text-gray-600">
                        {selectedDocument.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* OCR Data Table */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-4">Datos Extraídos</h3>
                    <div className="overflow-hidden bg-gray-50 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <tbody className="divide-y divide-gray-200">
                          <tr>
                            <td className="px-4 py-3 text-sm font-medium text-gray-500">Proveedor</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{selectedDocument.supplier_name || '—'}</td>
                            <td className="px-4 py-3">
                              {selectedDocument.confidence?.fields?.supplier_name && 
                                getConfidenceChip(selectedDocument.confidence.fields.supplier_name)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-sm font-medium text-gray-500">NIF</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{selectedDocument.supplier_tax_id || '—'}</td>
                            <td className="px-4 py-3">
                              {selectedDocument.confidence?.fields?.supplier_tax_id && 
                                getConfidenceChip(selectedDocument.confidence.fields.supplier_tax_id)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-sm font-medium text-gray-500">Dirección servicio</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{selectedDocument.service_address || '—'}</td>
                            <td className="px-4 py-3">
                              {selectedDocument.confidence?.fields?.service_address && 
                                getConfidenceChip(selectedDocument.confidence.fields.service_address)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-sm font-medium text-gray-500">Fecha emisión</td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {selectedDocument.issue_date ? new Date(selectedDocument.issue_date).toLocaleDateString('es-ES') : '—'}
                            </td>
                            <td className="px-4 py-3">
                              {selectedDocument.confidence?.fields?.issue_date && 
                                getConfidenceChip(selectedDocument.confidence.fields.issue_date)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-sm font-medium text-gray-500">Vencimiento/Cargo</td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {selectedDocument.due_date ? new Date(selectedDocument.due_date).toLocaleDateString('es-ES') : '—'}
                            </td>
                            <td className="px-4 py-3">
                              {selectedDocument.confidence?.fields?.due_date && 
                                getConfidenceChip(selectedDocument.confidence.fields.due_date)}
                            </td>
                          </tr>
                          <tr className="bg-blue-50">
                            <td className="px-4 py-3 text-sm font-bold text-gray-900">Total</td>
                            <td className="px-4 py-3 text-2xl font-bold" style={{ color: '#0B2C4A' }}>
                              {selectedDocument.total_amount ? `${selectedDocument.total_amount.toFixed(2)} €` : '—'}
                            </td>
                            <td className="px-4 py-3">
                              {selectedDocument.confidence?.fields?.total_amount && 
                                getConfidenceChip(selectedDocument.confidence.fields.total_amount)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-sm font-medium text-gray-500">IBAN</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{selectedDocument.iban_mask || '—'}</td>
                            <td className="px-4 py-3">
                              {selectedDocument.confidence?.fields?.iban_mask && 
                                getConfidenceChip(selectedDocument.confidence.fields.iban_mask)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Validation Messages */}
                  {selectedDocument.validation && !selectedDocument.validation.isValid && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center">
                        <AlertCircle className="w-5 h-5 text-yellow-500 mr-2" />
                        <span className="text-sm font-medium text-yellow-800">
                          Revisión requerida: faltan campos críticos
                        </span>
                      </div>
                      <ul className="mt-2 text-sm text-yellow-700">
                        {selectedDocument.validation.criticalFieldsMissing.map((field, index) => (
                          <li key={index}>• {field}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Destination */}
                  {selectedDocument.destino_sugerido && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="text-sm font-medium text-green-800">Destino sugerido:</h4>
                      <p className="text-sm text-green-700">{selectedDocument.destino_sugerido}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3 mb-6">
                    {selectedDocument.destino_sugerido && (
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2">
                        <Archive className="w-4 h-4" />
                        <span>Archivar en destino sugerido</span>
                      </button>
                    )}
                    
                    <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center space-x-2">
                      <Archive className="w-4 h-4" />
                      <span>Cambiar destino...</span>
                    </button>
                    
                    {selectedDocument.status === 'ocr_error' && (
                      <button 
                        onClick={() => handleRetryOCR(selectedDocument.id)}
                        className="px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 flex items-center space-x-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Reintentar OCR</span>
                      </button>
                    )}
                    
                    <button className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 flex items-center space-x-2">
                      <Trash2 className="w-4 h-4" />
                      <span>Eliminar</span>
                    </button>
                  </div>

                  {/* Logs Panel */}
                  <div className="border-t pt-4">
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
                      <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                        {selectedDocument.logs.slice(-6).map((log, index) => (
                          <div key={index} className="text-xs bg-gray-50 p-3 rounded">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900">{log.code}</span>
                              <span className="text-gray-500">
                                {new Date(log.timestamp).toLocaleString('es-ES')}
                              </span>
                            </div>
                            <p className="text-gray-700 mt-1">{log.message}</p>
                            {log.meta && (
                              <pre className="text-gray-600 mt-1 text-xs">
                                {JSON.stringify(log.meta, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border h-96 flex items-center justify-center">
                <div className="text-center">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Selecciona un documento para ver los detalles</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedInboxPageNew;