import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  KPIConfiguration, 
  KPITemplate, 
  KPIMetricType, 
  KPI_TEMPLATES, 
  KPI_METRICS, 
  DEFAULT_KPI_CONFIG,
  kpiService,
  PropertyKPIData
} from '../../services/kpiService';
import { Eye, Save, RotateCcw, GripVertical, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const KpiBuilder: React.FC = () => {
  const { currentModule } = useTheme();
  const [config, setConfig] = useState<KPIConfiguration>(DEFAULT_KPI_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PropertyKPIData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Setup sensors for drag and drop with better touch support
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance for touch devices
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true);
        const savedConfig = await kpiService.getConfiguration(currentModule);
        setConfig(savedConfig);
      } catch (error) {
        console.error('Error loading KPI configuration:', error);
        toast.error('Error al cargar la configuración de KPIs');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadConfig();
  }, [currentModule]);

  const handleTemplateChange = (template: KPITemplate) => {
    const templateMetrics = KPI_TEMPLATES[template].metrics;
    setConfig(prev => ({
      ...prev,
      template,
      activeMetrics: [...templateMetrics],
      metricOrder: [...templateMetrics]
    }));
  };

  const handleMetricToggle = (metricId: KPIMetricType) => {
    setConfig(prev => {
      const isActive = prev.activeMetrics.includes(metricId);
      let newActiveMetrics: KPIMetricType[];
      let newMetricOrder: KPIMetricType[];

      if (isActive) {
        // Remove metric
        newActiveMetrics = prev.activeMetrics.filter(id => id !== metricId);
        newMetricOrder = prev.metricOrder.filter(id => id !== metricId);
      } else {
        // Add metric
        newActiveMetrics = [...prev.activeMetrics, metricId];
        newMetricOrder = [...prev.metricOrder, metricId];
      }

      return {
        ...prev,
        activeMetrics: newActiveMetrics,
        metricOrder: newMetricOrder
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    if (active.id !== over.id) {
      const oldIndex = config.metricOrder.findIndex((metric) => metric === active.id);
      const newIndex = config.metricOrder.findIndex((metric) => metric === over.id);

      const newOrder = arrayMove(config.metricOrder, oldIndex, newIndex);

      setConfig(prev => ({
        ...prev,
        metricOrder: newOrder
      }));
    }
  };

  const handleParameterChange = (key: keyof KPIConfiguration['parameters'], value: any) => {
    setConfig(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [key]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await kpiService.saveConfiguration(config, currentModule);
      toast.success('Configuración de KPIs guardada correctamente');
    } catch (error) {
      console.error('Error saving KPI configuration:', error);
      toast.error('Error al guardar la configuración de KPIs');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToTemplate = () => {
    const templateMetrics = KPI_TEMPLATES[config.template].metrics;
    setConfig(prev => ({
      ...prev,
      activeMetrics: [...templateMetrics],
      metricOrder: [...templateMetrics]
    }));
  };

  const handlePreview = async () => {
    try {
      setIsLoadingPreview(true);
      setShowPreview(true);
      
      // Get the first property for preview (or show placeholder if none)
      const db = await import('../../services/db').then(m => m.initDB());
      const dbInstance = await db;
      const properties = await dbInstance.getAll('properties');
      
      if (properties.length === 0) {
        setPreviewData(null);
        return;
      }

      // Use the most recently created property
      const latestProperty = properties.sort((a: any, b: any) => 
        new Date(b.acquisitionCosts?.price ? b.createdAt || '0' : '0').getTime() - 
        new Date(a.acquisitionCosts?.price ? a.createdAt || '0' : '0').getTime()
      )[0];

      const kpiData = await kpiService.calculateKPIsForProperty(latestProperty.id!, config);
      setPreviewData(kpiData);
    } catch (error) {
      console.error('Error generating preview:', error);
      toast.error('Error al generar la previsualización');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-600">Cargando configuración de KPIs...</div>
      </div>
    );
  }

  const accentColor = currentModule === 'horizon' ? 'brand-navy' : 'brand-teal';

  return (
    <div className="space-y-8">
      {/* Templates Section */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Plantillas</h3>
        <p className="text-neutral-600 mb-6">
          Selecciona una plantilla base que se adapte a tu perfil de análisis.
        </p>
        
        <div className="space-y-3">
          {Object.entries(KPI_TEMPLATES).map(([key, template]) => (
            <label key={key} className="flex items-center">
              <input
                type="radio"
                name="template"
                value={key}
                checked={config.template === key}
                onChange={() => handleTemplateChange(key as KPITemplate)}
                className={`mr-3 text-${accentColor} focus:ring-${accentColor}`}
              />
              <div>
                <span className="font-medium text-neutral-900">{template.name}</span>
                <p className="text-sm text-neutral-600">
                  {key === 'basico' && 'Métricas esenciales de rentabilidad e ingresos'}
                  {key === 'fiscal' && 'Enfoque en deducibilidad y tratamiento fiscal (disponible en H9)'}
                  {key === 'inversor' && 'Análisis avanzado de rentabilidad y capitalización'}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Active Metrics Section */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-900">Métricas activas</h3>
          <div className="flex gap-2">
            <button
              onClick={handleResetToTemplate}
              className="inline-flex items-center gap-2 px-3 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Restablecer a plantilla
            </button>
          </div>
        </div>
        
        <p className="text-neutral-600 mb-6">
          Arrastra para reordenar las métricas o usa los checkboxes para activarlas/desactivarlas.
        </p>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={config.metricOrder}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {config.metricOrder.map((metricId) => {
                const metric = KPI_METRICS[metricId];
                const isActive = config.activeMetrics.includes(metricId);
                
                return (
                  <div
                    key={metricId}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-shadow border-neutral-200 hover:border-neutral-300 ${isActive ? 'bg-neutral-50' : 'bg-white opacity-60'}`}
                  >
                    <div className="text-neutral-400">
                      <GripVertical className="w-5 h-5" />
                    </div>
                    
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => handleMetricToggle(metricId)}
                      className={`rounded text-${accentColor} focus:ring-${accentColor}`}
                    />
                    
                    <div className="flex-1">
                      <div className="font-medium text-neutral-900">{metric.name}</div>
                      <div className="text-sm text-neutral-600">{metric.description}</div>
                    </div>
                    
                    <div className="text-xs text-neutral-500 bg-neutral-100 px-2 py-1 rounded">
                      {metric.unit === 'currency' && '€'}
                      {metric.unit === 'percentage' && '%'}
                      {metric.unit === 'ratio' && 'x'}
                    </div>
                  </div>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {/* Additional available metrics */}
        <div className="mt-6 pt-6 border-t border-neutral-200">
          <h4 className="font-medium text-neutral-900 mb-3">Métricas disponibles</h4>
          <div className="space-y-2">
            {Object.entries(KPI_METRICS)
              .filter(([metricId]) => !config.metricOrder.includes(metricId as KPIMetricType))
              .map(([metricId, metric]) => (
                <div key={metricId} className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 bg-neutral-50">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => handleMetricToggle(metricId as KPIMetricType)}
                    className={`rounded text-${accentColor} focus:ring-${accentColor}`}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-neutral-900">{metric.name}</div>
                    <div className="text-sm text-neutral-600">{metric.description}</div>
                  </div>
                  <div className="text-xs text-neutral-500 bg-neutral-100 px-2 py-1 rounded">
                    {metric.unit === 'currency' && '€'}
                    {metric.unit === 'percentage' && '%'}
                    {metric.unit === 'ratio' && 'x'}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Parameters Section */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Parámetros</h3>
        <p className="text-neutral-600 mb-6">
          Configura los parámetros que afectan al cálculo de las métricas.
        </p>

        <div className="space-y-6">
          {/* Cost Basis */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Base de coste para rentabilidades
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="costBasis"
                  value="precio-solo"
                  checked={config.parameters.costBasis === 'precio-solo'}
                  onChange={(e) => handleParameterChange('costBasis', e.target.value)}
                  className={`mr-2 text-${accentColor} focus:ring-${accentColor}`}
                />
                <span className="text-sm">Precio solo</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="costBasis"
                  value="coste-adquisicion"
                  checked={config.parameters.costBasis === 'coste-adquisicion'}
                  onChange={(e) => handleParameterChange('costBasis', e.target.value)}
                  className={`mr-2 text-${accentColor} focus:ring-${accentColor}`}
                />
                <span className="text-sm">Coste de adquisición (precio + costes marcados)</span>
              </label>
            </div>
          </div>

          {/* Acquisition Costs Inclusion */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-3">
              Incluir en "Coste de adquisición"
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'includeITP', label: 'ITP/IVA' },
                { key: 'includeNotary', label: 'Notaría' },
                { key: 'includeRegistry', label: 'Registro' },
                { key: 'includeManagement', label: 'Gestoría' },
                { key: 'includePSI', label: 'PSI' },
                { key: 'includeRealEstate', label: 'Inmobiliaria' },
                { key: 'includeOther', label: 'Otros' }
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.parameters[key as keyof typeof config.parameters] as boolean}
                    onChange={(e) => handleParameterChange(key as keyof typeof config.parameters, e.target.checked)}
                    className={`mr-2 rounded text-${accentColor} focus:ring-${accentColor}`}
                  />
                  <span className="text-sm text-neutral-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* CAPEX Amortization */}
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.parameters.capexAmortizable}
                onChange={(e) => handleParameterChange('capexAmortizable', e.target.checked)}
                className={`mr-2 rounded text-${accentColor} focus:ring-${accentColor}`}
              />
              <span className="text-sm font-medium text-neutral-700">CAPEX amortizable en KPIs</span>
            </label>
            {config.parameters.capexAmortizable && (
              <div className="ml-6">
                <label className="block text-sm text-neutral-600 mb-1">
                  Ventana de amortización (años)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={config.parameters.capexYears}
                  onChange={(e) => handleParameterChange('capexYears', parseInt(e.target.value) || 10)}
                  className="block w-20 rounded-md border-neutral-300 text-sm focus:border-brand-navy focus:ring-brand-navy"
          >
                />
              </div>
            )}
          </div>

          {/* Management Fee */}
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.parameters.managementFee}
                onChange={(e) => handleParameterChange('managementFee', e.target.checked)}
                className={`mr-2 rounded text-${accentColor} focus:ring-${accentColor}`}
              />
              <span className="text-sm font-medium text-neutral-700">Fee de gestión</span>
            </label>
            {config.parameters.managementFee && (
              <div className="ml-6">
                <label className="block text-sm text-neutral-600 mb-1">
                  Porcentaje sobre renta (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  value={config.parameters.managementFeePercent}
                  onChange={(e) => handleParameterChange('managementFeePercent', parseFloat(e.target.value) || 5)}
                  className="block w-20 rounded-md border-neutral-300 text-sm focus:border-brand-navy focus:ring-brand-navy"
          >
                />
              </div>
            )}
          </div>

          {/* Vacancy Rate */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Vacancia estimada (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={config.parameters.vacancyPercent}
              onChange={(e) => handleParameterChange('vacancyPercent', parseFloat(e.target.value) || 7.5)}
              className="block w-24 rounded-md border-neutral-300 text-sm focus:border-brand-navy focus:ring-brand-navy"
          >
            />
          </div>

          {/* DSCR Visibility */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.parameters.dxcrVisible}
                onChange={(e) => handleParameterChange('dxcrVisible', e.target.checked)}
                className={`mr-2 rounded text-${accentColor} focus:ring-${accentColor}`}
              />
              <span className="text-sm font-medium text-neutral-700">DSCR visible</span>
              <span className="ml-2 text-xs text-neutral-500">(por defecto oculto)</span>
            </label>
          </div>

          {/* Market Value */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Valor de mercado (opcional)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={config.parameters.marketValue || ''}
              onChange={(e) => handleParameterChange('marketValue', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="Si está, cap rate usa este valor"
              className="block w-64 rounded-md border-neutral-300 text-sm focus:border-brand-navy focus:ring-brand-navy"
          >
            />
            <p className="text-xs text-neutral-500 mt-1">
              Si no se especifica, cap rate usará la base de coste seleccionada
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePreview}
          disabled={isLoadingPreview}
          className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
        >
          <Eye className="w-4 h-4" />
          {isLoadingPreview ? 'Generando...' : 'Previsualizar'}
        </button>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`inline-flex items-center gap-2 px-4 py-2 bg-${accentColor} text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50`}
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-gray-200 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-900">
                  Previsualización de KPIs
                </h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  ✕
                </button>
              </div>
              {previewData && (
                <p className="text-sm text-neutral-600 mt-2">
                  Datos del último inmueble creado (ID: {previewData.propertyId})
                </p>
              )}
            </div>
            
            <div className="p-6">
              {isLoadingPreview ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-neutral-600">Calculando KPIs...</div>
                </div>
              ) : previewData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {previewData.kpis.map((kpi, index) => {
                    const metric = KPI_METRICS[kpi.metricId];
                    return (
                      <div key={kpi.metricId} className="bg-neutral-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-neutral-900">
                            {metric.name}
                          </span>
                          {kpi.tooltipText && (
                            <div className="group relative">
                              <Info className="w-4 h-4 text-neutral-400" />
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-neutral-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                                {kpi.tooltipText}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className={`text-xl font-semibold ${kpi.isAvailable ? 'text-neutral-900' : 'text-neutral-400'}`}>
                          {kpi.formattedValue}
                        </div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {metric.category}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-neutral-600 mb-4">
                    No hay inmuebles registrados para previsualizar
                  </div>
                  <p className="text-sm text-neutral-500">
                    Crea un inmueble primero para ver cómo se calculan las métricas
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KpiBuilder;