import React, { useState, useEffect, useCallback } from 'react';
import { Calculator, Plus } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { Presupuesto, PresupuestoLinea, TipoLinea, UUID } from '../../../../services/db';
import { 
  getPresupuestosByYear, 
  createPresupuesto, 
  getPresupuestoLineas,
  calcularResumenPresupuesto,
  sembrarPresupuesto,
  createPresupuestoLinea,
  updatePresupuestoLinea,
  deletePresupuestoLinea,
  ResumenPresupuesto
} from './services/presupuestoService';
import PresupuestoHeader from './components/PresupuestoHeader';
import PresupuestoResumen from './components/PresupuestoResumen';
import PresupuestoTablaLineas from './components/PresupuestoTablaLineas';
import PresupuestoCalendario from './components/PresupuestoCalendario';
import PresupuestoLineaModal from './components/PresupuestoLineaModal';

const PresupuestoNuevo: React.FC = () => {
  const [currentYear] = useState(new Date().getFullYear());
  const [presupuestoActual, setPresupuestoActual] = useState<Presupuesto | null>(null);
  const [lineas, setLineas] = useState<PresupuestoLinea[]>([]);
  const [resumen, setResumen] = useState<ResumenPresupuesto | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedInmuebleId, setSelectedInmuebleId] = useState<UUID | 'todos'>('todos');
  const [showLineaModal, setShowLineaModal] = useState(false);
  const [editingLinea, setEditingLinea] = useState<PresupuestoLinea | null>(null);
  
  // Filter states
  const [filtroTipo, setFiltroTipo] = useState<TipoLinea | 'todos'>('todos');
  const [filtroCategoria] = useState<string>('todos');
  const [filtroOrigen, setFiltroOrigen] = useState<string>('todos');

  const loadPresupuestos = useCallback(async () => {
    try {
      setLoading(true);
      const presupuestosAno = await getPresupuestosByYear(currentYear);
      
      // Select the first presupuesto if any
      if (presupuestosAno.length > 0) {
        setPresupuestoActual(presupuestosAno[0]);
      }
    } catch (error) {
      console.error('Error loading presupuestos:', error);
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  const loadPresupuestoData = useCallback(async () => {
    if (!presupuestoActual) return;
    
    try {
      const [lineasData, resumenData] = await Promise.all([
        getPresupuestoLineas(presupuestoActual.id),
        calcularResumenPresupuesto(presupuestoActual.id)
      ]);
      
      setLineas(lineasData);
      setResumen(resumenData);
    } catch (error) {
      console.error('Error loading presupuesto data:', error);
    }
  }, [presupuestoActual]);

  useEffect(() => {
    loadPresupuestos();
  }, [loadPresupuestos]);

  useEffect(() => {
    if (presupuestoActual) {
      loadPresupuestoData();
    }
  }, [presupuestoActual, loadPresupuestoData]);

  const handleCreatePresupuesto = async () => {
    try {
      const id = await createPresupuesto(currentYear);
      await loadPresupuestos();
      
      // Find and select the newly created presupuesto
      const updatedPresupuestos = await getPresupuestosByYear(currentYear);
      const newPresupuesto = updatedPresupuestos.find(p => p.id === id);
      if (newPresupuesto) {
        setPresupuestoActual(newPresupuesto);
      }
    } catch (error) {
      console.error('Error creating presupuesto:', error);
    }
  };

  const handleSembrarPresupuesto = async () => {
    if (!presupuestoActual) return;
    
    try {
      // For now, we'll seed without specific inmuebleIds (all properties)
      await sembrarPresupuesto(presupuestoActual.id, currentYear);
      await loadPresupuestoData();
    } catch (error) {
      console.error('Error seeding presupuesto:', error);
    }
  };

  const handleCreateLinea = () => {
    setEditingLinea(null);
    setShowLineaModal(true);
  };

  const handleEditLinea = (linea: PresupuestoLinea) => {
    setEditingLinea(linea);
    setShowLineaModal(true);
  };

  const handleDeleteLinea = async (lineaId: UUID) => {
    try {
      await deletePresupuestoLinea(lineaId);
      await loadPresupuestoData();
    } catch (error) {
      console.error('Error deleting linea:', error);
    }
  };

  const handleSaveLinea = async (lineaData: Omit<PresupuestoLinea, 'id'>) => {
    try {
      if (editingLinea) {
        await updatePresupuestoLinea(editingLinea.id, lineaData);
      } else {
        await createPresupuestoLinea({
          ...lineaData,
          presupuestoId: presupuestoActual!.id
        });
      }
      
      setShowLineaModal(false);
      setEditingLinea(null);
      await loadPresupuestoData();
    } catch (error) {
      console.error('Error saving linea:', error);
    }
  };

  const handleExportCSV = () => {
    if (!lineas.length) return;
    
    const headers = [
      'Tipo', 'Inmueble', 'Categoría', 'Concepto', 'Frecuencia', 
      'Importe', 'Cuenta', 'Vigencia', 'Origen', 'Notas'
    ];
    
    const rows = lineas.map(linea => [
      linea.tipo,
      linea.inmuebleId || '',
      linea.categoria || '',
      linea.tipoConcepto || '',
      linea.frecuencia,
      (linea.importeUnitario || 0).toString(),
      linea.cuentaId || '',
      `${linea.desde || ''} - ${linea.hasta || ''}`,
      linea.origen,
      linea.notas || ''
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presupuesto_${currentYear}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Filter lineas based on current filters
  const lineasFiltradas = lineas.filter(linea => {
    if (filtroTipo !== 'todos' && linea.tipo !== filtroTipo) return false;
    if (filtroCategoria !== 'todos' && linea.categoria !== filtroCategoria) return false;
    if (filtroOrigen !== 'todos' && linea.origen !== filtroOrigen) return false;
    if (selectedInmuebleId !== 'todos' && linea.inmuebleId !== selectedInmuebleId) return false;
    return true;
  });

  if (loading) {
    return (
      <PageLayout title="Presupuesto" subtitle="Cargando...">
        <div className="flex justify-center py-12">
          <div className="btn-secondary-horizon animate-spin h-8 w-8 "></div>
        </div>
      </PageLayout>
    );
  }

  // Empty state - no presupuesto exists
  if (!presupuestoActual) {
    return (
      <PageLayout title="Presupuesto" subtitle="Gestión de presupuestos anuales">
        <div className="text-center py-12 bg-gray-50">
          <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay presupuestos para {currentYear}
          </h3>
          <p className="text-gray-600 mb-6">
            Crea tu primer presupuesto anual para gestionar ingresos y gastos por inmueble
          </p>
          <button
            onClick={handleCreatePresupuesto}
            className="atlas-atlas-btn-primary inline-flex items-center space-x-2 px-6 py-3"
          >
            <Plus className="h-5 w-5" />
            <span>Crear Presupuesto {currentYear}</span>
          </button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Presupuesto" subtitle="Gestión de presupuestos anuales">
      <div className="space-y-6">
        {/* Header with controls */}
        <PresupuestoHeader
          year={currentYear}
          presupuesto={presupuestoActual}
          inmuebleId={selectedInmuebleId}
          onInmuebleChange={setSelectedInmuebleId}
          onSembrar={handleSembrarPresupuesto}
          onAddLinea={handleCreateLinea}
          onExport={handleExportCSV}
        />

        {/* Zona A: Resumen */}
        {resumen && (
          <PresupuestoResumen
            resumen={resumen}
            inmuebleId={selectedInmuebleId}
          />
        )}

        {/* Zona B: Tabla de Líneas */}
        <div className="bg-white border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Líneas de Presupuesto
              </h3>
              
              {/* Filters */}
              <div className="flex items-center space-x-4">
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value as TipoLinea | 'todos')}
                  className="text-sm border border-gray-300 rounded px-3 py-1"
                >
                  <option value="todos">Todos los tipos</option>
                  <option value="Ingreso">Ingresos</option>
                  <option value="Gasto">Gastos</option>
                </select>
                
                <select
                  value={filtroOrigen}
                  onChange={(e) => setFiltroOrigen(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-3 py-1"
                >
                  <option value="todos">Todos los orígenes</option>
                  <option value="SemillaAuto">Semilla Auto</option>
                  <option value="ManualUsuario">Manual</option>
                  <option value="AjusteSistema">Ajuste Sistema</option>
                </select>
                
                <button
                  onClick={handleCreateLinea}
                  className="atlas-atlas-btn-primary flex items-center space-x-1 px-3 py-1 rounded text-sm"
              >
                  <Plus className="h-4 w-4" />
                  <span>Añadir</span>
                </button>
              </div>
            </div>
          </div>
          
          <PresupuestoTablaLineas
            lineas={lineasFiltradas}
            onEdit={handleEditLinea}
            onDelete={handleDeleteLinea}
          />
        </div>

        {/* Zona C: Calendario Mensual */}
        {resumen && (
          <PresupuestoCalendario
            resumen={resumen}
            year={currentYear}
          />
        )}
      </div>

      {/* Modal for creating/editing lines */}
      {showLineaModal && (
        <PresupuestoLineaModal
          linea={editingLinea}
          year={currentYear}
          onSave={handleSaveLinea}
          onCancel={() => {
            setShowLineaModal(false);
            setEditingLinea(null);
          }}
        />
      )}
    </PageLayout>
  );
};

export default PresupuestoNuevo;