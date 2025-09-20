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
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  dashboardService, 
  DashboardConfiguration, 
  DashboardBlockConfig, 
  DashboardBlockType 
} from '../../services/dashboardService';
import { 
  Settings, 
  Eye, 
  Save, 
  RotateCcw, 
  GripVertical, 
  Plus,
  Minus,
  Banknote,
  TrendingUp,
  BarChart3,
  FileText,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmAction } from '../../services/confirmationService';

const DashboardConfig: React.FC = () => {
  const { currentModule } = useTheme();
  const [config, setConfig] = useState<DashboardConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [propertyCount, setPropertyCount] = useState(0);

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

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setIsLoading(true);
      const [dashboardConfig, propCount] = await Promise.all([
        dashboardService.loadConfiguration(),
        dashboardService.getPropertyCount()
      ]);
      setConfig(dashboardConfig);
      setPropertyCount(propCount);
    } catch (error) {
      console.error('Error loading dashboard configuration:', error);
      toast.error('Error al cargar la configuración del dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    
    try {
      setIsSaving(true);
      await dashboardService.saveConfiguration(config);
      toast.success('Configuración guardada correctamente');
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    const confirmed = await confirmAction(
      'restaurar la configuración por defecto',
      'Esto eliminará todas las personalizaciones.'
    );
    if (!confirmed) return;

    try {
      const defaultConfig = await dashboardService.resetToDefault();
      setConfig(defaultConfig);
      toast.success('Configuración restaurada a valores por defecto');
    } catch (error) {
      console.error('Error resetting to default:', error);
      toast.error('Error al restaurar la configuración');
    }
  };

  const handleBlockToggle = (blockId: DashboardBlockType) => {
    if (!config) return;

    const updatedBlocks = config.blocks.map((block: DashboardBlockConfig) =>
      block.id === blockId ? { ...block, isActive: !block.isActive } : block
    );

    setConfig({
      ...config,
      blocks: updatedBlocks
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !config) return;

    if (active.id !== over.id) {
      const oldIndex = config.blocks.findIndex((block) => block.id === active.id);
      const newIndex = config.blocks.findIndex((block) => block.id === over.id);

      const newBlocks = arrayMove(config.blocks, oldIndex, newIndex);
      
      // Update positions
      const updatedBlocks = newBlocks.map((block: DashboardBlockConfig, index: number) => ({
        ...block,
        position: index
      }));

      setConfig({
        ...config,
        blocks: updatedBlocks
      });
    }
  };

  const handlePreview = () => {
    // For now, just show a preview mode
    setShowPreview(!showPreview);
    toast('Vista previa - navega a /panel para ver el dashboard completo', { icon: '👀' });
  };

  const getBlockIcon = (blockType: DashboardBlockType) => {
    const iconProps = { className: "w-5 h-5" };
    
    switch (blockType) {
      case 'treasury': return <Banknote {...iconProps} />;
      case 'income-expenses': return <TrendingUp {...iconProps} />;
      case 'kpis': return <BarChart3 {...iconProps} />;
      case 'tax': return <FileText {...iconProps} />;
      case 'alerts': return <AlertTriangle {...iconProps} />;
      default: return <Settings {...iconProps} />;
    }
  };

  const getAvailableBlocks = () => {
    return dashboardService.getAllAvailableBlocks();
  };

  const addBlock = (blockType: DashboardBlockType) => {
    if (!config) return;

    // Check if block already exists
    const existingBlock = config.blocks.find((b: DashboardBlockConfig) => b.id === blockType);
    if (existingBlock) {
      // Just activate it
      handleBlockToggle(blockType);
      return;
    }

    // Create new block with default options
    const availableBlocks = getAvailableBlocks();
    const blockInfo = availableBlocks[blockType];
    
    const newBlock: DashboardBlockConfig = {
      id: blockType,
      name: blockInfo.name,
      description: blockInfo.description,
      isActive: true,
      position: config.blocks.length,
      options: getDefaultOptionsForBlock(blockType)
    };

    setConfig({
      ...config,
      blocks: [...config.blocks, newBlock]
    });
  };

  const getDefaultOptionsForBlock = (blockType: DashboardBlockType): Record<string, any> => {
    switch (blockType) {
      case 'treasury':
        return {
          accountsIncluded: 'all',
          horizon: 7,
          thresholds: { red: 1000, amber: 5000 }
        };
      case 'income-expenses':
        return {
          scope: 'portfolio',
          period: 'current-month'
        };
      case 'kpis':
        return {
          selectedMetrics: ['rentabilidad-neta', 'beneficio-neto-mes', 'ocupacion'],
          source: 'kpi-builder'
        };
      case 'tax':
        return {
          fiscalYear: new Date().getFullYear(),
          showAmortizations: true
        };
      case 'alerts':
        return {
          types: ['reconciliation', 'ocr', 'due-dates'],
          maxLimit: 5
        };
      default:
        return {};
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-neutral-200 rounded w-1/3"></div>
        <div className="h-32 bg-neutral-200 rounded"></div>
        <div className="h-64 bg-neutral-200 rounded"></div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-8">
        <p className="text-error-600">Error al cargar la configuración del dashboard</p>
        <button 
          onClick={loadConfiguration}
          className="btn-primary-horizon mt-4 px-4 py-2"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Sortable Item Component
  const SortableItem = ({ block }: { block: DashboardBlockConfig }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: block.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`
          bg-white border border-neutral-200 p-4 shadow-sm
          ${isDragging ? 'shadow-lg' : ''}
          ${!block.isActive ? 'opacity-50' : ''}
        `}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            {...attributes}
            {...listeners}
            className="text-neutral-400 hover:text-neutral-600 cursor-grab active:cursor-grabbing p-1 -m-1 touch-manipulation"
            >
            aria-label="Reordenar bloque"
          >
            <GripVertical className="w-5 h-5" />
          </button>

          <div className="text-neutral-600">
            {getBlockIcon(block.id)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-medium text-neutral-900 truncate">{block.name}</div>
            <div className="text-sm text-neutral-600 truncate">{block.description}</div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="flex items-center cursor-pointer touch-manipulation">
              <input
                type="checkbox"
                checked={block.isActive}
                onChange={() => handleBlockToggle(block.id)}
                className={`rounded text-${accentColor} focus:ring-${accentColor} w-4 h-4`}
              />
              <span className="ml-2 text-sm text-neutral-700 hidden sm:inline">
                {block.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </label>
          </div>
        </div>
      </div>
    );
  };

  const accentColor = currentModule === 'horizon' ? 'brand-navy' : 'brand-teal';
  const availableBlocks = getAvailableBlocks();
  const activeBlocks = config.blocks.filter((b: DashboardBlockConfig) => b.isActive);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-neutral-900">Configuración del Panel</h2>
          <p className="text-neutral-600 mt-1 text-sm sm:text-base">
            Personaliza tu dashboard añadiendo, quitando y reordenando bloques.
          </p>
          <div className="text-xs sm:text-sm text-neutral-500 mt-2">
            <span>{propertyCount} inmueble{propertyCount !== 1 ? 's' : ''}</span>
            <span className="mx-2">•</span>
            <span>Preset recomendado: {propertyCount <= 3 ? 'A (≤3 inmuebles)' : 'B (>3 inmuebles)'}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={handlePreview}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-neutral-300 text-sm font-medium text-neutral-700"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Vista previa</span>
            <span className="sm:hidden">Vista</span>
          </button>
          
          <button
            onClick={handleResetToDefault}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-neutral-300 text-sm font-medium text-neutral-700"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Restaurar por defecto</span>
            <span className="sm:hidden">Restaurar</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 bg-${accentColor} hover:opacity-90 transition-opacity disabled:opacity-50`}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
        {/* Active Dashboard Blocks */}
        <div className="xl:col-span-2">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Mi Dashboard</h3>
          <p className="text-neutral-600 mb-6 text-sm sm:text-base">
            Arrastra para reordenar los bloques o desmárcalos para ocultarlos.
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={config.blocks.map(block => block.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {config.blocks
                  .sort((a, b) => a.position - b.position)
                  .map((block) => (
                    <SortableItem key={block.id} block={block} />
                  ))}
              </div>
            </SortableContext>
          </DndContext>

          {activeBlocks.length === 0 && (
            <div className="text-center py-8 border border-dashed border-neutral-300">
              <Settings className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
              <p className="text-neutral-600">No hay bloques activos</p>
              <p className="text-sm text-neutral-500">Añade bloques desde el catálogo de la derecha</p>
            </div>
          )}
        </div>

        {/* Available Blocks Catalog */}
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Catálogo de Bloques</h3>
          <p className="text-neutral-600 mb-6">
            Haz clic para añadir bloques a tu dashboard.
          </p>

          <div className="space-y-3">
            {Object.entries(availableBlocks).map(([blockId, blockInfo]) => {
              const isActive = config.blocks.some((b: DashboardBlockConfig) => b.id === blockId && b.isActive);
              
              return (
                <div
                  key={blockId}
                  className={`
                    border border-neutral-200 p-4 cursor-pointer
                    ${isActive 
                      ? 'bg-success-50 border-success-200' 
                      : 'bg-white'
                    }
                  `}
                  onClick={() => addBlock(blockId as DashboardBlockType)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`${isActive ? 'text-success-600' : 'text-neutral-600'}`}>
                      {getBlockIcon(blockId as DashboardBlockType)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="font-medium text-neutral-900">{blockInfo.name}</div>
                      <div className="text-sm text-neutral-600">{blockInfo.description}</div>
                    </div>

                    <div className={`
                      w-6 h-6 flex items-center justify-center text-sm
                      ${isActive ? 'bg-success-500' : 'bg-neutral-300'}
                    `}>
                      {isActive ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info box */}
          <div className="btn-secondary-horizon btn-primary-horizon ">
            <div className="flex items-start gap-3">
              <div className="text-primary-600 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-medium text-primary-800 mb-2">Presets automáticos</h4>
                <div className="text-sm text-primary-700 space-y-1">
                  <p><strong>Preset A (≤3 inmuebles):</strong> Tesorería, Ingresos/Gastos, Fiscalidad, Alertas</p>
                  <p><strong>Preset B (&gt;3 inmuebles):</strong> Tesorería, Ingresos/Gastos, KPIs, Fiscalidad, Alertas</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardConfig;