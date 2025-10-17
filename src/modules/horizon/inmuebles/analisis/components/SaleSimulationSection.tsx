import React from 'react';
import { SaleSimulation } from '../../../../../types/propertyAnalysis';
import { formatEuro } from '../../../../../utils/formatUtils';

interface SaleSimulationSectionProps {
  data: SaleSimulation;
  onUpdateSalePrice: (value: number) => void;
  onUpdateCommission: (value: number) => void;
}

const SaleSimulationSection: React.FC<SaleSimulationSectionProps> = ({ 
  data, 
  onUpdateSalePrice, 
  onUpdateCommission 
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
        3.1 Simulación de venta (siempre visible)
      </h3>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Precio venta (€)
          </label>
          <input
            type="number"
            value={data.precioVenta}
            onChange={(e) => onUpdateSalePrice(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border rounded-md text-sm"
            style={{ fontSize: '14px' }}
          />
        </div>

        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Comisión venta (€)
          </label>
          <input
            type="number"
            value={data.comisionVenta}
            onChange={(e) => onUpdateCommission(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border rounded-md text-sm"
            style={{ fontSize: '14px' }}
          />
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Impuestos (3%) (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.impuestos3Pct)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Deuda pendiente (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.deudaPendiente)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Comisión cancelación (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.comisionCancelacion)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Capital liberable (sin IRPF) (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.capitalLiberable)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Plusvalía estimada (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.plusvaliaEstimada)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            IRPF (26%) (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.irpf26Pct)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Capital neto final (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.capitalNetoFinal)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Intereses futuros evitados (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.interesesFuturosEvitados)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaleSimulationSection;
