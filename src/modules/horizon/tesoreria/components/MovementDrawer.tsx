import React, { useState, useEffect } from 'react';
import { X, Check, Edit3, Trash2, FileText, Building, User, Target, Sparkles } from 'lucide-react';
import { formatEuro } from '../../../../utils/formatUtils';
import { MovementStatusChip } from '../../../../components/treasury/MovementStatusChip';
import { Movement, initDB, Property } from '../../../../services/db';
import { performManualReconciliation } from '../../../../services/movementLearningService';
import toast from 'react-hot-toast';
import { confirmDelete } from '../../../../services/confirmationService';

interface MovementDrawerProps {
  movement: Movement;
  onClose: () => void;
  onUpdate: (movement: Movement) => void;
}

// Categories for reconciliation
const CATEGORIES = [
  'Alquiler',
  'Suministros', 
  'IBI',
  'Comunidad',
  'Seguros',
  'Intereses',
  'Reparación y Conservación',
  'Mejora',
  'Mobiliario',
  'Gastos Personales',
  'Ingresos Varios',
  'Otros'
];

const MovementDrawer: React.FC<MovementDrawerProps> = ({
  movement,
  onClose,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedMovement, setEditedMovement] = useState<Movement>(movement);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconciliationData, setReconciliationData] = useState({
    categoria: movement.categoria || '',
    ambito: movement.ambito || 'PERSONAL',
    inmuebleId: movement.inmuebleId || ''
  });
  const [properties, setProperties] = useState<Property[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load properties for inmueble selection
  useEffect(() => {
    const loadProperties = async () => {
      try {
        const db = await initDB();
        const allProperties = await db.getAll('properties');
        setProperties(allProperties.filter(p => p.state === 'activo'));
      } catch (error) {
        console.error('Error loading properties:', error);
      }
    };
    loadProperties();
  }, []);

  // Get movement status badge with v1.1 statusConciliacion
  const getStatusBadge = (movement: Movement) => {
    // Use new statusConciliacion field
    const status = movement.statusConciliacion || 'sin_match';
    const movementType = movement.amount >= 0 ? 'Ingreso' : 'Gasto';
    
    return (
      <div className="flex items-center gap-2">
        <MovementStatusChip 
          status={status === 'sin_match' ? 'no_planificado' : 'confirmado'}
          movementType={movementType}
          className="ml-2"
        />
        {/* V1.1: Auto chip for auto-categorized movements */}
        {movement.categoria && status === 'sin_match' && (
          <span className="atlas-atlas-atlas-btn-primary inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-700">
            <Sparkles className="w-3 h-3" />
            auto
          </span>
        )}
      </div>
    );
  };

  // Handle manual reconciliation
  const handleManualReconciliation = async () => {
    if (!reconciliationData.categoria || !reconciliationData.ambito) {
      toast.error('Por favor, selecciona categoría y ámbito');
      return;
    }

    if (reconciliationData.ambito === 'INMUEBLE' && !reconciliationData.inmuebleId) {
      toast.error('Por favor, selecciona un inmueble');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await performManualReconciliation(
        movement.id!,
        reconciliationData.categoria,
        reconciliationData.ambito,
        reconciliationData.inmuebleId || undefined
      );

      // Update the movement
      const updatedMovement: Movement = {
        ...movement,
        categoria: reconciliationData.categoria,
        ambito: reconciliationData.ambito,
        inmuebleId: reconciliationData.inmuebleId || undefined,
        statusConciliacion: 'match_manual',
        updatedAt: new Date().toISOString()
      };

      onUpdate(updatedMovement);
      setIsReconciling(false);
      
      toast.success(
        `Movimiento conciliado manualmente. ${result.appliedToSimilar > 0 ? 
          `Se aplicó la regla a ${result.appliedToSimilar} movimientos similares.` : ''}`
      );
    } catch (error) {
      console.error('Error in manual reconciliation:', error);
      toast.error('Error al realizar la conciliación manual');
    } finally {
      setIsProcessing(false);
    }
  };

  // Get movement type icon
  const getMovementIcon = (movement: Movement) => {
    if (movement.ambito === 'PERSONAL') {
      return <User className="h-4 w-4 text-hz-neutral-700" />;
    }
    if (movement.ambito === 'INMUEBLE') {
      return <Building className="h-4 w-4 text-hz-neutral-700" />;
    }
    return <FileText className="h-4 w-4 text-hz-neutral-700" />;
  };

  // Handle save edit  
  const handleSaveEdit = () => {
    onUpdate(editedMovement);
    setIsEditing(false);
  };

  // Handle delete
  const handleDelete = async () => {
    const confirmed = await confirmDelete('este movimiento');
    if (confirmed) {
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
              className="p-2"
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
                  className="w-full px-3 py-2 border border-hz-neutral-300 focus:ring-2 focus:ring-hz-primary focus:border-transparent"
                />
              ) : (
                <p className="text-hz-neutral-700 bg-hz-neutral-100 px-3 py-2">
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
                    className="w-full px-3 py-2 border border-hz-neutral-300 focus:ring-2 focus:ring-hz-primary focus:border-transparent"
                  />
                ) : (
                  <p className="text-hz-neutral-700 bg-hz-neutral-100 px-3 py-2">
                    {movement.counterparty}
                  </p>
                )}
              </div>
            )}

            {/* V1.1: Category (updated) */}
            <div>
              <label className="block text-sm font-medium text-hz-neutral-900 mb-1">
                Categoría
              </label>
              <p className="text-hz-neutral-700 bg-hz-neutral-100 px-3 py-2">
                {movement.categoria || 'Sin categoría'}
              </p>
            </div>

            {/* V1.1: Scope (ambito) */}
            <div>
              <label className="block text-sm font-medium text-hz-neutral-900 mb-1">
                Ámbito
              </label>
              <div className="flex items-center gap-2">
                <p className="text-hz-neutral-700 bg-hz-neutral-100 px-3 py-2 flex-1">
                  {movement.ambito === 'PERSONAL' ? 'Personal' : 'Inmueble'}
                </p>
                {movement.ambito === 'INMUEBLE' && movement.inmuebleId && (
                  <Building className="w-4 h-4 text-hz-neutral-500" />
                )}
              </div>
            </div>

            {/* V1.1: Reconciliation status */}
            <div>
              <label className="block text-sm font-medium text-hz-neutral-900 mb-1">
                Estado de Conciliación
              </label>
              <div className="flex items-center gap-2">
                <p className="text-hz-neutral-700 bg-hz-neutral-100 px-3 py-2 flex-1">
                  {movement.statusConciliacion === 'sin_match' ? 'Sin conciliar' :
                   movement.statusConciliacion === 'match_automatico' ? 'Conciliado automáticamente' :
                   movement.statusConciliacion === 'match_manual' ? 'Conciliado manualmente' : 'Sin conciliar'}
                </p>
                {movement.statusConciliacion === 'match_automatico' && (
                  <span className="atlas-atlas-atlas-btn-primary inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-700">
                    <Sparkles className="w-3 h-3" />
                    auto
                  </span>
                )}
              </div>
            </div>

            {/* V1.1: Reconciliation modal */}
            {isReconciling && (
              <div className="btn-secondary-horizon atlas-atlas-atlas-btn-primary ">
                <h4 className="font-medium text-blue-900 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Conciliación Manual
                </h4>
                
                {/* Category selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría *
                  </label>
                  <select
                    value={reconciliationData.categoria}
                    onChange={(e) => setReconciliationData(prev => ({ ...prev, categoria: e.target.value }))}
                    className="btn-secondary-horizon w-full px-3 py-2 "
                    required
                  >
                    <option value="">Seleccionar categoría</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Scope selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ámbito *
                  </label>
                  <select
                    value={reconciliationData.ambito}
                    onChange={(e) => setReconciliationData(prev => ({ 
                      ...prev, 
                      ambito: e.target.value as 'PERSONAL' | 'INMUEBLE',
                      inmuebleId: e.target.value === 'PERSONAL' ? '' : prev.inmuebleId
                    }))}
                    className="btn-secondary-horizon w-full px-3 py-2 "
                    required
                  >
                    <option value="PERSONAL">Personal</option>
                    <option value="INMUEBLE">Inmueble</option>
                  </select>
                </div>

                {/* Property selection (if INMUEBLE) */}
                {reconciliationData.ambito === 'INMUEBLE' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Inmueble *
                    </label>
                    <select
                      value={reconciliationData.inmuebleId}
                      onChange={(e) => setReconciliationData(prev => ({ ...prev, inmuebleId: e.target.value }))}
                      className="btn-secondary-horizon w-full px-3 py-2 "
                      required
                    >
                      <option value="">Seleccionar inmueble</option>
                      {properties.map(property => (
                        <option key={property.id} value={property.id?.toString() || ''}>
                          {property.alias}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleManualReconciliation}
                    disabled={isProcessing || !reconciliationData.categoria || !reconciliationData.ambito || 
                             (reconciliationData.ambito === 'INMUEBLE' && !reconciliationData.inmuebleId)}
                    className="atlas-atlas-atlas-btn-primary flex-1 px-4 py-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? 'Procesando...' : 'Conciliar'}
                  </button>
                  <button
                    onClick={() => setIsReconciling(false)}
                    disabled={isProcessing}
                    className="px-4 py-2 border border-gray-300 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Reference */}
            {movement.reference && (
              <div>
                <label className="block text-sm font-medium text-hz-neutral-900 mb-1">
                  Referencia
                </label>
                <p className="text-hz-neutral-700 bg-hz-neutral-100 px-3 py-2 text-sm font-mono">
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
                <p className="text-hz-neutral-700 bg-hz-neutral-100 px-3 py-2">
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
                  className="flex-1 bg-hz-primary px-4 py-2 light"
                >
                  Guardar cambios
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedMovement(movement);
                  }}
                  className="px-4 py-2 border border-hz-neutral-300"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                {/* V1.1: Manual Reconciliation button (only for sin_match) */}
                {movement.statusConciliacion === 'sin_match' && (
                  <button
                    onClick={() => {
                      setReconciliationData({
                        categoria: movement.categoria || '',
                        ambito: movement.ambito || 'PERSONAL',
                        inmuebleId: movement.inmuebleId || ''
                      });
                      setIsReconciling(true);
                    }}
                    className="atlas-atlas-atlas-btn-primary w-full flex items-center justify-center gap-2 px-4 py-2"
                  >
                    <Target className="h-4 w-4" />
                    Conciliar
                  </button>
                )}

                {/* Edit */}
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-hz-neutral-300"
                >
                  <Edit3 className="h-4 w-4" />
                  Editar
                </button>

                {/* Delete */}
                <button
                  onClick={handleDelete}
                  className="atlas-atlas-atlas-btn-destructive w-full flex items-center justify-center gap-2 px-4 py-2 bg-hz-error hover:"
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