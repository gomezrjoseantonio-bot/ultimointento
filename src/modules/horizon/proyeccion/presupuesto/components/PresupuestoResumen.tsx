import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { UUID } from '../../../../../services/db';

// Import ResumenPresupuesto from the service
import { ResumenPresupuesto } from '../services/presupuestoService';

interface PresupuestoResumenProps {
  resumen: ResumenPresupuesto;
  inmuebleId: UUID | 'todos';
}

const PresupuestoResumen: React.FC<PresupuestoResumenProps> = ({
  resumen
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  // Calculate some basic metrics for display
  const netoColor = resumen.netoAnual >= 0 ? 'text-success-600' : 'text-error-600';
  const netoIcon = resumen.netoAnual >= 0 ? TrendingUp : TrendingDown;

  // Simple heatmap calculation for months
  const getMonthHeatmapColor = (monthIndex: number) => {
    const monthNeto = resumen.breakdown.neto[monthIndex];
    const avgNeto = resumen.netoAnual / 12;
    
    if (Math.abs(monthNeto - avgNeto) / Math.abs(avgNeto) <= 0.1) {
      return 'bg-success-100 text-success-800'; // En línea
    } else if (Math.abs(monthNeto - avgNeto) / Math.abs(avgNeto) <= 0.3) {
      return 'bg-warning-100 text-yellow-800'; // Desviación moderada
    } else {
      return 'bg-error-100 text-error-800'; // Desviación alta
    }
  };

  const monthNames = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Resumen Anual</h2>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Ingresos */}
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-success-600">Ingresos Anuales</p>
              <p className="text-2xl font-bold text-success-800">
                {formatCurrency(resumen.ingresoAnual)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-success-600" />
          </div>
        </div>

        {/* Gastos */}
        <div className="bg-gradient-to-r from-red-50 to-red-100 p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-error-600">Gastos Anuales</p>
              <p className="text-2xl font-bold text-error-800">
                {formatCurrency(resumen.gastoAnual)}
              </p>
            </div>
            <TrendingDown className="h-8 w-8 text-error-600" />
          </div>
        </div>

        {/* Neto */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary-600">Resultado Neto</p>
              <p className={`text-2xl font-bold ${netoColor}`}>
                {formatCurrency(resumen.netoAnual)}
              </p>
            </div>
            {React.createElement(netoIcon, { className: `h-8 w-8 ${netoColor}` })}
          </div>
        </div>
      </div>

      {/* Mini-heatmap mensual */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-4">Vista Mensual</h3>
        <div className="grid grid-cols-12 gap-2">
          {monthNames.map((month, index) => {
            const monthNeto = resumen.breakdown.neto[index];
            const heatmapColor = getMonthHeatmapColor(index);
            
            return (
              <div
                key={month}
                className={`p-3 rounded-lg text-center ${heatmapColor}`}
                title={`${month}: ${formatCurrency(monthNeto)}`}
              >
                <div className="text-xs font-medium">{month}</div>
                <div className="text-xs mt-1">
                  {formatCurrency(monthNeto)}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center space-x-6 mt-4 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-success-100 rounded"></div>
            <span>En línea (±10%)</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-warning-100 rounded"></div>
            <span>Desviación moderada (±30%)</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-error-100 rounded"></div>
            <span>Desviación alta ({'>'}30%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresupuestoResumen;