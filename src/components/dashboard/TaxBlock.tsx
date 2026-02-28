import React, { useState, useEffect, useCallback } from 'react';
import { FileText } from 'lucide-react';
import DashboardBlockBase, { DashboardBlockProps, DashboardBlockData } from './DashboardBlockBase';
import { TaxBlockOptions } from '../../services/dashboardService';
import { calcularDeclaracionIRPF, DeclaracionIRPF } from '../../services/irpfCalculationService';

const TaxBlock: React.FC<DashboardBlockProps> = ({ config, onNavigate, className, excludePersonal }) => {
  const [data, setData] = useState<DashboardBlockData>({
    value: 0,
    formattedValue: '0,00 €',
    isLoading: true
  });
  const [declaracion, setDeclaracion] = useState<DeclaracionIRPF | null>(null);

  const options = config.options as TaxBlockOptions;

  const loadTaxData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, isLoading: true, error: undefined }));

      const ejercicio = options.fiscalYear ?? new Date().getFullYear();
      const decl = await calcularDeclaracionIRPF(ejercicio);
      setDeclaracion(decl);

      const resultado = decl.resultado;
      const formattedTotal = new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
      }).format(Math.abs(resultado));

      setData({
        value: resultado,
        formattedValue: formattedTotal,
        isLoading: false
      });

    } catch (error) {
      console.error('Error loading tax data:', error);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Error al cargar datos fiscales'
      }));
    }
  }, [options]);

  useEffect(() => {
    loadTaxData();
  }, [loadTaxData]);

  const handleNavigate = () => {
    if (onNavigate) {
      onNavigate('/fiscalidad/dashboard', {
        year: options.fiscalYear,
      });
    }
  };

  const getSubtitle = () => {
    const year = options.fiscalYear ?? new Date().getFullYear();
    return `Estimación IRPF ${year}`;
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

  return (
    <DashboardBlockBase
      title="Fiscalidad"
      subtitle={getSubtitle()}
      data={data}
      icon={<FileText className="w-5 h-5" />}
      onNavigate={handleNavigate}
      className={className}
      filterLabel={excludePersonal ? 'Sin finanzas personales' : undefined}
    >
      {/* Tax specific content */}
      {declaracion && (
        <div className="mt-3 text-xs text-neutral-500">
          <div className="flex justify-between">
            <span>Cuota líquida IRPF</span>
            <span className="font-medium text-neutral-700">
              {fmt(declaracion.liquidacion.cuotaLiquida)}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Retenciones totales</span>
            <span className="font-medium text-success-600">
              {fmt(declaracion.retenciones.total)}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Tipo efectivo</span>
            <span className="font-medium text-neutral-700">
              {declaracion.tipoEfectivo.toFixed(1)}%
            </span>
          </div>
          <div className="border-t border-neutral-200 mt-2 pt-2 flex justify-between font-medium">
            <span>{declaracion.resultado >= 0 ? 'A pagar' : 'A devolver'}</span>
            <span className={declaracion.resultado >= 0 ? 'text-error-600' : 'text-success-700'}>
              {fmt(Math.abs(declaracion.resultado))}
            </span>
          </div>
        </div>
      )}
    </DashboardBlockBase>
  );
};

export default TaxBlock;