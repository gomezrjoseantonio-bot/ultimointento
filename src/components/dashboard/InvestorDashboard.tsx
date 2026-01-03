import React from 'react';
import InvestorLiquidityCard from './InvestorLiquidityCard';
import InvestorProfitabilityCard from './InvestorProfitabilityCard';
import InvestorAlertsCard, { Alert } from './InvestorAlertsCard';
import InvestorQuickActions from './InvestorQuickActions';

interface InvestorDashboardProps {
  // Liquidez
  currentBalance?: number;
  projection7d?: number;
  projection30d?: number;
  
  // Rentabilidad
  netReturn?: number;
  netReturnTrend?: 'up' | 'down' | 'neutral';
  monthlyCashflow?: number;
  occupancy?: number;
  
  // Alertas
  alerts?: Alert[];
  
  // Callbacks
  onRegisterPayment?: () => void;
  onUploadDocument?: () => void;
  onViewAll?: () => void;
  onAlertClick?: (alert: Alert) => void;
}

/**
 * InvestorDashboard - Vista simplificada para inversores
 * 
 * Muestra las 3 métricas clave sin necesidad de scroll:
 * 1. Liquidez (saldo actual + proyección)
 * 2. Rentabilidad (KPIs principales)
 * 3. Alertas (items que requieren atención)
 * 
 * Cumple 100% ATLAS Design Bible:
 * - Fuente Inter con tabular-nums
 * - Solo tokens CSS (var(--atlas-blue), etc.)
 * - Iconos lucide-react
 * - Formato ES-ES (1.234,56 €)
 * - Espaciado grid 4px
 * - Botones ATLAS
 */
const InvestorDashboard: React.FC<InvestorDashboardProps> = ({
  // Valores por defecto con datos de ejemplo
  currentBalance = 45230.00,
  projection7d = -2100.00,
  projection30d = 8500.00,
  netReturn = 5.2,
  netReturnTrend = 'up',
  monthlyCashflow = 1850.00,
  occupancy = 92,
  alerts = [
    {
      id: '1',
      type: 'rent-pending',
      title: 'Alquiler pendiente',
      description: 'Piso Centro',
      priority: 'high',
      daysUntilDue: 2
    },
    {
      id: '2',
      type: 'document-unclassified',
      title: 'Factura sin clasificar',
      description: 'Documento pendiente en Inbox',
      priority: 'medium'
    },
    {
      id: '3',
      type: 'contract-review',
      title: 'Revisión de contrato próxima',
      description: 'Contrato de alquiler Piso Norte',
      priority: 'medium',
      daysUntilDue: 15
    }
  ],
  onRegisterPayment,
  onUploadDocument,
  onViewAll,
  onAlertClick
}) => {
  return (
    <div 
      style={{ 
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
        fontFamily: 'var(--font-inter)'
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 
          style={{ 
            fontSize: '1.75rem',
            fontWeight: 600,
            color: 'var(--atlas-navy-1)',
            margin: 0,
            marginBottom: '8px',
            fontFamily: 'var(--font-inter)'
          }}
        >
          Dashboard Inversor
        </h1>
        <p 
          style={{ 
            fontSize: '1rem',
            color: 'var(--text-gray)',
            margin: 0,
            fontFamily: 'var(--font-inter)'
          }}
        >
          Visión completa de tu inversión inmobiliaria
        </p>
      </div>

      {/* Grid principal: 2 columnas en desktop, 1 en mobile */}
      <div 
        style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
          marginBottom: '24px'
        }}
      >
        {/* Bloque Liquidez */}
        <InvestorLiquidityCard
          currentBalance={currentBalance}
          projection7d={projection7d}
          projection30d={projection30d}
        />

        {/* Bloque Rentabilidad */}
        <InvestorProfitabilityCard
          netReturn={netReturn}
          netReturnTrend={netReturnTrend}
          monthlyCashflow={monthlyCashflow}
          occupancy={occupancy}
        />
      </div>

      {/* Bloque Alertas - Full width */}
      <div style={{ marginBottom: '24px' }}>
        <InvestorAlertsCard
          alerts={alerts}
          onAlertClick={onAlertClick}
        />
      </div>

      {/* Acciones rápidas */}
      <InvestorQuickActions
        onRegisterPayment={onRegisterPayment}
        onUploadDocument={onUploadDocument}
        onViewAll={onViewAll}
      />
    </div>
  );
};

export default InvestorDashboard;
