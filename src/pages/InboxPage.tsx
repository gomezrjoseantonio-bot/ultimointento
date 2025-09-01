import React, { useState, useEffect } from 'react';
import { initDB, deleteDocumentAndBlob } from '../services/db';
import { Search, SortAsc, SortDesc, Trash2, FolderOpen } from 'lucide-react';
import DocumentViewer from '../components/documents/DocumentViewer';
import DocumentUploader from '../components/documents/DocumentUploader';
import DocumentList from '../components/documents/DocumentList';
import toast from 'react-hot-toast';

const InboxPage: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const [folderFilter, setFolderFilter] = useState('todos');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const loadDocuments = async () => {
      setLoading(true);
      
      try {
        const db = await initDB();
        const docs = await db.getAll('documents');
        
        // Filter documents that haven't been assigned to entities
        const inboxDocs = docs.filter(doc => !doc.metadata.entityId);
        setDocuments(inboxDocs);
      } catch (error) {
        // Fallback to localStorage if IndexedDB fails
        const storedDocs = localStorage.getItem('atlas-inbox-documents');
        if (storedDocs) {
          const parsedDocs = JSON.parse(storedDocs);
          setDocuments(parsedDocs);
        }
      }
      
      setLoading(false);
    };
    
    loadDocuments();
  }, []);

  const handleDocumentUpload = async (newDocuments: any[]) => {
    // Add documents to state
    const updatedDocuments = [...documents, ...newDocuments];
    setDocuments(updatedDocuments);
    
    // Persist to localStorage as backup
    localStorage.setItem('atlas-inbox-documents', JSON.stringify(updatedDocuments));
    
    // Try to persist to IndexedDB
    try {
      const db = await initDB();
      const tx = db.transaction('documents', 'readwrite');
      
      for (const doc of newDocuments) {
        await tx.store.add(doc);
      }
      
      await tx.done;
    } catch (error) {
      console.warn('Failed to save to IndexedDB, using localStorage only:', error);
    }
  };

  const handleAssignDocument = async (docId: number, metadata: any) => {
    try {
      const db = await initDB();
      const tx = db.transaction('documents', 'readwrite');
      const doc = await tx.store.get(docId);
      
      if (doc) {
        doc.metadata = { ...doc.metadata, ...metadata };
        await tx.store.put(doc);
      }
      
      await tx.done;
    } catch (error) {
      console.warn('Failed to update in IndexedDB:', error);
    }
    
    // Remove from inbox list since it's now assigned
    const updatedDocuments = documents.filter(d => d.id !== docId);
    setDocuments(updatedDocuments);
    
    // Update localStorage
    localStorage.setItem('atlas-inbox-documents', JSON.stringify(updatedDocuments));
    
    // If it was selected, deselect it
    if (selectedDocument && selectedDocument.id === docId) {
      setSelectedDocument(null);
    }
  };

  const handleUpdateDocument = async (docId: number, updates: any) => {
    try {
      const db = await initDB();
      const tx = db.transaction('documents', 'readwrite');
      const doc = await tx.store.get(docId);
      
      if (doc) {
        Object.assign(doc, updates);
        await tx.store.put(doc);
      }
      
      await tx.done;
    } catch (error) {
      console.warn('Failed to update in IndexedDB:', error);
    }
    
    // Update local state
    const updatedDocuments = documents.map(d => 
      d.id === docId ? { ...d, ...updates } : d
    );
    setDocuments(updatedDocuments);
    
    // Update localStorage
    localStorage.setItem('atlas-inbox-documents', JSON.stringify(updatedDocuments));
    
    // Update selected document if it's the one being updated
    if (selectedDocument && selectedDocument.id === docId) {
      setSelectedDocument({ ...selectedDocument, ...updates });
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    try {
      // Use the new utility function that properly deletes the blob
      await deleteDocumentAndBlob(docId);
    } catch (error) {
      console.warn('Failed to delete from IndexedDB:', error);
    }
    
    // Remove from inbox list
    const updatedDocuments = documents.filter(d => d.id !== docId);
    setDocuments(updatedDocuments);
    
    // Update localStorage
    localStorage.setItem('atlas-inbox-documents', JSON.stringify(updatedDocuments));
    
    // If it was selected, deselect it
    if (selectedDocument && selectedDocument.id === docId) {
      setSelectedDocument(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocuments.length === 0) return;
    
    try {
      for (const docId of selectedDocuments) {
        await deleteDocumentAndBlob(docId);
      }
      
      const updatedDocuments = documents.filter(d => !selectedDocuments.includes(d.id));
      setDocuments(updatedDocuments);
      localStorage.setItem('atlas-inbox-documents', JSON.stringify(updatedDocuments));
      
      setSelectedDocuments([]);
      if (selectedDocument && selectedDocuments.includes(selectedDocument.id)) {
        setSelectedDocument(null);
      }
      
      toast.success(`${selectedDocuments.length} documento(s) eliminado(s)`);
    } catch (error) {
      toast.error('Error al eliminar documentos');
    }
  };

  const handleBulkReassign = () => {
    // This would open a modal to reassign multiple documents
    toast('Función de reasignación en lote próximamente', { icon: 'ℹ️' });
  };

  const toggleDocumentSelection = (docId: number) => {
    setSelectedDocuments(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const toggleAllDocuments = () => {
    if (selectedDocuments.length === filteredDocuments.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(filteredDocuments.map(doc => doc.id));
    }
  };

  const sortDocuments = (docs: any[]) => {
    return [...docs].sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'date') {
        const dateA = new Date(a.uploadDate || 0).getTime();
        const dateB = new Date(b.uploadDate || 0).getTime();
        comparison = dateA - dateB;
      } else {
        comparison = (a.filename || '').localeCompare(b.filename || '');
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const filteredDocuments = sortDocuments(documents.filter(doc => {
    // Apply folder filter
    if (folderFilter !== 'todos') {
      const docFolder = doc.metadata?.carpeta?.toLowerCase() || 'otros';
      if (docFolder !== folderFilter) return false;
    }
    
    // Apply type filter
    if (filter !== 'all') {
      if (filter === 'image' && !doc.type?.startsWith('image/')) return false;
      if (filter === 'pdf' && doc.type !== 'application/pdf') return false;
      if (filter === 'zip' && doc.type !== 'application/zip') return false;
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      const docCategory = doc.metadata?.categoria?.toLowerCase() || 'otros';
      if (docCategory !== categoryFilter.toLowerCase()) return false;
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      const docStatus = doc.metadata?.status?.toLowerCase() || 'nuevo';
      if (docStatus !== statusFilter.toLowerCase()) return false;
    }
    
    // Apply search term (search in filename, provider, and notes)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const filename = (doc.filename || '').toLowerCase();
      const provider = (doc.metadata?.proveedor || '').toLowerCase();
      const notes = (doc.metadata?.notas || '').toLowerCase();
      
      if (!filename.includes(searchLower) && 
          !provider.includes(searchLower) && 
          !notes.includes(searchLower)) {
        return false;
      }
    }

    // Apply date range filter
    if (dateFrom || dateTo) {
      const docDate = new Date(doc.uploadDate || 0);
      if (dateFrom && docDate < new Date(dateFrom)) return false;
      if (dateTo && docDate > new Date(dateTo + 'T23:59:59')) return false;
    }
    
    return true;
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-neutral-900">Bandeja de Documentos</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkActions(!showBulkActions)}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
              showBulkActions 
                ? 'bg-blue-50 border-blue-200 text-blue-700' 
                : 'border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            Selección múltiple
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <div className="p-4 border-b">
          <DocumentUploader 
            onUploadComplete={handleDocumentUpload} 
            existingDocuments={documents}
          />
        </div>
        
        <div className="flex flex-col lg:flex-row">
          {/* Enhanced sidebar with filters */}
          <div className="w-full lg:w-80 lg:flex-shrink-0 border-r border-neutral-200">
            {/* Bulk Actions */}
            {showBulkActions && selectedDocuments.length > 0 && (
              <div className="p-4 bg-blue-50 border-b border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedDocuments.length} seleccionado(s)
                  </span>
                  <button
                    onClick={() => setSelectedDocuments([])}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Limpiar
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                    Eliminar
                  </button>
                  <button
                    onClick={handleBulkReassign}
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <FolderOpen className="w-3 h-3" />
                    Reasignar
                  </button>
                </div>
              </div>
            )}

            {/* Folder section */}
            <div className="p-4 border-b border-neutral-200">
              <h4 className="text-sm font-medium text-neutral-700 mb-3">Carpetas</h4>
              <div className="space-y-1">
                {['Todos', 'Facturas', 'Contratos', 'CAPEX', 'Otros'].map((folder) => (
                  <button
                    key={folder}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                      folderFilter === folder.toLowerCase()
                        ? 'bg-neutral-100 text-neutral-900'
                        : 'text-neutral-600 hover:bg-neutral-50'
                    }`}
                    onClick={() => setFolderFilter(folder.toLowerCase())}
                  >
                    {folder}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Enhanced search and filters */}
            <div className="p-4 border-b border-neutral-200">
              <div className="space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Buscar documentos..."
                    className="w-full pl-10 pr-3 py-2 border border-neutral-200 rounded-lg focus:border-neutral-300 focus:ring-2 focus:ring-neutral-200 focus:ring-opacity-50"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Type filter */}
                <select
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 focus:border-neutral-300 focus:ring-2 focus:ring-neutral-200 focus:ring-opacity-50"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Todos los tipos</option>
                  <option value="pdf">PDF</option>
                  <option value="image">Imágenes</option>
                  <option value="zip">ZIP</option>
                </select>

                {/* Status filter */}
                <select
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 focus:border-neutral-300 focus:ring-2 focus:ring-neutral-200 focus:ring-opacity-50"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Todos los estados</option>
                  <option value="nuevo">Nuevo</option>
                  <option value="asignado">Asignado</option>
                </select>

                {/* Category filter */}
                <select
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 focus:border-neutral-300 focus:ring-2 focus:ring-neutral-200 focus:ring-opacity-50"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">Todas las categorías</option>
                  <option value="suministros">Suministros</option>
                  <option value="comunidad">Comunidad</option>
                  <option value="seguro">Seguro</option>
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="reforma/capex">Reforma/CAPEX</option>
                  <option value="fiscal">Fiscal</option>
                  <option value="otros">Otros</option>
                </select>

                {/* Date range filters */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-neutral-600 mb-1">Desde</label>
                    <input
                      type="date"
                      className="w-full border border-neutral-200 rounded-lg px-2 py-1 text-sm focus:border-neutral-300"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-600 mb-1">Hasta</label>
                    <input
                      type="date"
                      className="w-full border border-neutral-200 rounded-lg px-2 py-1 text-sm focus:border-neutral-300"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sorting controls */}
            <div className="p-4 border-b border-neutral-200">
              <h4 className="text-sm font-medium text-neutral-700 mb-3">Ordenar</h4>
              <div className="flex gap-2">
                <select
                  className="flex-1 text-sm border border-neutral-200 rounded-lg px-2 py-1"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'name')}
                >
                  <option value="date">Fecha</option>
                  <option value="name">Nombre</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1 border border-neutral-200 rounded-lg hover:bg-neutral-50"
                >
                  {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Document count and bulk selection */}
            <div className="p-4">
              <div className="flex items-center justify-between text-sm text-neutral-600">
                <span>{filteredDocuments.length} documento(s)</span>
                {showBulkActions && (
                  <button
                    onClick={toggleAllDocuments}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {selectedDocuments.length === filteredDocuments.length ? 'Deseleccionar' : 'Seleccionar'} todos
                  </button>
                )}
              </div>
            </div>
            
            <DocumentList 
              documents={filteredDocuments}
              selectedId={selectedDocument?.id}
              onSelectDocument={setSelectedDocument}
              loading={loading}
              selectedDocuments={selectedDocuments}
              onToggleDocumentSelection={showBulkActions ? toggleDocumentSelection : undefined}
              showBulkActions={showBulkActions}
            />
          </div>
          
          {/* Main content area - flexible width */}
          <div className="flex-1 min-w-0">
            {selectedDocument ? (
              <div className="p-6">
                <DocumentViewer 
                  document={selectedDocument}
                  onAssign={handleAssignDocument}
                  onDelete={handleDeleteDocument}
                  onUpdate={handleUpdateDocument}
                />
              </div>
            ) : (
              <div className="h-96 flex flex-col items-center justify-center text-neutral-500 bg-white border border-neutral-200 m-6 rounded-lg">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-4 text-neutral-400">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-neutral-600">Selecciona un documento para ver</p>
                  {filteredDocuments.length === 0 && !loading && (
                    <p className="text-sm text-neutral-500 mt-2">
                      No hay documentos que coincidan con los filtros
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InboxPage;