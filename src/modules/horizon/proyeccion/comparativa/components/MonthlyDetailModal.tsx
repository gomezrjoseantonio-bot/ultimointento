import React from 'react';
import { X } from 'lucide-react';
import { formatEuro } from '../../../../../utils/formatUtils';
import { ComparativaData, CategoryBreakdown } from '../services/comparativaService';

interface MonthlyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: number;
  year: number;
  data: ComparativaData;
}

const MonthlyDetailModal: React.FC<MonthlyDetailModalProps> = ({
  isOpen,
  onClose,
  month,
  year,
  data
}) => {
  if (!isOpen) return null;

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const monthDetail = data.monthlyDetails[month - 1];
  
  const getDeviationColor = (status: 'green' | 'amber' | 'red') => {
    switch (status) {
      case 'green': return '#16A34A';
      case 'amber': return '#F59E0B';
      case 'red': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const formatDeviation = (deviation: number) => {
    const sign = deviation >= 0 ? '+' : '';
    return `${sign}${deviation.toFixed(1)} %`;
  };

  const CategoryTable: React.FC<{ 
    title: string; 
    categories: CategoryBreakdown[]; 
    isIncome: boolean;
  }> = ({ title, categories, isIncome }) => (
    <div className="mb-6">
      <h4 className={`text-md font-semibold mb-3 ${isIncome ? 'text-success-900' : 'text-error-900'}`}>
        {title}
      </h4>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left text-xs font-medium text-gray-600 py-2 px-3">Categoría</th>
              <th className="text-right text-xs font-medium text-gray-600 py-2 px-2">Budget</th>
              <th className="text-right text-xs font-medium text-gray-600 py-2 px-2">Forecast</th>
              <th className="text-right text-xs font-medium text-gray-600 py-2 px-2">Actual</th>
              <th className="text-center text-xs font-medium text-gray-600 py-2 px-2">Desv.</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category, index) => (
              <tr key={index} className="border-b border-gray-100">
                <td className="py-2 px-3 text-sm text-gray-900">{category.category}</td>
                <td className="py-2 px-2 text-sm text-right text-gray-900 tabular-nums">
                  {formatEuro(category.budget)}
                </td>
                <td className="py-2 px-2 text-sm text-right text-gray-900 tabular-nums">
                  {formatEuro(category.forecast)}
                </td>
                <td className="py-2 px-2 text-sm text-right text-gray-900 tabular-nums">
                  {category.actual !== 0 ? formatEuro(category.actual) : '—'}
                </td>
                <td className="py-2 px-2 text-center">
                  <span 
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                    style={{ 
                      backgroundColor: `${getDeviationColor(category.deviationStatus)}20`,
                      color: getDeviationColor(category.deviationStatus)
                    }}
                  >
                    {category.budget !== 0 ? formatDeviation(category.deviation) : '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-gray-200 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Detalle mensual - {monthNames[month - 1]} {year}
            </h3>
            <p className="text-sm text-gray-600">
              Desglose por categorías con comparativa Budget / Forecast / Actual
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {monthDetail ? (
            <>
              {/* Income Categories */}
              <CategoryTable 
                title="Ingresos"
                categories={monthDetail.ingresos}
                isIncome={true}
              />

              {/* Expense Categories */}
              <CategoryTable 
                title="Gastos"
                categories={monthDetail.gastos}
                isIncome={false}
              />
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No hay datos disponibles para este mes</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-[#0B2B5C] text-white rounded-lg hover:bg-[#0A2449] transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonthlyDetailModal;