import React from 'react';
import { Scale, Upload } from 'lucide-react';
import PageLayout from '../components/common/PageLayout';
import EmptyState from '../components/common/EmptyState';

const TaxPage: React.FC = () => {
  return (
    <PageLayout
      title="Impuestos"
      icon={Scale}
      primaryAction={{
        label: 'Importar',
        onClick: () => {},
        variant: 'header',
        icon: Upload,
      }}
      tabs={[
        { label: 'Mi IRPF', path: '/fiscalidad/mi-irpf' },
        { label: 'Historial', path: '/fiscalidad/historial' },
      ]}
    >
      <EmptyState
        lucideIcon={Scale}
        title="Sin datos fiscales"
        description="Importa tu primera declaración para empezar"
        action={{
          label: 'Importar declaración',
          onClick: () => {},
        }}
      />
    </PageLayout>
  );
};

export default TaxPage;
