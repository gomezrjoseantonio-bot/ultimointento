import React from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';

interface Alerta {
  id: string;
  tipo: 'trabajo' | 'inmuebles' | 'inversiones' | 'personal';
  mensaje: string;
  urgencia: 'alta' | 'media' | 'baja';
  link: string;
  diasHastaVencimiento?: number;
}

interface AlertasSectionProps {
  alertas: Alerta[];
  onAlertClick?: (alerta: Alerta) => void;
}

/**
 * AlertasSection - Displays alerts requiring attention
 * 
 * Shows up to 5 alerts ordered by urgency:
 * - High priority (red)
 * - Medium priority (amber)
 * - Low priority (blue)
 * 
 * Each alert shows:
 * - Type icon (💼 work, 🏢 real estate, 📈 investments, 🏠 personal)
 * - Message
 * - Click to navigate to detail
 * 
 * 100% ATLAS Design Bible compliant
 */
const AlertasSection: React.FC<AlertasSectionProps> = ({
  alertas,
  onAlertClick
}) => {
  // Get icon based on alert type
  const getIcono = (tipo: string): string => {
    switch (tipo) {
      case 'trabajo':
        return '💼';
      case 'inmuebles':
        return '🏢';
      case 'inversiones':
        return '📈';
      case 'personal':
        return '🏠';
      default:
        return '📌';
    }
  };

  // Get color based on urgency
  const getUrgenciaColor = (urgencia: string): {
    bg: string;
    border: string;
    text: string;
  } => {
    switch (urgencia) {
      case 'alta':
        return {
          bg: 'rgba(220, 53, 69, 0.05)',
          border: 'var(--error)',
          text: 'var(--error)'
        };
      case 'media':
        return {
          bg: 'rgba(255, 193, 7, 0.05)',
          border: 'var(--warn)',
          text: 'var(--warn)'
        };
      case 'baja':
      default:
        return {
          bg: 'rgba(4, 44, 94, 0.05)',
          border: 'var(--atlas-blue)',
          text: 'var(--atlas-blue)'
        };
    }
  };

  // Show empty state if no alerts
  if (alertas.length === 0) {
    return (
      <div
        style={{
          padding: '24px',
          backgroundColor: 'white',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          fontFamily: 'var(--font-inter)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px'
          }}
        >
          <span
            role="img"
            aria-label="Alertas"
            style={{ fontSize: '1.25rem' }}
          >
            ⚠️
          </span>
          <h2
            style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--atlas-navy-1)',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            REQUIERE ATENCIÓN (0)
          </h2>
        </div>
        <div
          style={{
            textAlign: 'center',
            padding: '32px',
            color: 'var(--text-gray)'
          }}
        >
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            ✅ Todo en orden. No hay alertas pendientes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '24px',
        backgroundColor: 'white',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        fontFamily: 'var(--font-inter)'
      }}
    >
      {/* Section title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px'
        }}
      >
        <span
          role="img"
          aria-label="Alertas"
          style={{ fontSize: '1.25rem' }}
        >
          ⚠️
        </span>
        <h2
          style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: 'var(--atlas-navy-1)',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          REQUIERE ATENCIÓN ({alertas.length})
        </h2>
      </div>

      {/* Alerts list */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {alertas.map((alerta) => {
          const colors = getUrgenciaColor(alerta.urgencia);
          
          return (
            <button
              key={alerta.id}
              onClick={() => onAlertClick?.(alerta)}
              aria-label={`Ver alerta: ${alerta.mensaje}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                fontFamily: 'var(--font-inter)',
                width: '100%'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateX(4px)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateX(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Alert icon based on type */}
              <span
                style={{
                  fontSize: '1.25rem',
                  flexShrink: 0
                }}
                role="img"
                aria-label={alerta.tipo}
              >
                {getIcono(alerta.tipo)}
              </span>

              {/* Alert message */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'var(--atlas-navy-1)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {alerta.mensaje}
                </p>
              </div>

              {/* Days until due (if applicable) */}
              {alerta.diasHastaVencimiento !== undefined && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: colors.text,
                    padding: '2px 8px',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    flexShrink: 0
                  }}
                >
                  {alerta.diasHastaVencimiento > 0
                    ? `${alerta.diasHastaVencimiento}d`
                    : `${Math.abs(alerta.diasHastaVencimiento)}d vencido`}
                </span>
              )}

              {/* Chevron icon */}
              <ChevronRight
                size={18}
                strokeWidth={2}
                style={{
                  color: colors.text,
                  flexShrink: 0
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AlertasSection;
