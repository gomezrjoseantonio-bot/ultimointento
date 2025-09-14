import React, { useState } from 'react';
import { X, Check, Edit3, Trash2, FileText, Building, User } from 'lucide-react';
import { formatEuro } from '../../../../utils/formatUtils';
import { MovementStatusChip } from '../../../../components/treasury/MovementStatusChip';

interface Movement {
  id: number;
  accountId: number;
  date: string;
  description: string;
  counterparty?: string;
  amount: number;
  currency: string;
  source?: string;
  reference?: string;
  status?: 'previsto' | 'confirmado' | 'no_planificado';
  category?: string;
  scope?: 'personal' | 'inmueble';
  inmuebleId?: number;
  planned?: boolean;
  confirmed?: boolean;
  type?: 'Gasto' | 'Ingreso' | 'Transferencia';
}

interface MovementDrawerProps {
  movement: Movement;
  onClose: () => void;
  onUpdate: (movement: Movement) => void;
}

const MovementDrawer: React.FC<MovementDrawerProps> = ({
  movement,
  onClose,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedMovement, setEditedMovement] = useState<Movement>(movement);

  // Get movement status badge - now using color-only chips per requirements
  const getStatusBadge = (movement: Movement) => {
    // Map old status fields to new unified status
    let unifiedStatus: 'previsto' | 'confirmado' | 'no_planificado' = 'no_planificado';
    
    if (movement.confirmed || movement.status === 'confirmado') {
      unifiedStatus = 'confirmado';
    } else if (movement.planned || movement.status === 'previsto') {
      unifiedStatus = 'previsto';
    }
    
    // Determine movement type from amount for color coding
    const movementType = movement.amount >= 0 ? 'Ingreso' : 'Gasto';
    
    return (
      <MovementStatusChip 
        status={unifiedStatus}
        movementType={movementType}
        className="ml-2"
      />
    );
  };

  // Get movement type icon
  const getMovementIcon = (movement: Movement) => {
    if (movement.scope === 'personal') {
      return <User className="h-4 w-4 text-hz-neutral-700" />;
    }
    if (movement.scope === 'inmueble') {
      return <Building className="h-4 w-4 text-hz-neutral-700" />;
    }
    return <FileText className="h-4 w-4 text-hz-neutral-700" />;
  };

  // Handle confirm/unconfirm
  const handleConfirmToggle = () => {
    const updatedMovement: Movement = {
      ...movement,
      confirmed: !movement.confirmed,
      status: movement.confirmed ? 'previsto' : 'confirmado'
    };
    onUpdate(updatedMovement);
  };

  // Handle save edit
  const handleSaveEdit = () => {
    onUpdate(editedMovement);
    setIsEditing(false);
  };

  // Handle delete
  const handleDelete = () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este movimiento?')) {
      // TODO: Implement delete
      console.log('Delete movement:', movement.id);
      onClose();
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-200"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-96 bg-hz-card-bg shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-hz-neutral-300">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-hz-neutral-900">
              Detalle del movimiento
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-hz-neutral-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-hz-neutral-700" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getMovementIcon(movement)}
                <span className="text-sm text-hz-neutral-700">
                  {formatDate(movement.date)}
                </span>
              </div>
              {getStatusBadge(movement)}
            </div>

            {/* Amount */}
            <div className="text-center py-4">
              <div className={`text-2xl font-bold ${
                movement.amount >= 0 ? 'text-hz-success' : 'text-hz-error'
              }`}>
                {formatEuro(movement.amount)}
              </div>
              <div className="text-sm text-hz-neutral-700 mt-1">
                {movement.currency}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-4">
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-hz-neutral-900 mb-1">
                Descripción
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedMovement.description}
                  onChange={(e) => setEditedMovement({
                    ...editedMovement,
                    description: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-hz-neutral-300 rounded-lg focus:ring-2 focus:ring-hz-primary focus:border-transparent"
                />
              ) : (
                <p className="text-hz-neutral-700 bg-hz-neutral-100 px-3 py-2 rounded-lg">
                  {movement.description || 'Sin descripción'}
                </p>
              )}
            </div>

            {/* Counterparty */}
            {movement.counterparty && (
              <div>
                <label className="block text-sm font-medium text-hz-neutral-900 mb-1">
                  Contraparte
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedMovement.counterparty || ''}
                    onChange={(e) => setEditedMovement({
                      ...editedMovement,
                      counterparty: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-hz-neutral-300 rounded-lg focus:ring-2 focus:ring-hz-primary focus:border-transparent"
                  />
                ) : (
                  <p className="text-hz-neutral-700 bg-hz-neutral-100 px-3 py-2 rounded-lg">
                    {movement.counterparty}
                  </p>
                )}
              </div>
            )}

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-hz-neutral-900 mb-1">
                Categoría
              </label>
              {isEditing ? (
                <select
                  value={editedMovement.category || ''}
                  onChange={(e) => setEditedMovement({
                    ...editedMovement,
                    category: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-hz-neutral-300 rounded-lg focus:ring-2 focus:ring-hz-primary focus:border-transparent"
                >
                  <option value="">Sin categoría</option>
                  <option value="Alimentación">Alimentación</option>
                  <option value="Transporte">Transporte</option>
                  <option value="Vivienda">Vivienda</option>
                  <option value="Salud">Salud</option>
                  <option value="Entretenimiento">Entretenimiento</option>
                  <option value="Personal">Personal</option>
                  <option value="Inversión">Inversión</option>
                  <option value="Otros">Otros</option>
                </select>
              ) : (
                <p className="text-hz-neutral-700 bg-hz-neutral-100 px-3 py-2 rounded-lg">
                  {movement.category || 'Sin categoría'}
                </p>
              )}
            </div>

            {/* Scope */}
            <div>
              <label className="block text-sm font-medium text-hz-neutral-900 mb-1">
                Ámbito
              </label>
              {isEditing ? (
                <select
                  value={editedMovement.scope || ''}
                  onChange={(e) => setEditedMovement({
                    ...editedMovement,
                    scope: e.target.value as 'personal' | 'inmueble'
                  })}
                  className="w-full px-3 py-2 border border-hz-neutral-300 rounded-lg focus:ring-2 focus:ring-hz-primary focus:border-transparent"
                >
                  <option value="">Sin especificar</option>
                  <option value="personal">Personal</option>
                  <option value="inmueble">Inmueble</option>
                </select>
              ) : (
                <p className="text-hz-neutral-700 bg-hz-neutral-100 px-3 py-2 rounded-lg">
                  {movement.scope === 'personal' ? 'Personal' : 
                   movement.scope === 'inmueble' ? 'Inmueble' : 'Sin especificar'}
                </p>
              )}
            </div>

            {/* Reference */}
            {movement.reference && (
              <div>
                <label className="block text-sm font-medium text-hz-neutral-900 mb-1">
                  Referencia
                </label>
                <p className="text-hz-neutral-700 bg-hz-neutral-100 px-3 py-2 rounded-lg text-sm font-mono">
                  {movement.reference}
                </p>
              </div>
            )}

            {/* Source */}
            {movement.source && (
              <div>
                <label className="block text-sm font-medium text-hz-neutral-900 mb-1">
                  Origen
                </label>
                <p className="text-hz-neutral-700 bg-hz-neutral-100 px-3 py-2 rounded-lg">
                  {movement.source === 'import' ? 'Importado de extracto' : 
                   movement.source === 'manual' ? 'Introducido manualmente' : 
                   movement.source}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="border-t border-hz-neutral-300 pt-6 space-y-3">
            {isEditing ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 bg-hz-primary text-white px-4 py-2 rounded-lg hover:bg-hz-primary- light transition-colors"
                >
                  Guardar cambios
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedMovement(movement);
                  }}
                  className="px-4 py-2 border border-hz-neutral-300 rounded-lg hover:bg-hz-neutral-100 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                {/* Confirm/Unconfirm */}
                <button
                  onClick={handleConfirmToggle}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    movement.confirmed 
                      ? 'bg-hz-neutral-100 text-hz-neutral-700 hover:bg-hz-neutral-200' 
                      : 'bg-hz-success text-white hover:bg-hz-success-dark'
                  }`}
                >
                  <Check className="h-4 w-4" />
                  {movement.confirmed ? 'Desconfirmar' : 'Confirmar'}
                </button>

                {/* Edit */}
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-hz-neutral-300 rounded-lg hover:bg-hz-neutral-100 transition-colors"
                >
                  <Edit3 className="h-4 w-4" />
                  Editar
                </button>

                {/* Delete */}
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-hz-error text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovementDrawer;