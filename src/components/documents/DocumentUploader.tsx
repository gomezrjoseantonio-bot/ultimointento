import React, { useRef } from 'react';
import { Upload } from 'lucide-react';

interface DocumentUploaderProps {
  onUploadComplete: (documents: any[]) => void;
}

const DocumentUploader: React.FC<DocumentUploaderProps> = ({ onUploadComplete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    
    const newDocuments = Array.from(files).map((file, index) => ({
      id: Date.now() + index,
      filename: file.name,
      type: file.type,
      size: file.size,
      uploadDate: new Date().toISOString(),
      content: file,
      metadata: {
        provider: '',
        docType: 'Factura',
        status: 'Nuevo',
        origin: 'Subida manual'
      }
    }));
    
    onUploadComplete(newDocuments);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div 
      className="border-2 border-dashed border-gray-300 rounded-atlas p-6 text-center hover:border-gray-400 transition-colors"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
      <p className="text-gray-500 mb-4">
        Arrastra y suelta documentos aquí o haz clic para seleccionar
      </p>
      <p className="text-sm text-gray-400 mb-4">
        Tipos soportados: PDF, JPG, PNG, ZIP
      </p>
      <button 
        className="px-6 py-2 bg-brand-navy text-white rounded-atlas hover:opacity-90 transition-opacity"
        onClick={() => fileInputRef.current?.click()}
      >
        Subir documentos
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.zip"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />
    </div>
  );
};

export default DocumentUploader;