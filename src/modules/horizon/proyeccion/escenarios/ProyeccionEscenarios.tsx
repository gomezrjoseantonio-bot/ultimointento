import React from 'react';
import PageLayout from '../../../../components/common/PageLayout';

// Direct import for base content
import ProyeccionBase from '../base/ProyeccionBase';

const ProyeccionEscenarios: React.FC = () => {
  return (
    <PageLayout 
      title="Escenarios" 
      subtitle="Línea base a 20 años derivada de contratos y gastos recurrentes"
    >
      <div className="space-y-6">
        <ProyeccionBase />
      </div>
    </PageLayout>
  );
};

export default ProyeccionEscenarios;