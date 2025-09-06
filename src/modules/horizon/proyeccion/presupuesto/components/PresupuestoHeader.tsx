import React from 'react';
import { Plus, Download, Repeat } from 'lucide-react';
import { Presupuesto, UUID } from '../../../../../services/db';

interface PresupuestoHeaderProps {
  year: number;
  presupuesto: Presupuesto;
  inmuebleId: UUID | 'todos';
  onInmuebleChange: (id: UUID | 'todos') => void;
  onSembrar: () => void;
  onAddLinea: () => void;
  onExport: () => void;
}

const PresupuestoHeader: React.FC<PresupuestoHeaderProps> = ({
  year,
  presupuesto,
  inmuebleId,
  onInmuebleChange,
  onSembrar,
  onAddLinea,
  onExport
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Presupuesto {year}
          </h1>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>Estado: <span className="font-medium">{presupuesto.estado}</span></span>
            <span>•</span>
            <span>Creado: {new Date(presupuesto.creadoEn).toLocaleDateString()}</span>
            <span>•</span>
            <span>Actualizado: {new Date(presupuesto.actualizadoEn).toLocaleDateString()}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Selector de inmueble */}
          <select
            value={inmuebleId}
            onChange={(e) => onInmuebleChange(e.target.value as UUID | 'todos')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="todos">Todos los inmuebles</option>
            {/* TODO: Load actual properties */}
            <option value="prop-1">Inmueble 1</option>
            <option value="prop-2">Inmueble 2</option>
          </select>
          
          <button
            onClick={onSembrar}
            className="flex items-center space-x-2 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
          >
            <Repeat className="h-4 w-4" />
            <span>Sembrar</span>
          </button>
          
          <button
            onClick={onAddLinea}
            className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Añadir Línea</span>
          </button>
          
          <button
            onClick={onExport}
            className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PresupuestoHeader;