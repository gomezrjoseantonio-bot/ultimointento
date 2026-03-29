import React from 'react';
import { User } from 'lucide-react';
import PageLayout from '../components/common/PageLayout';
import EmptyState from '../components/common/EmptyState';

const ExpensesPage: React.FC = () => {
  return (
    <PageLayout
      title="Personal"
      subtitle="Gestión de finanzas personales"
      icon={User}
    >
      <EmptyState
        lucideIcon={User}
        title="Sin datos personales"
        description="Configura tu perfil para ver tus finanzas personales"
      />
    </PageLayout>
  );
};

export default ExpensesPage;
