import React from 'react';

interface DocumentListProps {
  documents: any[];
  selectedId?: number;
  onSelectDocument: (document: any) => void;
  loading: boolean;
}

const DocumentList: React.FC<DocumentListProps> = ({ 
  documents, 
  selectedId, 
  onSelectDocument, 
  loading 
}) => {
  if (loading) {
    return <div className="p-4 text-gray-500">Loading documents...</div>;
  }

  if (documents.length === 0) {
    return <div className="p-4 text-gray-500">No documents found</div>;
  }

  return (
    <div className="space-y-2 p-4">
      {documents.map((doc, index) => (
        <div
          key={doc.id || index}
          className={`p-3 rounded-lg cursor-pointer transition-colors ${
            selectedId === doc.id 
              ? 'bg-blue-100 border border-blue-300' 
              : 'bg-gray-50 hover:bg-gray-100'
          }`}
          onClick={() => onSelectDocument(doc)}
        >
          <p className="font-medium">{doc.name || `Document ${index + 1}`}</p>
          <p className="text-sm text-gray-500">{doc.type || 'Unknown type'}</p>
        </div>
      ))}
    </div>
  );
};

export default DocumentList;