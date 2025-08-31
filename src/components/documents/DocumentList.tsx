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
    return <div className="p-4 text-gray-500">Cargando documentos...</div>;
  }

  if (documents.length === 0) {
    return <div className="p-4 text-gray-500">No se encontraron documentos</div>;
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
          <p className="font-medium">{doc.filename || doc.name || `Documento ${index + 1}`}</p>
          <p className="text-sm text-gray-500">
            {new Date(doc.uploadDate || Date.now()).toLocaleDateString('es-ES')}
          </p>
          <p className="text-xs text-gray-400">{doc.metadata?.status || 'Nuevo'}</p>
        </div>
      ))}
    </div>
  );
};

export default DocumentList;