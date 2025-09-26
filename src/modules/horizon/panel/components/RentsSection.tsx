import React from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { ExternalLink, Home, TrendingUp, TrendingDown } from 'lucide-react';
import { PanelFilters } from './HorizonVisualPanel';

interface RentData {
  month: string;
  collected: number;
  pending: number;
  total: number;
}

interface PropertyData {
  id: string;
  name: string;
  expected: number;
  collected: number;
  deviation: number;
  deviationPercent: number;
}

interface RentsSectionProps {
  filters: PanelFilters;
}

const RentsSection: React.FC<RentsSectionProps> = ({ filters }) => {
  const navigate = useNavigate();
  
  // Mock data - in real implementation would come from contracts and treasury
  const currentMonth = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  const handleViewContracts = () => {
    // Show loading toast and navigate to the contracts section
    toast.loading('Abriendo gestión de contratos...', { id: 'contracts-nav' });
    setTimeout(() => {
      toast.success('Redirigiendo a Contratos', { id: 'contracts-nav' });
      navigate('/inmuebles/contratos');
    }, 500);
  };

  const handleConfigureContracts = () => {
    // Show loading toast and navigate to the contracts creation section
    toast.loading('Abriendo configuración de contratos...', { id: 'config-contracts' });
    setTimeout(() => {
      toast.success('Redirigiendo a Contratos', { id: 'config-contracts' });
      navigate('/inmuebles/contratos');
    }, 500);
  };
  
  const rentData: RentData = {
    month: currentMonth,
    collected: 2850,
    pending: 450,
    total: 3300
  };

  const propertiesData: PropertyData[] = [
    {
      id: '1',
      name: 'Piso Centro',
      expected: 1200,
      collected: 1200,
      deviation: 0,
      deviationPercent: 0
    },
    {
      id: '2',
      name: 'Apartamento Norte',
      expected: 950,
      collected: 950,
      deviation: 0,
      deviationPercent: 0
    },
    {
      id: '3',
      name: 'Estudio Centro',
      expected: 700,
      collected: 700,
      deviation: 0,
      deviationPercent: 0
    },
    {
      id: '4',
      name: 'Ático Barrio Sur',
      expected: 450,
      collected: 0,
      deviation: -450,
      deviationPercent: -100
    },
    {
      id: '5',
      name: 'Local Comercial',
      expected: 800,
      collected: 800,
      deviation: 0,
      deviationPercent: 0
    }
  ].slice(0, 5); // Top 5 as specified

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const doughnutData = [
    { name: 'Cobradas', value: rentData.collected, color: '#10B981' },
    { name: 'Pendientes', value: rentData.pending, color: '#F59E0B' }
  ];

  const collectionRate = ((rentData.collected / rentData.total) * 100).toFixed(1);

  if (rentData.total === 0) {
    return (
      <div className="bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-6">
        <h2 className="text-lg font-semibold text-hz-neutral-900 mb-4">Rentas</h2>
        <div className="text-center py-8 text-hz-neutral-500">
          <Home className="w-12 h-12 mx-auto mb-4 text-hz-neutral-300" />
          <p>Sin contratos configurados</p>
          <button 
            onClick={handleConfigureContracts}
            className="mt-4 px-4 py-2 text-sm bg-hz-primary text-white rounded-lg hover:bg-hz-primary- light transition-colors"
          >
            Configurar contratos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-hz-neutral-900">Rentas</h2>
        <button 
          onClick={handleViewContracts}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-hz-primary text-white rounded-lg hover:bg-hz-primary- light transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Ver contratos
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doughnut Chart - Rentas del mes */}
        <div>
          <h3 className="text-sm font-medium text-hz-neutral-700 mb-4">
            Rentas de {rentData.month}
          </h3>
          
          <div className="relative">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={doughnutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    startAngle={90}
                    endAngle={450}
                    dataKey="value"
                  >
                    {doughnutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-hz-neutral-900 text-white px-3 py-2 rounded-lg">
                            <p className="font-medium">{payload[0].name}</p>
                            <p>{formatCurrency(payload[0].value as number)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Center text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-hz-neutral-900">
                  {collectionRate}%
                </div>
                <div className="text-xs text-hz-neutral-500">
                  cobrado
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-4 mt-4">
            {doughnutData.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
                <span className="text-sm text-hz-neutral-600">
                  {item.name}: {formatCurrency(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Properties Performance */}
        <div>
          <h3 className="text-sm font-medium text-hz-neutral-700 mb-4">
            Previsto vs Cobrado (Top 5)
          </h3>
          
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={propertiesData} 
                layout="horizontal"
                margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
              >
                <XAxis 
                  type="number" 
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `€${value}`}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as PropertyData;
                      return (
                        <div className="bg-hz-neutral-900 text-white p-3 rounded-lg">
                          <p className="font-medium mb-2">{data.name}</p>
                          <p>Previsto: {formatCurrency(data.expected)}</p>
                          <p>Cobrado: {formatCurrency(data.collected)}</p>
                          {data.deviation !== 0 && (
                            <p className={data.deviation > 0 ? 'text-hz-success' : 'text-hz-error'}>
                              Desviación: {data.deviation > 0 ? '+' : ''}{formatCurrency(data.deviation)}
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="expected" fill="#0A84FF" name="Previsto" radius={[0, 2, 2, 0]} />
                <Bar dataKey="collected" fill="#10B981" name="Cobrado" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Deviation badges */}
          <div className="space-y-2 mt-4">
            {propertiesData.map((property) => (
              <div key={property.id} className="flex items-center justify-between text-sm">
                <span className="text-hz-neutral-600 truncate flex-1 mr-2">
                  {property.name}
                </span>
                {property.deviation !== 0 && (
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    property.deviation > 0 
                      ? 'bg-hz-success text-hz-success'
                      : 'bg-hz-error text-hz-error'
                  }`}>
                    {property.deviation > 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {property.deviationPercent > 0 ? '+' : ''}{property.deviationPercent}%
                  </div>
                )}
                {property.deviation === 0 && (
                  <div className="px-2 py-1 rounded-full text-xs font-medium bg-hz-success text-hz-success">
                    ✓ OK
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-hz-neutral-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-hz-neutral-900">
              {formatCurrency(rentData.total)}
            </div>
            <div className="text-xs text-hz-neutral-500">Previsto total</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-hz-success">
              {formatCurrency(rentData.collected)}
            </div>
            <div className="text-xs text-hz-neutral-500">Ya cobrado</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-hz-warning">
              {formatCurrency(rentData.pending)}
            </div>
            <div className="text-xs text-hz-neutral-500">Pendiente</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RentsSection;