import React from 'react';
import { Pencil, Trash2, Power, PowerOff, Home, Car, Shield, Zap, Tv, Heart, GraduationCap, MoreHorizontal } from 'lucide-react';
import { GastoRecurrente, CategoriaGasto } from '../../../types/personal';
import { gastosPersonalesService } from '../../../services/gastosPersonalesService';

interface GastoRecurrenteListProps {
  gastos: GastoRecurrente[];
  onEdit: (gasto: GastoRecurrente) => void;
  onDelete: (id: number) => void;
  onToggleActivo: (id: number) => void;
}

const iconMap: Record<string, any> = {
  Home, Car, Shield, Zap, Tv, Heart, GraduationCap, MoreHorizontal
};

const GastoRecurrenteList: React.FC<GastoRecurrenteListProps> = ({
  gastos,
  onEdit,
  onDelete,
  onToggleActivo
}) => {
  const getCategoriaIcon = (categoria: CategoriaGasto) => {
    const iconName = gastosPersonalesService.getCategoriaIcon(categoria);
    const IconComponent = iconMap[iconName] || MoreHorizontal;
    return IconComponent;
  };

  if (gastos.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No hay gastos recurrentes registrados</p>
        <p className="text-sm text-gray-400 mt-1">
          Haz clic en "Nuevo Gasto" para crear tu primer gasto recurrente
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {gastos.map((gasto) => {
        const IconComponent = getCategoriaIcon(gasto.categoria);
        const frecuenciaText = {
          mensual: 'mes',
          bimestral: 'bimestre',
          trimestral: 'trimestre',
          semestral: 'semestre',
          anual: 'año'
        }[gasto.frecuencia];

        return (
          <div
            key={gasto.id}
            className={`p-4 border rounded-lg ${
              gasto.activo ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <IconComponent className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{gasto.nombre}</h4>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                    <span>
                      {new Intl.NumberFormat('es-ES', { 
                        style: 'currency', 
                        currency: 'EUR' 
                      }).format(gasto.importe)}/{frecuenciaText}
                    </span>
                    <span>·</span>
                    <span>Día {gasto.diaCobro}</span>
                    <span>·</span>
                    <span>{gastosPersonalesService.getCategoriaLabel(gasto.categoria)}</span>
                  </div>
                  {gasto.notas && (
                    <p className="text-sm text-gray-500 mt-1">{gasto.notas}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onToggleActivo(gasto.id!)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                  title={gasto.activo ? 'Desactivar' : 'Activar'}
                >
                  {gasto.activo ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => onEdit(gasto)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(gasto.id!)}
                  className="p-2 text-gray-400 hover:text-red-600"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GastoRecurrenteList;
