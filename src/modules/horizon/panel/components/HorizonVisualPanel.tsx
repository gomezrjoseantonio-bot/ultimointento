import React, { useEffect, useState } from 'react';
import type { DashboardSnapshot } from '../../../../services/dashboardService';
import ActualizacionValoresDrawer from '../../../../components/dashboard/ActualizacionValoresDrawer';
import ExecutiveDashboard from './ExecutiveDashboard';
import './horizonExecutiveDashboard.css';

export interface PanelFilters {
  excludePersonal?: boolean;
  dateRange: 'today' | '7days' | '30days';
}

const DEFAULT_DATA: DashboardSnapshot = {
  patrimonio: {
    total: 0,
    variacionMes: 0,
    variacionPorcentaje: 0,
    fechaCalculo: new Date().toISOString(),
    desglose: { inmuebles: 0, inversiones: 0, cuentas: 0, deuda: 0 }
  },
  liquidez: {
    disponibleHoy: 0,
    comprometido30d: 0,
    ingresos30d: 0,
    proyeccion30d: 0
  },
  salud: {
    liquidezHoy: 0,
    gastoMedioMensual: 0,
    colchonMeses: 0,
    estado: 'critical',
    proyeccion30d: { estimado: 0, ingresos: 0, gastos: 0 }
  },
  tesoreria: {
    asOf: new Date().toISOString(),
    filas: [],
    totales: { inicioMes: 0, hoy: 0, porCobrar: 0, porPagar: 0, proyeccion: 0 }
  },
  alertas: []
};

const HorizonVisualPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardSnapshot>(DEFAULT_DATA);
  const [flujos, setFlujos] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadDashboardData = async () => {
    setLoading(true);
    const { dashboardService } = await import('../../../../services/dashboardService');
    const [patrimonio, liquidez, salud, tesoreria, alertas, flujosCaja] = await Promise.all([
      dashboardService.getPatrimonioNeto(),
      dashboardService.getLiquidez(),
      dashboardService.getSaludFinanciera(),
      dashboardService.getTesoreriaPanel(),
      dashboardService.getAlertas(),
      dashboardService.getFlujosCaja()
    ]);
    setData({ patrimonio, liquidez, salud, tesoreria, alertas });
    setFlujos(flujosCaja);
    setLoading(false);
  };

  useEffect(() => {
    void loadDashboardData();
  }, []);

  if (loading && data.patrimonio.total === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400, color: 'var(--n-500)', fontFamily: 'var(--font)' }}>
        Cargando dashboard...
      </div>
    );
  }

  return (
    <>
      <ExecutiveDashboard
        data={data}
        flujos={flujos}
        onOpenDrawer={() => setDrawerOpen(true)}
      />
      <ActualizacionValoresDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => {
          setDrawerOpen(false);
          void loadDashboardData();
        }}
      />
    </>
  );
};

export default HorizonVisualPanel;
