import React from 'react';
import PageLayout from './PageLayout';

interface ModulePanelProps {
  module: 'horizon' | 'pulse';
}

const ModulePanel: React.FC<ModulePanelProps> = ({ module }) => {
  const config = {
    horizon: {
      title: "Panel",
      subtitle: "Vista general del módulo Horizon con resumen de inversiones."
    },
    pulse: {
      title: "Panel", 
      subtitle: "Vista general del módulo Pulse con resumen de finanzas personales."
    }
  };
  
  const { title, subtitle } = config[module];
  
  return (
    <PageLayout 
      title={title}
      subtitle={subtitle}
      showInfoIcon={true}
    >
      <p className="text-gray-600">En construcción. Próximo hito: funcionalidades.</p>
    </PageLayout>
  );
};

export default ModulePanel;