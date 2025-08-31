import React from 'react';

interface DocumentViewerProps {
  document: any;
  onAssign: (documentId: number, entityId: number) => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ document, onAssign }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">{document?.name || 'Document'}</h3>
      <p className="text-gray-500">Document viewer - coming soon</p>
    </div>
  );
};

export default DocumentViewer;