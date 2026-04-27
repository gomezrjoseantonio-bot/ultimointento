// InversionesPage.tsx
// ATLAS HORIZON: Unified Investment Portfolio Page
// Uses PageHeader (mandatory) with 4 tabs: Resumen, Cartera, Rendimientos, Individual

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, TrendingUp } from 'lucide-react';
import PageHeader, { HeaderPrimaryButton } from '../../../components/shared/PageHeader';
import { inversionesService } from '../../../services/inversionesService';
import { rendimientosService } from '../../../services/rendimientosService';
import { migrateInversionesToNewModel } from '../../../services/migrations/migrateInversiones';
import { planesInversionService } from '../../../services/planesInversionService';
import { PosicionInversion, Aportacion } from '../../../types/inversiones';
import type { PlanPensionInversion } from '../../../types/personal';
import PosicionForm from './components/PosicionForm';
import PosicionDetailModal from './components/PosicionDetailModal';
import AportacionForm from './components/AportacionForm';
import { TabResumen, TabCartera, TabRendimientos, TabIndividual } from './components/tabs';
import { PositionRow, Tab } from './components/types';
import { mapPosicionesToRows, POSITION_COLORS } from './components/utils';
import toast from 'react-hot-toast';

interface InversionesPageProps {
  initialTab?: Tab;
}



