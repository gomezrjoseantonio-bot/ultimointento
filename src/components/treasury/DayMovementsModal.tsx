import React from 'react';
import { X, Edit2, Link, Trash2 } from 'lucide-react';
import { Movement } from '../../services/db';
import { formatEuro } from '../../utils/formatUtils';

interface DayMovementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  movements: Movement[];
  onMovementAction: (movement: Movement, action: 'edit' | 'link' | 'delete' | 'reconcile') => void;
}

/**
 * Treasury v1.2 - Day Movements Modal
 * 
 * Shows complete list of movements for a day with internal scroll
 * as specified in problem statement requirements
 */
const DayMovementsModal: React.FC<DayMovementsModalProps> = ({
  isOpen,
  onClose,
  date,
  movements,
  onMovementAction
}) => {
  if (!isOpen) return null;

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Get movement status display
  const getMovementStatus = (movement: Movement) => {
    if (movement.state === 'reconciled') {
      return { label: 'Conciliado', color: 'bg-blue-100 text-blue-800' };
    }
    
    if (movement.state === 'pending' || !movement.state) {
      return { label: 'No planificado', color: 'bg-gray-100 text-gray-800' };
    }
    
    if (movement.state === 'ignored') {
      return { label: 'Ignorado', color: 'bg-red-100 text-red-800' };
    }
    
    return { label: 'Confirmado', color: 'bg-green-100 text-green-800' };
  };

  // Calculate daily totals
  const dailyTotals = {
    ingresos: movements.filter(m => m.amount > 0).reduce((sum, m) => sum + m.amount, 0),
    gastos: movements.filter(m => m.amount < 0).reduce((sum, m) => sum + Math.abs(m.amount), 0),
    neto: movements.reduce((sum, m) => sum + m.amount, 0)
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'var(--bg)', opacity: 0.95 }}>
      <div className="bg-white shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Movimientos del día
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {formatDate(date)} • {movements.length} movimientos
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Daily Summary */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="btn-accent-horizon p-4 border border-green-200">
              <p className="text-sm text-green-600">Ingresos</p>
              <p className="text-xl font-bold text-green-700">
                {formatEuro(dailyTotals.ingresos)}
              </p>
            </div>
            <div className="btn-danger p-4 border border-red-200">
              <p className="text-sm text-red-600">Gastos</p>
              <p className="text-xl font-bold text-red-700">
                {formatEuro(dailyTotals.gastos)}
              </p>
            </div>
            <div className={`p-4 border ${
              dailyTotals.neto >= 0 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <p className={`text-sm ${
                dailyTotals.neto >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                Neto del día
              </p>
              <p className={`text-xl font-bold ${
                dailyTotals.neto >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {formatEuro(dailyTotals.neto)}
              </p>
            </div>
          </div>
        </div>

        {/* Movements List with Internal Scroll */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {movements.map((movement) => {
              const status = getMovementStatus(movement);
              
              return (
                <div
                  key={movement.id}
                  className="bg-white border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Movement Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                          {movement.source && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              {movement.source}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => onMovementAction(movement, 'edit')}
                            className="p-1 text-gray-400 hover:text-blue-600"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onMovementAction(movement, 'link')}
                            className="p-1 text-gray-400 hover:text-green-600"
                            title="Conciliar"
                          >
                            <Link className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onMovementAction(movement, 'delete')}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Movement Details */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Concepto</p>
                          <p className="font-medium text-gray-900">
                            {movement.description || 'Sin descripción'}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm text-gray-500">Contraparte</p>
                          <p className="font-medium text-gray-900">
                            {movement.counterparty || 'Sin especificar'}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm text-gray-500">Importe</p>
                          <p className={`text-lg font-bold ${
                            movement.amount >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {movement.amount >= 0 ? '+' : ''}{formatEuro(movement.amount)}
                          </p>
                        </div>
                      </div>

                      {/* Additional Details */}
                      {(movement.categoria || movement.reference) && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            {movement.categoria && (
                              <div>
                                <span className="text-gray-500">Categoría:</span>
                                <span className="ml-2 text-gray-700">{movement.categoria}</span>
                              </div>
                            )}
                            {movement.reference && (
                              <div>
                                <span className="text-gray-500">Referencia:</span>
                                <span className="ml-2 text-gray-700">{movement.reference}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {movements.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No hay movimientos en este día</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {movements.length} movimientos totales
            </p>
            <button
              onClick={onClose}
              className="btn-primary-horizon px-4 py-2"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayMovementsModal;