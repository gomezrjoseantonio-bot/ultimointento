// ATLAS HORIZON - Inbox Atlas Horizon (v2 definitivo)
// Implementación exacta según especificaciones del problema
// H-HOTFIX: Enhanced with inline preview, utility detection, reform breakdown, etc.

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  Upload,
  Search, 
  Eye, 
  RotateCcw,
  Trash2, 
  ChevronDown, 
  ChevronUp,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  Image,
  FileSpreadsheet,
  Archive,
  File,
  X
} from 'lucide-react';

// H-HOTFIX: Import new services and types
import DocumentPreview from '../components/DocumentPreview';
import ReformBreakdownComponent from '../components/ReformBreakdownComponent';
import { detectUtilityType, getUtilityTypeDisplayName } from '../services/utilityDetectionService';
import { calculateDocumentFingerprint } from '../services/documentFingerprintingService';
import { UtilityType, ReformBreakdown } from '../types/inboxTypes';

// Tipos de documentos según especificaciones
type DocumentStatus = 'guardado_automatico' | 'revision_requerida' | 'error';
type DocumentType = 'Factura' | 'Recibo' | 'Extracto' | 'Contrato' | 'Archivo' | 'Otro';

interface InboxDocument {
  id: string;
  filename: string;
  type: string;
  size: number;
  uploadDate: string;
  status: DocumentStatus;
  
  // Campos extraídos mínimos
  tipo: DocumentType;
  proveedor?: string;  // proveedor_nombre / emisor
  cif?: string;       // proveedor_CIF
  importe?: number;   // total_amount
  fecha?: string;     // fecha_emisión / fecha_doc
  inmueble?: string;  // inmueble / dirección_suministro
  iban?: string;      // iban_mascara (****1234)
  destino?: string;   // destino final (chip clicable)
  
  // H-HOTFIX: Enhanced fields
  utility_type?: UtilityType;
  supply_address?: string;
  expected_charge_date?: string;
  reform_breakdown?: ReformBreakdown;
  doc_fingerprint?: string;
  revision?: number;
  property_id?: string;
  
  // Metadatos específicos
  logs: Array<{
    timestamp: string;
    action: string;
  }>;
  blockingReasons?: string[];
  expiresAt?: string; // Para retención de 72h
  
  // Campos específicos por tipo
  fechaCargoPreivista?: string; // Para suministros
  categoriaFiscal?: 'Mejora' | 'Mobiliario' | 'Reparación y Conservación'; // Para reformas
  contraparte?: string; // Para contratos
  renta?: number; // Para contratos
  
  // H-HOTFIX: File content for preview
  fileContent?: Blob | ArrayBuffer;
  fileUrl?: string;
}

