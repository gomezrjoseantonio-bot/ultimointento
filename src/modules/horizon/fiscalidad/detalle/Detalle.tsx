import React, { useState } from 'react';
import { BarChart3, FileText, Calculator, TrendingDown } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';

type DetalleSection = 'ingresos' | 'gastos' | 'amortizaciones' | 'arrastres';

const Detalle: React.FC = () => {
  const [activeSection, setActiveSection] = useState<DetalleSection>('ingresos');

  const sections = [
    { id: 'ingresos' as DetalleSection, label: 'Ingresos', icon: BarChart3 },
    { id: 'gastos' as DetalleSection, label: 'Gastos AEAT', icon: FileText },
    { id: 'amortizaciones' as DetalleSection, label: 'Amortizaciones', icon: Calculator },
    { id: 'arrastres' as DetalleSection, label: 'Arrastres', icon: TrendingDown },
  ];

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'ingresos':
        return (
          <div className="text-center py-12">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-blue-500" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Ingresos</h3>
            <p className="text-gray-600">Detalle de ingresos devengados y estado de cobro por contrato.</p>
          </div>
        );
      case 'gastos':
        return (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Gastos AEAT</h3>
            <p className="text-gray-600">Clasificación detallada de gastos por casillas AEAT (0105-0117).</p>
          </div>
        );
      case 'amortizaciones':
        return (
          <div className="text-center py-12">
            <Calculator className="w-16 h-16 mx-auto mb-4 text-purple-500" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Amortizaciones</h3>
            <p className="text-gray-600">Amortización de inmuebles (3%) y mobiliario/CAPEX (10 años).</p>
          </div>
        );
      case 'arrastres':
        return (
          <div className="text-center py-12">
            <TrendingDown className="w-16 h-16 mx-auto mb-4 text-orange-500" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Arrastres</h3>
            <p className="text-gray-600">Excesos deducibles aplicables en ejercicios futuros (hasta 4 años).</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <PageLayout title="Detalle" subtitle="Detalle de ingresos, gastos, amortizaciones y arrastres.">
      <div className="space-y-6">
        {/* Section Tabs */}
        <div className="bg-white rounded-lg border border-gray-200 p-1">
          <div className="grid grid-cols-4 gap-1">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section Content */}
        <div className="bg-white rounded-lg border border-gray-200 min-h-96">
          {renderSectionContent()}
        </div>
      </div>
    </PageLayout>
  );
};

export default Detalle;