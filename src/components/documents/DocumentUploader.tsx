import React, { useRef, useState } from 'react';
import { Upload, AlertTriangle, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface DocumentUploaderProps {
  onUploadComplete: (documents: any[]) => void;
  existingDocuments?: any[];
}

interface DuplicateFile {
  file: File;
  existingDoc: any;
  action: 'replace' | 'keep-both' | 'skip' | null;
}

const DocumentUploader: React.FC<DocumentUploaderProps> = ({ onUploadComplete, existingDocuments = [] }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [duplicates, setDuplicates] = useState<DuplicateFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const checkForDuplicates = (files: File[]): { duplicates: DuplicateFile[], newFiles: File[] } => {
    const duplicateFiles: DuplicateFile[] = [];
    const newFiles: File[] = [];

    files.forEach(file => {
      const existingDoc = existingDocuments.find(doc => 
        doc.filename === file.name && doc.size === file.size
      );
      
      if (existingDoc) {
        duplicateFiles.push({
          file,
          existingDoc,
          action: null
        });
      } else {
        newFiles.push(file);
      }
    });

    return { duplicates: duplicateFiles, newFiles };
  };

  const createDocumentFromFile = (file: File, index: number = 0) => ({
    id: Date.now() + index,
    filename: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    lastModified: file.lastModified,
    uploadDate: new Date().toISOString(),
    content: file,
    metadata: {
      title: file.name.split('.')[0],
      description: '',
      tags: [],
      proveedor: '',
      tipo: 'Factura',
      categoria: 'Otros',
      destino: 'Personal',
      status: 'Nuevo',
      entityType: 'personal',
      entityId: undefined,
      notas: '',
      carpeta: 'otros'
    }
  });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    
    setIsProcessing(true);
    const fileArray = Array.from(files);
    
    // Validate file types
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/zip'];
    const invalidFiles = fileArray.filter(file => 
      !validTypes.includes(file.type) && 
      !file.name.toLowerCase().endsWith('.pdf') &&
      !file.name.toLowerCase().endsWith('.jpg') &&
      !file.name.toLowerCase().endsWith('.jpeg') &&
      !file.name.toLowerCase().endsWith('.png') &&
      !file.name.toLowerCase().endsWith('.zip')
    );

    if (invalidFiles.length > 0) {
      toast.error(`Tipos de archivo no soportados: ${invalidFiles.map(f => f.name).join(', ')}`);
      setIsProcessing(false);
      return;
    }

    const { duplicates: duplicateFiles, newFiles } = checkForDuplicates(fileArray);
    
    if (duplicateFiles.length > 0) {
      setDuplicates(duplicateFiles);
      setIsProcessing(false);
      return;
    }

    // Process new files directly
    if (newFiles.length > 0) {
      const newDocuments = newFiles.map((file, index) => createDocumentFromFile(file, index));
      onUploadComplete(newDocuments);
      toast.success(`${newFiles.length} documento(s) subido(s) correctamente`);
    }
    
    setIsProcessing(false);
  };

  const handleDuplicateAction = (index: number, action: 'replace' | 'keep-both' | 'skip') => {
    setDuplicates(prev => prev.map((dup, i) => 
      i === index ? { ...dup, action } : dup
    ));
  };

  const processDuplicates = async () => {
    const documentsToProcess: any[] = [];
    
    for (const dup of duplicates) {
      if (!dup.action) continue;
      
      switch (dup.action) {
        case 'replace':
          // Replace existing document
          const replacedDoc = createDocumentFromFile(dup.file);
          replacedDoc.id = dup.existingDoc.id; // Keep the same ID
          replacedDoc.metadata = { ...dup.existingDoc.metadata, ...replacedDoc.metadata };
          documentsToProcess.push(replacedDoc);
          break;
          
        case 'keep-both':
          // Create new document with modified name
          const baseName = dup.file.name.split('.').slice(0, -1).join('.');
          const extension = dup.file.name.split('.').pop();
          const newName = `${baseName} (2).${extension}`;
          
          const newFile = new File([dup.file], newName, { type: dup.file.type });
          const newDoc = createDocumentFromFile(newFile);
          documentsToProcess.push(newDoc);
          break;
          
        case 'skip':
          // Do nothing
          break;
      }
    }
    
    if (documentsToProcess.length > 0) {
      onUploadComplete(documentsToProcess);
      toast.success(`${documentsToProcess.length} documento(s) procesado(s) correctamente`);
    }
    
    setDuplicates([]);
  };

  const cancelDuplicateHandling = () => {
    setDuplicates([]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (duplicates.length > 0) {
    return (
      <div className="border border-orange-200 rounded-lg p-6 bg-orange-50">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          <h3 className="font-semibold text-orange-900">Documentos duplicados detectados</h3>
        </div>
        
        <p className="text-sm text-orange-700 mb-4">
          Se encontraron documentos con el mismo nombre y tamaño. ¿Qué deseas hacer?
        </p>
        
        <div className="space-y-4">
          {duplicates.map((dup, index) => (
            <div key={index} className="border border-orange-200 rounded-lg p-4 bg-white">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-neutral-900">{dup.file.name}</span>
                <span className="text-sm text-neutral-500">
                  {(dup.file.size / 1024).toFixed(1)} KB
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => handleDuplicateAction(index, 'replace')}
                  className={`p-2 text-sm rounded-lg border transition-colors ${
                    dup.action === 'replace' 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <strong>Reemplazar</strong><br />
                  <span className="text-xs">Sustituir el existente</span>
                </button>
                
                <button
                  onClick={() => handleDuplicateAction(index, 'keep-both')}
                  className={`p-2 text-sm rounded-lg border transition-colors ${
                    dup.action === 'keep-both' 
                      ? 'border-green-500 bg-green-50 text-green-700' 
                      : 'border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <strong>Conservar ambos</strong><br />
                  <span className="text-xs">Añadir "(2)" al nuevo</span>
                </button>
                
                <button
                  onClick={() => handleDuplicateAction(index, 'skip')}
                  className={`p-2 text-sm rounded-lg border transition-colors ${
                    dup.action === 'skip' 
                      ? 'border-neutral-500 bg-neutral-50 text-neutral-700' 
                      : 'border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <strong>Omitir</strong><br />
                  <span className="text-xs">No subir este archivo</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex gap-2 mt-6">
          <button
            onClick={processDuplicates}
            disabled={duplicates.some(d => !d.action)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCircle className="w-4 h-4 inline mr-2" />
            Procesar Documentos
          </button>
          <button
            onClick={cancelDuplicateHandling}
            className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors"
          >
            <X className="w-4 h-4 inline mr-2" />
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-neutral-400 transition-colors"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <Upload className="mx-auto h-12 w-12 text-neutral-400 mb-4" />
      <p className="text-neutral-600 mb-4">
        Arrastra y suelta documentos aquí o haz clic para seleccionar
      </p>
      <p className="text-sm text-neutral-500 mb-4">
        Tipos soportados: PDF, JPG, PNG, ZIP (varios archivos a la vez)
      </p>
      <button 
        className="px-6 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 disabled:opacity-50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
      >
        {isProcessing ? 'Procesando...' : 'Subir documentos'}
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