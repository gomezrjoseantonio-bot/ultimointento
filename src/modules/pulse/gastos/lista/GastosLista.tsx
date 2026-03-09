import React from 'react';
import PageLayout from '../../../../components/common/PageLayout';

const GastosLista: React.FC = () => {
  return (
    <PageLayout 
      title="Lista" 
      subtitle="Listado completo de todos los gastos." 
      showInfoIcon={true}
    >
      <p className="text-neutral-600">En construcción. Próximo hito: funcionalidades.</p>
    </PageLayout>
  );
};

export default GastosLista;