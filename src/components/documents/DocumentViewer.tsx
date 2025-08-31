import React, { useState } from 'react';
import { Eye, Trash2, UserCheck } from 'lucide-react';

interface DocumentViewerProps {
  document: any;
  onAssign: (documentId: number, entityId: number) => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ document, onAssign }) => {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignData, setAssignData] = useState({
    destino: 'personal',
    inmueble: '',
    habitacion: '',
    categoria: 'Suministros'
  });

  const handleAssign = () => {
    // For now, just use a dummy entity ID
    onAssign(document.id, 1);
    setShowAssignModal(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Document Info */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-medium mb-2">{document?.filename || 'Documento'}</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Fecha:</span>
            <span className="ml-2 text-gray-600">
              {new Date(document?.uploadDate || Date.now()).toLocaleDateString('es-ES')}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Tamaño:</span>
            <span className="ml-2 text-gray-600">
              {document?.size ? formatFileSize(document.size) : 'N/A'}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Proveedor:</span>
            <input 
              type="text" 
              className="ml-2 border-none bg-transparent text-gray-600 focus:bg-white focus:border-gray-300 rounded px-1"
              defaultValue={document?.metadata?.provider || ''}
              placeholder="Editar..."
            />
          </div>
          <div>
            <span className="font-medium text-gray-700">Tipo:</span>
            <select className="ml-2 border-none bg-transparent text-gray-600 focus:bg-white focus:border-gray-300 rounded">
              <option value="Factura">Factura</option>
              <option value="Contrato">Contrato</option>
              <option value="Recibo">Recibo</option>
            </select>
          </div>
          <div>
            <span className="font-medium text-gray-700">Estado:</span>
            <span className="ml-2 text-gray-600">{document?.metadata?.status || 'Nuevo'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Origen:</span>
            <span className="ml-2 text-gray-600">{document?.metadata?.origin || 'Subida manual'}</span>
          </div>
        </div>
      </div>

      {/* Preview Area */}
      <div className="bg-gray-50 rounded-atlas p-8 text-center">
        <Eye className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-gray-500">Vista previa del documento</p>
        <p className="text-sm text-gray-400 mt-2">
          {document?.type || 'Tipo de archivo no especificado'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex space-x-3">
        <button className="flex items-center px-4 py-2 text-blue-600 border border-blue-600 rounded-atlas hover:bg-blue-50">
          <Eye className="w-4 h-4 mr-2" />
          Ver
        </button>
        <button 
          className="flex items-center px-4 py-2 text-green-600 border border-green-600 rounded-atlas hover:bg-green-50"
          onClick={() => setShowAssignModal(true)}
        >
          <UserCheck className="w-4 h-4 mr-2" />
          Asignar
        </button>
        <button className="flex items-center px-4 py-2 text-red-600 border border-red-600 rounded-atlas hover:bg-red-50">
          <Trash2 className="w-4 h-4 mr-2" />
          Eliminar
        </button>
      </div>

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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría
                </label>
                <select 
                  className="w-full border border-gray-300 rounded-atlas px-3 py-2"
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
            </div>

            <div className="flex space-x-3 mt-6">
              <button 
                className="px-4 py-2 bg-brand-navy text-white rounded-atlas hover:opacity-90"
                onClick={handleAssign}
              >
                Guardar
              </button>
              <button 
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-atlas hover:bg-gray-50"
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