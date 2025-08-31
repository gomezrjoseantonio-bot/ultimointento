import React, { useState, useEffect } from 'react';
import { initDB } from '../services/db';
import DocumentViewer from '../components/documents/DocumentViewer';
import DocumentUploader from '../components/documents/DocumentUploader';
import DocumentList from '../components/documents/DocumentList';

const InboxPage: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [filter, setFilter] = useState('all');
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

  const filteredDocuments = documents.filter(doc => {
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
      
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-4 border-b">
          <DocumentUploader onUploadComplete={handleDocumentUpload} />
        </div>
        
        <div className="flex flex-col md:flex-row">
          <div className="w-full md:w-1/3 border-r">
            <div className="p-4 border-b">
              <div className="flex space-x-2 mb-2">
                <input
                  type="text"
                  placeholder="Buscar documentos..."
                  className="flex-1 border-gray-300 rounded-md shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                  className="border-gray-300 rounded-md shadow-sm"
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
          
          <div className="w-full md:w-2/3">
            {selectedDocument ? (
              <div className="p-4">
                <DocumentViewer 
                  document={selectedDocument}
                  onAssign={handleAssignDocument}
                />
              </div>
            ) : (
              <div className="h-96 flex items-center justify-center text-gray-500">
                Selecciona un documento para ver
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InboxPage;