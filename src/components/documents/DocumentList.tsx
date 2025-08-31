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
    return <div className="p-4 text-neutral-500">Cargando documentos...</div>;
  }

  if (documents.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="text-neutral-400 mb-2">No se encontraron documentos</div>
        <div className="text-sm text-neutral-500">Intenta cambiar los filtros o sube documentos nuevos</div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4 overflow-y-auto">
      {documents.map((doc, index) => (
        <div
          key={doc.id || index}
          className={`p-3 rounded-lg cursor-pointer transition-colors border ${
            selectedId === doc.id 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-white border-neutral-200 hover:bg-neutral-50'
          }`}
          onClick={() => onSelectDocument(doc)}
        >
          <p className="font-medium text-neutral-900">{doc.filename || doc.name || `Documento ${index + 1}`}</p>
          <p className="text-sm text-neutral-500">
            {new Date(doc.uploadDate || Date.now()).toLocaleDateString('es-ES')}
          </p>
          <p className="text-xs text-neutral-400">{doc.metadata?.status || 'Nuevo'}</p>
        </div>
      ))}
    </div>
  );
};

export default DocumentList;