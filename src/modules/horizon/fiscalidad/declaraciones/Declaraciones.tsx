import React from 'react';
import { FileText } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';

const Declaraciones: React.FC = () => {
  const handleGenerateDeclaration = () => {
    // TODO: Implement declaration generation logic
    console.log('Generating fiscal declaration...');
  };

  const primaryAction = (
    <button
      onClick={handleGenerateDeclaration}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
    >
      <FileText className="w-4 h-4" />
      Generar Declaración
    </button>
  );

  return (
    <PageLayout 
      title="Declaraciones" 
      subtitle="Preparación de declaraciones fiscales."
      primaryAction={primaryAction}
    >
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Paquete Renta + Histórico</h3>
        <p className="text-gray-600 mb-6">
          Genera tu declaración de IRPF con datos fiscales consolidados y acceso al histórico de ejercicios anteriores.
        </p>
        <div className="space-y-4 text-sm text-gray-500">
          <p>• Preparación automática del modelo IRPF</p>
          <p>• Integración con datos de ingresos y gastos</p>
          <p>• Histórico de declaraciones anteriores</p>
          <p>• Exportación en formatos oficiales</p>
        </div>
      </div>
    </PageLayout>
  );
};

export default Declaraciones;