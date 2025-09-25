// ATLAS HORIZON - Inbox Atlas Horizon (v2 definitivo)
// Implementación exacta según especificaciones del problema
// H-HOTFIX: Enhanced with inline preview, utility detection, reform breakdown, etc.

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { initDB } from '../services/db';
import { 
  RotateCcw,
  ChevronDown, 
  ChevronUp,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  Image,
  FileSpreadsheet,
  Archive,
  File
} from 'lucide-react';

// Import standardized components
import PageHeader from '../components/common/PageHeader';
import FilterBar from '../components/common/FilterBar';
import DataTable from '../components/common/DataTable';
import Drawer from '../components/common/Drawer';

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
  
  // Load properties from database
  const [availableProperties, setAvailableProperties] = useState<any[]>([]);

  // Load initial data
  useEffect(() => {
    loadProperties();
    loadMockDocuments(); // Keep for now to avoid breaking functionality
    
    // Clean up expired documents every minute
    const interval = setInterval(cleanupExpiredDocuments, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadProperties = async () => {
    try {
      const db = await initDB();
      const properties = await db.getAll('properties');
      const formattedProperties = properties
        .filter(p => p.state === 'activo') // Only show active properties
        .filter(p => !p.alias?.toLowerCase().includes('demo') && 
                     !p.alias?.toLowerCase().includes('sample') && 
                     !p.alias?.toLowerCase().includes('fake') &&
                     !p.alias?.toLowerCase().includes('test'))  // Exclude demo properties
        .map(p => ({
          id: p.id?.toString() || '',
          alias: p.alias,
          address: p.address
        }));
      setAvailableProperties(formattedProperties);
    } catch (error) {
      console.error('Error loading properties:', error);
      // Fallback to empty array if database fails
      setAvailableProperties([]);
    }
  };

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
      
      // Assign to first available property if any exist
      if (availableProperties.length > 0) {
        const firstProperty = availableProperties[0];
        processed.property_id = firstProperty.id;
        processed.inmueble = firstProperty.alias;
      }
      
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
        return <FileText className="w-4 h-4 text-error-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
        return <Image className="w-4 h-4 text-primary-500" />;
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <FileSpreadsheet className="w-4 h-4 text-success-500" />;
      case 'zip':
      case 'eml':
        return <Archive className="w-4 h-4 text-purple-500" />;
      default:
        return <File className="w-4 h-4 text-gray-500" />;
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

  // DataTable configuration
  const tableColumns = [
    {
      key: 'tipo',
      label: 'Tipo',
      render: (value: DocumentType, item: InboxDocument) => (
        <div className="flex items-center gap-2">
          {getFileIcon(item.filename, item.type)}
          <span className="text-sm font-medium text-gray-900">{value}</span>
        </div>
      )
    },
    {
      key: 'proveedor',
      label: 'Proveedor/Emisor', 
      render: (value: string, item: InboxDocument) => (
        <div>
          <div className="text-sm text-gray-900">{value || '—'}</div>
          <div className="text-xs text-gray-500">{item.filename}</div>
        </div>
      )
    },
    {
      key: 'importe',
      label: 'Importe',
      render: (value: number) => value ? `${value.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '—'
    },
    {
      key: 'fecha',
      label: 'Fecha doc.',
      render: (value: string) => value ? new Date(value).toLocaleDateString('es-ES') : '—'
    },
    {
      key: 'inmueble',
      label: 'Inmueble/Personal',
      render: (value: string) => value || 'Personal'
    },
    {
      key: 'iban',
      label: 'IBAN detectado',
      render: (value: string) => (
        <span className="font-mono text-sm">{value || '—'}</span>
      )
    },
    {
      key: 'destino',
      label: 'Destino final',
      render: (value: string) => value ? (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-hz-primary/10 text-hz-primary cursor-pointer hover:bg-hz-primary/20 transition-colors">
          {value}
        </span>
      ) : (
        <span className="text-sm text-gray-400">—</span>
      )
    },
    {
      key: 'status',
      label: 'Estado',
      render: (value: DocumentStatus) => (
        <div className="flex items-center gap-1">
          {getStatusIcon(value)}
          <span className="text-sm">
            {value === 'guardado_automatico' ? '✅' : 
             value === 'revision_requerida' ? '⚠' : '⛔'}
          </span>
        </div>
      )
    }
  ];

  const tableActions = [
    {
      type: 'view' as const,
      label: 'Ver documento',
      onClick: (item: InboxDocument) => setSelectedDocument(item)
    },
    {
      type: 'custom' as const,
      label: 'Reprocesar',
      icon: <RotateCcw className="w-4 h-4" />,
      onClick: handleReprocess,
      className: 'text-hz-success hover:text-success-700'
    },
    {
      type: 'delete' as const,
      label: 'Eliminar',
      onClick: (item: InboxDocument) => handleDelete(item.id)
    }
  ];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Standardized Header */}
      <PageHeader
        title="Bandeja de entrada"
        subtitle="Procesamiento automático de documentos con OCR y clasificación inteligente"
        primaryAction={{
          label: "Subir documentos",
          onClick: () => {
            // Trigger file input click
            const fileInput = document.getElementById('file-upload') as HTMLInputElement;
            fileInput?.click();
          }
        }}
      />
      
      {/* Hidden file input */}
      <input
        id="file-upload"
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.xls,.zip,.eml"
        onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
        className="hidden" />

      {/* Standardized Filter Bar */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por proveedor, importe, IBAN, inmueble, id..."
        filters={[
          {
            key: 'status',
            label: 'Estado',
            value: statusFilter,
            options: [
              { value: 'todos', label: `Todos (${statusCounts.todos})` },
              { value: 'guardado_automatico', label: `Guardado ✅ (${statusCounts.guardado_automatico})` },
              { value: 'revision_requerida', label: `Revisión ⚠ (${statusCounts.revision_requerida})` },
              { value: 'error', label: `Error ⛔ (${statusCounts.error})` }
            ],
            onChange: (value) => setStatusFilter(value as typeof statusFilter)
          },
          {
            key: 'type',
            label: 'Tipo',
            value: typeFilter,
            options: [
              { value: 'todos', label: 'Todos los tipos' },
              { value: 'Factura', label: 'Factura' },
              { value: 'Recibo', label: 'Recibo' },
              { value: 'Extracto', label: 'Extracto' },
              { value: 'Contrato', label: 'Contrato' },
              { value: 'Archivo', label: 'Archivo' },
              { value: 'Otro', label: 'Otro' }
            ],
            onChange: (value) => setTypeFilter(value as typeof typeFilter)
          },
          {
            key: 'date',
            label: 'Período',
            value: dateFilter,
            options: [
              { value: 'todos', label: 'Todas las fechas' },
              { value: '72h', label: 'Últimas 72h' },
              { value: 'semana', label: 'Última semana' },
              { value: 'mes', label: 'Último mes' }
            ],
            onChange: setDateFilter
          }
        ]}
      />

      {/* Contenido principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Standardized Data Table */}
        <div className="flex-1 p-6">
          <DataTable
            data={filteredDocuments}
            columns={tableColumns}
            actions={tableActions}
            emptyMessage="No hay documentos que coincidan con los filtros"
            emptyIcon={<FileText className="h-12 w-12 text-gray-400" />}
            onSort={undefined} // Could implement sorting later
            className="border-0" />
        </div>

        {/* Vista de detalle (split/panel lateral) */}
        <Drawer
          isOpen={!!selectedDocument}
          onClose={() => setSelectedDocument(null)}
          title={selectedDocument?.filename || 'Documento'}
          size="lg"
        >
          {selectedDocument && (
            <div className="space-y-6">
              {/* H-HOTFIX: Enhanced inline document preview */}
              <div>
                <DocumentPreview
                  filename={selectedDocument.filename}
                  fileType={selectedDocument.type}
                  fileContent={selectedDocument.fileContent}
                  fileUrl={selectedDocument.fileUrl}
                  className="border rounded-lg" />
              </div>

              {/* H-HOTFIX: Enhanced campos extraídos */}
              <div className="space-y-4">
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
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-hz-success-light text-hz-success">
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
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-hz-primary/10 text-hz-primary">
                          {selectedDocument.destino}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* H-HOTFIX: Document revision info */}
                  {selectedDocument.revision && selectedDocument.revision > 1 && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Revisión:</span>
                      <div className="font-medium text-xs text-hz-primary">
                        v{selectedDocument.revision} (reprocesado)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mensajes de bloqueo para revisión requerida */}
              {selectedDocument.status === 'revision_requerida' && selectedDocument.blockingReasons && (
                <div className="p-4 bg-hz-warning-light border border-hz-warning rounded-lg">
                  <div className="flex items-center mb-2">
                    <AlertTriangle className="w-5 h-5 text-hz-warning mr-2" />
                    <span className="font-medium text-hz-warning">Revisión requerida</span>
                  </div>
                  <ul className="text-sm text-hz-warning space-y-1">
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
                      <label className="block text-sm font-medium text-hz-warning">
                        Seleccionar categoría fiscal:
                      </label>
                      <select 
                        className="w-full px-3 py-2 border border-hz-warning rounded-md focus:outline-none focus:ring-2 focus:ring-hz-warning/30"
          >
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
                      <label className="block text-sm font-medium text-hz-warning">
                        Seleccionar inmueble:
                      </label>
                      <select 
                        className="w-full px-3 py-2 border border-hz-warning rounded-md focus:outline-none focus:ring-2 focus:ring-hz-warning/30"
          >
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
                      <label className="block text-sm font-medium text-hz-warning">
                        Seleccionar destino:
                      </label>
                      <div className="text-xs text-hz-warning mb-2">
                        ⚠ Los documentos se adjuntan a registros, no a carpetas separadas
                      </div>
                      <select 
                        className="w-full px-3 py-2 border border-hz-warning rounded-md focus:outline-none focus:ring-2 focus:ring-hz-warning/30"
          >
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
                <div className="p-4 bg-hz-error-light border border-hz-error rounded-lg">
                  <div className="flex items-center mb-2">
                    <XCircle className="w-5 h-5 text-hz-error mr-2" />
                    <span className="font-medium text-hz-error">Error en procesamiento</span>
                  </div>
                  <ul className="text-sm text-hz-error space-y-1">
                    {selectedDocument.blockingReasons.map((reason, index) => (
                      <li key={index}>• {reason}</li>
                    ))}
                  </ul>
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
        </Drawer>
      </div>
    </div>
  );
};

export default InboxAtlasHorizon;