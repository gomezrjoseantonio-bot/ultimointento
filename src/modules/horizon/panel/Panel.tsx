import React from 'react';
import PageLayout from '../../../components/common/PageLayout';

const Panel: React.FC = () => {
  return (
    <PageLayout 
      title="Panel" 
      subtitle="Vista general del módulo Horizon con resumen de inversiones." 
      showInfoIcon={true}
    >
      <p className="text-gray-600">En construcción. Próximo hito: funcionalidades.</p>
    </PageLayout>
  );
};

export default Panel;