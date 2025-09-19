import React, { useState } from 'react';
import { X, Edit3, Check, EyeOff } from 'lucide-react';
import { Movement } from '../../../../services/db';
import { formatEuro } from '../../../../utils/formatUtils';

/**
 * ATLAS HORIZON - Movement Drawer for Day View
 * 
 * Implementation per problem statement:
 * - Shows movements for a specific day
 * - Color coding: Income=green, Expense=red, Conciliated=blue, No match=gray
 * - Actions: Conciliar manualmente, Editar, Ignorar
 * - States: sin_match, match_manual, match_automatico
 */

interface CalendarDay {
  date: Date;
  dateStr: string;
  movements: Movement[];
}

interface MovementDrawerProps {
  day: CalendarDay;
  onClose: () => void;
  onMovementUpdate: () => void;
}

interface EditingMovement {
  id: number;
  category?: string;
  counterparty?: string;
  description: string;
  notes?: string;
}

const MovementDrawer: React.FC<MovementDrawerProps> = ({
  day,
  onClose,
  onMovementUpdate,
}) => {
  const [editingMovement, setEditingMovement] = useState<EditingMovement | null>(null);

  // Get movement status color classes
  const getMovementStatusClass = (movement: Movement) => {
    // According to requirements:
    // - Income (amount > 0) → green (success)
    // - Expense (amount < 0) → red (error)  
    // - sin_match → gray (muted)
    // - match_manual or match_automatico → blue (info/conciliated)
    
    if (movement.status === 'conciliado' || movement.unifiedStatus === 'conciliado') {
      return {
        bg: 'bg-blue-50',
        text: 'text-hz-info',
        border: 'border-blue-200'
      };
    }
    
    if (movement.amount > 0) {
      return {
        bg: 'bg-green-50',
        text: 'text-hz-success', 
        border: 'border-green-200'
      };
    }
    
    if (movement.amount < 0) {
      return {
        bg: 'bg-red-50',
        text: 'text-hz-error',
        border: 'border-red-200'
      };
    }
    
    // sin_match or unknown state
    return {
      bg: 'bg-gray-50',
      text: 'text-hz-neutral-500',
      border: 'border-gray-200'
    };
  };

  // Get movement status text
  const getMovementStatusText = (movement: Movement) => {
    if (movement.status === 'conciliado' || movement.unifiedStatus === 'conciliado') {
      return 'Conciliado';
    }
    if (movement.unifiedStatus === 'confirmado') {
      return 'Confirmado';
    }
    if (movement.unifiedStatus === 'previsto') {
      return 'Previsto';
    }
    if (movement.unifiedStatus === 'vencido') {
      return 'Vencido';
    }
    if (movement.unifiedStatus === 'no_planificado') {
      return 'No planificado';
    }
    return 'Sin conciliar';
  };

  // Handle manual conciliation
  const handleConciliar = async (movement: Movement) => {
    try {
      // TODO: Implement conciliation logic
      // For now, just update status to conciliado
      const updatedMovement = {
        ...movement,
        status: 'conciliado' as const,
        unifiedStatus: 'conciliado' as const
      };
      
      // TODO: Save to database
      console.log('Conciliating movement:', updatedMovement);
      
      onMovementUpdate();
    } catch (error) {
      console.error('Error conciliating movement:', error);
    }
  };

  // Handle edit movement
  const handleEdit = (movement: Movement) => {
    const categoryString = typeof movement.category === 'object' && movement.category?.tipo 
      ? movement.category.tipo 
      : typeof movement.category === 'string' 
        ? movement.category 
        : '';
        
    setEditingMovement({
      id: movement.id!,
      category: categoryString,
      counterparty: movement.counterparty,
      description: movement.description,
      notes: '' // TODO: Add notes field to Movement
    });
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editingMovement) return;
    
    try {
      // TODO: Implement save edit logic
      console.log('Saving edited movement:', editingMovement);
      
      setEditingMovement(null);
      onMovementUpdate();
    } catch (error) {
      console.error('Error saving movement edit:', error);
    }
  };

  // Handle ignore movement
  const handleIgnore = async (movement: Movement) => {
    try {
      // TODO: Implement ignore logic
      // Set movement as ignored (won't count in totals)
      const updatedMovement = {
        ...movement,
        status: 'ignored' as const
      };
      
      console.log('Ignoring movement:', updatedMovement);
      
      onMovementUpdate();
    } catch (error) {
      console.error('Error ignoring movement:', error);
    }
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end md:items-center justify-center">
      <div className="bg-white w-full md:w-2xl md:max-w-2xl h-screen md:h-auto md:max-h-[80vh] md:rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-hz-neutral-300">
          <div>
            <h2 className="text-lg font-semibold text-hz-neutral-900">
              Movimientos del día
            </h2>
            <p className="text-sm text-hz-neutral-600 mt-1">
              {formatDisplayDate(day.date)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-hz-neutral-600 hover:text-hz-neutral-900"
          >
            <X size={20} />
          </button>
        </div>

        {/* Movement List */}
        <div className="flex-1 overflow-y-auto max-h-[calc(80vh-100px)]">
          {day.movements.length === 0 ? (
            <div className="p-6 text-center text-hz-neutral-500">
              No hay movimientos en este día
            </div>
          ) : (
            <div className="divide-y divide-hz-neutral-200">
              {day.movements.map((movement) => {
                const statusClass = getMovementStatusClass(movement);
                const isEditing = editingMovement?.id === movement.id;
                
                return (
                  <div key={movement.id} className="p-6">
                    <div className={`rounded-lg border p-4 ${statusClass.bg} ${statusClass.border}`}>
                      {/* Movement Info */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm text-hz-neutral-600">
                              {movement.date}
                            </span>
                            <span className={`text-xs px-2 py-1 ${statusClass.bg} ${statusClass.text}`}>
                              {getMovementStatusText(movement)}
                            </span>
                          </div>
                          
                          {isEditing ? (
                            <div className="space-y-3">
                              <input
                                type="text"
                                value={editingMovement?.description || ''}
                                onChange={(e) => setEditingMovement(prev => prev ? {...prev, description: e.target.value} : null)}
                                className="w-full p-2 border border-hz-neutral-300 rounded text-sm"
                                placeholder="Descripción"
                              />
                              <input
                                type="text"
                                value={editingMovement?.counterparty || ''}
                                onChange={(e) => setEditingMovement(prev => prev ? {...prev, counterparty: e.target.value} : null)}
                                className="w-full p-2 border border-hz-neutral-300 rounded text-sm"
                                placeholder="Contraparte"
                              />
                              <input
                                type="text"
                                value={editingMovement?.category || ''}
                                onChange={(e) => setEditingMovement(prev => prev ? {...prev, category: e.target.value} : null)}
                                className="w-full p-2 border border-hz-neutral-300 rounded text-sm"
                                placeholder="Categoría"
                              />
                            </div>
                          ) : (
                            <>
                              <h3 className="font-medium text-hz-neutral-900 mb-1">
                                {movement.description}
                              </h3>
                              {movement.counterparty && (
                                <p className="text-sm text-hz-neutral-600">
                                  {movement.counterparty}
                                </p>
                              )}
                              {(movement.category?.tipo || movement.category) && (
                                <p className="text-sm text-hz-neutral-600">
                                  Categoría: {typeof movement.category === 'object' ? movement.category.tipo : movement.category}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                        
                        <div className="text-right ml-4">
                          <div className={`text-lg font-semibold ${
                            movement.amount >= 0 ? 'text-hz-success' : 'text-hz-error'
                          }`}>
                            {formatEuro(movement.amount)}
                          </div>
                          {movement.reference && (
                            <div className="text-xs text-hz-neutral-500 mt-1">
                              Ref: {movement.reference}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t border-hz-neutral-200">
                        {isEditing ? (
                          <>
                            <button
                              onClick={handleSaveEdit}
                              className="btn-accent-horizon flex items-center gap-1 px-3 py-1 text-sm text-green-700 rounded"
                            >
                              <Check size={14} />
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditingMovement(null)}
                              className="flex items-center gap-1 px-3 py-1 text-sm text-hz-neutral-700 bg-hz-neutral-100 rounded"
                            >
                              <X size={14} />
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            {movement.status !== 'conciliado' && movement.unifiedStatus !== 'conciliado' && (
                              <button
                                onClick={() => handleConciliar(movement)}
                                className="btn-primary-horizon flex items-center gap-1 px-3 py-1 text-sm text-blue-700 rounded"
                              >
                                <Check size={14} />
                                Conciliar
                              </button>
                            )}
                            
                            <button
                              onClick={() => handleEdit(movement)}
                              className="flex items-center gap-1 px-3 py-1 text-sm text-hz-neutral-700 bg-hz-neutral-100 rounded"
                            >
                              <Edit3 size={14} />
                              Editar
                            </button>
                            
                            <button
                              onClick={() => handleIgnore(movement)}
                              className="flex items-center gap-1 px-3 py-1 text-sm text-orange-700 bg-orange-100 rounded"
                            >
                              <EyeOff size={14} />
                              Ignorar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MovementDrawer;