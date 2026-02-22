import React, { useEffect, useState } from 'react';
import PatrimonioHeader from './PatrimonioHeader';
import FlujosGrid from './FlujosGrid';
import SaludFinanciera from './SaludFinanciera';
import AlertasSection from './AlertasSection';
import ActualizacionValoresDrawer from './ActualizacionValoresDrawer';
import { dashboardService } from '../../services/dashboardService';
import type { PatrimonioData, FlujosCaja, SaludFinanciera as SaludFinancieraType, Alerta } from '../../types/dashboard';
import './investor-dashboard.css';

interface InvestorDashboardProps {
  onNavigate: (route: string) => void;
}

/**
 * InvestorDashboard - REFACTORED Dashboard v2.0
 * 
 * Displays complete financial overview in a single screen:
 * 1. PATRIMONIO NETO - Total net worth with breakdown (4 icons)
 * 2. FLUJOS DE CAJA - Three cashflow sources with trends and occupancy
 * 3. SALUD FINANCIERA - Liquidity cushion and 30-day projection
 * 4. REQUIERE ATENCIÓN - Prioritized alerts with amounts
 * 
 * 100% ATLAS Design Bible compliant:
 * - Lucide icons ONLY (NO emojis)
 * - Monochromatic + semantic colors (green/red for states)
 * - Spanish locale formatting
 * - Fits in single screen (NO scroll at 1080p)
 */
const InvestorDashboard: React.FC<InvestorDashboardProps> = ({
  onNavigate
}) => {
  const [loading, setLoading] = useState(true);
  const [patrimonio, setPatrimonio] = useState<PatrimonioData>({
    total: 0,
    variacionMes: 0,
    variacionPorcentaje: 0,
    fechaCalculo: new Date().toISOString(),
    desglose: {
      inmuebles: 0,
      inversiones: 0,
      cuentas: 0,
      deuda: 0
    }
  });
  const [flujos, setFlujos] = useState<FlujosCaja>({
    trabajo: { netoMensual: 0, tendencia: 'stable', variacionPorcentaje: 0 },
    inmuebles: { cashflow: 0, ocupacion: 0, tendencia: 'stable' },
    inversiones: { rendimientoMes: 0, dividendosMes: 0, tendencia: 'stable' }
  });
  const [salud, setSalud] = useState<SaludFinancieraType>({
    liquidezHoy: 0,
    gastoMedioMensual: 0,
    colchonMeses: 0,
    estado: 'critical',
    proyeccion30d: {
      estimado: 0,
      ingresos: 0,
      gastos: 0
    }
  });
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load all dashboard data in parallel
      const [patrimonioData, flujosData, saludData, alertasData] = await Promise.all([
        dashboardService.getPatrimonioNeto(),
        dashboardService.getFlujosCaja(),
        dashboardService.getSaludFinanciera(),
        dashboardService.getAlertas()
      ]);

      setPatrimonio(patrimonioData);
      setFlujos(flujosData);
      setSalud(saludData);
      setAlertas(alertasData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAlertClick = (alerta: Alerta) => {
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
                backgroundColor: 'var(--hz-neutral-300)',
                borderRadius: '4px',
                marginBottom: '16px'
              }}
            />
            <div
              style={{
                height: '48px',
                width: '400px',
                backgroundColor: 'var(--hz-neutral-300)',
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
                  backgroundColor: 'var(--hz-neutral-300)',
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
                backgroundColor: 'var(--hz-neutral-300)',
                borderRadius: '12px'
              }}
            />
            <div
              style={{
                height: '140px',
                backgroundColor: 'var(--hz-neutral-300)',
                borderRadius: '12px'
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="investor-dashboard">
      {/* Header - PATRIMONIO NETO with breakdown */}
      <PatrimonioHeader
        patrimonioNeto={patrimonio.total}
        variacionPorcentaje={patrimonio.variacionPorcentaje}
        desglose={patrimonio.desglose}
        fechaCalculo={patrimonio.fechaCalculo}
        onActualizarValores={() => setDrawerOpen(true)}
      />

      {/* Actualizar valores drawer */}
      <ActualizacionValoresDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={loadDashboardData}
      />

      {/* Grid - FLUJOS DE CAJA (3 cards) */}
      <FlujosGrid
        trabajo={flujos.trabajo}
        inmuebles={flujos.inmuebles}
        inversiones={flujos.inversiones}
        onNavigate={onNavigate}
      />

      {/* Bottom sections: Salud Financiera + Alerts */}
      <div className="bottom-sections">
        {/* SALUD FINANCIERA */}
        <SaludFinanciera
          liquidezHoy={salud.liquidezHoy}
          gastoMedioMensual={salud.gastoMedioMensual}
          colchonMeses={salud.colchonMeses}
          estado={salud.estado}
          proyeccion30d={salud.proyeccion30d}
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
