// InversionesPage.tsx
// ATLAS HORIZON: Investment positions page - Refactored with tabs

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, TrendingUp, BarChart3, AlertCircle } from 'lucide-react';
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

const InversionesPage: React.FC = () => {
  const [posiciones, setPosiciones] = useState<PosicionInversion[]>([]);
  const [resumen, setResumen] = useState({
    valor_total: 0,
    total_aportado: 0,
    rentabilidad_euros: 0,
    rentabilidad_porcentaje: 0,
    num_posiciones: 0,
    por_tipo: {} as Record<string, number>,
  });
  const [activeTab, setActiveTab] = useState<Tab>('cartera');
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showActualizarValor, setShowActualizarValor] = useState(false);
  const [showAportacionForm, setShowAportacionForm] = useState(false);
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
      await inversionesService.addAportacion(editingPosicion.id, aportacion);
      toast.success('Aportación añadida correctamente');
      setShowAportacionForm(false);
      await loadData();
      const updated = await inversionesService.getPosicion(editingPosicion.id);
      setEditingPosicion(updated);
    } catch (error) {
      console.error('Error adding aportacion:', error);
      toast.error('Error al añadir la aportación');
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

  const tabs: { id: Tab; label: string; icon: React.ReactElement }[] = [
    { id: 'cartera', label: 'Cartera', icon: <TrendingUp size={16} /> },
    { id: 'rendimientos', label: 'Rendimientos', icon: <BarChart3 size={16} /> },
  ];

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--r-lg)',
            background: 'rgba(4, 44, 94, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <TrendingUp size={24} style={{ color: 'var(--blue)' }} />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-base)',
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            color: 'var(--atlas-navy-1)',
            margin: 0,
          }}>
            Inversiones
          </h1>
        </div>
        <button
          onClick={handleNewPosicion}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: 'var(--blue)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--r-md)',
            fontFamily: 'var(--font-base)',
            fontSize: '1rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--blue-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--blue)'; }}
        >
          <Plus size={20} />
          Nueva posición
        </button>
      </div>

      {/* Pending rendimientos alert */}
      {pendingRendimientos > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.875rem 1.25rem',
          background: 'var(--s-warning-bg)',
          border: '1px solid var(--s-warning)',
          borderRadius: 'var(--r-md)',
          marginBottom: '1.5rem',
        }}>
          <AlertCircle size={18} style={{ color: 'var(--s-warning)', flexShrink: 0 }} />
          <p style={{ fontFamily: 'var(--font-base)', fontSize: 'var(--text-base)', color: 'var(--s-warning)', margin: 0 }}>
            Tienes <strong>{pendingRendimientos}</strong> {pendingRendimientos === 1 ? 'rendimiento pendiente' : 'rendimientos pendientes'} de cobrar.{' '}
            <button
              onClick={() => setActiveTab('rendimientos')}
              style={{ background: 'none', border: 'none', color: 'var(--s-warning)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-base)', fontSize: 'var(--text-base)', padding: 0 }}
            >
              Ver rendimientos
            </button>
          </p>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--n-200)', paddingBottom: '0' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--blue)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--blue)' : 'var(--text-gray)',
              fontFamily: 'var(--font-base)',
              fontSize: 'var(--text-base)',
              fontWeight: activeTab === tab.id ? 600 : 500,
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: 'color 0.15s',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.id === 'rendimientos' && pendingRendimientos > 0 && (
              <span style={{
                background: 'var(--error)',
                color: 'white',
                borderRadius: '999px',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.1rem 0.4rem',
                minWidth: '18px',
                textAlign: 'center',
              }}>
                {pendingRendimientos}
              </span>
            )}
          </button>
        ))}
      </div>

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
              background: 'var(--hz-card-bg)',
              border: '1px solid var(--n-300)',
              borderRadius: 'var(--r-lg)',
              padding: '3rem 2rem',
              textAlign: 'center',
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--n-100)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}>
                <TrendingUp size={32} style={{ color: 'var(--text-gray)' }} />
              </div>
              <h3 style={{
                fontFamily: 'var(--font-base)',
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--atlas-navy-1)',
                margin: '0 0 0.5rem 0',
              }}>
                No hay posiciones todavía
              </h3>
              <p style={{
                fontFamily: 'var(--font-base)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-gray)',
                margin: '0 0 1.5rem 0',
              }}>
                Comienza añadiendo tu primera posición de inversión
              </p>
              <button
                onClick={handleNewPosicion}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  background: 'var(--blue)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--r-md)',
                  fontFamily: 'var(--font-base)',
                  fontSize: '1rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Plus size={20} />
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

      {/* Detail Modal */}
      {showDetail && editingPosicion && (
        <PosicionDetailModal
          posicion={editingPosicion}
          onClose={() => {
            setShowDetail(false);
            setEditingPosicion(undefined);
          }}
          onAddAportacion={() => setShowAportacionForm(true)}
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
          onSave={handleAddAportacion}
          onClose={() => setShowAportacionForm(false)}
        />
      )}
    </div>
  );
};

export default InversionesPage;
