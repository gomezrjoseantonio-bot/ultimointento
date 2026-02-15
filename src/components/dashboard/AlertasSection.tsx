import React from 'react';
import { ChevronRight, AlertCircle, Receipt, CalendarDays, FileText, Percent } from 'lucide-react';

interface Alerta {
  id: string;
  tipo: 'cobro' | 'contrato' | 'pago' | 'documento' | 'hipoteca' | 'ipc';
  titulo: string;
  descripcion: string;
  urgencia: 'alta' | 'media';
  diasVencimiento: number;
  importe?: number;
  link: string;
}

interface AlertasSectionProps {
  alertas: Alerta[];
  onAlertClick?: (alerta: Alerta) => void;
}

/**
 * AlertasSection - Displays alerts requiring attention
 * 
 * Shows prioritized alerts with:
 * - Type-specific icons (Receipt, CalendarDays, FileText, Percent)
 * - Title and description
 * - Days until/since due date
 * - Amount when applicable
 * - Only alta/media urgency (baja filtered out)
 * 
 * 100% ATLAS Design Bible compliant:
 * - Lucide icons only (NO emojis)
 * - Monochromatic + semantic colors
 */
const AlertasSection: React.FC<AlertasSectionProps> = ({
  alertas,
  onAlertClick
}) => {
  // Format currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Get icon based on alert type
  const getIcono = (tipo: string) => {
    const iconSize = 16;
    const iconStyle = { color: 'var(--atlas-blue)' };
    
    switch (tipo) {
      case 'cobro':
      case 'pago':
        return <Receipt size={iconSize} strokeWidth={1.5} style={iconStyle} aria-hidden="true" />;
      case 'contrato':
        return <CalendarDays size={iconSize} strokeWidth={1.5} style={iconStyle} aria-hidden="true" />;
      case 'documento':
        return <FileText size={iconSize} strokeWidth={1.5} style={iconStyle} aria-hidden="true" />;
      case 'hipoteca':
      case 'ipc':
        return <Percent size={iconSize} strokeWidth={1.5} style={iconStyle} aria-hidden="true" />;
      default:
        return <AlertCircle size={iconSize} strokeWidth={1.5} style={iconStyle} aria-hidden="true" />;
    }
  };

  // Get color based on urgency
  const getUrgenciaColor = (urgencia: string): {
    border: string;
    text: string;
  } => {
    switch (urgencia) {
      case 'alta':
        return {
          border: 'var(--alert)',
          text: 'var(--alert)'
        };
      case 'media':
        return {
          border: 'var(--warn)',
          text: 'var(--warn)'
        };
      default:
        return {
          border: 'var(--atlas-blue)',
          text: 'var(--atlas-blue)'
        };
    }
  };

  // Format days until/since due
  const formatDiasVencimiento = (dias: number): string => {
    if (dias < 0) {
      return `Hace ${Math.abs(dias)}d`;
    } else if (dias === 0) {
      return 'Hoy';
    } else {
      return `En ${dias}d`;
    }
  };

  // Show empty state if no alerts
  if (alertas.length === 0) {
    return (
      <div
        style={{
          padding: '24px',
          backgroundColor: 'var(--hz-card-bg)',
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
          <AlertCircle
            size={20}
            strokeWidth={1.5}
            style={{ color: 'var(--ok)' }}
            aria-hidden="true"
          />
          <h2
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-gray)',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            REQUIERE ATENCIÓN
          </h2>
        </div>
        <div
          style={{
            textAlign: 'center',
            padding: '24px',
            color: 'var(--text-gray)'
          }}
        >
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            Todo en orden. No hay alertas pendientes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '24px',
        backgroundColor: 'var(--hz-card-bg)',
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
        <AlertCircle
          size={20}
          strokeWidth={1.5}
          style={{ color: 'var(--warn)' }}
          aria-hidden="true"
        />
        <h2
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text-gray)',
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
          gap: '8px'
        }}
      >
        {alertas.map((alerta) => {
          const colors = getUrgenciaColor(alerta.urgencia);
          
          return (
            <button
              key={alerta.id}
              onClick={() => onAlertClick?.(alerta)}
              aria-label={`Ver alerta: ${alerta.titulo}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                backgroundColor: 'var(--bg)',
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
              <div style={{ flexShrink: 0 }}>
                {getIcono(alerta.tipo)}
              </div>

              {/* Alert content */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0
                }}
              >
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--atlas-navy-1)',
                    marginBottom: '2px'
                  }}
                >
                  {alerta.titulo}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-gray)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {alerta.descripcion}
                </div>
              </div>

              {/* Amount (if applicable) */}
              {alerta.importe !== undefined && (
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--atlas-navy-1)',
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0
                  }}
                >
                  {formatCurrency(alerta.importe)}
                </div>
              )}

              {/* Days until/since due */}
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: colors.text,
                  padding: '4px 8px',
                  backgroundColor: 'var(--hz-neutral-100)',
                  borderRadius: '4px',
                  flexShrink: 0,
                  minWidth: '60px',
                  textAlign: 'center'
                }}
              >
                {formatDiasVencimiento(alerta.diasVencimiento)}
              </div>

              {/* Chevron icon */}
              <ChevronRight
                size={18}
                strokeWidth={2}
                style={{
                  color: 'var(--text-gray)',
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
