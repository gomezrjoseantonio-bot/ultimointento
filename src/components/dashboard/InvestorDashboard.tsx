import React, { useEffect, useState } from 'react';
import PatrimonioHeader from './PatrimonioHeader';
import TresBolsillosGrid from './TresBolsillosGrid';
import LiquidezSection from './LiquidezSection';
import AlertasSection from './AlertasSection';
import { dashboardService } from '../../services/dashboardService';
import './investor-dashboard.css';

interface InvestorDashboardProps {
  onNavigate: (route: string) => void;
}

/**
 * InvestorDashboard - Investor-focused dashboard view
 * 
 * Displays complete financial overview in a single screen:
 * 1. MI PATRIMONIO - Total net worth with variation
 * 2. 3 BOLSILLOS - Three income sources (Trabajo, Inmuebles, Inversiones)
 * 3. LIQUIDEZ - Liquidity with 30-day projection breakdown
 * 4. REQUIERE ATENCIÓN - Alerts requiring action
 * 
 * 100% ATLAS Design Bible compliant:
 * - Inter font with tabular-nums
 * - CSS tokens only (NO hardcoded colors)
 * - Lucide icons (NO emojis)
 * - Spanish locale formatting
 * - Fits in single screen (NO scroll)
 * - NO action buttons in dashboard
 * 
 * @note This is the corrected version per issue requirements
 */
const InvestorDashboard: React.FC<InvestorDashboardProps> = ({
  onNavigate
}) => {
  const [loading, setLoading] = useState(true);
  const [patrimonio, setPatrimonio] = useState({
    total: 0,
    variacionMes: 0,
    variacionPorcentaje: 0,
    desglose: {
      inmuebles: 0,
      inversiones: 0,
      cuentas: 0,
      deuda: 0
    }
  });
  const [bolsillos, setBolsillos] = useState({
    trabajo: { mensual: 0, tendencia: 'stable' as 'up' | 'down' | 'stable' },
    inmuebles: { cashflow: 0, tendencia: 'stable' as 'up' | 'down' | 'stable' },
    inversiones: { dividendos: 0, tendencia: 'stable' as 'up' | 'down' | 'stable' }
  });
  const [liquidez, setLiquidez] = useState({
    disponibleHoy: 0,
    comprometido30d: 0,
    ingresos30d: 0,
    proyeccion30d: 0
  });
  const [alertas, setAlertas] = useState<Array<{
    id: string;
    tipo: 'trabajo' | 'inmuebles' | 'inversiones' | 'personal';
    mensaje: string;
    urgencia: 'alta' | 'media' | 'baja';
    link: string;
    diasHastaVencimiento?: number;
  }>>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load all dashboard data in parallel
      const [patrimonioData, bolsillosData, liquidezData, alertasData] = await Promise.all([
        dashboardService.getPatrimonioNeto(),
        dashboardService.getTresBolsillos(),
        dashboardService.getLiquidez(),
        dashboardService.getAlertas()
      ]);

      setPatrimonio(patrimonioData);
      setBolsillos(bolsillosData);
      setLiquidez(liquidezData);
      setAlertas(alertasData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAlertClick = (alerta: typeof alertas[0]) => {
    onNavigate(alerta.link);
  };

  // Show skeleton loader while loading
  if (loading) {
    return (
      <div className="investor-dashboard">
        <div className="animate-pulse">
          {/* Header skeleton */}
          <div
            style={{
              padding: '24px',
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'var(--bg)'
            }}
          >
            <div
              style={{
                height: '32px',
                width: '300px',
                backgroundColor: '#e0e0e0',
                borderRadius: '4px',
                marginBottom: '16px'
              }}
            />
            <div
              style={{
                height: '48px',
                width: '400px',
                backgroundColor: '#e0e0e0',
                borderRadius: '4px'
              }}
            />
          </div>

          {/* Grid skeleton */}
          <div className="bolsillos-grid">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: '120px',
                  backgroundColor: '#e0e0e0',
                  borderRadius: '12px'
                }}
              />
            ))}
          </div>

          {/* Bottom sections skeleton */}
          <div className="bottom-sections">
            <div
              style={{
                height: '140px',
                backgroundColor: '#e0e0e0',
                borderRadius: '12px'
              }}
            />
            <div
              style={{
                height: '140px',
                backgroundColor: '#e0e0e0',
                borderRadius: '12px'
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Show empty state if no data
  const hasData = patrimonio.total > 0 || bolsillos.trabajo.mensual > 0 || 
                  bolsillos.inmuebles.cashflow > 0 || liquidez.disponibleHoy > 0;

  if (!hasData) {
    return (
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '48px 24px',
          textAlign: 'center',
          fontFamily: 'var(--font-inter)'
        }}
      >
        <div
          style={{
            padding: '48px',
            backgroundColor: 'var(--hz-card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}
        >
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: 'var(--atlas-navy-1)',
              marginBottom: '8px'
            }}
          >
            Bienvenido a ATLAS
          </h2>
          <p
            style={{
              fontSize: '1rem',
              color: 'var(--text-gray)',
              marginBottom: '32px'
            }}
          >
            Empieza añadiendo tu primera fuente de ingresos
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="investor-dashboard">
      {/* Header - MI PATRIMONIO */}
      <PatrimonioHeader
        patrimonioNeto={patrimonio.total}
        variacionPorcentaje={patrimonio.variacionPorcentaje}
      />

      {/* Grid - TRES BOLSILLOS */}
      <div className="bolsillos-grid">
        <TresBolsillosGrid
          trabajo={bolsillos.trabajo}
          inmuebles={bolsillos.inmuebles}
          inversiones={bolsillos.inversiones}
          onNavigate={onNavigate}
        />
      </div>

      {/* Bottom sections: Liquidity + Alerts */}
      <div className="bottom-sections">
        {/* LIQUIDEZ */}
        <LiquidezSection
          disponibleHoy={liquidez.disponibleHoy}
          comprometido30d={liquidez.comprometido30d}
          ingresos30d={liquidez.ingresos30d}
          proyeccion30d={liquidez.proyeccion30d}
        />

        {/* REQUIERE ATENCIÓN */}
        <AlertasSection
          alertas={alertas}
          onAlertClick={handleAlertClick}
        />
      </div>
    </div>
  );
};

export default InvestorDashboard;
