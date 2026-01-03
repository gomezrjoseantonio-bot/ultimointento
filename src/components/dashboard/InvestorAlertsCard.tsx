import React from 'react';
import { AlertTriangle, Clock, FileText, FileCheck } from 'lucide-react';

export interface Alert {
  id: string;
  type: 'rent-pending' | 'document-unclassified' | 'contract-review' | 'invoice-pending';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  daysUntilDue?: number;
}

interface InvestorAlertsCardProps {
  alerts: Alert[];
  onAlertClick?: (alert: Alert) => void;
}

/**
 * InvestorAlertsCard - Bloque de Alertas para InvestorDashboard
 * 
 * Muestra hasta 5 alertas ordenadas por prioridad
 * Usa patrón HelperBanner de ATLAS Design Bible
 */
const InvestorAlertsCard: React.FC<InvestorAlertsCardProps> = ({
  alerts,
  onAlertClick
}) => {
  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'rent-pending':
        return <Clock size={16} style={{ color: 'var(--warn)' }} aria-hidden="true" />;
      case 'document-unclassified':
        return <FileText size={16} style={{ color: 'var(--warn)' }} aria-hidden="true" />;
      case 'contract-review':
        return <FileCheck size={16} style={{ color: 'var(--warn)' }} aria-hidden="true" />;
      case 'invoice-pending':
        return <AlertTriangle size={16} style={{ color: 'var(--error)' }} aria-hidden="true" />;
      default:
        return <AlertTriangle size={16} style={{ color: 'var(--warn)' }} aria-hidden="true" />;
    }
  };

  const getPriorityColor = (priority: Alert['priority']) => {
    switch (priority) {
      case 'high':
        return 'var(--error)';
      case 'medium':
        return 'var(--warn)';
      case 'low':
        return 'var(--text-gray)';
      default:
        return 'var(--text-gray)';
    }
  };

  // Mostrar máximo 5 alertas
  const displayAlerts = alerts.slice(0, 5);

  return (
    <div 
      style={{ 
        backgroundColor: 'var(--hz-card-bg)',
        border: '1px solid var(--hz-neutral-300)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 2px rgba(15, 61, 98, .06), 0 4px 12px rgba(15, 61, 98, .04)'
      }}
    >
      {/* Título */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <AlertTriangle 
          size={24} 
          strokeWidth={1.5} 
          style={{ color: 'var(--warn)' }} 
          aria-hidden="true"
        />
        <h3 
          style={{ 
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--atlas-navy-1)',
            margin: 0,
            fontFamily: 'var(--font-inter)'
          }}
        >
          Requiere atención
        </h3>
        <span 
          style={{ 
            backgroundColor: 'var(--warn)',
            color: 'white',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.875rem',
            fontWeight: 600,
            fontFamily: 'var(--font-inter)',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {alerts.length}
        </span>
      </div>

      {/* Lista de alertas */}
      {displayAlerts.length === 0 ? (
        <div 
          style={{ 
            textAlign: 'center',
            padding: '32px',
            color: 'var(--text-gray)',
            fontFamily: 'var(--font-inter)'
          }}
        >
          No hay alertas pendientes
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displayAlerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => onAlertClick?.(alert)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px',
                backgroundColor: 'var(--hz-warning-soft)',
                borderLeft: `3px solid ${getPriorityColor(alert.priority)}`,
                borderRadius: '8px',
                cursor: onAlertClick ? 'pointer' : 'default',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (onAlertClick) {
                  e.currentTarget.style.backgroundColor = '#FFF3DC';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--hz-warning-soft)';
              }}
              role={onAlertClick ? 'button' : undefined}
              tabIndex={onAlertClick ? 0 : undefined}
              aria-label={`Alerta: ${alert.title}. ${alert.description}`}
            >
              <div style={{ flexShrink: 0, marginTop: '2px' }}>
                {getAlertIcon(alert.type)}
              </div>
              <div style={{ flex: 1 }}>
                <div 
                  style={{ 
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--atlas-navy-1)',
                    marginBottom: '4px',
                    fontFamily: 'var(--font-inter)'
                  }}
                >
                  {alert.title}
                </div>
                <div 
                  style={{ 
                    fontSize: '0.875rem',
                    color: 'var(--text-gray)',
                    fontFamily: 'var(--font-inter)'
                  }}
                >
                  {alert.description}
                  {alert.daysUntilDue !== undefined && (
                    <span style={{ fontWeight: 500, color: 'var(--warn)' }}>
                      {' '}(vence en {alert.daysUntilDue} {alert.daysUntilDue === 1 ? 'día' : 'días'})
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InvestorAlertsCard;
