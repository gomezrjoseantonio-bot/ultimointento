import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, FileText, Calculator, TrendingDown, Search, ExternalLink, Info, CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { initDB, Ingreso, Gasto, Contract, Property, IngresoEstado, GastoEstado } from '../../../../services/db';
import AmortizationDetail from '../../../../components/fiscalidad/AmortizationDetail';
import { getAEATBoxDisplayName, AEAT_CLASSIFICATION_MAP } from '../../../../services/aeatClassificationService';
import { findIncomeReconciliationMatches, updateIncomeReconciliationStatus } from '../../../../services/incomeReconciliationService';

type DetalleSection = 'ingresos' | 'gastos' | 'amortizaciones' | 'arrastres';

interface DetalleFilters {
  year: number;
  propertyId: number | 'todos';
  searchTerm: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

const Detalle: React.FC = () => {
  const [activeSection, setActiveSection] = useState<DetalleSection>('ingresos');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciliationSuggestions, setReconciliationSuggestions] = useState<any[]>([]);
  const [showReconciliationPanel, setShowReconciliationPanel] = useState(false);
  
  const [filters, setFilters] = useState<DetalleFilters>({
    year: new Date().getFullYear(),
    propertyId: 'todos',
    searchTerm: '',
    status: 'all',
    dateFrom: '',
    dateTo: ''
  });

  const sections = [
    { id: 'ingresos' as DetalleSection, label: 'Ingresos', icon: BarChart3 },
    { id: 'gastos' as DetalleSection, label: 'Gastos AEAT', icon: FileText },
    { id: 'amortizaciones' as DetalleSection, label: 'Amortizaciones', icon: Calculator },
    { id: 'arrastres' as DetalleSection, label: 'Arrastres', icon: TrendingDown },
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const db = await initDB();
      const [contractsData, ingresosData, gastosData, propertiesData] = await Promise.all([
        db.getAll('contracts'),
        db.getAll('ingresos'),
        db.getAll('gastos'),
        db.getAll('properties')
      ]);
      
      setContracts(contractsData);
      setIngresos(ingresosData);
      setGastos(gastosData);
      setProperties(propertiesData);

      // Load reconciliation suggestions for income
      if (activeSection === 'ingresos') {
        const suggestions = await findIncomeReconciliationMatches();
        setReconciliationSuggestions(suggestions);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeSection]);

