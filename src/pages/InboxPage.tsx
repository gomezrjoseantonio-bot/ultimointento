import React, { useState, useEffect } from 'react';
import { initDB } from '../services/db';
import DocumentViewer from '../components/documents/DocumentViewer';
import DocumentUploader from '../components/documents/DocumentUploader';
import DocumentList from '../components/documents/DocumentList';

const InboxPage: React.FC = () => {
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDocuments = async () => {
      setLoading(true);
      const db = await initDB();
      const docs = await db.getAll('documents');
      
      // Filter documents that haven't been assigned to entities
      const inboxDocs = docs.filter(doc => !doc.metadata.entityId);
      setDocuments(inboxDocs);
      setLoading(false);
    };
    
    loadDocuments();
  }, []);

  const handleDocumentUpload = async (newDocuments) => {
    // Add documents to state
    setDocuments(prev => [...prev, ...newDocuments]);
  };

  const handleAssignDocument = async (docId, entityType, entityId) => {
    const db = await initDB();
    const tx = db.transaction('documents', 'readwrite');
    const doc = await tx.store.get(docId);
    
    if (doc) {
      doc.metadata.entityType = entityType;
      doc.metadata.entityId = entityId;
      await tx.store.put(doc);
      
      // Remove from inbox list
      setDocuments(prev => prev.filter(d => d.id !== docId));
      
      // If it was selected, deselect it
      if (selectedDocument && selectedDocument.id === docId) {
        setSelectedDocument(null);
      }
    }
    
    await tx.done;
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
        <h1 className="text-2xl font-semibold text-gray-800">Document Inbox</h1>
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
                  placeholder="Search documents..."
                  className="flex-1 border-gray-300 rounded-md shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                  className="border-gray-300 rounded-md shadow-sm"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All Types</option>
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
                Select a document to view
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InboxPage;