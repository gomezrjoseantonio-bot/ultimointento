import React from 'react';
import { Plus, Upload, ArrowRight } from 'lucide-react';

interface InvestorQuickActionsProps {
  onRegisterPayment?: () => void;
  onUploadDocument?: () => void;
  onViewAll?: () => void;
}

/**
 * InvestorQuickActions - Acciones rápidas para InvestorDashboard
 * 
 * Botones de acciones principales usando clases ATLAS
 * Cumple 100% ATLAS Design Bible
 */
const InvestorQuickActions: React.FC<InvestorQuickActionsProps> = ({
  onRegisterPayment,
  onUploadDocument,
  onViewAll
}) => {
  return (
    <div 
      style={{ 
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '16px 0'
      }}
    >
      {/* Registrar cobro - Primario */}
      <button
        className="atlas-btn-primary"
        onClick={onRegisterPayment}
        aria-label="Registrar cobro"
        style={{ fontFamily: 'var(--font-inter)' }}
      >
        <Plus size={16} strokeWidth={2} />
        Registrar cobro
      </button>

      {/* Subir documento - Secundario */}
      <button
        className="atlas-btn-secondary"
        onClick={onUploadDocument}
        aria-label="Subir documento"
        style={{ fontFamily: 'var(--font-inter)' }}
      >
        <Upload size={16} strokeWidth={2} />
        Subir documento
      </button>

      {/* Ver todo - Ghost */}
      <button
        className="atlas-btn-secondary"
        onClick={onViewAll}
        aria-label="Ver todo el dashboard completo"
        style={{ fontFamily: 'var(--font-inter)' }}
      >
        Ver todo
        <ArrowRight size={16} strokeWidth={2} />
      </button>
    </div>
  );
};

export default InvestorQuickActions;
