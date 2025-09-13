// Préstamos Detail View Component

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calculator, 
  Calendar, 
  Home,
  ChevronRight,
} from 'lucide-react';
import { formatEuro, formatDate, formatPercentage } from '../../../../../utils/formatUtils';
import { Prestamo, PlanPagos } from '../../../../../types/prestamos';
import { prestamosService } from '../../../../../services/prestamosService';
import AmortizationSimulator from './AmortizationSimulator';
import BonificationPanel from './BonificationPanel';

interface PrestamoDetailProps {
  prestamoId: string;
  onBack: () => void;
}

const PrestamoDetail: React.FC<PrestamoDetailProps> = ({ prestamoId, onBack }) => {
  const [prestamo, setPrestamo] = useState<Prestamo | null>(null);
  const [planPagos, setPlanPagos] = useState<PlanPagos | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSimulator, setShowSimulator] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const loadPrestamoData = useCallback(async () => {
    try {
      setLoading(true);
      const [prestamoData, planData] = await Promise.all([
        prestamosService.getPrestamoById(prestamoId),
        prestamosService.getPaymentPlan(prestamoId)
      ]);
      
      setPrestamo(prestamoData);
      setPlanPagos(planData);
    } catch (error) {
      console.error('Error loading préstamo:', error);
    } finally {
      setLoading(false);
    }
  }, [prestamoId]);

  useEffect(() => {
    loadPrestamoData();
  }, [loadPrestamoData]);

  const getTipoDisplay = (prestamo: Prestamo): string => {
    switch (prestamo.tipo) {
      case 'FIJO':
        return `Fijo ${formatPercentage(prestamo.tipoNominalAnualFijo || 0)}`;
      case 'VARIABLE':
        return `Variable ${prestamo.indice} + ${formatPercentage(prestamo.diferencial || 0)}`;
      case 'MIXTO':
        return `Mixto (${prestamo.tramoFijoMeses}m fijo)`;
      default:
        return prestamo.tipo;
    }
  };

  const getFeatures = (prestamo: Prestamo): string[] => {
    const features: string[] = [];
    
    if (prestamo.cobroMesVencido) {
      features.push('Cobro a mes vencido');
    } else {
      features.push('Cobro al corriente');
    }
    
    if (prestamo.diferirPrimeraCuotaMeses && prestamo.diferirPrimeraCuotaMeses > 0) {
      features.push(`Diferido: ${prestamo.diferirPrimeraCuotaMeses} meses`);
    }
    
    if (prestamo.mesesSoloIntereses && prestamo.mesesSoloIntereses > 0) {
      features.push(`Solo intereses: ${prestamo.mesesSoloIntereses} meses`);
    }
    
    return features;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-atlas-blue"></div>
      </div>
    );
  }

  if (!prestamo || !planPagos) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No se pudo cargar la información del préstamo.</p>
        <button 
          onClick={onBack}
          className="mt-4 text-atlas-blue hover:text-[#033A73] font-medium"
        >
          ← Volver a préstamos
        </button>
      </div>
    );
  }

  // Pagination
  const totalPages = Math.ceil(planPagos.periodos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPeriodos = planPagos.periodos.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-[#D7DEE7] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <button 
              onClick={onBack}
              className="text-gray-500 hover:text-atlas-blue transition-colors"
            >
              <ChevronRight className="h-5 w-5 rotate-180" />
            </button>
            <div className="flex items-center space-x-2">
              <Home className="h-5 w-5 text-atlas-blue" />
              <h1 className="text-xl font-semibold text-neutral-900">{prestamo.nombre}</h1>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="px-3 py-1 bg-[#F8F9FA] text-atlas-blue rounded-full text-sm font-medium">
              {getTipoDisplay(prestamo)}
            </span>
            <button
              onClick={() => setShowSimulator(true)}
              className="px-4 py-2 bg-atlas-blue text-white rounded-lg hover:bg-[#033A73] transition-colors flex items-center space-x-2"
            >
              <Calculator className="h-4 w-4" />
              <span>Simular amortización</span>
            </button>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-4 bg-[#F8F9FA] rounded-lg">
            <div className="text-2xl font-bold text-atlas-blue">{formatEuro(prestamo.principalVivo)}</div>
            <div className="text-sm text-gray-500">Principal vivo</div>
          </div>
          <div className="text-center p-4 bg-[#F8F9FA] rounded-lg">
            <div className="text-2xl font-bold text-atlas-blue">
              {planPagos.periodos[0]?.cuota ? formatEuro(planPagos.periodos[0].cuota) : '—'}
            </div>
            <div className="text-sm text-gray-500">Cuota actual</div>
          </div>
          <div className="text-center p-4 bg-[#F8F9FA] rounded-lg">
            <div className="text-2xl font-bold text-atlas-blue">{prestamo.plazoMesesTotal} meses</div>
            <div className="text-sm text-gray-500">Plazo total</div>
          </div>
          <div className="text-center p-4 bg-[#F8F9FA] rounded-lg">
            <div className="text-2xl font-bold text-atlas-blue">{formatDate(planPagos.resumen.fechaFinalizacion)}</div>
            <div className="text-sm text-gray-500">Fin previsto</div>
          </div>
        </div>

        {/* Features chips */}
        <div className="flex flex-wrap gap-2">
          {getFeatures(prestamo).map((feature, index) => (
            <span key={index} className="px-2 py-1 bg-[#E5E7EB] text-gray-700 rounded text-xs">
              {feature}
            </span>
          ))}
          <span className="px-2 py-1 bg-[#E5E7EB] text-gray-700 rounded text-xs">
            Día de cargo: {prestamo.diaCargoMes}
          </span>
        </div>
      </div>

      {/* Bonifications Panel */}
      <BonificationPanel prestamo={prestamo} />

      {/* Payment Schedule */}
      <div className="bg-white rounded-lg border border-[#D7DEE7] p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-neutral-900 flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-atlas-blue" />
            <span>Plan de pagos</span>
          </h2>
          <div className="text-sm text-gray-500">
            Total intereses: {formatEuro(planPagos.resumen.totalIntereses)}
          </div>
        </div>

        {/* Payment schedule table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F9FA]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Devengo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha cargo</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cuota</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Interés</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amortización</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Principal final</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {currentPeriodos.map((periodo) => (
                <tr key={periodo.periodo} className="hover:bg-[#F8F9FA]">
                  <td className="px-3 py-3 text-neutral-900 font-medium">{periodo.periodo}</td>
                  <td className="px-3 py-3 text-gray-500">
                    {formatDate(periodo.devengoDesde)} - {formatDate(periodo.devengoHasta)}
                    {periodo.diasDevengo && (
                      <div className="text-xs text-gray-400">{periodo.diasDevengo} días</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-500">{formatDate(periodo.fechaCargo)}</td>
                  <td className="px-3 py-3 text-right text-neutral-900 font-medium">{formatEuro(periodo.cuota)}</td>
                  <td className="px-3 py-3 text-right text-gray-500">{formatEuro(periodo.interes)}</td>
                  <td className="px-3 py-3 text-right text-gray-500">{formatEuro(periodo.amortizacion)}</td>
                  <td className="px-3 py-3 text-right text-neutral-900 font-medium">{formatEuro(periodo.principalFinal)}</td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex justify-center space-x-1">
                      {periodo.esProrrateado && (
                        <span className="px-1 py-0.5 bg-warning-100 text-warning-600 rounded text-xs" title="Prorrateado">
                          P
                        </span>
                      )}
                      {periodo.esSoloIntereses && (
                        <span className="px-1 py-0.5 bg-info-100 text-info-600 rounded text-xs" title="Solo intereses">
                          I
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-500">
              Mostrando {startIndex + 1}-{Math.min(endIndex, planPagos.periodos.length)} de {planPagos.periodos.length} períodos
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-[#D7DEE7] rounded-md hover:bg-[#F8F9FA] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-500">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-[#D7DEE7] rounded-md hover:bg-[#F8F9FA] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Amortization Simulator Modal */}
      {showSimulator && (
        <AmortizationSimulator
          prestamo={prestamo}
          onClose={() => setShowSimulator(false)}
          onApply={(importe: number) => {
            // Handle amortization application
            console.log('Apply amortization:', importe);
            setShowSimulator(false);
            // Reload data after amortization
            loadPrestamoData();
          }}
        />
      )}
    </div>
  );
};

export default PrestamoDetail;