import React, { useState, useEffect } from 'react';
import { initDB, deleteDocumentAndBlob } from '../services/db';
import DocumentViewer from '../components/documents/DocumentViewer';
import DocumentUploader from '../components/documents/DocumentUploader';
import DocumentList from '../components/documents/DocumentList';

const InboxPage: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const [folderFilter, setFolderFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

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

  const handleAssignDocument = async (docId: number, entityId: number) => {
    try {
      const db = await initDB();
      const tx = db.transaction('documents', 'readwrite');
      const doc = await tx.store.get(docId);
      
      if (doc) {
        doc.metadata.entityId = entityId;
        doc.metadata.status = 'Asignado';
        await tx.store.put(doc);
      }
      
      await tx.done;
    } catch (error) {
      console.warn('Failed to update in IndexedDB:', error);
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

  const filteredDocuments = documents.filter(doc => {
    // Apply folder filter
    if (folderFilter !== 'todos') {
      const docFolder = doc.metadata?.carpeta?.toLowerCase() || 'otros';
      if (docFolder !== folderFilter) return false;
    }
    
    // Apply type filter
    if (filter !== 'all' && doc.type !== filter) return false;
    
    // Apply search term
    if (searchTerm && !doc.filename.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800">Bandeja de Documentos</h1>
      </div>
      
      <div className="bg-white rounded-atlas border border-neutral-200 overflow-hidden">
        <div className="p-4 border-b">
          <DocumentUploader onUploadComplete={handleDocumentUpload} />
        </div>
        
        <div className="flex flex-col lg:flex-row">
          {/* Fixed width sidebar - 320px */}
          <div className="w-full lg:w-80 lg:flex-shrink-0 border-r border-neutral-200">
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
            
            {/* Search and filters */}
            <div className="p-4 border-b border-neutral-200">
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Buscar documentos..."
                  className="w-full max-w-full border-neutral-200 rounded-atlas focus:border-neutral-300 focus:ring-2 focus:ring-neutral-200 focus:ring-opacity-50"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                  className="w-full border-neutral-200 rounded-atlas focus:border-neutral-300 focus:ring-2 focus:ring-neutral-200 focus:ring-opacity-50"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Todos los tipos</option>
                  <option value="application/pdf">PDF</option>
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/png">PNG</option>
                  <option value="application/zip">ZIP</option>
                </select>
              </div>
            </div>
            
            <DocumentList 
              documents={filteredDocuments}
              selectedId={selectedDocument?.id}
              onSelectDocument={setSelectedDocument}
              loading={loading}
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
                />
              </div>
            ) : (
              <div className="h-96 flex flex-col items-center justify-center text-neutral-500 bg-white border border-neutral-200 m-6 rounded-atlas">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-4 text-neutral-400">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-neutral-600">Selecciona un documento para ver</p>
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