import React from 'react';
import { BarChart3, Download } from 'lucide-react';
import PageLayout from '../components/common/PageLayout';
import EmptyState from '../components/common/EmptyState';

const ProjectionsPage: React.FC = () => {
  return (
    <PageLayout
      title="Proyección mensual"
      icon={BarChart3}
      primaryAction={{
        label: 'Exportar',
        onClick: () => {},
        variant: 'header',
        icon: Download,
      }}
    >
      <EmptyState
        lucideIcon={BarChart3}
        title="Sin datos de proyección"
        description="Configura tu perfil para generar proyecciones"
      />
    </PageLayout>
  );
};

export default ProjectionsPage;
