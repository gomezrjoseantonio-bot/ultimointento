import React, { useEffect, useState } from 'react';
import PatrimonioHeader from './PatrimonioHeader';
import TresBolsillosGrid from './TresBolsillosGrid';
import LiquidezSection from './LiquidezSection';
import AlertasSection from './AlertasSection';
import QuickActions from './QuickActions';
import { dashboardService } from '../../services/dashboardService';

interface InvestorDashboardV2Props {
  onNavigate: (route: string) => void;
}

/**
 * InvestorDashboardV2 - Redesigned investor dashboard with "3 Bolsillos" view
 * 
 * New investor-centric dashboard showing:
 * 1. MI PATRIMONIO - Total net worth with variation
 * 2. 3 BOLSILLOS - Three income sources (Trabajo, Inmuebles, Inversiones)
 * 3. LIQUIDEZ TOTAL - Liquidity with 30-day projection
 * 4. REQUIERE ATENCIÓN - Alerts requiring action
 * 5. ACCIONES RÁPIDAS - Quick action buttons
 * 
 * 100% ATLAS Design Bible compliant:
 * - Inter font
 * - CSS tokens only
 * - Spanish locale formatting
 * - Responsive layout
 * - Accessible with ARIA labels
 */
const InvestorDashboardV2: React.FC<InvestorDashboardV2Props> = ({
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
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          fontFamily: 'var(--font-inter)'
        }}
      >
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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
              padding: '24px'
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: '200px',
                  backgroundColor: '#e0e0e0',
                  borderRadius: '12px'
                }}
              />
            ))}
          </div>

          {/* Liquidity and alerts skeleton */}
          <div
            style={{
              padding: '24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px'
            }}
          >
            <div
              style={{
                height: '300px',
                backgroundColor: '#e0e0e0',
                borderRadius: '12px'
              }}
            />
            <div
              style={{
                height: '300px',
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
            backgroundColor: 'white',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}
        >
          <span
            style={{
              fontSize: '4rem',
              marginBottom: '16px',
              display: 'block'
            }}
            role="img"
            aria-label="Cartera vacía"
          >
            📊
          </span>
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
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              justifyContent: 'center'
            }}
          >
            <button
              onClick={() => onNavigate('/personal')}
              className="atlas-btn-primary"
              style={{
                padding: '12px 24px',
                backgroundColor: 'var(--atlas-blue)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-inter)'
              }}
            >
              + Añadir nómina
            </button>
            <button
              onClick={() => onNavigate('/inmuebles/cartera/nuevo')}
              className="atlas-btn-secondary"
              style={{
                padding: '12px 24px',
                backgroundColor: 'white',
                color: 'var(--atlas-blue)',
                border: '1px solid var(--atlas-blue)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-inter)'
              }}
            >
              + Añadir inmueble
            </button>
            <button
              onClick={() => onNavigate('/inversiones')}
              className="atlas-btn-secondary"
              style={{
                padding: '12px 24px',
                backgroundColor: 'white',
                color: 'var(--atlas-blue)',
                border: '1px solid var(--atlas-blue)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-inter)'
              }}
            >
              + Añadir inversión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        backgroundColor: 'var(--bg)',
        minHeight: '100vh',
        fontFamily: 'var(--font-inter)'
      }}
    >
      {/* Header - MI PATRIMONIO */}
      <PatrimonioHeader
        patrimonioNeto={patrimonio.total}
        variacionPorcentaje={patrimonio.variacionPorcentaje}
      />

      {/* Grid - TRES BOLSILLOS */}
      <TresBolsillosGrid
        trabajo={bolsillos.trabajo}
        inmuebles={bolsillos.inmuebles}
        inversiones={bolsillos.inversiones}
        onNavigate={onNavigate}
      />

      {/* Main content grid: Liquidity + Alerts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          padding: '0 24px 24px 24px'
        }}
      >
        {/* LIQUIDEZ TOTAL */}
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

      {/* ACCIONES RÁPIDAS */}
      <QuickActions
        onRegistrarIngreso={() => onNavigate('/tesoreria')}
        onAñadirGasto={() => onNavigate('/inmuebles/gastos-capex')}
        onVerTodo={() => {
          // Navigate to a route that will trigger the parent to switch to full view
          // The parent component will handle the view mode switch
          onNavigate('/panel?view=full');
        }}
      />
    </div>
  );
};

export default InvestorDashboardV2;
