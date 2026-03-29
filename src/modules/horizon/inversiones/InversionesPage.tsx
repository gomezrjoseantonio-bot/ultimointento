import React, { useState, useEffect, useCallback } from 'react';
import { Plus, TrendingUp, AlertCircle } from 'lucide-react';
import PageHeader, { HeaderPrimaryButton } from '../../../components/shared/PageHeader';
import { inversionesService } from '../../../services/inversionesService';
import { rendimientosService } from '../../../services/rendimientosService';
import { migrateInversionesToNewModel } from '../../../services/migrations/migrateInversiones';
import { PosicionInversion, Aportacion } from '../../../types/inversiones';
import CarteraResumen from './components/CarteraResumen';
import PosicionCard from './components/PosicionCard';
import PosicionForm from './components/PosicionForm';
import PosicionDetailModal from './components/PosicionDetailModal';
import ActualizarValorModal from './components/ActualizarValorModal';
import AportacionForm from './components/AportacionForm';
import RendimientosTab from './components/RendimientosTab';
import toast from 'react-hot-toast';

type Tab = 'cartera' | 'rendimientos';

interface InversionesPageProps {
  initialTab?: Tab;
}



const InversionesPage: React.FC<InversionesPageProps> = ({ initialTab = 'cartera' }) => {
  const [posiciones, setPosiciones] = useState<PosicionInversion[]>([]);
  const [resumen, setResumen] = useState({
    valor_total: 0,
    total_aportado: 0,
    rentabilidad_euros: 0,
    rentabilidad_porcentaje: 0,
    num_posiciones: 0,
    por_tipo: {} as Record<string, number>,
  });
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showActualizarValor, setShowActualizarValor] = useState(false);
  const [showAportacionForm, setShowAportacionForm] = useState(false);
  const [editingAportacion, setEditingAportacion] = useState<Aportacion | undefined>();
  const [editingPosicion, setEditingPosicion] = useState<PosicionInversion | undefined>();
  const [loading, setLoading] = useState(true);
  const [pendingRendimientos, setPendingRendimientos] = useState(0);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [posicionesData, resumenData] = await Promise.all([
        inversionesService.getPosiciones(),
        inversionesService.getResumenCartera(),
      ]);
      setPosiciones(posicionesData);
      setResumen(resumenData);

      // Count pending rendimientos
      const allRendimientos = await rendimientosService.getAllRendimientos();
      const pending = allRendimientos.filter(r => r.estado === 'pendiente').length;
      setPendingRendimientos(pending);
    } catch (error) {
      console.error('Error loading inversiones:', error);
      toast.error('Error al cargar las inversiones');
    } finally {
      setLoading(false);
    }
  }, []);


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

  const handleViewDetails = (id: number) => {
    const posicion = posiciones.find(p => p.id === id);
    if (posicion) {
      setEditingPosicion(posicion);
      setShowDetail(true);
    }
  };

  const handleActualizarValor = async (nuevoValor: number, fechaValoracion: string) => {
    if (!editingPosicion) return;
    try {
      await inversionesService.updatePosicion(editingPosicion.id, {
        valor_actual: nuevoValor,
        fecha_valoracion: fechaValoracion,
      });
      toast.success('Valor actualizado correctamente');
      setShowActualizarValor(false);
      await loadData();
      const updated = await inversionesService.getPosicion(editingPosicion.id);
      setEditingPosicion(updated);
    } catch (error) {
      console.error('Error updating valor:', error);
      toast.error('Error al actualizar el valor');
    }
  };

  const handleAddAportacion = async (aportacion: Omit<Aportacion, 'id'>) => {
    if (!editingPosicion) return;
    try {
      if (editingAportacion) {
        await inversionesService.updateAportacion(editingPosicion.id, editingAportacion.id, aportacion);
        toast.success('Movimiento actualizado correctamente');
      } else {
        await inversionesService.addAportacion(editingPosicion.id, aportacion);
        toast.success('Aportación añadida correctamente');
      }
      setShowAportacionForm(false);
      setEditingAportacion(undefined);
      await loadData();
      const updated = await inversionesService.getPosicion(editingPosicion.id);
      setEditingPosicion(updated);
    } catch (error) {
      console.error('Error adding aportacion:', error);
      toast.error('Error al añadir la aportación');
    }
  };

  const handleDeleteAportacion = async (aportacionId: number) => {
    if (!editingPosicion) return;
    await inversionesService.deleteAportacion(editingPosicion.id, aportacionId);
    await loadData();
    const updated = await inversionesService.getPosicion(editingPosicion.id);
    setEditingPosicion(updated);
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

  const tabItems: { id: Tab; label: string }[] = [
    { id: 'cartera', label: 'Cartera' },
    { id: 'rendimientos', label: 'Rendimientos' },
  ];

  return (
    <div>
      {/* v4 Header */}
      <PageHeader
        icon={TrendingUp}
        title="Inversiones"
        tabs={[
          { id: 'cartera', label: 'Cartera' },
          { id: 'rendimientos', label: pendingRendimientos > 0 ? `Rendimientos (${pendingRendimientos})` : 'Rendimientos' },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as Tab)}
        actions={<HeaderPrimaryButton icon={Plus} label="Nueva posición" onClick={handleNewPosicion} />}
      />

    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Pending rendimientos alert */}
      {pendingRendimientos > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'var(--grey-100)',
          border: '1px solid var(--grey-300)',
          borderRadius: 'var(--r-md)',
          marginBottom: 24,
        }}>
          <AlertCircle size={18} style={{ color: 'var(--grey-500)', flexShrink: 0 }} />
          <p style={{ fontFamily: 'var(--font-base)', fontSize: 'var(--t-base)', color: 'var(--grey-700)', margin: 0 }}>
            Tienes <strong>{pendingRendimientos}</strong> {pendingRendimientos === 1 ? 'rendimiento pendiente' : 'rendimientos pendientes'} de cobrar.{' '}
            <button
              onClick={() => setActiveTab('rendimientos')}
              style={{ background: 'none', border: 'none', color: 'var(--navy-900)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-base)', fontSize: 'var(--t-base)', padding: 0 }}
            >
              Ver rendimientos
            </button>
          </p>
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'cartera' && (
        <>
          <CarteraResumen
            valorTotal={resumen.valor_total}
            rentabilidadEuros={resumen.rentabilidad_euros}
            rentabilidadPorcentaje={resumen.rentabilidad_porcentaje}
            porTipo={resumen.por_tipo}
          />

          <h2 style={{
            fontFamily: 'var(--font-base)',
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--atlas-navy-1)',
            margin: '0 0 1rem 0',
          }}>
            Mis Posiciones
          </h2>

          {posiciones.length === 0 ? (
            <div style={{
              background: 'var(--white)',
              border: '1px solid var(--grey-200)',
              borderRadius: 'var(--r-lg)',
              padding: '48px 24px',
              textAlign: 'center',
            }}>
              <TrendingUp size={48} style={{ color: 'var(--grey-400)', margin: '0 auto 16px', display: 'block' }} />
              <h3 style={{
                fontSize: 'var(--t-md)',
                fontWeight: 600,
                color: 'var(--grey-700)',
                margin: '0 0 4px',
              }}>
                No hay posiciones todavía
              </h3>
              <p style={{
                fontSize: 'var(--t-sm)',
                color: 'var(--grey-500)',
                margin: '0 0 24px',
              }}>
                Comienza añadiendo tu primera posición de inversión
              </p>
              <button
                onClick={handleNewPosicion}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  background: 'var(--navy-900)',
                  color: 'var(--white)',
                  border: 'none',
                  borderRadius: 'var(--r-md)',
                  fontFamily: 'var(--font-base)',
                  fontSize: 'var(--t-base)',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} />
                Añadir primera posición
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              {posiciones.map(posicion => (
                <PosicionCard
                  key={posicion.id}
                  posicion={posicion}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'rendimientos' && <RendimientosTab />}
    </div>
      {/* Detail Modal */}
      {showDetail && editingPosicion && (
        <PosicionDetailModal
          posicion={editingPosicion}
          onClose={() => {
            setShowDetail(false);
            setEditingPosicion(undefined);
            setEditingAportacion(undefined);
          }}
          onAddAportacion={() => {
            setEditingAportacion(undefined);
            setShowAportacionForm(true);
          }}
          onEditAportacion={(aportacionId) => {
            const aportacion = editingPosicion.aportaciones.find((a) => a.id === aportacionId);
            if (!aportacion) return;
            setEditingAportacion(aportacion);
            setShowAportacionForm(true);
          }}
          onDeleteAportacion={handleDeleteAportacion}
          onActualizarValor={() => setShowActualizarValor(true)}
          onEditarPosicion={() => {
            setShowDetail(false);
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

      {/* Actualizar Valor Modal */}
      {showActualizarValor && editingPosicion && (
        <ActualizarValorModal
          posicionNombre={editingPosicion.nombre}
          valorActual={editingPosicion.valor_actual}
          onSave={handleActualizarValor}
          onClose={() => setShowActualizarValor(false)}
        />
      )}

      {/* Aportacion Form Modal */}
      {showAportacionForm && editingPosicion && (
        <AportacionForm
          posicionNombre={editingPosicion.nombre}
          posicion={editingPosicion}
          initialAportacion={editingAportacion}
          onSave={handleAddAportacion}
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
