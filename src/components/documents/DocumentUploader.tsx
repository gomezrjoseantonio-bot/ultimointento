import React, { useRef, useState } from 'react';
import { Upload, AlertTriangle, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { processZipFile, ZipProcessingResult } from '../../services/zipProcessingService';

interface DocumentUploaderProps {
  onUploadComplete: (documents: any[]) => void;
  onZipProcessed?: (result: ZipProcessingResult) => void;
  existingDocuments?: any[];
}

interface DuplicateFile {
  file: File;
  existingDoc: any;
  action: 'replace' | 'keep-both' | 'skip' | null;
}

const DocumentUploader: React.FC<DocumentUploaderProps> = ({ 
  onUploadComplete, 
  onZipProcessed,
  existingDocuments = [] 
}) => {
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

  const createDocumentFromFile = (file: File, index: number = 0) => {
    // H8 Issue 2: Enhanced automatic file classification
    const classification = classifyFileOnUpload(file);
    
    return {
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
        tipo: classification.tipo,
        categoria: 'Otros',
        destino: 'Personal',
        status: 'pendiente', // H8: Default status is pendiente
        queueStatus: 'pendiente',
        entityType: 'personal',
        entityId: undefined,
        confidence: classification.confidence,
        clasificacion_automatica: true,
        tipo_detectado: classification.tipo, // H8: Store detected type
        notas: '',
        origen: 'upload' // H8: Mark as upload origin
      }
    };
  };

  // H8 Issue 2: Enhanced file type detection with OCR patterns
  const classifyFileOnUpload = (file: File): { tipo: string, confidence: number } => {
    const fileName = file.name.toLowerCase();
    
    // Factura detection: PDF/JPG/PNG/ZIP/EML with invoice patterns
    if (isInvoiceFile(file, fileName)) {
      return { tipo: 'Factura', confidence: 0.85 };
    }
    
    // Extracto detection: XLS/XLSX/CSV/TXT with bank patterns
    if (isBankStatementFile(file)) {
      return { tipo: 'Extracto bancario', confidence: 0.90 };
    }
    
    // Contrato detection: PDF with contract patterns
    if (isContractFile(file, fileName)) {
      return { tipo: 'Contrato', confidence: 0.75 };
    }
    
    // Default to Otros for unclassified
    return { tipo: 'Otros', confidence: 0.50 };
  };

  // H8: Invoice file detection
  const isInvoiceFile = (file: File, fileName: string): boolean => {
    const invoiceExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'zip', 'eml'];
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (!invoiceExtensions.includes(extension || '')) {
      return false;
    }
    
    // Check filename patterns
    const invoicePatterns = [
      'factura', 'invoice', 'bill', 'receipt', 'recibo', 
      'ticket', 'compra', 'purchase', 'gasto', 'expense'
    ];
    
    return invoicePatterns.some(pattern => fileName.includes(pattern)) ||
           file.type === 'application/pdf' || 
           file.type?.startsWith('image/');
  };

  // H8: Contract file detection  
  const isContractFile = (file: File, fileName: string): boolean => {
    if (file.type !== 'application/pdf') {
      return false;
    }
    
    const contractPatterns = [
      'contrato', 'contract', 'acuerdo', 'agreement', 
      'convenio', 'rental', 'lease', 'alquiler', 'arrendamiento'
    ];
    
    return contractPatterns.some(pattern => fileName.includes(pattern));
  };

  const isBankStatementFile = (file: File): boolean => {
    const fileName = file.name.toLowerCase();
    const extension = fileName.split('.').pop();
    
    // Check file extension
    if (!['csv', 'xlsx', 'xls'].includes(extension || '')) {
      return false;
    }
    
    // Check file name patterns that suggest bank statements
    const bankStatementPatterns = [
      'extracto', 'movimientos', 'transacciones', 'bancario', 'cuenta',
      'bbva', 'santander', 'ing', 'caixa', 'unicaja', 'openbank', 
      'revolut', 'bankinter', 'sabadell', 'abanca'
    ];
    
    return bankStatementPatterns.some(pattern => fileName.includes(pattern));
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    
    setIsProcessing(true);
    const fileArray = Array.from(files);
    
    // Validate file types
    const validTypes = [
      'application/pdf', 'image/jpeg', 'image/png', 'application/zip',
      'text/csv', 'application/vnd.ms-excel', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.zip', '.csv', '.xlsx', '.xls'];
    
    const invalidFiles = fileArray.filter(file => {
      const hasValidType = validTypes.includes(file.type);
      const hasValidExtension = validExtensions.some(ext => 
        file.name.toLowerCase().endsWith(ext)
      );
      return !hasValidType && !hasValidExtension;
    });

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

    // Separate ZIP files from regular files
    const zipFiles = newFiles.filter(file => file.type === 'application/zip' || file.name.toLowerCase().endsWith('.zip'));
    const regularFiles = newFiles.filter(file => file.type !== 'application/zip' && !file.name.toLowerCase().endsWith('.zip'));

    // Process regular files
    if (regularFiles.length > 0) {
      const newDocuments = regularFiles.map((file, index) => createDocumentFromFile(file, index));
      onUploadComplete(newDocuments);
      toast.success(`${regularFiles.length} documento(s) subido(s) correctamente`);
    }

    // Process ZIP files
    for (const zipFile of zipFiles) {
      try {
        toast.loading(`Procesando ZIP: ${zipFile.name}...`, { id: zipFile.name });
        
        const result = await processZipFile(zipFile);
        
        // Convert ZIP children to regular documents format
        const zipDocuments = result.children.map(child => ({
          id: child.id,
          filename: child.filename,
          content: child.content,
          type: child.type,
          size: child.size,
          uploadDate: child.uploadDate,
          metadata: {
            ...child.metadata,
            zipPackageId: result.package.id,
            originalPath: child.originalPath,
            origen: 'upload'
          }
        }));

        // Add the package record itself as a document
        const packageDocument = {
          id: result.package.id,
          filename: result.package.filename,
          content: await result.package.originalZip.arrayBuffer(),
          type: 'application/zip',
          size: result.package.originalZip.size,
          uploadDate: result.package.uploadDate,
          metadata: {
            isZipPackage: true,
            childCount: result.children.length,
            queueStatus: 'importado', // ZIP packages are considered processed
            ...result.package.metadata
          }
        };

        // Notify about ZIP processing
        if (onZipProcessed) {
          onZipProcessed(result);
        }

        // Add all documents (children + package) to the inbox
        onUploadComplete([packageDocument, ...zipDocuments]);

        toast.success(
          `ZIP procesado: ${result.summary.validFiles} archivos válidos de ${result.summary.totalFiles} total`,
          { id: zipFile.name, duration: 5000 }
        );

        // Show detailed summary
        if (result.summary.skippedFiles > 0 || result.summary.failedFiles > 0) {
          const details = [];
          if (result.summary.skippedFiles > 0) details.push(`${result.summary.skippedFiles} omitidos`);
          if (result.summary.failedFiles > 0) details.push(`${result.summary.failedFiles} errores`);
          
          toast(`Detalles: ${details.join(', ')}`, {
            icon: 'ℹ️',
            duration: 4000
          });
        }

      } catch (error) {
        toast.error(`Error procesando ZIP ${zipFile.name}: ${error instanceof Error ? error.message : 'Error desconocido'}`, {
          id: zipFile.name
        });
      }
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
      <div className="border border-orange-200 p-6 bg-orange-50">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          <h3 className="font-semibold text-orange-900">Documentos duplicados detectados</h3>
        </div>
        
        <p className="text-sm text-orange-700 mb-4">
          Se encontraron documentos con el mismo nombre y tamaño. ¿Qué deseas hacer?
        </p>
        
        <div className="space-y-4">
          {duplicates.map((dup, index) => (
            <div key={index} className="border border-orange-200 p-4 bg-white">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-neutral-900">{dup.file.name}</span>
                <span className="text-sm text-neutral-500">
                  {(dup.file.size / 1024).toFixed(1)} KB
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => handleDuplicateAction(index, 'replace')}
                  className={`p-2 text-sm border ${
                    dup.action === 'replace' 
                      ? 'border-primary-500 bg-primary-50 text-primary-700' 
                      : 'border-neutral-200'                  }`}
                >
                  <strong>Reemplazar</strong><br />
                  <span className="text-xs">Sustituir el existente</span>
                </button>
                
                <button
                  onClick={() => handleDuplicateAction(index, 'keep-both')}
                  className={`p-2 text-sm border ${
                    dup.action === 'keep-both' 
                      ? 'border-success-500 bg-success-50 text-success-700' 
                      : 'border-neutral-200'                  }`}
                >
                  <strong>Conservar ambos</strong><br />
                  <span className="text-xs">Añadir "(2)" al nuevo</span>
                </button>
                
                <button
                  onClick={() => handleDuplicateAction(index, 'skip')}
                  className={`p-2 text-sm border ${
                    dup.action === 'skip' 
                      ? 'border-neutral-500 bg-neutral-50 text-neutral-700' 
                      : 'border-neutral-200'                  }`}
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
            className="btn-primary-horizon px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-4 h-4 inline mr-2" />
            Procesar Documentos
          </button>
          <button
            onClick={cancelDuplicateHandling}
            className="px-4 py-2 bg-neutral-200 text-neutral-700"
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
      className="border-2 border-dashed border-neutral-300 p-6 text-center hover:border-neutral-400"
          >
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <Upload className="mx-auto h-12 w-12 text-neutral-400 mb-4" />
      <p className="text-neutral-600 mb-4">
        Arrastra y suelta documentos aquí o haz clic para seleccionar
      </p>
      <p className="text-sm text-neutral-500 mb-4">
        Tipos soportados: PDF, JPG, PNG, ZIP, CSV, XLS, XLSX (varios archivos a la vez)
      </p>
      <button 
        className="px-6 py-2 bg-neutral-600 disabled:opacity-50"
          >
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
      >
        {isProcessing ? 'Procesando...' : 'Subir documentos'}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.zip,.csv,.xlsx,.xls"
        className="hidden"
           onChange={(e) => handleFileUpload(e.target.files)}
       />
    </div>
  );
};

export default DocumentUploader;