/**
 * ATLAS HORIZON - Movement Quick Actions Component
 * 
 * Implements quick actions per problem statement section 10:
 * - Marcar OK (confirm)
 * - Editar (edit details) 
 * - Enlazar factura (link invoice)
 * - Reclassify (change category)
 */

import React, { useState } from 'react';
import { Check, Edit2, Link2, Tag, MoreVertical } from 'lucide-react';
import { Movement } from '../../services/db';

interface QuickActionsProps {
  movement: Movement;
  onConfirm: (movement: Movement) => void;
  onEdit: (movement: Movement) => void;
  onLinkInvoice: (movement: Movement) => void;
  onReclassify: (movement: Movement) => void;
  className?: string;
}

export const MovementQuickActions: React.FC<QuickActionsProps> = ({
  movement,
  onConfirm,
  onEdit,
  onLinkInvoice,
  onReclassify,
  className = ''
}) => {
  const [showMenu, setShowMenu] = useState(false);

  // Determine which actions are available based on movement status
  const canConfirm = movement.unifiedStatus === 'previsto' || movement.unifiedStatus === 'no_planificado';
  const canEdit = true; // Most movements can be edited
  const canLinkInvoice = movement.unifiedStatus !== 'vencido';
  const canReclassify = movement.unifiedStatus === 'no_planificado' || movement.unifiedStatus === 'confirmado';

  const handleAction = (action: () => void) => {
    action();
    setShowMenu(false);
  };

  // Primary action button (most common action)
  const renderPrimaryAction = () => {
    if (canConfirm) {
      return (
        <button
          onClick={() => onConfirm(movement)}
          className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          title="Marcar como confirmado"
        >
          <Check className="w-4 h-4" />
        </button>
      );
    }

    if (canEdit) {
      return (
        <button
          onClick={() => onEdit(movement)}
          className="flex items-center justify-center w-8 h-8 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          title="Editar movimiento"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      );
    }

    return null;
  };

  // Secondary actions menu
  const renderSecondaryActions = () => {
    const secondaryActions = [];

    if (!canConfirm && canEdit) {
      secondaryActions.push({
        icon: <Edit2 className="w-4 h-4" />,
        label: 'Editar',
        action: () => onEdit(movement),
        enabled: true
      });
    }

    if (canLinkInvoice) {
      secondaryActions.push({
        icon: <Link2 className="w-4 h-4" />,
        label: 'Enlazar factura',
        action: () => onLinkInvoice(movement),
        enabled: true
      });
    }

    if (canReclassify) {
      secondaryActions.push({
        icon: <Tag className="w-4 h-4" />,
        label: 'Reclasificar',
        action: () => onReclassify(movement),
        enabled: true
      });
    }

    if (secondaryActions.length === 0) return null;

    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Más acciones"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {showMenu && (
          <>
            {/* Backdrop to close menu */}
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setShowMenu(false)}
            />
            
            {/* Actions menu */}
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
              <div className="py-1">
                {secondaryActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleAction(action.action)}
                    disabled={!action.enabled}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors
                      ${action.enabled 
                        ? 'text-gray-700 hover:bg-gray-50' 
                        : 'text-gray-400 cursor-not-allowed'
                      }
                    `}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {renderPrimaryAction()}
      {renderSecondaryActions()}
    </div>
  );
};

export default MovementQuickActions;