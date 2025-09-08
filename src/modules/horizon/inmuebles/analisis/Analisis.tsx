import React from 'react';
import PageLayout from '../../../../components/common/PageLayout';
import EmptyState from '../../../../components/common/EmptyState';
import { BarChart3 } from 'lucide-react';

const Analisis: React.FC = () => {
  return (
    <PageLayout
      title="Análisis"
      subtitle="Análisis de rentabilidad y rendimiento con métricas avanzadas"
    >
      <EmptyState
        icon={<BarChart3 className="h-12 w-12 text-gray-400" />}
        title="Análisis Avanzado"
        description="Esta funcionalidad estará disponible próximamente. Incluirá análisis de ROI, TIR, ratios de rentabilidad y comparativas de rendimiento entre inmuebles."
        action={{
          label: "Solicitar acceso",
          onClick: () => console.log('Feature requested')
        }}
      />
    </PageLayout>
  );
};

export default Analisis;