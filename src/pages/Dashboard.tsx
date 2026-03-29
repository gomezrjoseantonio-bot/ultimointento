import React from 'react';
import { LayoutDashboard, RefreshCw } from 'lucide-react';
import PageLayout from '../components/common/PageLayout';
import KpiCard from '../components/dashboard/KpiCard';
import ProjectionChart from '../components/dashboard/ProjectionChart';
import RecentActivity from '../components/dashboard/RecentActivity';

const Dashboard: React.FC = () => {
  const kpis = [
    { title: 'Patrimonio neto', value: '€312.450', change: '+€8.300', isPositive: true },
    { title: 'Cashflow mensual', value: '€3.240', change: '+€180', isPositive: true },
    { title: 'Rentabilidad bruta', value: '5,8%', change: '+0,3%', isPositive: true },
    { title: 'Tasa de ahorro', value: '28%', change: '+2%', isPositive: true },
  ];

  return (
    <PageLayout
      title="Dashboard ejecutivo"
      subtitle="Mar 2026"
      icon={LayoutDashboard}
      primaryAction={{
        label: 'Actualizar valores',
        onClick: () => {},
        variant: 'header',
        icon: RefreshCw,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {kpis.map((kpi, index) => (
          <KpiCard key={index} {...kpi} color="navy" />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{
          background: 'var(--white)',
          border: '1px solid var(--grey-200)',
          borderRadius: 'var(--r-lg)',
          padding: 24,
        }}>
          <h2 style={{ fontSize: 'var(--t-lg)', fontWeight: 600, color: 'var(--grey-900)', marginBottom: 16 }}>
            Proyección 12 meses
          </h2>
          <ProjectionChart type="horizon" />
        </div>

        <div style={{
          background: 'var(--white)',
          border: '1px solid var(--grey-200)',
          borderRadius: 'var(--r-lg)',
          padding: 24,
        }}>
          <h2 style={{ fontSize: 'var(--t-lg)', fontWeight: 600, color: 'var(--grey-900)', marginBottom: 16 }}>
            Actividad reciente
          </h2>
          <RecentActivity />
        </div>
      </div>
    </PageLayout>
  );
};

export default Dashboard;
