import React from 'react';
import { Key } from 'lucide-react';
import PageLayout from '../components/common/PageLayout';
import EmptyState from '../components/common/EmptyState';

const ContractsPage: React.FC = () => {
  return (
    <PageLayout
      title="Alquileres"
      icon={Key}
    >
      <EmptyState
        lucideIcon={Key}
        title="Sin contratos de alquiler"
        description="Añade tu primer contrato de alquiler"
      />
    </PageLayout>
  );
};

export default ContractsPage;