const InversionesPage: React.FC<InversionesPageProps> = ({ initialTab = 'resumen' }) => {
  const [closedPositions, setClosedPositions] = useState<PosicionInversion[]>([]);
  const [planesPension, setPlanesPension] = useState<PlanPensionInversion[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showAportacionForm, setShowAportacionForm] = useState(false);
  const [editingAportacion, setEditingAportacion] = useState<Aportacion | undefined>();
  const [editingPosicion, setEditingPosicion] = useState<PosicionInversion | undefined>();
  const [detailPosicion, setDetailPosicion] = useState<PosicionInversion | undefined>();
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [{ activas, cerradas }, planes] = await Promise.all([
        inversionesService.getAllPosiciones(),
        planesInversionService.getPlanes(1).catch(() => [] as typeof planesPension),
      ]);
      setClosedPositions(cerradas);
      setPlanesPension(planes as unknown as PlanPensionInversion[]);

      // Convertir planes de pensión a PositionRow para incluirlos en todas las vistas
      const planRows: PositionRow[] = planes.map((plan: any, index) => {
        const valorActual = plan.unidades ? plan.unidades * (plan.valorActual ?? 0) : (plan.valorActual ?? 0);
        const aportado = plan.aportacionesRealizadas ?? 0;
        const valor = valorActual > 0 ? valorActual : aportado;
        const rentPct = aportado > 0 ? ((valor - aportado) / aportado) * 100 : 0;
        return {
          id: `plan-${plan.id ?? index}`,
          alias: plan.nombre,
          broker: plan.entidad ?? plan.gestoraActual ?? '—',
          tipo: 'plan_pensiones',
          aportado,
          valor,
          rentPct,
          rentAnual: 0,
          peso: 0, // recalculado abajo
          color: POSITION_COLORS[(activas.length + index) % POSITION_COLORS.length],
          tag: null,
          fechaCompra: plan.fechaApertura ?? plan.fechaContratacion ?? null,
          duracionMeses: null,
        };
      });

      // Map positions y combinar con planes
      const mapped = mapPosicionesToRows(activas);
      const allRows = [...mapped, ...planRows];

      // Recalcular pesos sobre el total real (posiciones + planes)
      const totalValor = allRows.reduce((s, r) => s + r.valor, 0);
      const allRowsConPeso = allRows.map(r => ({
        ...r,
        peso: totalValor > 0 ? Number(((r.valor / totalValor) * 100).toFixed(1)) : 0,
      }));

      setPositions(allRowsConPeso);
      if (allRowsConPeso.length && !allRowsConPeso.some((p) => p.id === selectedPositionId)) {
        setSelectedPositionId(allRowsConPeso[0].id);
      }
    } catch (error) {
      console.error('Error loading inversiones:', error);
      toast.error('Error al cargar las inversiones');
    } finally {
      setLoading(false);
    }
  }, [selectedPositionId]);


  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const init = async () => {
      try {
        await migrateInversionesToNewModel();
        await rendimientosService.generarRendimientosPendientes();
      } catch (err) {
        console.error('Error initializing inversiones:', err);
      }
      await loadData();
    };
    init();
  }, [loadData]);

  const handleSavePosicion = async (data: Partial<PosicionInversion> & { importe_inicial?: number }) => {
    try {
      if (editingPosicion) {
        await inversionesService.updatePosicion(editingPosicion.id, data);
        toast.success('Posición actualizada correctamente');
      } else {
        await inversionesService.createPosicion(data as Omit<PosicionInversion, 'id' | 'created_at' | 'updated_at'> & { importe_inicial?: number });
        toast.success('Posición creada correctamente');
      }
      setShowForm(false);
      setEditingPosicion(undefined);
      // Re-generate rendimientos after saving
      await rendimientosService.generarRendimientosPendientes();
      loadData();
    } catch (error) {
      console.error('Error saving posicion:', error);
      toast.error('Error al guardar la posición');
    }
  };

  const handleSelectPosition = (id: string) => {
    setSelectedPositionId(id);
    setActiveTab('individual');
  };

  const handleViewAportaciones = async (id: string) => {
    // Los planes de pensión no tienen historial de aportaciones en formato inversiones
    if (id.startsWith('plan-')) return;
    try {
      const posicion = await inversionesService.getPosicion(Number(id));
      if (!posicion) {
        toast.error('No se ha encontrado la posición');
        return;
      }
      setDetailPosicion(posicion);
      setShowDetail(true);
    } catch (error) {
      console.error('Error cargando detalle de posición:', error);
      toast.error('Error al abrir el detalle de aportaciones');
    }
  };

  const refreshDetailPosicion = async () => {
    if (!detailPosicion) return;
    const updated = await inversionesService.getPosicion(detailPosicion.id);
    setDetailPosicion(updated);
  };

  const handleDeleteAportacion = async (aportacionId: number) => {
    if (!detailPosicion) return;
    await inversionesService.deleteAportacion(detailPosicion.id, aportacionId);
    await loadData();
    await refreshDetailPosicion();
  };

  const handleSaveAportacion = async (aportacion: Omit<Aportacion, 'id'>) => {
    if (!detailPosicion) return;
    try {
      if (editingAportacion) {
        await inversionesService.updateAportacion(detailPosicion.id, editingAportacion.id, aportacion);
        toast.success('Movimiento actualizado correctamente');
      } else {
        await inversionesService.addAportacion(detailPosicion.id, aportacion);
        toast.success('Aportación añadida correctamente');
      }
      setShowAportacionForm(false);
      setEditingAportacion(undefined);
      await loadData();
      await refreshDetailPosicion();
    } catch (error) {
      console.error('Error guardando aportación:', error);
      toast.error('Error al guardar el movimiento');
    }
  };

  const handleNewPosicion = () => {
    setEditingPosicion(undefined);
    setShowForm(true);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        fontFamily: 'var(--font-base)',
        color: 'var(--text-gray)',
      }}>
        Cargando...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--grey-50, #F8F9FA)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ padding: 24 }}>
        {/* v4 PageHeader with 4 tabs */}
        <PageHeader
          icon={TrendingUp}
          title="Inversiones"
          subtitle="Análisis de rendimiento y evolución de tus posiciones"
          tabs={[
            { id: 'resumen', label: 'Resumen' },
            { id: 'cartera', label: 'Cartera' },
            { id: 'rendimientos', label: 'Rendimientos' },
            { id: 'individual', label: 'Individual' },
          ]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as Tab)}
          actions={<HeaderPrimaryButton icon={Plus} label="Nueva posición" onClick={handleNewPosicion} />}
        />

        {/* Tab content */}
        {activeTab === 'resumen' && (
          <TabResumen positions={positions} planesPension={planesPension} />
        )}
        
        {activeTab === 'cartera' && (
          <TabCartera
            positions={positions}
            closedPositions={closedPositions}
            planesPension={planesPension}
            onSelectPosition={handleSelectPosition}
            onViewAportaciones={handleViewAportaciones}
          />
        )}
        
        {activeTab === 'rendimientos' && (
          <TabRendimientos positions={positions} />
        )}
        
        {activeTab === 'individual' && (
          <TabIndividual selectedId={selectedPositionId} positions={positions} />
        )}
      </div>

      {/* Detail Modal */}
      {showDetail && detailPosicion && (
        <PosicionDetailModal
          posicion={detailPosicion}
          onClose={() => {
            setShowDetail(false);
            setDetailPosicion(undefined);
            setEditingAportacion(undefined);
          }}
          onAddAportacion={() => {
            setEditingAportacion(undefined);
            setShowAportacionForm(true);
          }}
          onEditAportacion={(aportacionId) => {
            const aportacion = detailPosicion.aportaciones.find((a) => a.id === aportacionId);
            if (!aportacion) return;
            setEditingAportacion(aportacion);
            setShowAportacionForm(true);
          }}
          onDeleteAportacion={handleDeleteAportacion}
          onActualizarValor={async () => {
            toast('Actualiza el valor desde editar posición por ahora.', { icon: 'ℹ️' });
          }}
          onEditarPosicion={() => {
            setShowDetail(false);
            setEditingPosicion(detailPosicion);
            setShowForm(true);
          }}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <PosicionForm
          posicion={editingPosicion}
          onSave={handleSavePosicion}
          onClose={() => {
            setShowForm(false);
            setEditingPosicion(undefined);
          }}
        />
      )}

      {/* Aportacion Form Modal */}
      {showAportacionForm && detailPosicion && (
        <AportacionForm
          posicionNombre={detailPosicion.nombre}
          posicion={detailPosicion}
          initialAportacion={editingAportacion}
          onSave={handleSaveAportacion}
          onClose={() => {
            setShowAportacionForm(false);
            setEditingAportacion(undefined);
          }}
        />
      )}
    </div>
  );
};

export default InversionesPage;
