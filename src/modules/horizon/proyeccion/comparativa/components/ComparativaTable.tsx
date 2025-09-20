import React from 'react';
import { formatEuro } from '../../../../../utils/formatUtils';
import { ComparativaData } from '../services/comparativaService';

interface ComparativaTableProps {
  data: ComparativaData;
  onMonthClick: (month: number) => void;
}

const ComparativaTable: React.FC<ComparativaTableProps> = ({ data, onMonthClick }) => {
  const monthNames = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];

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

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left text-sm font-medium text-gray-600 py-3 px-6">Mes</th>
            <th className="text-right text-sm font-medium text-gray-600 py-3 px-4">Budget</th>
            <th className="text-right text-sm font-medium text-gray-600 py-3 px-4">Forecast</th>
            <th className="text-right text-sm font-medium text-gray-600 py-3 px-4">Actual</th>
            <th className="text-center text-sm font-medium text-gray-600 py-3 px-4">Desv. vs Budget</th>
          </tr>
        </thead>
        <tbody>
          {data.monthlyData.map((monthData, index) => (
            <tr 
              key={index}
              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
          >
              onClick={() => onMonthClick(index + 1)}
            >
              <td className="py-3 px-6 text-sm font-medium text-gray-900">
                {monthNames[index]}
              </td>
              <td className="py-3 px-4 text-sm text-right text-gray-900 tabular-nums">
                {formatEuro(monthData.budget)}
              </td>
              <td className="py-3 px-4 text-sm text-right text-gray-900 tabular-nums">
                {formatEuro(monthData.forecast)}
              </td>
              <td className="py-3 px-4 text-sm text-right text-gray-900 tabular-nums">
                {monthData.actual !== 0 ? formatEuro(monthData.actual) : '—'}
              </td>
              <td className="py-3 px-4 text-center">
                <span 
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                  >
                  style={{ 
                    backgroundColor: `${getDeviationColor(monthData.deviationStatus)}20`,
                    color: getDeviationColor(monthData.deviationStatus)
                  }}
                >
                  {monthData.budget !== 0 ? formatDeviation(monthData.deviation) : '—'}
                </span>
              </td>
            </tr>
          ))}
          
          {/* YTD Totals Row */}
          <tr className="border-t-2 border-gray-300 bg-gray-50">
            <td className="py-4 px-6 text-sm font-semibold text-gray-900">
              Totales YTD
            </td>
            <td className="py-4 px-4 text-sm text-right font-semibold text-gray-900 tabular-nums">
              {formatEuro(data.ytdTotals.budget)}
            </td>
            <td className="py-4 px-4 text-sm text-right font-semibold text-gray-900 tabular-nums">
              {formatEuro(data.ytdTotals.forecast)}
            </td>
            <td className="py-4 px-4 text-sm text-right font-semibold text-gray-900 tabular-nums">
              {formatEuro(data.ytdTotals.actual)}
            </td>
            <td className="py-4 px-4 text-center">
              <span 
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
                >
                style={{ 
                  backgroundColor: `${getDeviationColor(data.ytdTotals.deviationStatus)}20`,
                  color: getDeviationColor(data.ytdTotals.deviationStatus)
                }}
              >
                {formatDeviation(data.ytdTotals.deviation)}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ComparativaTable;