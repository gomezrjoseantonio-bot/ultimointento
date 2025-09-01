import React from 'react';
import PageLayout from '../../../../components/common/PageLayout';
import { useTheme } from '../../../../contexts/ThemeContext';

const PreferenciasDatos: React.FC = () => {
  const { currentModule } = useTheme();
  
  const subtitle = currentModule === 'horizon' 
    ? 'Configuración de preferencias y datos del módulo Horizon.'
    : 'Configuración de preferencias y datos del módulo Pulse.';
  
  return (
    <PageLayout title="Preferencias & Datos" subtitle={subtitle}>
      <p className="text-neutral-600">En construcción. Próximo hito: funcionalidades.</p>
    </PageLayout>
  );
};

export default PreferenciasDatos;