import React from 'react';

interface DocumentUploaderProps {
  onUploadComplete: (documents: any[]) => void;
}

const DocumentUploader: React.FC<DocumentUploaderProps> = ({ onUploadComplete }) => {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
      <p className="text-gray-500">Document uploader - coming soon</p>
      <button 
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        onClick={() => onUploadComplete([])}
      >
        Upload Documents
      </button>
    </div>
  );
};

export default DocumentUploader;