  const handleReconcileIncome = async (ingresoId: number, movementId: number) => {
    try {
      await updateIncomeReconciliationStatus(ingresoId, movementId);
      await loadData(); // Reload data to reflect changes
    } catch (error) {
      console.error('Error reconciling income:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  const getStatusChip = (status: IngresoEstado | GastoEstado) => {
    const statusMap = {
      'previsto': { 
        label: 'Prevista', 
        color: 'bg-warning-100 text-yellow-800 border-yellow-200',
        icon: Clock 
      },
      'cobrado': { 
        label: 'Cobrada', 
        color: 'bg-success-100 text-success-800 border-success-200',
        icon: CheckCircle 
      },
      'incompleto': { 
        label: 'Parcialmente cobrada', 
        color: 'bg-warning-100 text-orange-800 border-orange-200',
        icon: AlertCircle 
      },
      'completo': { 
        label: 'Completo', 
        color: 'bg-primary-100 text-primary-800 border-primary-200',
        icon: CheckCircle 
      },
      'pagado': { 
        label: 'Pagado', 
        color: 'bg-success-100 text-success-800 border-success-200',
        icon: CheckCircle 
      }
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { 
      label: status, 
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      icon: AlertCircle 
    };
    
    const IconComponent = statusInfo.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium border ${statusInfo.color}`}>
        <IconComponent className="w-3 h-3" />
        {statusInfo.label}
      </span>
    );
  };

  const renderFilters = () => (
    <div className="bg-white border border-gray-200 p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Búsqueda</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              placeholder="Buscar..."
              className="pl-10 w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Todos</option>
            {activeSection === 'ingresos' && (
              <>
                <option value="previsto">Prevista</option>
                <option value="cobrado">Cobrada</option>
                <option value="incompleto">Parcialmente cobrada</option>
              </>
            )}
            {activeSection === 'gastos' && (
              <>
                <option value="completo">Completo</option>
                <option value="pagado">Pagado</option>
                <option value="incompleto">Incompleto</option>
              </>
            )}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
          />
        </div>
      </div>
    </div>
  );

  const renderIngresosSection = () => {
    const filteredIngresos = ingresos.filter(ingreso => {
      const matchesSearch = !filters.searchTerm || 
        ingreso.contraparte.toLowerCase().includes(filters.searchTerm.toLowerCase());
      const matchesStatus = filters.status === 'all' || ingreso.estado === filters.status;
      const matchesDateFrom = !filters.dateFrom || ingreso.fecha_emision >= filters.dateFrom;
      const matchesDateTo = !filters.dateTo || ingreso.fecha_emision <= filters.dateTo;
      
      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
    });

    const unreconciledCount = filteredIngresos.filter(i => !i.movement_id).length;

    return (
      <div className="space-y-6">
        {renderFilters()}
        
        {/* Reconciliation Summary */}
        {reconciliationSuggestions.length > 0 && (
          <div className="btn-secondary-horizon btn-primary-horizon ">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-5 h-5 text-primary-600" />
                <span className="text-sm font-medium text-primary-900">
                  {reconciliationSuggestions.length} ingresos con sugerencias de conciliación
                </span>
              </div>
              <button
                onClick={() => setShowReconciliationPanel(!showReconciliationPanel)}
                className="text-sm text-primary-600 hover:text-primary-800"
              >
                {showReconciliationPanel ? 'Ocultar' : 'Ver sugerencias'}
              </button>
            </div>
          </div>
        )}
        
        <div className="bg-white border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Ingresos por Contrato</h3>
                <p className="text-sm text-gray-600">
                  Detalle de ingresos devengados y estado de cobro 
                  {unreconciledCount > 0 && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-warning-100 text-yellow-800">
                      {unreconciledCount} sin conciliar
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => loadData()}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm text-gray-700 bg-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualizar
              </button>
            </div>
          </div>

          {filteredIngresos.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">No hay ingresos para mostrar con los filtros seleccionados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha Devengo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contrato/Inquilino
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Importe
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Conciliación
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Enlaces
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredIngresos.map((ingreso) => {
                    const contract = contracts.find(c => c.id === ingreso.origen_id);
                    const suggestion = reconciliationSuggestions.find(s => s.ingreso.id === ingreso.id);
                    const hasReconciliation = !!ingreso.movement_id;
                    
                    return (
                      <tr key={ingreso.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(ingreso.fecha_emision)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {contract?.tenant?.name || ingreso.contraparte}
                          </div>
                          <div className="text-sm text-gray-500">
                            Contrato #{contract?.id || 'No encontrado'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatCurrency(ingreso.importe)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {getStatusChip(ingreso.estado)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {hasReconciliation ? (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-success-100 text-success-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Conciliado
                            </span>
                          ) : suggestion && suggestion.potentialMovements.length > 0 ? (
                            <div className="flex flex-col space-y-1">
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-warning-100 text-orange-800">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                {suggestion.potentialMovements.length} sugerencias
                              </span>
                              {showReconciliationPanel && (
                                <div className="space-y-1">
                                  {suggestion.potentialMovements.slice(0, 1).map((match: any, idx: number) => (
                                    <button
                                      key={idx}
                                      onClick={() => handleReconcileIncome(ingreso.id!, match.movement.id)}
                                      className="btn-primary-horizon btn-primary-horizon text-xs px-2 py-1 text-primary-800 rounded hover: "
            title={`Confianza: ${match.confidence}% - ${match.reason}`}
          >
                                      Conciliar ({match.confidence}%)
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800">
                              <Clock className="w-3 h-3 mr-1" />
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex items-center justify-center space-x-2">
                            {ingreso.movement_id && (
                              <button
                                title="Ver conciliación"
                                className="text-primary-600 hover:text-primary-800"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </button>
                            )}
                            {contract && (
                              <button
                                title="Ver contrato"
                                className="text-success-600 hover:text-success-800"
                              >
                                <FileText className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderGastosSection = () => {
    const gastosGrouped = gastos.reduce((acc, gasto) => {
      const category = gasto.categoria_AEAT;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(gasto);
      return acc;
    }, {} as Record<string, Gasto[]>);

    return (
      <div className="space-y-6">
        {renderFilters()}
        
        <div className="bg-white border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Gastos Deducibles AEAT (0105-0117)</h3>
            <p className="text-sm text-gray-600">Clasificación por categorías con totales</p>
          </div>

          <div className="space-y-6 p-6">
            {Object.entries(gastosGrouped).map(([category, categoryGastos]) => {
              const total = categoryGastos.reduce((sum, gasto) => sum + gasto.total, 0);
              
              return (
                <div key={category} className="border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900">
                        Casilla {AEAT_CLASSIFICATION_MAP[category as keyof typeof AEAT_CLASSIFICATION_MAP]} - {getAEATBoxDisplayName(AEAT_CLASSIFICATION_MAP[category as keyof typeof AEAT_CLASSIFICATION_MAP])}
                      </h4>
                      <span className="text-sm font-semibold text-gray-900">
                        Total: {formatCurrency(total)} ({categoryGastos.length} facturas)
                      </span>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Fecha</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Proveedor</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Inmueble</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Base</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">IVA</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Estado</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Enlaces</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {categoryGastos.map((gasto) => {
                          const property = properties.find(p => p.id === gasto.destino_id);
                          return (
                            <tr key={gasto.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {formatDate(gasto.fecha_emision)}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                <div className="font-medium">{gasto.contraparte_nombre}</div>
                                {gasto.contraparte_nif && (
                                  <div className="text-xs text-gray-500">{gasto.contraparte_nif}</div>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {property ? property.alias : 'No asignado'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 text-right">
                                {gasto.base ? formatCurrency(gasto.base) : '—'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 text-right">
                                {gasto.iva ? formatCurrency(gasto.iva) : '—'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">
                                {formatCurrency(gasto.total)}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {getStatusChip(gasto.estado)}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <div className="flex items-center justify-center space-x-2">
                                  {gasto.movement_id && (
                                    <button
                                      title="Ver conciliación bancaria"
                                      className="text-success-600 hover:text-success-800"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </button>
                                  )}
                                  {gasto.source_doc_id && (
                                    <button
                                      title="Ver documento"
                                      className="text-primary-600 hover:text-primary-800"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderAmortizacionesSection = () => {
    // Filter properties based on current filters
    const filteredProperties = properties.filter(property => {
      if (filters.propertyId !== 'todos' && property.id !== filters.propertyId) {
        return false;
      }
      
      // Only show properties with AEAT amortization data configured
      return property.aeatAmortization && property.aeatAmortization.acquisitionType;
    });

    if (filteredProperties.length === 0) {
      return (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Amortizaciones AEAT</h3>
            <div className="text-center py-8 text-gray-500">
              <Calculator className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No hay inmuebles con datos de amortización AEAT configurados</p>
              <p className="text-sm mt-2">
                Configure los datos de amortización AEAT en la ficha de cada inmueble para ver los cálculos detallados.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {filteredProperties.map((property) => (
          <AmortizationDetail
            key={`amortization-${property.id}`}
            propertyId={property.id!}
            exerciseYear={filters.year}
          />
        ))}
      </div>
    );
  };

  const renderArrastresSection = () => (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Arrastres</h3>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Info className="h-4 w-4" />
            <span title="Aplicable hasta 4 ejercicios">Límite 4 años</span>
          </div>
        </div>
        
        <div className="text-center py-12 text-gray-500">
          <TrendingDown className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-lg">Funcionalidad en desarrollo</p>
          <p className="text-sm">Categoría AEAT, original, aplicado este año, pendiente, año límite</p>
        </div>
      </div>
    </div>
  );

  const renderSectionContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="btn-secondary-horizon animate-spin h-8 w-8 "></div>
        </div>
      );
    }

    switch (activeSection) {
      case 'ingresos':
        return renderIngresosSection();
      case 'gastos':
        return renderGastosSection();
      case 'amortizaciones':
        return renderAmortizacionesSection();
      case 'arrastres':
        return renderArrastresSection();
      default:
        return null;
    }
  };

  return (
    <PageLayout title="Detalle" subtitle="Detalle de ingresos, gastos, amortizaciones y arrastres.">
      <div className="space-y-6">
        {/* Section Tabs */}
        <div className="bg-white border border-gray-200 p-1">
          <div className="grid grid-cols-4 gap-1">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium ${
                    isActive
                      ? 'bg-primary-100 text-primary-700 border-b-2 border-primary-500'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section Content */}
        {renderSectionContent()}
      </div>
    </PageLayout>
  );
};

export default Detalle;