import React from 'react';
import { Calendar as CalendarIcon, TrendingUp, TrendingDown } from 'lucide-react';

// Import ResumenPresupuesto from the service
import { ResumenPresupuesto } from '../services/presupuestoService';

interface PresupuestoCalendarioProps {
  resumen: ResumenPresupuesto;
  year: number;
}

const PresupuestoCalendario: React.FC<PresupuestoCalendarioProps> = ({
  resumen,
  year
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const getBubbleColor = (monthIndex: number) => {
    const neto = resumen.breakdown.neto[monthIndex];
    if (neto > 0) {
      return 'bg-green-100 border-green-300 text-green-800';
    } else if (neto < 0) {
      return 'bg-red-100 border-red-300 text-red-800';
    } else {
      return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getIcon = (monthIndex: number) => {
    const neto = resumen.breakdown.neto[monthIndex];
    return neto >= 0 ? TrendingUp : TrendingDown;
  };

  // Mock real data for comparison (TODO: implement real vs budget comparison)
  const generateMockReal = (budgeted: number) => {
    // Generate some realistic variation
    const variation = (Math.random() - 0.5) * 0.4; // ±20% variation
    return budgeted * (1 + variation);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <CalendarIcon className="h-5 w-5 mr-2" />
          Calendario Mensual {year}
        </h2>
        <div className="text-sm text-gray-600">
          Presupuesto vs Real vs Δ
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {monthNames.map((month, index) => {
          const presupuestado = resumen.breakdown.neto[index];
          const real = generateMockReal(presupuestado); // TODO: get real data
          const delta = real - presupuestado;
          const bubbleColor = getBubbleColor(index);
          const Icon = getIcon(index);

          return (
            <div
              key={month}
              className={`p-4 rounded-lg border-2 ${bubbleColor} transition-all hover:shadow-lg`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm">{month}</h3>
                <Icon className="h-4 w-4" />
              </div>
              
              <div className="space-y-2">
                {/* Presupuestado */}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">PRES:</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(presupuestado)}
                  </span>
                </div>
                
                {/* Real (mock data) */}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">REAL:</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(real)}
                  </span>
                </div>
                
                {/* Delta */}
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-xs text-gray-600">Δ:</span>
                  <span className={`text-sm font-bold ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
                  </span>
                </div>
                
                {/* Percentage */}
                {presupuestado !== 0 && (
                  <div className="text-center">
                    <span className={`text-xs ${Math.abs(delta / presupuestado) > 0.1 ? 'font-bold' : ''}`}>
                      {((delta / presupuestado) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-gray-600 mb-1">Total Presupuestado</div>
            <div className="text-lg font-bold text-gray-900">
              {formatCurrency(resumen.netoAnual)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Total Real (Mock)</div>
            <div className="text-lg font-bold text-gray-900">
              {formatCurrency(generateMockReal(resumen.netoAnual))}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Desviación</div>
            <div className="text-lg font-bold text-green-600">
              +{formatCurrency(Math.abs(generateMockReal(resumen.netoAnual) - resumen.netoAnual))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 text-xs text-gray-600 text-center">
        <p>
          <span className="font-medium">PRES</span>: Presupuestado • 
          <span className="font-medium"> REAL</span>: Datos reales • 
          <span className="font-medium"> Δ</span>: Diferencia
        </p>
        <p className="mt-1">
          Los datos reales se obtendrán de Movimientos + Contratos + OCR (actualmente mock)
        </p>
      </div>
    </div>
  );
};

export default PresupuestoCalendario;