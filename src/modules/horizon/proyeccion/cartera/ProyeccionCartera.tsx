import React from 'react';
import PageHeader from '../../../../components/common/PageHeader';
import EmptyState from '../../../../components/common/EmptyState';
import { Building2 } from 'lucide-react';

const ProyeccionCartera: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cartera"
        subtitle="Proyecciones de la cartera inmobiliaria y análisis de rendimiento"
      />
      
      <EmptyState
        icon={<Building2 className="h-12 w-12 text-gray-400" />}
        title="Proyección de Cartera"
        description="Esta funcionalidad estará disponible próximamente. Incluirá análisis de rentabilidad, proyecciones de valor y métricas de rendimiento de la cartera inmobiliaria."
        action={{
          label: "Solicitar acceso",
          onClick: () => console.log('Feature requested')
        }}
      />
    </div>
  );
};

export default ProyeccionCartera;