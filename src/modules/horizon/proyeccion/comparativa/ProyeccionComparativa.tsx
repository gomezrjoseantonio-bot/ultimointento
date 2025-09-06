import React, { useState, useEffect } from 'react';
import { Calendar, Building, Download, TrendingUp } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { formatEuro } from '../../../../utils/formatUtils';
import ComparativaTable from './components/ComparativaTable';
import MonthlyDetailModal from './components/MonthlyDetailModal';
import ExportModal from './components/ExportModal';
import { comparativaService, ComparativaData } from './services/comparativaService';

const ProyeccionComparativa: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedScope, setSelectedScope] = useState<'consolidado' | 'inmueble'>('consolidado');
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [data, setData] = useState<ComparativaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMonthlyDetail, setShowMonthlyDetail] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Available years (current and next few years)
  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear, currentYear + 1, currentYear + 2];

  useEffect(() => {
    loadComparativaData();
  }, [selectedYear, selectedScope, selectedPropertyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadComparativaData = async () => {
    try {
      setLoading(true);
      const comparativaData = await comparativaService.getComparativaData({
        year: selectedYear,
        scope: selectedScope,
        propertyId: selectedPropertyId
      });
      setData(comparativaData);
    } catch (error) {
      console.error('Error loading comparativa data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMonthClick = (month: number) => {
    setSelectedMonth(month);
    setShowMonthlyDetail(true);
  };

  if (loading) {
    return (
      <PageLayout title="Comparativa Anual" subtitle="Cargando datos...">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B2B5C]"></div>
        </div>
      </PageLayout>
    );
  }

  if (!data) {
    return (
      <PageLayout title="Comparativa Anual" subtitle="No hay datos disponibles">
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay datos para mostrar
          </h3>
          <p className="text-gray-600">
            Asegúrate de tener presupuestos confirmados para el año seleccionado
          </p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Comparativa Anual" subtitle="Budget vs Forecast vs Actual">
      <div className="space-y-6">
        {/* Header Controls */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Comparativa anual</h1>
          
          <div className="flex items-center space-x-4">
            {/* Year Selector */}
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-lg border-gray-300 text-sm focus:ring-[#0B2B5C] focus:border-[#0B2B5C]"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Scope Selector */}
            <div className="flex items-center space-x-2">
              <Building className="h-4 w-4 text-gray-500" />
              <select
                value={selectedScope}
                onChange={(e) => {
                  setSelectedScope(e.target.value as 'consolidado' | 'inmueble');
                  setSelectedPropertyId(null);
                }}
                className="rounded-lg border-gray-300 text-sm focus:ring-[#0B2B5C] focus:border-[#0B2B5C]"
              >
                <option value="consolidado">Consolidado</option>
                <option value="inmueble">Por inmueble</option>
              </select>
            </div>

            {/* Property Selector (if scope is inmueble) */}
            {selectedScope === 'inmueble' && (
              <select
                value={selectedPropertyId || ''}
                onChange={(e) => setSelectedPropertyId(Number(e.target.value))}
                className="rounded-lg border-gray-300 text-sm focus:ring-[#0B2B5C] focus:border-[#0B2B5C]"
              >
                <option value="">Seleccionar inmueble</option>
                {data.availableProperties.map(property => (
                  <option key={property.id} value={property.id}>
                    {property.alias}
                  </option>
                ))}
              </select>
            )}

            {/* Export Button */}
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center space-x-2 bg-[#0B2B5C] text-white px-4 py-2 rounded-lg hover:bg-[#0A2449] transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Exportar</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Ingresos YTD */}
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-[#0B2B5C]">
            <p className="text-sm font-medium text-gray-600">Ingresos YTD</p>
            <div className="space-y-1 mt-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Budget:</span>
                <span className="text-gray-900 tabular-nums">{formatEuro(data.kpis.ingresosYTD.budget)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Forecast:</span>
                <span className="text-gray-900 tabular-nums">{formatEuro(data.kpis.ingresosYTD.forecast)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-700">Actual:</span>
                <span className="text-[#0B2B5C] tabular-nums">{formatEuro(data.kpis.ingresosYTD.actual)}</span>
              </div>
            </div>
          </div>
          
          {/* Gastos YTD */}
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-[#0B2B5C]">
            <p className="text-sm font-medium text-gray-600">Gastos YTD</p>
            <div className="space-y-1 mt-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Budget:</span>
                <span className="text-gray-900 tabular-nums">{formatEuro(data.kpis.gastosYTD.budget)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Forecast:</span>
                <span className="text-gray-900 tabular-nums">{formatEuro(data.kpis.gastosYTD.forecast)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-700">Actual:</span>
                <span className="text-[#0B2B5C] tabular-nums">{formatEuro(data.kpis.gastosYTD.actual)}</span>
              </div>
            </div>
          </div>
          
          {/* Resultado neto YTD */}
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-teal-500">
            <p className="text-sm font-medium text-gray-600">Resultado neto YTD</p>
            <p className={`text-2xl font-semibold tabular-nums mt-2 ${data.kpis.resultadoNetoYTD >= 0 ? 'text-success-600' : 'text-error-600'}`}>
              {formatEuro(data.kpis.resultadoNetoYTD)}
            </p>
          </div>
          
          {/* DSCR YTD (if applicable) */}
          {data.kpis.dscrYTD !== null && (
            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-teal-500">
              <p className="text-sm font-medium text-gray-600">DSCR YTD</p>
              <p className={`text-2xl font-semibold tabular-nums mt-2 ${data.kpis.dscrYTD >= 1.25 ? 'text-success-600' : 'text-error-600'}`}>
                {data.kpis.dscrYTD.toFixed(2)} x
              </p>
            </div>
          )}
        </div>

        {/* Main Comparison Table */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Comparativa mensual</h3>
            <p className="text-sm text-gray-600">
              Budget (presupuesto) vs Forecast (proyección) vs Actual (real conciliado)
            </p>
          </div>
          
          <ComparativaTable 
            data={data}
            onMonthClick={handleMonthClick}
          />
        </div>

        {/* Monthly Detail Modal */}
        {showMonthlyDetail && selectedMonth !== null && (
          <MonthlyDetailModal
            isOpen={showMonthlyDetail}
            onClose={() => setShowMonthlyDetail(false)}
            month={selectedMonth}
            year={selectedYear}
            data={data}
          />
        )}

        {/* Export Modal */}
        {showExportModal && (
          <ExportModal
            isOpen={showExportModal}
            onClose={() => setShowExportModal(false)}
            data={data}
            year={selectedYear}
            scope={selectedScope}
          />
        )}
      </div>
    </PageLayout>
  );
};

export default ProyeccionComparativa;