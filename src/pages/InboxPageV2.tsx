import React, { useState, useEffect } from 'react';
import { 
  Upload, Search, Eye, RotateCcw, Trash2, CheckCircle, AlertTriangle, XCircle,
  FileText, Image, FileSpreadsheet, Archive, File, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import BankStatementModal from '../components/inbox/BankStatementModal';

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

const InboxPageV2: React.FC = () => {
  const [documents, setDocuments] = useState<InboxDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<InboxDocument | null>(null);
  const [statusFilter, setStatusFilter] = useState<'todos' | DocumentStatus>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('72h');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Bank statement modal
  const [showBankStatementModal, setShowBankStatementModal] = useState(false);
  const [bankStatementFile, setBankStatementFile] = useState<File | null>(null);

  // Load initial data
  useEffect(() => {
    loadDocuments();
    
    // Clean up expired documents every minute
    const interval = setInterval(cleanupExpiredDocuments, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadDocuments = () => {
    // Mock data for demonstration
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
        'image/jpeg', 'image/png', 'image/jpg',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'application/zip',
        'message/rfc822'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Tipo de archivo no soportado: ${file.name}`);
        return;
      }

      // Detect bank statements by file type and name
      const filename = file.name.toLowerCase();
      const isBankStatement = 
        file.type.includes('csv') || 
        file.type.includes('excel') || 
        file.type.includes('spreadsheet') ||
        filename.includes('extracto') ||
        filename.includes('movimientos') ||
        filename.includes('bank') ||
        filename.includes('bancario');

      if (isBankStatement) {
        // Open bank statement modal
        setBankStatementFile(file);
        setShowBankStatementModal(true);
        toast.success(`Extracto bancario detectado: ${file.name}`);
        return;
      }

      // Create new document entry for regular files
      const newDoc: InboxDocument = {
        id: Date.now().toString() + Math.random(),
        filename: file.name,
        type: file.type,
        size: file.size,
        uploadDate: new Date().toISOString(),
        status: 'revision_requerida', // Initial status, will be processed
        tipo: 'Otro',
        logs: [
          { timestamp: new Date().toISOString(), action: 'Documento subido' }
        ]
      };

      // Simulate document processing
      processDocument(newDoc);
    });
  };

  const processDocument = async (document: InboxDocument) => {
    // Add to documents list immediately
    setDocuments(prev => [...prev, document]);
    
    // Simulate OCR and classification
    setTimeout(() => {
      const processed = { ...document };
      processed.logs.push({ timestamp: new Date().toISOString(), action: 'OCR realizado' });
      
      // Enhanced classification based on filename and business rules
      const filename = document.filename.toLowerCase();
      
      // 1. Suministros (Luz/Agua/Gas/Telco) - Auto-save
      if (filename.includes('luz') || filename.includes('iberdrola') || 
          filename.includes('agua') || filename.includes('gas') || 
          filename.includes('telefon') || filename.includes('movistar') ||
          filename.includes('endesa') || filename.includes('aqualia')) {
        
        processed.tipo = 'Factura';
        processed.proveedor = filename.includes('iberdrola') ? 'Iberdrola' : 
                             filename.includes('endesa') ? 'Endesa' :
                             filename.includes('aqualia') ? 'Aqualia' : 'Proveedor Suministro';
        processed.importe = 50 + Math.random() * 200; // Mock amount
        processed.fecha = new Date().toISOString().split('T')[0];
        processed.iban = `****${Math.floor(1000 + Math.random() * 9000)}`;
        processed.destino = 'Inmuebles › Gastos › Suministros';
        processed.status = 'guardado_automatico';
        processed.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
        processed.logs.push(
          { timestamp: new Date().toISOString(), action: 'Clasificado como suministro' },
          { timestamp: new Date().toISOString(), action: 'Archivado automáticamente' }
        );
        toast.success(`${document.filename} procesado y archivado automáticamente`);
        
      // 2. Reformas/Compras - Require category selection
      } else if (filename.includes('reforma') || filename.includes('obra') || 
                 filename.includes('compra') || filename.includes('material')) {
        
        processed.tipo = 'Factura';
        processed.proveedor = 'Reformas García';
        processed.importe = 1000 + Math.random() * 5000; // Mock amount
        processed.fecha = new Date().toISOString().split('T')[0];
        processed.status = 'revision_requerida';
        processed.blockingReasons = ['Categoría fiscal requerida: Mejora/Mobiliario/Reparación y Conservación'];
        processed.logs.push(
          { timestamp: new Date().toISOString(), action: 'Clasificado como reforma' },
          { timestamp: new Date().toISOString(), action: 'Pendiente de categorización' }
        );
        
      // 3. Recibos simples - Auto-save to Tesorería
      } else if (filename.includes('recibo') || filename.includes('ticket') || 
                 filename.includes('comprobante')) {
        
        processed.tipo = 'Recibo';
        processed.proveedor = 'Emisor Recibo';
        processed.importe = 10 + Math.random() * 100; // Mock amount
        processed.fecha = new Date().toISOString().split('T')[0];
        processed.iban = `****${Math.floor(1000 + Math.random() * 9000)}`;
        processed.destino = 'Tesorería › Movimientos';
        processed.status = 'guardado_automatico';
        processed.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
        processed.logs.push(
          { timestamp: new Date().toISOString(), action: 'Clasificado como recibo simple' },
          { timestamp: new Date().toISOString(), action: 'Movimiento creado en Tesorería' }
        );
        toast.success(`${document.filename} procesado - movimiento creado en Tesorería`);
        
      // 4. Extractos bancarios - Process movements, don't keep as document
      } else if (filename.includes('extracto') || filename.includes('bank') || 
                 processed.type.includes('csv') || processed.type.includes('xlsx')) {
        
        processed.tipo = 'Extracto';
        processed.destino = 'Tesorería › Movimientos';
        processed.status = 'guardado_automatico';
        processed.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
        processed.logs.push(
          { timestamp: new Date().toISOString(), action: 'Extracto bancario procesado' },
          { timestamp: new Date().toISOString(), action: `${3 + Math.floor(Math.random() * 10)} movimientos importados` }
        );
        toast.success(`${document.filename} procesado - ${3 + Math.floor(Math.random() * 10)} movimientos importados`);
        
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
        toast.success(`${document.filename} procesado y archivado en Contratos`);
        
      // 6. ZIP/EML files - Decompress and process each attachment
      } else if (processed.type.includes('zip') || processed.type.includes('eml')) {
        
        processed.tipo = 'Archivo';
        processed.status = 'guardado_automatico';
        processed.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
        processed.logs.push(
          { timestamp: new Date().toISOString(), action: 'Archivo descomprimido' },
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
    }, 1500); // Longer processing time for better UX
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    if (statusFilter !== 'todos' && doc.status !== statusFilter) return false;
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        doc.filename.toLowerCase().includes(search) ||
        doc.proveedor?.toLowerCase().includes(search) ||
        doc.inmueble?.toLowerCase().includes(search) ||
        doc.iban?.toLowerCase().includes(search)
      );
    }
    
    return true;
  });

  // Count by status
  const statusCounts = {
    todos: documents.length,
    guardado_automatico: documents.filter(d => d.status === 'guardado_automatico').length,
    revision_requerida: documents.filter(d => d.status === 'revision_requerida').length,
    error: documents.filter(d => d.status === 'error').length
  };

  const getFileIcon = (filename: string, type: string) => {
    if (type.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
    if (type.includes('image')) return <Image className="w-4 h-4 text-blue-500" />;
    if (type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet className="w-4 h-4 text-green-500" />;
    if (type.includes('zip')) return <Archive className="w-4 h-4 text-purple-500" />;
    return <File className="w-4 h-4 text-gray-500" />;
  };

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case 'guardado_automatico':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'revision_requerida':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const formatAmount = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES');
  };

  const handleReprocess = (doc: InboxDocument) => {
    toast(`Reprocesando ${doc.filename}...`, { icon: 'ℹ️' });
    processDocument(doc);
  };

  const handleView = (doc: InboxDocument) => {
    // Open document in side panel
    setSelectedDocument(doc);
    setSelectedCategory(''); // Reset category selection
    
    // For better UX, scroll the side panel into view on mobile
    if (window.innerWidth < 1024) { // lg breakpoint
      setTimeout(() => {
        const detailPanel = document.querySelector('[data-testid="detail-panel"]');
        if (detailPanel) {
          detailPanel.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  const handleDelete = (doc: InboxDocument) => {
    if (window.confirm(`¿Eliminar ${doc.filename}?`)) {
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      if (selectedDocument?.id === doc.id) {
        setSelectedDocument(null);
      }
      toast.success('Documento eliminado');
    }
  };

  const handleCompleteAndArchive = (doc: InboxDocument) => {
    // Check if it's a reform document needing category selection
    if (doc.blockingReasons?.some(r => r.includes('Categoría fiscal'))) {
      if (!selectedCategory) {
        toast.error('Selecciona una categoría fiscal');
        return;
      }
      
      // Update document with selected category
      const updated = {
        ...doc,
        status: 'guardado_automatico' as DocumentStatus,
        destino: `Inmuebles › Gastos › ${selectedCategory}`,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        blockingReasons: undefined,
        logs: [
          ...doc.logs,
          { timestamp: new Date().toISOString(), action: `Categoría seleccionada: ${selectedCategory}` },
          { timestamp: new Date().toISOString(), action: 'Completado y archivado' }
        ]
      };
      
      setDocuments(prev => prev.map(d => d.id === doc.id ? updated : d));
      setSelectedDocument(updated);
      setSelectedCategory(''); // Reset selection
      toast.success(`Documento categorizado como ${selectedCategory} y archivado`);
      return;
    }
    
    // For other types, just mark as completed
    const updated = {
      ...doc,
      status: 'guardado_automatico' as DocumentStatus,
      destino: doc.destino || 'Documentos',
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      blockingReasons: undefined,
      logs: [
        ...doc.logs,
        { timestamp: new Date().toISOString(), action: 'Completado y archivado' }
      ]
    };
    
    setDocuments(prev => prev.map(d => d.id === doc.id ? updated : d));
    setSelectedDocument(updated);
    toast.success('Documento completado y archivado');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header compacto */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-0 justify-between items-start sm:items-center">
          <h1 className="text-xl sm:text-2xl font-semibold" style={{ color: '#0A2A57' }}>
            Bandeja de entrada
          </h1>
          <div className="relative">
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.xls,.csv,.zip,.eml"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-white rounded-lg cursor-pointer transition-colors text-sm sm:text-base"
              style={{ backgroundColor: '#0A2A57' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0C356B'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0A2A57'}
            >
              <Upload className="w-4 h-4" />
              Subir documentos
            </label>
          </div>
        </div>
      </div>

      {/* Barra de utilidades */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col gap-4">
          {/* Buscador global */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por proveedor, importe, IBAN, inmueble, ID..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Segmented control de estado - Responsive */}
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
                className={`px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors flex-1 sm:flex-none ${
                  statusFilter === key
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="hidden sm:inline">{label} ({count})</span>
                <span className="sm:hidden">{label.split(' ')[0]} ({count})</span>
              </button>
            ))}
          </div>

          {/* Filtros adicionales */}
          <div className="flex flex-wrap gap-2">
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 sm:flex-none"
              defaultValue=""
            >
              <option value="">Tipos</option>
              <option value="factura">Factura</option>
              <option value="recibo">Recibo</option>
              <option value="extracto">Extracto</option>
              <option value="contrato">Contrato</option>
              <option value="otro">Otro</option>
            </select>
            
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 sm:flex-none"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="72h">72h</option>
              <option value="7d">7 días</option>
              <option value="30d">30 días</option>
              <option value="all">Todos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Tabla principal */}
        <div className="flex-1 bg-white min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Proveedor/Emisor
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Importe
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Fecha doc.
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Inmueble/Personal
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                    IBAN detectado
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
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
                    className={`hover:bg-gray-50 cursor-pointer ${
                      selectedDocument?.id === doc.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => {
                      setSelectedDocument(doc);
                      setSelectedCategory(''); // Reset category selection
                    }}
                  >
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getFileIcon(doc.filename, doc.type)}
                        <span className="text-sm text-gray-900">{doc.tipo}</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden sm:table-cell">
                      {doc.proveedor || '-'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatAmount(doc.importe)}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden md:table-cell">
                      {formatDate(doc.fecha)}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden lg:table-cell">
                      {doc.inmueble || 'Personal'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden xl:table-cell">
                      {doc.iban || '-'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                      {doc.destino ? (
                        <span 
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer"
                          style={{ backgroundColor: '#EAF1F8', color: '#0A2A57' }}
                        >
                          {doc.destino}
                        </span>
                      ) : '-'}
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
                            handleView(doc);
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
                            handleDelete(doc);
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
          </div>
          
          {filteredDocuments.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No se encontraron documentos</p>
            </div>
          )}
        </div>

        {/* Vista de detalle (panel lateral) - Responsive */}
        {selectedDocument && (
          <div 
            data-testid="detail-panel"
            className="w-full lg:w-80 xl:w-96 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 overflow-y-auto"
          >
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-start mb-4">
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
              
              {/* Document viewer area */}
              <div className="mb-6 p-4 bg-gray-100 rounded-lg">
                <div className="flex items-center justify-center h-32 text-gray-500">
                  {getFileIcon(selectedDocument.filename, selectedDocument.type)}
                  <span className="ml-2">Vista previa del documento</span>
                </div>
              </div>

              {/* Campos extraídos */}
              <div className="space-y-4 mb-6">
                <h4 className="font-medium text-gray-900">Campos extraídos</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
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
              </div>

              {/* Revisión requerida - campos editables */}
              {selectedDocument.status === 'revision_requerida' && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-3">Revisión requerida</h4>
                  
                  {selectedDocument.blockingReasons?.map((reason, index) => (
                    <p key={index} className="text-sm text-yellow-700 mb-3">{reason}</p>
                  ))}
                  
                  {/* Example inline editing for reform category */}
                  {selectedDocument.blockingReasons?.some(r => r.includes('Categoría fiscal')) && (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-yellow-800">
                        Categoría fiscal:
                      </label>
                      <select 
                        className="w-full p-2 border border-yellow-300 rounded"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                      >
                        <option value="">Seleccionar categoría</option>
                        <option value="mejora">Mejora</option>
                        <option value="mobiliario">Mobiliario</option>
                        <option value="reparacion">Reparación y Conservación</option>
                      </select>
                    </div>
                  )}
                  
                  <button
                    onClick={() => handleCompleteAndArchive(selectedDocument)}
                    className="mt-4 w-full px-4 py-2 text-white rounded-lg"
                    style={{ backgroundColor: '#0A2A57' }}
                  >
                    Completar y archivar
                  </button>
                </div>
              )}

              {/* Panel de logs */}
              <div>
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer font-medium text-gray-900 mb-2">
                    <span>Logs</span>
                    <span className="text-gray-500 group-open:rotate-180 transition-transform">
                      ▼
                    </span>
                  </summary>
                  <div className="space-y-2">
                    {selectedDocument.logs.map((log, index) => (
                      <div key={index} className="text-sm">
                        <span className="text-gray-500">
                          {new Date(log.timestamp).toLocaleString('es-ES')}
                        </span>
                        <p className="text-gray-900">{log.action}</p>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Bank Statement Modal */}
      <BankStatementModal
        isOpen={showBankStatementModal}
        onClose={() => {
          setShowBankStatementModal(false);
          setBankStatementFile(null);
        }}
        file={bankStatementFile}
        onImportComplete={(summary) => {
          toast.success(`✅ ${summary.inserted} movimientos importados`);
          setShowBankStatementModal(false);
          setBankStatementFile(null);
        }}
      />
    </div>
  );
};

export default InboxPageV2;