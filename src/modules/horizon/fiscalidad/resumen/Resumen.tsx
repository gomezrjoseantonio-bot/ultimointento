import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { initDB, Property, FiscalSummary } from '../../../../services/db';
import { getFiscalSummary, exportFiscalData } from '../../../../services/fiscalSummaryService';
import { formatEuro, getAEATBoxDisplayName } from '../../../../services/aeatClassificationService';

interface PropertyFiscalData {
  property: Property;
  fiscalSummary: FiscalSummary | null;
  ingresos: number;
  gastos: number;
  amortizaciones: number;
  arrastres: number;
  neto: number;
}

const Resumen: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | 'todos' | null>('todos');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [fiscalSummary, setFiscalSummary] = useState<FiscalSummary | null>(null);
  const [allPropertiesData, setAllPropertiesData] = useState<PropertyFiscalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Vivo' | 'Prescrito'>('all');

  const loadProperties = useCallback(async () => {
    setLoading(true);
    try {
      const db = await initDB();
      const props = await db.getAll('properties');
      setProperties(props.filter(p => p.state === 'activo'));
      
      // Auto-select "todos" by default
      if (props.length > 0 && selectedPropertyId === null) {
        setSelectedPropertyId('todos');
      }
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId]);

  const loadFiscalSummary = useCallback(async () => {
    if (selectedPropertyId === null) return;
    
    const loadAllPropertiesData = async () => {
      const propertiesData: PropertyFiscalData[] = [];
      
      for (const property of properties) {
        if (!property.id) continue;
        
        try {
          const fiscalSummary = await getFiscalSummary(property.id, selectedYear);
          
          // Calculate metrics for this property
          const gastos = (fiscalSummary.box0105 || 0) + (fiscalSummary.box0106 || 0) + 
                       (fiscalSummary.box0109 || 0) + (fiscalSummary.box0112 || 0) + 
                       (fiscalSummary.box0113 || 0) + (fiscalSummary.box0114 || 0) + 
                       (fiscalSummary.box0115 || 0) + (fiscalSummary.box0117 || 0);
          
          const amortizaciones = fiscalSummary.annualDepreciation || 0;
          const arrastres = 0; // TODO: Implement carryforward calculation
          const ingresos = 0; // TODO: Implement income calculation from contracts
          const neto = ingresos - gastos - amortizaciones - arrastres;
          
          propertiesData.push({
            property,
            fiscalSummary,
            ingresos,
            gastos,
            amortizaciones,
            arrastres,
            neto
          });
        } catch (error) {
          console.error(`Error loading data for property ${property.alias}:`, error);
          propertiesData.push({
            property,
            fiscalSummary: null,
            ingresos: 0,
            gastos: 0,
            amortizaciones: 0,
            arrastres: 0,
            neto: 0
          });
        }
      }
      
      setAllPropertiesData(propertiesData);
      setFiscalSummary(null);
    };
    
    try {
      if (selectedPropertyId === 'todos') {
        // Load data for all properties
        await loadAllPropertiesData();
      } else {
        // Load data for single property
        const summary = await getFiscalSummary(selectedPropertyId, selectedYear);
        setFiscalSummary(summary);
        setAllPropertiesData([]);
      }
    } catch (error) {
      console.error('Error loading fiscal summary:', error);
      setFiscalSummary(null);
      setAllPropertiesData([]);
    }
  }, [selectedPropertyId, selectedYear, properties]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    if (selectedPropertyId) {
      loadFiscalSummary();
    } else {
      setFiscalSummary(null);
    }
  }, [selectedPropertyId, selectedYear, loadFiscalSummary]);

  const handleExport = async () => {
    if (!selectedPropertyId || selectedPropertyId === 'todos') return;

    try {
      const { summary, csvData } = await exportFiscalData(selectedPropertyId, selectedYear);
      
      // Create ZIP with PDFs and CSV
      const JSZip = await import('jszip');
      const zip = new JSZip.default();
      
      // Add CSV summary
      zip.file(`fiscal-${selectedYear}-casillas.csv`, csvData);
      
      // Add summary file
      const summaryData = [
        `Resumen Fiscal ${selectedYear}`,
        `Inmueble: ${properties.find(p => p.id === selectedPropertyId)?.alias}`,
        ``,
        `Casilla 0105 (Intereses financiación): ${formatEuro(summary.box0105)}`,
        `Casilla 0106 (Reparación/conservación): ${formatEuro(summary.box0106)}`,
        `Casilla 0109 (Comunidad): ${formatEuro(summary.box0109)}`,
        `Casilla 0112 (Servicios de terceros): ${formatEuro(summary.box0112)}`,
        `Casilla 0113 (Suministros): ${formatEuro(summary.box0113)}`,
        `Casilla 0114 (Seguros): ${formatEuro(summary.box0114)}`,
        `Casilla 0115 (Tributos locales): ${formatEuro(summary.box0115)}`,
        `Casilla 0117 (Amortización muebles): ${formatEuro(summary.box0117)}`,
        `CAPEX (Mejoras): ${formatEuro(summary.capexTotal)}`,
        ``,
        `Valor construcción: ${formatEuro(summary.constructionValue)}`,
        `Amortización anual: ${formatEuro(summary.annualDepreciation)}`,
        summary.deductibleExcess ? `Exceso deducible: ${formatEuro(summary.deductibleExcess)}` : '',
        `Estado: ${summary.status}`
      ].join('\n');
      
      zip.file(`resumen-fiscal-${selectedYear}.txt`, summaryData);
      
      // Generate and download ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fiscal-${selectedYear}-${properties.find(p => p.id === selectedPropertyId)?.alias || 'inmueble'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting fiscal data:', error);
    }
  };

  const getYearRange = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= currentYear - 10; year--) {
      years.push(year);
    }
    return years;
  };

  const getBoxes = () => {
    if (!fiscalSummary) return [];
    
    return [
      { box: '0105', label: getAEATBoxDisplayName('0105'), amount: fiscalSummary.box0105, status: fiscalSummary.status },
      { box: '0106', label: getAEATBoxDisplayName('0106'), amount: fiscalSummary.box0106, status: fiscalSummary.status },
      { box: '0109', label: getAEATBoxDisplayName('0109'), amount: fiscalSummary.box0109, status: fiscalSummary.status },
      { box: '0112', label: getAEATBoxDisplayName('0112'), amount: fiscalSummary.box0112, status: fiscalSummary.status },
      { box: '0113', label: getAEATBoxDisplayName('0113'), amount: fiscalSummary.box0113, status: fiscalSummary.status },
      { box: '0114', label: getAEATBoxDisplayName('0114'), amount: fiscalSummary.box0114, status: fiscalSummary.status },
      { box: '0115', label: getAEATBoxDisplayName('0115'), amount: fiscalSummary.box0115, status: fiscalSummary.status },
      { box: '0117', label: getAEATBoxDisplayName('0117'), amount: fiscalSummary.box0117, status: fiscalSummary.status },
      { box: 'CAPEX', label: 'Mejoras (valor +)', amount: fiscalSummary.capexTotal, status: fiscalSummary.status }
    ].filter(item => statusFilter === 'all' || item.status === statusFilter);
  };

  const getTotalAmount = () => {
    if (!fiscalSummary) return 0;
    return fiscalSummary.box0105 + fiscalSummary.box0106 + fiscalSummary.box0109 + 
           fiscalSummary.box0112 + fiscalSummary.box0113 + fiscalSummary.box0114 + 
           fiscalSummary.box0115 + fiscalSummary.box0117 + fiscalSummary.capexTotal;
  };

  // Helper functions for KPIs when "Todos" is selected
  const getGlobalKPIs = () => {
    if (!allPropertiesData.length) return null;
    
    const totalIngresos = allPropertiesData.reduce((sum, data) => sum + data.ingresos, 0);
    const totalGastos = allPropertiesData.reduce((sum, data) => sum + data.gastos, 0);
    const totalAmortizaciones = allPropertiesData.reduce((sum, data) => sum + data.amortizaciones, 0);
    const totalArrastres = allPropertiesData.reduce((sum, data) => sum + data.arrastres, 0);
    const cobrado = totalIngresos; // TODO: Implement actual cobrado/pendiente calculation
    const pendiente = 0; // TODO: Implement actual cobrado/pendiente calculation
    const netoFiscal = cobrado - totalGastos - totalAmortizaciones - totalArrastres;
    
    return {
      ingresosDevengados: totalIngresos,
      cobrado,
      pendiente,
      gastosDeducibles: totalGastos,
      amortizacionesAplicadas: totalAmortizaciones,
      arrastresAplicados: totalArrastres,
      netoFiscal
    };
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <PageLayout title="Resumen Fiscal" subtitle="Resumen fiscal anual de inversiones.">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Resumen Fiscal" subtitle="Resumen fiscal anual por inmueble (IRPF - Capital inmobiliario).">
      <div className="space-y-6">
        {/* Controls */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-64">
              <label className="block text-sm font-medium text-gray-700 mb-2">Inmueble</label>
              <select
                value={selectedPropertyId || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedPropertyId(value === 'todos' ? 'todos' : value ? parseInt(value) : null);
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50"
              >
                <option value="">Seleccionar inmueble</option>
                <option value="todos">Todos</option>
                {properties.map(property => (
                  <option key={property.id} value={property.id}>
                    {property.alias} - {property.address}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ejercicio</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50"
              >
                {getYearRange().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filtros</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'Vivo' | 'Prescrito')}
                className="border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50"
              >
                <option value="all">Vivo | Histórico</option>
                <option value="Vivo">Solo Vivo</option>
                <option value="Prescrito">Solo Histórico</option>
              </select>
            </div>
            
            {fiscalSummary && selectedPropertyId !== 'todos' && (
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            )}
          </div>
        </div>

        {/* Content - KPIs and Tables */}
        {selectedPropertyId === 'todos' ? (
          // Global view for all properties
          <>
            {allPropertiesData.length > 0 && (
              <>
                {/* KPIs Section */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">KPIs Globales — Ejercicio: {selectedYear}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                    {(() => {
                      const kpis = getGlobalKPIs();
                      if (!kpis) return null;
                      
                      return (
                        <>
                          <div className="text-center">
                            <div className="text-2xl font-semibold text-blue-900">{formatCurrency(kpis.ingresosDevengados)}</div>
                            <div className="text-sm text-gray-600">Ingresos devengados</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-semibold text-green-700">{formatCurrency(kpis.cobrado)}</div>
                            <div className="text-sm text-gray-600">Cobrado</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-semibold text-orange-600">{formatCurrency(kpis.pendiente)}</div>
                            <div className="text-sm text-gray-600">Pendiente</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-semibold text-red-700">{formatCurrency(kpis.gastosDeducibles)}</div>
                            <div className="text-sm text-gray-600">Gastos deducibles</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-semibold text-purple-700">{formatCurrency(kpis.amortizacionesAplicadas)}</div>
                            <div className="text-sm text-gray-600">Amortizaciones</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-semibold text-gray-700">{formatCurrency(kpis.arrastresAplicados)}</div>
                            <div className="text-sm text-gray-600">Arrastres aplicados</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-900">{formatCurrency(getGlobalKPIs()?.netoFiscal || 0)}</div>
                      <div className="text-sm text-gray-600">Neto Fiscal</div>
                    </div>
                  </div>
                </div>

                {/* Macro Table */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Tabla Macro por Inmueble — Ejercicio: {selectedYear}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inmueble</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ingresos</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gastos</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amort.</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Arrastres</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Neto</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {allPropertiesData.map((data, index) => (
                          <tr key={data.property.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {data.property.alias}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              {formatCurrency(data.ingresos)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              {formatCurrency(data.gastos)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              {formatCurrency(data.amortizaciones)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              {formatCurrency(data.arrastres)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                              {formatCurrency(data.neto)}
                            </td>
                          </tr>
                        ))}
                        {/* Total Row */}
                        <tr className="bg-gray-100 font-medium">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">TOTAL</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                            {formatCurrency(allPropertiesData.reduce((sum, data) => sum + data.ingresos, 0))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                            {formatCurrency(allPropertiesData.reduce((sum, data) => sum + data.gastos, 0))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                            {formatCurrency(allPropertiesData.reduce((sum, data) => sum + data.amortizaciones, 0))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                            {formatCurrency(allPropertiesData.reduce((sum, data) => sum + data.arrastres, 0))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                            {formatCurrency(allPropertiesData.reduce((sum, data) => sum + data.neto, 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        ) : selectedPropertyId && fiscalSummary ? (
          // Single property view
          <>
            {/* Single Property KPIs */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                KPIs — {properties.find(p => p.id === selectedPropertyId)?.alias} | Ejercicio: {selectedYear}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-blue-900">{formatCurrency(0)}</div>
                  <div className="text-sm text-gray-600">Ingresos devengados</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-green-700">{formatCurrency(0)}</div>
                  <div className="text-sm text-gray-600">Cobrado</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-orange-600">{formatCurrency(0)}</div>
                  <div className="text-sm text-gray-600">Pendiente</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-red-700">{formatCurrency(getTotalAmount())}</div>
                  <div className="text-sm text-gray-600">Gastos deducibles</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-purple-700">{formatCurrency(fiscalSummary.annualDepreciation || 0)}</div>
                  <div className="text-sm text-gray-600">Amortizaciones</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-700">{formatCurrency(fiscalSummary.deductibleExcess || 0)}</div>
                  <div className="text-sm text-gray-600">Arrastres aplicados</div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {formatCurrency(0 - getTotalAmount() - (fiscalSummary.annualDepreciation || 0) - (fiscalSummary.deductibleExcess || 0))}
                  </div>
                  <div className="text-sm text-gray-600">Neto Fiscal</div>
                </div>
              </div>
            </div>

            {/* Single Property Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Tabla Macro — {properties.find(p => p.id === selectedPropertyId)?.alias} | Ejercicio: {selectedYear}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inmueble</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ingresos</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gastos</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amort.</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Arrastres</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Neto</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {properties.find(p => p.id === selectedPropertyId)?.alias}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(getTotalAmount())}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(fiscalSummary.annualDepreciation || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(fiscalSummary.deductibleExcess || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                        {formatCurrency(0 - getTotalAmount() - (fiscalSummary.annualDepreciation || 0) - (fiscalSummary.deductibleExcess || 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* AEAT Details Table (for single property) */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Detalle AEAT — {properties.find(p => p.id === selectedPropertyId)?.alias} | Ejercicio: {selectedYear}
                </h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Casilla</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total (€)</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getBoxes().map((item, index) => (
                      <tr key={index} className={item.amount > 0 ? 'bg-blue-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.box}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.label}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                          {formatEuro(item.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            item.status === 'Vivo' 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-100 font-medium">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">TOTAL</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                        {formatEuro(getTotalAmount())}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* Additional Information */}
              <div className="p-6 bg-gray-50 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Notas:</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  {fiscalSummary.deductibleExcess && fiscalSummary.deductibleExcess > 0 && (
                    <p>• Exceso 0105+0106: {formatEuro(fiscalSummary.deductibleExcess)} → arrastre 4 años.</p>
                  )}
                  <p>• Valor construcción: {formatEuro(fiscalSummary.constructionValue)} {fiscalSummary.capexTotal > 0 && `(incluye CAPEX ${formatEuro(fiscalSummary.capexTotal)})`}.</p>
                  <p>• Amortización anual: {formatEuro(fiscalSummary.annualDepreciation)} (3%).</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          // Empty state
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Selecciona un inmueble</h3>
            <p className="text-gray-500">Elige un inmueble y ejercicio fiscal para ver el resumen.</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default Resumen;