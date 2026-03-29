import React from 'react';
import { Landmark, Upload } from 'lucide-react';
import PageLayout from '../components/common/PageLayout';
import EmptyState from '../components/common/EmptyState';

const TreasuryPage: React.FC = () => {
  return (
    <PageLayout
      title="Tesorería"
      subtitle="Conciliación mensual"
      icon={Landmark}
      primaryAction={{
        label: 'Importar CSV',
        onClick: () => {},
        variant: 'header',
        icon: Upload,
      }}
    >
      <EmptyState
        lucideIcon={Landmark}
        title="Sin cuentas bancarias"
        description="Añade tu primera cuenta bancaria para empezar"
      />
    </PageLayout>
  );
};

export default TreasuryPage;
