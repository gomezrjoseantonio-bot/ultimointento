// InversionesPage.tsx
// ATLAS HORIZON: Investment positions page

import React, { useState, useEffect } from 'react';
import { Plus, TrendingUp } from 'lucide-react';
import { inversionesService } from '../../../services/inversionesService';
import { PosicionInversion } from '../../../types/inversiones';
import CarteraResumen from './components/CarteraResumen';
import PosicionCard from './components/PosicionCard';
import PosicionForm from './components/PosicionForm';
import toast from 'react-hot-toast';

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
  const [showForm, setShowForm] = useState(false);
  const [editingPosicion, setEditingPosicion] = useState<PosicionInversion | undefined>();
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [posicionesData, resumenData] = await Promise.all([
        inversionesService.getPosiciones(),
        inversionesService.getResumenCartera(),
      ]);
      setPosiciones(posicionesData);
      setResumen(resumenData);
    } catch (error) {
      console.error('Error loading inversiones:', error);
      toast.error('Error al cargar las inversiones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSavePosicion = async (data: Partial<PosicionInversion>) => {
    try {
      if (editingPosicion) {
        await inversionesService.updatePosicion(editingPosicion.id, data);
        toast.success('Posición actualizada correctamente');
      } else {
        await inversionesService.createPosicion(data as Omit<PosicionInversion, 'id' | 'created_at' | 'updated_at'>);
        toast.success('Posición creada correctamente');
      }
      setShowForm(false);
      setEditingPosicion(undefined);
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
      setShowForm(true);
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
        fontFamily: 'var(--font-inter)',
        color: 'var(--text-gray)',
      }}>
        Cargando...
      </div>
    );
  }

  return (
    <div style={{
      padding: '2rem',
      maxWidth: '1400px',
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--hz-info-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <TrendingUp size={24} style={{ color: 'var(--atlas-blue)' }} />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-inter)',
            fontSize: 'var(--text-h1-large)',
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
            background: 'var(--atlas-blue)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontFamily: 'var(--font-inter)',
            fontSize: '1rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#03234a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--atlas-blue)';
          }}
        >
          <Plus size={20} />
          Nueva posición
        </button>
      </div>

      {/* Resumen de cartera */}
      <CarteraResumen
        valorTotal={resumen.valor_total}
        rentabilidadEuros={resumen.rentabilidad_euros}
        rentabilidadPorcentaje={resumen.rentabilidad_porcentaje}
        numPosiciones={resumen.num_posiciones}
      />

      {/* Distribución por tipo */}
      {Object.keys(resumen.por_tipo).length > 0 && (
        <div style={{
          background: 'var(--hz-card-bg)',
          border: '1px solid var(--hz-neutral-300)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-inter)',
            fontSize: 'var(--text-h2)',
            fontWeight: 600,
            color: 'var(--atlas-navy-1)',
            margin: '0 0 1rem 0',
          }}>
            Distribución por tipo
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}>
            {Object.entries(resumen.por_tipo).map(([tipo, valor]) => {
              const porcentaje = resumen.valor_total > 0 ? (valor / resumen.valor_total) * 100 : 0;
              const tipoLabels: Record<string, string> = {
                fondo_inversion: 'Fondos',
                accion: 'Acciones',
                etf: 'ETFs',
                plan_pensiones: 'Pensiones',
                plan_empleo: 'Plan empleo',
                crypto: 'Crypto',
                deposito: 'Depósitos',
                otro: 'Otros',
              };
              return (
                <div key={tipo} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: 'var(--atlas-blue)',
                  }} />
                  <span style={{
                    fontFamily: 'var(--font-inter)',
                    fontSize: 'var(--text-caption)',
                    color: 'var(--atlas-navy-1)',
                  }}>
                    {tipoLabels[tipo] || tipo}: {porcentaje.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Título de sección */}
      <h2 style={{
        fontFamily: 'var(--font-inter)',
        fontSize: 'var(--text-h2)',
        fontWeight: 600,
        color: 'var(--atlas-navy-1)',
        margin: '0 0 1rem 0',
      }}>
        Mis Posiciones
      </h2>

      {/* Lista de posiciones */}
      {posiciones.length === 0 ? (
        <div style={{
          background: 'var(--hz-card-bg)',
          border: '1px solid var(--hz-neutral-300)',
          borderRadius: '12px',
          padding: '3rem 2rem',
          textAlign: 'center',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--hz-neutral-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <TrendingUp size={32} style={{ color: 'var(--text-gray)' }} />
          </div>
          <h3 style={{
            fontFamily: 'var(--font-inter)',
            fontSize: '1.125rem',
            fontWeight: 600,
            color: 'var(--atlas-navy-1)',
            margin: '0 0 0.5rem 0',
          }}>
            No hay posiciones todavía
          </h3>
          <p style={{
            fontFamily: 'var(--font-inter)',
            fontSize: 'var(--text-caption)',
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
              background: 'var(--atlas-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontFamily: 'var(--font-inter)',
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
        <div>
          {posiciones.map(posicion => (
            <PosicionCard
              key={posicion.id}
              posicion={posicion}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
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
    </div>
  );
};

export default InversionesPage;
