import React, { useState } from 'react';
import { Eye, Trash2, UserCheck, X, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useButtonStyles } from '../../hooks/useButtonStyles';

interface DocumentViewerProps {
  document: any;
  onAssign: (documentId: number, entityId: number) => void;
  onDelete?: (documentId: number) => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ document, onAssign, onDelete }) => {
  const buttonStyles = useButtonStyles();
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [assignData, setAssignData] = useState({
    destino: 'personal',
    inmueble: '',
    habitacion: '',
    categoria: 'Suministros',
    carpeta: 'otros'
  });

  const handleAssign = () => {
    // For now, just use a dummy entity ID
    onAssign(document.id, 1);
    setShowAssignModal(false);
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(document.id);
      setShowDeleteConfirm(false);
      toast.success('Documento eliminado.');
    }
  };

  const handlePreview = () => {
    setShowPreviewModal(true);
  };

  const handleDownload = () => {
    if (document?.content) {
      const blob = new Blob([document.content], { type: document.type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.filename || 'documento';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderPreviewContent = () => {
    if (!document?.content) {
      return (
        <div className="text-center py-8">
          <p className="text-neutral-500">No se puede cargar el contenido del documento</p>
          <button 
            onClick={handleDownload}
            className={buttonStyles.primary}
          >
            <Download className="w-4 h-4 inline mr-2" />
            Descargar
          </button>
        </div>
      );
    }

    if (document.type === 'application/pdf') {
      const blob = new Blob([document.content], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      return (
        <div className="w-full h-96">
          <object
            data={url}
            type="application/pdf"
            className="w-full h-full border border-neutral-200"
          >
            <div className="text-center py-8">
              <p className="text-neutral-500 mb-4">No se puede previsualizar este PDF en tu navegador</p>
              <button 
                onClick={handleDownload}
                className={buttonStyles.primary}
              >
                <Download className="w-4 h-4 inline mr-2" />
                Descargar
              </button>
            </div>
          </object>
        </div>
      );
    }

    if (document.type.startsWith('image/')) {
      const blob = new Blob([document.content], { type: document.type });
      const url = URL.createObjectURL(blob);
      
      return (
        <div className="text-center">
          <img 
            src={url} 
            alt={document.filename} 
            className="max-w-full max-h-96 mx-auto object-contain border border-neutral-200 rounded-atlas"
          />
        </div>
      );
    }

    return (
      <div className="text-center py-8">
        <p className="text-neutral-500 mb-4">No se puede previsualizar este tipo de archivo</p>
        <button 
          onClick={handleDownload}
          className={buttonStyles.primary}
        >
          <Download className="w-4 h-4 inline mr-2" />
          Descargar
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Document Info */}
      <div className="border-b border-neutral-200 pb-4">
        <h3 className="text-lg font-medium text-neutral-900 mb-2">{document?.filename || 'Documento'}</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-neutral-700">Fecha:</span>
            <span className="ml-2 text-neutral-600">
              {new Date(document?.uploadDate || Date.now()).toLocaleDateString('es-ES')}
            </span>
          </div>
          <div>
            <span className="font-medium text-neutral-700">Tamaño:</span>
            <span className="ml-2 text-neutral-600">
              {document?.size ? formatFileSize(document.size) : 'N/A'}
            </span>
          </div>
          <div>
            <span className="font-medium text-neutral-700">Proveedor:</span>
            <input 
              type="text" 
              className="ml-2 border-none bg-transparent text-neutral-600 focus:bg-white focus:border-neutral-300 rounded px-1"
              defaultValue={document?.metadata?.provider || ''}
              placeholder="Editar..."
            />
          </div>
          <div>
            <span className="font-medium text-neutral-700">Tipo:</span>
            <select className="ml-2 border-none bg-transparent text-neutral-600 focus:bg-white focus:border-neutral-300 rounded">
              <option value="Factura">Factura</option>
              <option value="Contrato">Contrato</option>
              <option value="Recibo">Recibo</option>
            </select>
          </div>
          <div>
            <span className="font-medium text-neutral-700">Estado:</span>
            <span className="ml-2 text-neutral-600">{document?.metadata?.status || 'Nuevo'}</span>
          </div>
          <div>
            <span className="font-medium text-neutral-700">Origen:</span>
            <span className="ml-2 text-neutral-600">{document?.metadata?.origin || 'Subida manual'}</span>
          </div>
        </div>
      </div>

      {/* Preview Area */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-atlas p-8 text-center">
        <Eye className="mx-auto h-12 w-12 text-neutral-500 mb-4" />
        <p className="text-neutral-600">Vista previa del documento</p>
        <p className="text-sm text-neutral-400 mt-2">
          {document?.type || 'Tipo de archivo no especificado'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex space-x-3">
        <button 
          className={`${buttonStyles.secondary} flex items-center`}
          onClick={handlePreview}
        >
          <Eye className="w-4 h-4 mr-2 text-neutral-500" />
          Ver
        </button>
        <button 
          className={`${buttonStyles.primary} flex items-center`}
          onClick={() => setShowAssignModal(true)}
        >
          <UserCheck className="w-4 h-4 mr-2" />
          Asignar
        </button>
        <button 
          className={`${buttonStyles.dangerOutline} flex items-center`}
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Eliminar
        </button>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-atlas w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h4 className="text-lg font-medium">Vista previa del documento</h4>
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="p-2 hover:bg-gray-100 rounded-atlas"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="mb-4">
                <h5 className="font-medium">{document?.filename || 'Documento'}</h5>
                <p className="text-sm text-gray-500">{document?.type || 'Tipo desconocido'}</p>
              </div>
              {renderPreviewContent()}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-atlas p-6 w-full max-w-md">
            <h4 className="text-lg font-medium mb-4">¿Eliminar documento?</h4>
            <p className="text-neutral-600 mb-6">
              Se eliminará '{document?.filename || 'el documento'}'. Esta acción no se puede deshacer.
            </p>
            <div className="flex space-x-3">
              <button 
                className={buttonStyles.danger}
                onClick={handleDelete}
              >
                Eliminar
              </button>
              <button 
                className={buttonStyles.secondary}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-atlas p-6 w-full max-w-md">
            <h4 className="text-lg font-medium mb-4">Asignar Documento</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destino
                </label>
                <select 
                  className="w-full border border-gray-300 rounded-atlas px-3 py-2"
                  value={assignData.destino}
                  onChange={(e) => setAssignData({...assignData, destino: e.target.value})}
                >
                  <option value="personal">Personal</option>
                  <option value="inmueble">Inmueble</option>
                  <option value="habitacion">Habitación</option>
                </select>
              </div>

              {assignData.destino === 'inmueble' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Inmueble
                  </label>
                  <select className="w-full border border-gray-300 rounded-atlas px-3 py-2">
                    <option value="">Seleccionar inmueble...</option>
                  </select>
                </div>
              )}

              {assignData.destino === 'habitacion' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Inmueble
                    </label>
                    <select className="w-full border border-gray-300 rounded-atlas px-3 py-2">
                      <option value="">Seleccionar inmueble...</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Habitación
                    </label>
                    <select className="w-full border border-gray-300 rounded-atlas px-3 py-2">
                      <option value="">Seleccionar habitación...</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Categoría
                </label>
                <select 
                  className="w-full border border-neutral-200 rounded-atlas px-3 py-2 focus:border-neutral-300 focus:ring-2 focus:ring-neutral-200 focus:ring-opacity-50"
                  value={assignData.categoria}
                  onChange={(e) => setAssignData({...assignData, categoria: e.target.value})}
                >
                  <option value="Suministros">Suministros</option>
                  <option value="Comunidad">Comunidad</option>
                  <option value="Seguro">Seguro</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Reforma/CAPEX">Reforma/CAPEX</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Carpeta
                </label>
                <select 
                  className="w-full border border-neutral-200 rounded-atlas px-3 py-2 focus:border-neutral-300 focus:ring-2 focus:ring-neutral-200 focus:ring-opacity-50"
                  value={assignData.carpeta}
                  onChange={(e) => setAssignData({...assignData, carpeta: e.target.value})}
                >
                  <option value="facturas">Facturas</option>
                  <option value="contratos">Contratos</option>
                  <option value="capex">CAPEX</option>
                  <option value="otros">Otros</option>
                </select>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button 
                className={buttonStyles.primary}
                onClick={handleAssign}
              >
                Guardar
              </button>
              <button 
                className={buttonStyles.secondary}
                onClick={() => setShowAssignModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;