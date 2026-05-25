import React from 'react';
import { Wrench } from 'lucide-react';
import PageLayout from './PageLayout';
import { EmptyState } from './EmptyState';

interface ModulePanelProps {
  module: 'horizon' | 'pulse';
}

const ModulePanel: React.FC<ModulePanelProps> = ({ module }) => {
  const config = {
    horizon: {
      title: "Panel",
      subtitle: "Vista general del módulo con resumen de inversiones."
    },
    pulse: {
      title: "Panel", 
      subtitle: "Vista general del módulo con resumen de finanzas personales."
    }
  };
  
  const { title, subtitle } = config[module];
  
  return (
    <PageLayout 
      title={title}
      subtitle={subtitle}
      showInfoIcon={true}
    >
      <EmptyState
        icon={Wrench}
        title="Panel en construcción"
        subtitle="Próximo hito: funcionalidades de panel de control y resumen ejecutivo."
      />
    </PageLayout>
  );
};

export default ModulePanel;