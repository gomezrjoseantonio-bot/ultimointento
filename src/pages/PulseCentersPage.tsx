import React from 'react';
import { Target } from 'lucide-react';
import PageLayout from '../components/common/PageLayout';
import EmptyState from '../components/common/EmptyState';

const PulseCentersPage: React.FC = () => {
  return (
    <PageLayout
      title="Mi Plan"
      subtitle="Seguimiento de objetivos"
      icon={Target}
      primaryAction={{
        label: 'Editar objetivos',
        onClick: () => {},
        variant: 'header',
      }}
    >
      <EmptyState
        lucideIcon={Target}
        title="No hay objetivos configurados"
        description="Define tus objetivos para hacer seguimiento"
        action={{
          label: 'Configurar objetivos',
          onClick: () => {},
        }}
      />
    </PageLayout>
  );
};

export default PulseCentersPage;
