import React from 'react';
import { Trash2, Home, Car, Shield, Zap, Tv, Heart, GraduationCap, MoreHorizontal } from 'lucide-react';
import { GastoPuntual, CategoriaGasto } from '../../../types/personal';
import { gastosPersonalesService } from '../../../services/gastosPersonalesService';

interface GastoPuntualListProps {
  gastos: GastoPuntual[];
  onDelete: (id: number) => void;
}

const iconMap: Record<string, any> = {
  Home, Car, Shield, Zap, Tv, Heart, GraduationCap, MoreHorizontal
};

const GastoPuntualList: React.FC<GastoPuntualListProps> = ({ gastos, onDelete }) => {
  const getCategoriaIcon = (categoria: CategoriaGasto) => {
    const iconName = gastosPersonalesService.getCategoriaIcon(categoria);
    const IconComponent = iconMap[iconName] || MoreHorizontal;
    return IconComponent;
  };

  if (gastos.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No hay gastos puntuales este mes</p>
        <p className="text-sm text-gray-400 mt-1">
          Haz clic en "Nuevo Gasto" para registrar un gasto puntual
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {gastos.map((gasto) => {
        const IconComponent = getCategoriaIcon(gasto.categoria);
        const fecha = (() => {
          if (typeof gasto.fecha === 'string') {
            const parts = gasto.fecha.split('-').map(Number);
            if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
              const [year, month, day] = parts;
              // Construct Date in local time to avoid UTC interpretation issues
              return new Date(year, month - 1, day);
            }
          }
          // Fallback to default parsing if format is unexpected or not a string
          return new Date(gasto.fecha as any);
        })();

        return (
          <div key={gasto.id} className="p-4 border border-gray-200 rounded-lg bg-white">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <IconComponent className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{gasto.descripcion}</h4>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                    <span>
                      {new Intl.NumberFormat('es-ES', { 
                        style: 'currency', 
                        currency: 'EUR' 
                      }).format(gasto.importe)}
                    </span>
                    <span>·</span>
                    <span>
                      {fecha.toLocaleDateString('es-ES', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </span>
                    <span>·</span>
                    <span>{gastosPersonalesService.getCategoriaLabel(gasto.categoria)}</span>
                  </div>
                  {gasto.notas && (
                    <p className="text-sm text-gray-500 mt-1">{gasto.notas}</p>
                  )}
                </div>
              </div>

              <button
                onClick={() => onDelete(gasto.id!)}
                className="p-2 text-gray-400 hover:text-red-600"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GastoPuntualList;
