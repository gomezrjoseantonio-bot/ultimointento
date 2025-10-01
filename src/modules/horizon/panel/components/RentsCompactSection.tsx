import React from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ExternalLink } from 'lucide-react';
import { PanelFilters } from './HorizonVisualPanel';

interface Property {
  id: string;
  name: string;
  collectionPercent: number;
}

interface RentsCompactSectionProps {
  filters: PanelFilters;
}

const RentsCompactSection: React.FC<RentsCompactSectionProps> = ({ filters }) => {
  const navigate = useNavigate();

  const handleOpenContracts = () => {
    toast.loading('Abriendo gestión de contratos...', { id: 'contracts-nav' });
    setTimeout(() => {
      toast.success('Redirigiendo a Contratos', { id: 'contracts-nav' });
      navigate('/inmuebles/contratos');
    }, 500);
  };
  // Mock data - in real implementation would come from contracts service
  const collected = 2850;
  const pending = 450;
  const total = collected + pending;
  const collectionPercent = Math.round((collected / total) * 100);

  // Top 3 properties for compact view
  const properties: Property[] = [
    { id: '1', name: 'Piso Centro', collectionPercent: 100 },
    { id: '2', name: 'Apartamento Norte', collectionPercent: 100 },
    { id: '3', name: 'Ático Sur', collectionPercent: 0 }
  ];

  const doughnutData = [
    { name: 'Cobradas', value: collected, color: 'var(--ok)' },
    { name: 'Pendientes', value: pending, color: 'var(--warn)' }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="h-full bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-3 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-hz-neutral-900">Rentas del mes</h2>
        <button 
          onClick={handleOpenContracts}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-hz-primary text-white rounded hover:bg-hz-primary- light "
        >
          <ExternalLink className="w-3 h-3" />
          Abrir Contratos
        </button>
      </div>
      
      {/* Micro Doughnut Chart */}
      <div className="flex-1 flex flex-col">
        <div className="relative h-24 mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={doughnutData}
                cx="50%"
                cy="50%"
                innerRadius={25}
                outerRadius={40}
                startAngle={90}
                endAngle={450}
                dataKey="value"
              >
                {doughnutData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center percentage */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm font-bold text-hz-neutral-900">
                {collectionPercent}%
              </div>
              <div className="text-xs text-hz-neutral-500">
                cobrado
              </div>
            </div>
          </div>
        </div>
        
        {/* KPIs - Large numbers */}
        <div className="space-y-2 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-hz-neutral-700">Cobradas</span>
            <span className="text-sm font-semibold text-hz-success">
              {formatCurrency(collected)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-hz-neutral-700">Pendientes</span>
            <span className="text-sm font-semibold text-hz-warning">
              {formatCurrency(pending)}
            </span>
          </div>
        </div>
        
        {/* Compact list - max 3 properties */}
        <div className="flex-1 space-y-1">
          {properties.map((property) => (
            <div key={property.id} className="flex items-center justify-between text-xs">
              <span className="text-hz-neutral-700 truncate flex-1 mr-2">
                {property.name}
              </span>
              <div className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                property.collectionPercent === 100 
                  ? 'bg-hz-success text-hz-success'
                  : property.collectionPercent === 0
                  ? 'bg-hz-error text-hz-error'
                  : 'bg-hz-warning text-hz-warning'
              }`}>
                {property.collectionPercent}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RentsCompactSection;