import React, { useState } from 'react';
import { X, Download, FileText, File } from 'lucide-react';
import { ComparativaData, comparativaService } from '../services/comparativaService';
import { toast } from 'react-hot-toast';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ComparativaData;
  year: number;
  scope: 'consolidado' | 'inmueble';
}

const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  data,
  year,
  scope
}) => {
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const csvData = await comparativaService.exportToCSV(data, { year, scope });
      
      // Create and download CSV file
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `comparativa-${year}-${scope}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('CSV exportado correctamente');
      onClose();
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Error al exportar CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      const pdfBlob = await comparativaService.exportToPDF(data, { year, scope });
      
      // Create and download PDF file
      const link = document.createElement('a');
      const url = URL.createObjectURL(pdfBlob);
      link.setAttribute('href', url);
      link.setAttribute('download', `comparativa-${year}-${scope}.pdf`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('PDF exportado correctamente');
      onClose();
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Error al exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-200 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Exportar Comparativa</h3>
            <p className="text-sm text-gray-600">
              Año {year} - {scope === 'consolidado' ? 'Consolidado' : 'Por inmueble'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Selecciona el formato de exportación. Los datos se formatearán según el estándar español (es-ES).
          </p>

          {/* Export Options */}
          <div className="space-y-3">
            {/* CSV Export */}
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="w-full flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="bg-success-100 p-2 rounded-lg">
                <FileText className="h-5 w-5 text-success-600" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="font-medium text-gray-900">Exportar CSV</h4>
                <p className="text-sm text-gray-600">
                  Formato compatible con Excel y hojas de cálculo
                </p>
              </div>
              <Download className="h-4 w-4 text-gray-400" />
            </button>

            {/* PDF Export */}
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="w-full flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="bg-error-100 p-2 rounded-lg">
                <File className="h-5 w-5 text-error-600" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="font-medium text-gray-900">Exportar PDF</h4>
                <p className="text-sm text-gray-600">
                  Documento formateado para presentación e impresión
                </p>
              </div>
              <Download className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          {exporting && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-atlas-blue"></div>
              <span className="ml-2 text-sm text-gray-600">Generando archivo...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;