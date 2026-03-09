import React from 'react';
import { Plus, Eye } from 'lucide-react';

interface QuickActionsProps {
  onRegistrarIngreso?: () => void;
  onAñadirGasto?: () => void;
  onVerTodo?: () => void;
}

/**
 * QuickActions - Quick action buttons at the bottom of the dashboard
 * 
 * Provides 3 main actions:
 * 1. Register income/payment
 * 2. Add expense
 * 3. View all (navigate to full view)
 * 
 * 100% ATLAS Design Bible compliant:
 * - Primary button for main action
 * - Secondary button for secondary action
 * - Ghost button for tertiary action
 */
const QuickActions: React.FC<QuickActionsProps> = ({
  onRegistrarIngreso,
  onAñadirGasto,
  onVerTodo
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '24px',
        justifyContent: 'center',
        fontFamily: 'var(--font-inter)'
      }}
    >
      {/* Primary action: Register income */}
      <button
        onClick={onRegistrarIngreso}
        aria-label="Registrar ingreso"
        className="atlas-btn-primary"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 24px',
          backgroundColor: 'var(--atlas-blue)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontFamily: 'var(--font-inter)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#03356b';
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(4, 44, 94, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--atlas-blue)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <Plus size={18} strokeWidth={2.5} />
        Registrar ingreso
      </button>

      {/* Secondary action: Add expense */}
      <button
        onClick={onAñadirGasto}
        aria-label="Añadir gasto"
        className="atlas-btn-secondary"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 24px',
          backgroundColor: 'white',
          color: 'var(--atlas-blue)',
          border: '1px solid var(--atlas-blue)',
          borderRadius: '8px',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontFamily: 'var(--font-inter)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--atlas-blue)';
          e.currentTarget.style.color = 'white';
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(4, 44, 94, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'white';
          e.currentTarget.style.color = 'var(--atlas-blue)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <Plus size={18} strokeWidth={2.5} />
        Añadir gasto
      </button>

      {/* Tertiary action: View all */}
      <button
        onClick={onVerTodo}
        aria-label="Ver todo"
        className="atlas-btn-ghost"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 24px',
          backgroundColor: 'transparent',
          color: 'var(--atlas-navy-1)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontFamily: 'var(--font-inter)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg)';
          e.currentTarget.style.borderColor = 'var(--atlas-navy-1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        <Eye size={18} strokeWidth={2} />
        Ver todo
      </button>
    </div>
  );
};

export default QuickActions;
