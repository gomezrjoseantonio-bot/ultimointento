// H-HOTFIX: Inline Document Preview Component
// Handles inline preview for different document types without downloads

import React, { useState, useEffect } from 'react';
import { FileText, Image, FileSpreadsheet, Archive, Download, AlertTriangle } from 'lucide-react';

interface DocumentPreviewProps {
  filename: string;
  fileType: string;
  fileContent?: Blob | ArrayBuffer | string;
  fileUrl?: string;
  className?: string;
}

interface ZipEntry {
  name: string;
  content: Blob;
  type: string;
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  filename,
  fileType,
  fileContent,
  fileUrl,
  className = ""
}) => {
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [zipEntries, setZipEntries] = useState<ZipEntry[]>([]);
  const [selectedZipEntry, setSelectedZipEntry] = useState<ZipEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFileExtension = () => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  const renderFileIcon = () => {
    const extension = getFileExtension();
    
    switch (extension) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-error-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <Image className="w-5 h-5 text-primary-500" />;
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <FileSpreadsheet className="w-5 h-5 text-success-500" />;
      case 'zip':
        return <Archive className="w-5 h-5 text-purple-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const loadFileContent = async () => {
    if (!fileContent && !fileUrl) return;

    setLoading(true);
    setError(null);

    try {
      let blob: Blob;
      
      if (fileContent instanceof Blob) {
        blob = fileContent;
      } else if (fileContent instanceof ArrayBuffer) {
        blob = new Blob([fileContent], { type: fileType });
      } else if (fileUrl) {
        const response = await fetch(fileUrl);
        blob = await response.blob();
      } else {
        throw new Error('No file content available');
      }

      await processFileContent(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading file');
    } finally {
      setLoading(false);
    }
  };

  const processFileContent = async (blob: Blob) => {
    const extension = getFileExtension();

    switch (extension) {
      case 'pdf':
        await renderPdfPreview(blob);
        break;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        await renderImagePreview(blob);
        break;
      case 'xlsx':
      case 'xls':
      case 'csv':
        await renderSpreadsheetPreview(blob);
        break;
      case 'docx':
        await renderDocxPreview(blob);
        break;
      case 'zip':
        await renderZipPreview(blob);
        break;
      default:
        setError('Tipo de archivo no soportado para vista previa');
    }
  };

  const renderPdfPreview = async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setPreviewContent(url);
  };

  const renderImagePreview = async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setPreviewContent(url);
  };

  const renderSpreadsheetPreview = async (blob: Blob) => {
    try {
      // For demo purposes, we'll show a simple table structure
      // In production, use a library like SheetJS to parse Excel files
      if (getFileExtension() === 'csv') {
        const text = await blob.text();
        const lines = text.split('\n').slice(0, 100); // First 100 rows
        const table = lines.map(line => line.split(','));
        
        const tableHtml = `
          <div class="overflow-auto max-h-96">
            <table class="min-w-full text-xs border-collapse border border-gray-300">
              ${table.map((row, i) => `
                <tr class="${i === 0 ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'}">
                  ${row.map(cell => `
                    <td class="border border-gray-300 px-2 py-1">${cell.trim()}</td>
                  `).join('')}
                </tr>
              `).join('')}
            </table>
          </div>
        `;
        setPreviewContent(tableHtml);
      } else {
        setPreviewContent('<div class="p-4 text-gray-500">Vista previa de Excel disponible - descarga el archivo para ver el contenido completo</div>');
      }
    } catch (err) {
      setError('Error procesando el archivo de Excel');
    }
  };

  const renderDocxPreview = async (blob: Blob) => {
    try {
      // For demo purposes, show a simple text extraction message
      // In production, use mammoth.js or similar library
      const text = 'Vista previa de documento Word - las primeras 2000 palabras serían mostradas aquí...';
      
      setPreviewContent(`
        <div class="p-4 bg-white border rounded">
          <p class="text-sm text-gray-600 mb-2">Vista previa del documento:</p>
          <div class="text-sm">${text}</div>
          <div class="mt-4 pt-2 border-t">
            <button class="inline-flex items-center px-3 py-1 text-xs bg-primary-100 text-primary-700 rounded">
              <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 17a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zM3 10a1 1 0 011-1h12a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4z"/>
              </svg>
              Descargar original
            </button>
          </div>
        </div>
      `);
    } catch (err) {
      setError('Error procesando el documento Word');
    }
  };

  const renderZipPreview = async (blob: Blob) => {
    try {
      // For demo purposes, simulate ZIP extraction
      // In production, use JSZip library
      const mockEntries: ZipEntry[] = [
        { name: 'factura_1.pdf', content: blob, type: 'application/pdf' },
        { name: 'factura_2.pdf', content: blob, type: 'application/pdf' },
        { name: 'recibo.jpg', content: blob, type: 'image/jpeg' }
      ];
      
      setZipEntries(mockEntries);
      setPreviewContent('zip'); // Special marker for ZIP content
    } catch (err) {
      setError('Error procesando el archivo ZIP');
    }
  };

  useEffect(() => {
    loadFileContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileContent, fileUrl]); // Only depend on core file props

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="btn-secondary-horizon animate-spin h-8 w-8 "></div>
          <span className="ml-2 text-sm text-gray-600">Cargando vista previa...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-64 bg-gray-50">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">{error}</p>
            <button className="atlas-atlas-btn-primary mt-2 inline-flex items-center px-3 py-1 text-xs text-primary-700 rounded">
              <Download className="w-3 h-3 mr-1" />
              Descargar archivo
            </button>
          </div>
        </div>
      );
    }

    if (!previewContent) {
      return (
        <div className="flex items-center justify-center h-64 bg-gray-50">
          <div className="text-center">
            {renderFileIcon()}
            <p className="text-sm text-gray-600 mt-2">No hay vista previa disponible</p>
          </div>
        </div>
      );
    }

    const extension = getFileExtension();

    // Handle different file types
    if (extension === 'pdf') {
      return (
        <div className="h-96 border overflow-hidden">
          <embed
            src={previewContent}
            type="application/pdf"
            className="w-full h-full"
          />
        </div>
      );
    }

    if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
      return (
        <div className="border overflow-hidden">
          <img 
            src={previewContent} 
            alt={filename}
            className="w-full h-auto max-h-96 object-contain"
          />
        </div>
      );
    }

    if (previewContent === 'zip') {
      return (
        <div className="border p-4">
          <h4 className="font-medium text-gray-900 mb-3">Contenido del archivo ZIP:</h4>
          <div className="space-y-2">
            {zipEntries.map((entry, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-2 bg-gray-50 rounded cursor-pointer"
                onClick={() => setSelectedZipEntry(entry)}
              >
                <div className="flex items-center">
                  {renderFileIcon()}
                  <span className="ml-2 text-sm">{entry.name}</span>
                </div>
                <button className="atlas-btn-ghost-horizon text-xs">
                  Ver
                </button>
              </div>
            ))}
          </div>
          {selectedZipEntry && (
            <div className="mt-4 pt-4 border-t">
              <h5 className="font-medium text-sm mb-2">Vista previa: {selectedZipEntry.name}</h5>
              <DocumentPreview
                filename={selectedZipEntry.name}
                fileType={selectedZipEntry.type}
                fileContent={selectedZipEntry.content}
              />
            </div>
          )}
        </div>
      );
    }

    // For CSV/Excel and DOCX
    return (
      <div 
        className="border overflow-hidden"
        dangerouslySetInnerHTML={{ __html: previewContent }}
      />
    );
  };

  return (
    <div className={`${className}`}>
      <div className="flex items-center mb-3">
        {renderFileIcon()}
        <span className="ml-2 text-sm font-medium text-gray-900">{filename}</span>
      </div>
      {renderPreview()}
    </div>
  );
};

export default DocumentPreview;