const InboxAtlasHorizon: React.FC = () => {
  const [documents, setDocuments] = useState<InboxDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<InboxDocument | null>(null);
  const [statusFilter, setStatusFilter] = useState<'todos' | DocumentStatus>('todos');
  const [typeFilter, setTypeFilter] = useState<'todos' | DocumentType>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('72h');
  const [showLogsPanel, setShowLogsPanel] = useState(false);
  
  // H-HOTFIX: Simple properties for demo
  const availableProperties = [
    { id: '1', alias: 'C/ Mayor 123', address: 'Calle Mayor 123, Madrid' },
    { id: '2', alias: 'Piso 2A', address: 'Calle Alcalá 45, 2A, Madrid' },
    { id: '3', alias: 'Local Centro', address: 'Plaza España 8, Madrid' }
  ];

  // Cargar datos iniciales
  useEffect(() => {
    loadMockDocuments();
    
    // Limpiar documentos expirados cada minuto
    const interval = setInterval(cleanupExpiredDocuments, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadMockDocuments = () => {
    // Datos de muestra siguiendo exactamente los requerimientos
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
        cif: 'A95758389',
        importe: 89.45,
        fecha: '2024-01-15',
        inmueble: 'C/ Mayor 123',
        iban: '****1234',
        destino: 'Inmuebles › Gastos › Suministros',
        fechaCargoPreivista: '2024-02-15',
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
        cif: 'B12345678',
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
        contraparte: 'Juan Pérez',
        renta: 950.00,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        logs: [
          { timestamp: new Date().toISOString(), action: 'OCR realizado' },
          { timestamp: new Date().toISOString(), action: 'Clasificado como contrato' },
          { timestamp: new Date().toISOString(), action: 'Archivado automáticamente' }
        ]
      },
      {
        id: '4',
        filename: 'extracto_corrupto.csv',
        type: 'text/csv',
        size: 512000,
        uploadDate: new Date().toISOString(),
        status: 'error',
        tipo: 'Extracto',
        blockingReasons: ['Formato no reconocido', 'Columnas no identificadas'],
        logs: [
          { timestamp: new Date().toISOString(), action: 'Archivo recibido' },
          { timestamp: new Date().toISOString(), action: 'Error en procesamiento' }
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
      // Validar tipo de archivo
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
      
      if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.eml')) {
        toast.error(`Tipo de archivo no soportado: ${file.name}`);
        return;
      }

      // Simular procesamiento del documento
      const newDoc: InboxDocument = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        filename: file.name,
        type: file.type,
        size: file.size,
        uploadDate: new Date().toISOString(),
        status: 'guardado_automatico', // Se procesará después
        tipo: 'Otro',
        logs: [
          { timestamp: new Date().toISOString(), action: 'Archivo subido' },
          { timestamp: new Date().toISOString(), action: 'En cola de procesamiento' }
        ]
      };

      setDocuments(prev => [newDoc, ...prev]);
      
      // Simular procesamiento automático
      setTimeout(() => {
        processDocument(newDoc);
      }, 1500);
      
      toast.success(`Archivo ${file.name} subido correctamente`);
    });
  };

  const processDocument = async (document: InboxDocument) => {
    const filename = document.filename.toLowerCase();
    
    // H-HOTFIX: Check for existing document with same fingerprint
    const mockOcrData = {
      total_amount: 45.67 + Math.random() * 100,
      issue_date: new Date().toISOString().split('T')[0],
      supplier_tax_id: 'A95758389',
      supplier_name: 'Iberdrola'
    };
    
    const fingerprint = calculateDocumentFingerprint(
      document.filename, // Mock file content
      mockOcrData
    );
    
    // Check if document already exists (idempotence)
    const existingDoc = documents.find(d => d.doc_fingerprint === fingerprint.doc_fingerprint);
    if (existingDoc) {
      // Update existing document instead of creating new one
      const updatedDoc = {
        ...existingDoc,
        revision: (existingDoc.revision || 0) + 1,
        logs: [
          ...existingDoc.logs,
          { timestamp: new Date().toISOString(), action: 'Documento reprocesado (sin duplicar)' }
        ]
      };
      
      setDocuments(prev => prev.map(d => d.id === existingDoc.id ? updatedDoc : d));
      toast.success(`${document.filename} actualizado (sin duplicar)`);
      return;
    }
    
    // Simular procesamiento según tipo de documento
    const processed = { 
      ...document,
      doc_fingerprint: fingerprint.doc_fingerprint,
      revision: 1
    };
    
    // H-HOTFIX: Enhanced utility detection
    if (filename.includes('luz') || filename.includes('agua') || filename.includes('gas') || 
        filename.includes('iberdrola') || filename.includes('endesa') || 
        filename.includes('movistar') || filename.includes('orange')) {
      
      processed.tipo = 'Factura';
      processed.proveedor = filename.includes('agua') ? 'Canal de Isabel II' : 
                           filename.includes('gas') ? 'Naturgy' :
                           filename.includes('movistar') ? 'Movistar' : 'Iberdrola';
      processed.cif = 'A95758389';
      processed.importe = mockOcrData.total_amount;
      processed.fecha = mockOcrData.issue_date;
      
      // H-HOTFIX: Detect utility type
      const utilityType = detectUtilityType(processed.proveedor, filename);
      processed.utility_type = utilityType || undefined;
      
      // H-HOTFIX: Simple property assignment for demo
      const mockPropertyId = '1';
      processed.property_id = mockPropertyId;
      processed.inmueble = availableProperties.find(p => p.id === mockPropertyId)?.alias;
      
      if (processed.status !== 'revision_requerida') {
        processed.iban = `****${Math.floor(1000 + Math.random() * 9000)}`;
        processed.destino = `Inmuebles › Gastos › ${processed.inmueble || 'Suministros'}`;
        processed.status = 'guardado_automatico';
        processed.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
        processed.supply_address = 'C/ Mayor 123, Madrid';
        processed.expected_charge_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
      
      processed.logs.push(
        { timestamp: new Date().toISOString(), action: `Clasificado como ${utilityType ? getUtilityTypeDisplayName(utilityType) : 'suministro'}` },
        { timestamp: new Date().toISOString(), action: processed.status === 'guardado_automatico' ? 'Archivado automáticamente' : 'Pendiente de asignación de inmueble' }
      );
      
      if (processed.status === 'guardado_automatico') {
        toast.success(`${document.filename} procesado y archivado automáticamente`);
      } else {
        toast.error(`${document.filename} procesado - requiere asignación de inmueble`);
      }
      
    // H-HOTFIX: Enhanced reform processing with breakdown
    } else if (filename.includes('reforma') || filename.includes('obra') || 
               filename.includes('compra') || filename.includes('material')) {
      
      processed.tipo = 'Factura';
      processed.proveedor = 'Reformas García';
      processed.cif = 'B12345678';
      processed.importe = 500 + Math.random() * 2000;
      processed.fecha = new Date().toISOString().split('T')[0];
      processed.inmueble = 'Piso 2A';
      processed.property_id = '2';
      processed.status = 'revision_requerida';
      processed.blockingReasons = ['Reparto entre categorías fiscales: Mejora/Mobiliario/Reparación y conservación'];
      
      // H-HOTFIX: Initialize reform breakdown (will be set in UI)
      processed.reform_breakdown = {
        mejora: 0,
        mobiliario: 0,
        reparacion_conservacion: 0
      };
      
      processed.logs.push(
        { timestamp: new Date().toISOString(), action: 'Clasificado como reforma' },
        { timestamp: new Date().toISOString(), action: 'Pendiente de reparto fiscal' }
      );
      
    // 3. Recibos simples - Auto-guardado
    } else if (filename.includes('recibo') || filename.includes('sepa')) {
      
      processed.tipo = 'Recibo';
      processed.proveedor = 'Seguros Mapfre';
      processed.importe = 30 + Math.random() * 100;
      processed.fecha = new Date().toISOString().split('T')[0];
      processed.iban = `****${Math.floor(1000 + Math.random() * 9000)}`;
      processed.destino = 'Tesorería › Movimientos';
      processed.status = 'guardado_automatico';
      processed.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      processed.logs.push(
        { timestamp: new Date().toISOString(), action: 'Clasificado como recibo' },
        { timestamp: new Date().toISOString(), action: 'Archivado en Tesorería' }
      );
      
    // 4. Extractos bancarios
    } else if (filename.includes('extracto') || filename.includes('.csv') || filename.includes('.xlsx')) {
      
      processed.tipo = 'Extracto';
      if (Math.random() > 0.3) { // 70% éxito
        processed.proveedor = 'Banco Santander';
        processed.destino = 'Tesorería › Movimientos';
        processed.status = 'guardado_automatico';
        processed.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
        processed.logs.push(
          { timestamp: new Date().toISOString(), action: `${2 + Math.floor(Math.random() * 5)} movimientos creados` },
          { timestamp: new Date().toISOString(), action: 'Procesado exitosamente' }
        );
        toast.success(`${document.filename} procesado - ${2 + Math.floor(Math.random() * 5)} movimientos creados`);
      } else {
        processed.status = 'error';
        processed.blockingReasons = ['Formato no reconocido', 'Columnas no identificadas'];
        processed.logs.push(
          { timestamp: new Date().toISOString(), action: 'Error en procesamiento' }
        );
      }
      
    // 5. Contratos
    } else if (filename.includes('contrato') || filename.includes('alquiler')) {
      
      processed.tipo = 'Contrato';
      processed.proveedor = 'Ana Martínez';
      processed.importe = 800 + Math.random() * 500;
      processed.fecha = new Date().toISOString().split('T')[0];
      processed.inmueble = 'Apartamento 1B';
      processed.destino = 'Inmuebles › Contratos';
      processed.contraparte = 'Ana Martínez';
      processed.renta = processed.importe;
      processed.status = 'guardado_automatico';
      processed.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      processed.logs.push(
        { timestamp: new Date().toISOString(), action: 'Clasificado como contrato' },
        { timestamp: new Date().toISOString(), action: 'Archivado automáticamente' }
      );
      
    // 6. ZIP/EML files
    } else if (filename.includes('.zip') || filename.includes('.eml')) {
      
      processed.tipo = 'Archivo';
      processed.status = 'guardado_automatico';
      processed.destino = 'Documentos';
      processed.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      processed.logs.push(
        { timestamp: new Date().toISOString(), action: `${2 + Math.floor(Math.random() * 5)} documentos extraídos y procesados` }
      );
      toast.success(`${document.filename} descomprimido - ${2 + Math.floor(Math.random() * 5)} documentos procesados`);
      
    // 7. Otros - Always ask for destination
    } else {
      processed.tipo = 'Otro';
      processed.status = 'revision_requerida';
      processed.blockingReasons = ['Destino requerido: seleccionar Inmueble/Personal'];
      processed.logs.push(
        { timestamp: new Date().toISOString(), action: 'Pendiente de clasificación' },
        { timestamp: new Date().toISOString(), action: 'Requiere selección de destino' }
      );
    }
    
    setDocuments(prev => prev.map(doc => doc.id === document.id ? processed : doc));
  };

  // Filtrar documentos
  const getFilteredDocuments = () => {
    let filtered = documents;

    // Filtro de estado
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(doc => doc.status === statusFilter);
    }

    // Filtro de tipo
    if (typeFilter !== 'todos') {
      filtered = filtered.filter(doc => doc.tipo === typeFilter);
    }

    // Filtro de fecha
    if (dateFilter === '72h') {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000);
      filtered = filtered.filter(doc => new Date(doc.uploadDate) > cutoff);
    }

    // Búsqueda global
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.filename.toLowerCase().includes(term) ||
        doc.proveedor?.toLowerCase().includes(term) ||
        doc.importe?.toString().includes(term) ||
        doc.iban?.toLowerCase().includes(term) ||
        doc.inmueble?.toLowerCase().includes(term) ||
        doc.id.toLowerCase().includes(term)
      );
    }

    return filtered;
  };

  const getStatusCounts = () => {
    return {
      todos: documents.length,
      guardado_automatico: documents.filter(d => d.status === 'guardado_automatico').length,
      revision_requerida: documents.filter(d => d.status === 'revision_requerida').length,
      error: documents.filter(d => d.status === 'error').length
    };
  };

  const handleReprocess = (doc: InboxDocument) => {
    setDocuments(prev => prev.map(d => 
      d.id === doc.id 
        ? {
            ...d,
            logs: [...d.logs, { timestamp: new Date().toISOString(), action: 'Reprocesamiento iniciado' }]
          }
        : d
    ));
    
    setTimeout(() => {
      processDocument(doc);
    }, 1500);
    
    toast.success('Documento reprocesado exitosamente');
  };

  const handleDelete = (documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    if (selectedDocument?.id === documentId) {
      setSelectedDocument(null);
    }
    toast.success('Documento eliminado');
  };

  const handleCompleteAndArchive = (doc: InboxDocument, updates: Partial<InboxDocument>) => {
    const updated = {
      ...doc,
      ...updates,
      status: 'guardado_automatico' as DocumentStatus,
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      logs: [
        ...doc.logs,
        { timestamp: new Date().toISOString(), action: 'Completado por usuario' },
        { timestamp: new Date().toISOString(), action: 'Archivado exitosamente' }
      ]
    };
    
    setDocuments(prev => prev.map(d => d.id === doc.id ? updated : d));
    setSelectedDocument(updated);
    toast.success('Documento completado y archivado');
  };

  const getFileIcon = (filename: string, type: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'pdf':
        return <FileText className="w-4 h-4 text-red-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
        return <Image className="w-4 h-4 text-blue-500" />;
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <FileSpreadsheet className="w-4 h-4 text-green-500" />;
      case 'zip':
      case 'eml':
        return <Archive className="w-4 h-4 text-purple-500" />;
      default:
        return <File className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case 'guardado_automatico': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'revision_requerida': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-600" />;
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
            />
            <button
              style={{ backgroundColor: '#0A2A57' }}
              className="hover:bg-[#0C356B] text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Subir documentos
            </button>
          </div>
        </div>
      </div>

      {/* Barra de utilidades */}
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Buscador global */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por proveedor, importe, IBAN, inmueble, id..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Segmented control de estado con contadores */}
          <div className="flex flex-wrap bg-gray-100 rounded-lg p-1 gap-1">
            {[
              { key: 'todos' as const, label: 'Todos', count: statusCounts.todos },
              { key: 'guardado_automatico' as const, label: 'Guardado ✅', count: statusCounts.guardado_automatico },
              { key: 'revision_requerida' as const, label: 'Revisión ⚠', count: statusCounts.revision_requerida },
              { key: 'error' as const, label: 'Error ⛔', count: statusCounts.error }
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  statusFilter === key
                    ? 'bg-white text-[#0A2A57] shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>

          {/* Filtros adicionales */}
          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'todos' | DocumentType)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos los tipos</option>
              <option value="Factura">Factura</option>
              <option value="Recibo">Recibo</option>
              <option value="Extracto">Extracto</option>
              <option value="Contrato">Contrato</option>
              <option value="Archivo">Archivo</option>
              <option value="Otro">Otro</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todas las fechas</option>
              <option value="72h">Últimas 72h</option>
              <option value="semana">Última semana</option>
              <option value="mes">Último mes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tabla principal */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Proveedor/Emisor
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Importe
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha doc.
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inmueble/Personal
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IBAN detectado
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Destino final
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.map((doc) => (
                  <tr
                    key={doc.id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedDocument?.id === doc.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => setSelectedDocument(doc)}
                  >
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getFileIcon(doc.filename, doc.type)}
                        <span className="text-sm font-medium text-gray-900">{doc.tipo}</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{doc.proveedor || '—'}</div>
                      <div className="text-xs text-gray-500">{doc.filename}</div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {doc.importe ? `${doc.importe.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '—'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {doc.fecha ? new Date(doc.fecha).toLocaleDateString('es-ES') : '—'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {doc.inmueble || 'Personal'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                      {doc.iban || '—'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      {doc.destino ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200 transition-colors">
                          {doc.destino}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(doc.status)}
                        <span className="text-sm">
                          {doc.status === 'guardado_automatico' ? '✅' : 
                           doc.status === 'revision_requerida' ? '⚠' : '⛔'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-1 sm:gap-2">
                        <button 
                          className="text-blue-600 hover:text-blue-900"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDocument(doc);
                          }}
                          title="Ver documento"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          className="text-green-600 hover:text-green-900"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReprocess(doc);
                          }}
                          title="Reprocesar"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button 
                          className="text-red-600 hover:text-red-900"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(doc.id);
                          }}
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

            {filteredDocuments.length === 0 && (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay documentos</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Comienza subiendo un documento o ajusta los filtros.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Vista de detalle (split/panel lateral) */}
        {selectedDocument && (
          <div className="w-full lg:w-96 xl:w-[32rem] border-l border-gray-200 bg-white flex flex-col">
            <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 pr-4">
                  {selectedDocument.filename}
                </h3>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="lg:hidden text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto px-6 py-4">
              {/* H-HOTFIX: Enhanced inline document preview */}
              <div className="mb-6">
                <DocumentPreview
                  filename={selectedDocument.filename}
                  fileType={selectedDocument.type}
                  fileContent={selectedDocument.fileContent}
                  fileUrl={selectedDocument.fileUrl}
                  className="border rounded-lg"
                />
              </div>

              {/* H-HOTFIX: Enhanced campos extraídos */}
              <div className="space-y-4 mb-6">
                <h4 className="font-medium text-gray-900">Campos extraídos</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Tipo:</span>
                    <div className="font-medium">{selectedDocument.tipo}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Proveedor:</span>
                    <div className="font-medium">{selectedDocument.proveedor || '—'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">CIF:</span>
                    <div className="font-medium">{selectedDocument.cif || '—'}</div>
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
                      {selectedDocument.fecha ? new Date(selectedDocument.fecha).toLocaleDateString('es-ES') : '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Inmueble:</span>
                    <div className="font-medium">{selectedDocument.inmueble || 'Personal'}</div>
                  </div>
                  
                  {/* H-HOTFIX: Utility-specific fields */}
                  {selectedDocument.utility_type && (
                    <div>
                      <span className="text-gray-500">Tipo suministro:</span>
                      <div className="font-medium">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                          {getUtilityTypeDisplayName(selectedDocument.utility_type)}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {selectedDocument.supply_address && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Dirección suministro:</span>
                      <div className="font-medium text-xs">{selectedDocument.supply_address}</div>
                    </div>
                  )}
                  
                  {selectedDocument.expected_charge_date && (
                    <div>
                      <span className="text-gray-500">Fecha cargo prevista:</span>
                      <div className="font-medium text-xs">
                        {new Date(selectedDocument.expected_charge_date).toLocaleDateString('es-ES')}
                      </div>
                    </div>
                  )}
                  
                  <div className="col-span-2">
                    <span className="text-gray-500">IBAN:</span>
                    <div className="font-medium font-mono">{selectedDocument.iban || '—'}</div>
                  </div>
                  
                  {selectedDocument.destino && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Destino final:</span>
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {selectedDocument.destino}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* H-HOTFIX: Document revision info */}
                  {selectedDocument.revision && selectedDocument.revision > 1 && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Revisión:</span>
                      <div className="font-medium text-xs text-blue-600">
                        v{selectedDocument.revision} (reprocesado)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mensajes de bloqueo para revisión requerida */}
              {selectedDocument.status === 'revision_requerida' && selectedDocument.blockingReasons && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center mb-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                    <span className="font-medium text-yellow-800">Revisión requerida</span>
                  </div>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {selectedDocument.blockingReasons.map((reason, index) => (
                      <li key={index}>• {reason}</li>
                    ))}
                  </ul>
                  
                  {/* H-HOTFIX: Enhanced reform handling with breakdown */}
                  {selectedDocument.blockingReasons.some(r => r.includes('Reparto entre categorías')) && (
                    <div className="mt-4">
                      <ReformBreakdownComponent
                        totalAmount={selectedDocument.importe || 0}
                        onBreakdownChange={(breakdown: ReformBreakdown) => {
                          // Update the document with the breakdown
                          const updatedDoc = {
                            ...selectedDocument,
                            reform_breakdown: breakdown,
                            status: 'guardado_automatico' as DocumentStatus,
                            destino: `Inmuebles › Gastos › ${selectedDocument.inmueble || 'Reforma'}`,
                            blockingReasons: undefined,
                            expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
                            logs: [
                              ...selectedDocument.logs,
                              { timestamp: new Date().toISOString(), action: 'Reparto fiscal completado' },
                              { timestamp: new Date().toISOString(), action: 'Archivado automáticamente' }
                            ]
                          };
                          
                          setDocuments(prev => prev.map(d => d.id === selectedDocument.id ? updatedDoc : d));
                          setSelectedDocument(updatedDoc);
                          toast.success('Reforma procesada con reparto fiscal');
                        }}
                        initialBreakdown={selectedDocument.reform_breakdown}
                      />
                    </div>
                  )}
                  
                  {/* Legacy category selection for old blocking reasons */}
                  {selectedDocument.blockingReasons.some(r => r.includes('Categoría fiscal') && !r.includes('Reparto')) && (
                    <div className="mt-4 space-y-3">
                      <label className="block text-sm font-medium text-yellow-800">
                        Seleccionar categoría fiscal:
                      </label>
                      <select 
                        className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        onChange={(e) => {
                          const categoria = e.target.value as 'Mejora' | 'Mobiliario' | 'Reparación y Conservación';
                          if (categoria) {
                            handleCompleteAndArchive(selectedDocument, {
                              categoriaFiscal: categoria,
                              destino: `Inmuebles › Gastos › ${categoria}`,
                              blockingReasons: undefined
                            });
                          }
                        }}
                      >
                        <option value="">Seleccionar...</option>
                        <option value="Mejora">Mejora</option>
                        <option value="Mobiliario">Mobiliario</option>
                        <option value="Reparación y Conservación">Reparación y Conservación</option>
                      </select>
                    </div>
                  )}
                  
                  {/* Property assignment for utilities */}
                  {selectedDocument.blockingReasons.some(r => r.includes('inmueble')) && (
                    <div className="mt-4 space-y-3">
                      <label className="block text-sm font-medium text-yellow-800">
                        Seleccionar inmueble:
                      </label>
                      <select 
                        className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        onChange={(e) => {
                          const propertyId = e.target.value;
                          if (propertyId) {
                            const property = availableProperties.find(p => p.id === propertyId);
                            handleCompleteAndArchive(selectedDocument, {
                              property_id: propertyId,
                              inmueble: property?.alias,
                              destino: `Inmuebles › Gastos › ${property?.alias}`,
                              blockingReasons: undefined
                            });
                          }
                        }}
                      >
                        <option value="">Seleccionar inmueble...</option>
                        {availableProperties.map(property => (
                          <option key={property.id} value={property.id}>
                            {property.alias}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {/* H-HOTFIX: Fixed destinations - no phantom document folders */}
                  {selectedDocument.blockingReasons.some(r => r.includes('Destino requerido')) && (
                    <div className="mt-4 space-y-3">
                      <label className="block text-sm font-medium text-yellow-800">
                        Seleccionar destino:
                      </label>
                      <div className="text-xs text-yellow-700 mb-2">
                        ⚠ Los documentos se adjuntan a registros, no a carpetas separadas
                      </div>
                      <select 
                        className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        onChange={(e) => {
                          const destino = e.target.value;
                          if (destino) {
                            handleCompleteAndArchive(selectedDocument, {
                              destino: destino,
                              blockingReasons: undefined
                            });
                          }
                        }}
                      >
                        <option value="">Seleccionar...</option>
                        <option value="Inmuebles › Gastos">Inmuebles › Gastos (adjunto al registro)</option>
                        <option value="Tesorería › Movimientos">Tesorería › Movimientos (adjunto al registro)</option>
                        <option value="Archivo › General">Archivo › General</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Mensajes de error */}
              {selectedDocument.status === 'error' && selectedDocument.blockingReasons && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center mb-2">
                    <XCircle className="w-5 h-5 text-red-600 mr-2" />
                    <span className="font-medium text-red-800">Error en procesamiento</span>
                  </div>
                  <ul className="text-sm text-red-700 space-y-1">
                    {selectedDocument.blockingReasons.map((reason, index) => (
                      <li key={index}>• {reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Panel inferior plegable "Logs" */}
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
      </div>
    </div>
  );
};

export default InboxAtlasHorizon;