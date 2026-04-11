// src/pages/GestionInversiones/GestionInversionesPage.tsx
// Página de GESTIÓN de inversiones: acciones CRUD sobre posiciones

import React, { useState, useCallback, useEffect } from 'react';
import { TrendingUp, Eye, Edit2, Plus } from 'lucide-react';
import { inversionesService } from '../../services/inversionesService';
import { PosicionInversion, Aportacion } from '../../types/inversiones';
import PosicionForm from '../../modules/horizon/inversiones/components/PosicionForm';
import PosicionDetailModal from '../../modules/horizon/inversiones/components/PosicionDetailModal';
import AportacionForm from '../../modules/horizon/inversiones/components/AportacionForm';
import toast from 'react-hot-toast';

const C = {
  n50: '#F8F9FA',
  n100: '#EEF1F5',
  n200: '#DDE3EC',
  n300: '#C8D0DC',
  n500: '#6C757D',
  n700: '#303A4C',
  blue: '#042C5E',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' €';

const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;

const GestionInversionesPage: React.FC = () => {
  const [posiciones, setPosiciones] = useState<PosicionInversion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showAportacionForm, setShowAportacionForm] = useState(false);
  const [editingPosicion, setEditingPosicion] = useState<PosicionInversion | undefined>();
  const [detailPosicion, setDetailPosicion] = useState<PosicionInversion | undefined>();
  const [editingAportacion, setEditingAportacion] = useState<Aportacion | undefined>();

  const refresh = useCallback(async () => {
    try {
      const { activas } = await inversionesService.getAllPosiciones();
      setPosiciones(activas);
    } catch {
      setPosiciones([]);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleNewPosition = () => {
    setEditingPosicion(undefined);
    setShowForm(true);
  };

  const handleEditPosition = async (id: number) => {
    try {
      const posicion = await inversionesService.getPosicion(id);
      if (!posicion) { toast.error('No se ha encontrado la posición para editar'); return; }
      setEditingPosicion(posicion);
      setShowForm(true);
    } catch {
      toast.error('Error al abrir la edición');
    }
  };

  const handleViewDetail = async (id: number) => {
    try {
      const posicion = await inversionesService.getPosicion(id);
      if (!posicion) { toast.error('No se ha encontrado la posición'); return; }
      setDetailPosicion(posicion);
      setShowDetail(true);
    } catch {
      toast.error('Error al abrir el detalle');
    }
  };

  const handleSavePosition = async (data: Partial<PosicionInversion> & { importe_inicial?: number }) => {
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
      await refresh();
    } catch {
      toast.error('Error al guardar la posición');
    }
  };

  const refreshDetailPosicion = async () => {
    if (!detailPosicion) return;
    const updated = await inversionesService.getPosicion(detailPosicion.id);
    setDetailPosicion(updated);
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
      await refresh();
      await refreshDetailPosicion();
    } catch {
      toast.error('Error al guardar el movimiento');
    }
  };

  const handleDeleteAportacion = async (aportacionId: number) => {
    if (!detailPosicion) return;
    await inversionesService.deleteAportacion(detailPosicion.id, aportacionId);
    await refresh();
    await refreshDetailPosicion();
  };

  return (
    <div style={{ minHeight: '100vh', background: C.n50, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {/* Cabecera GESTIÓN: fondo navy-900 */}
      <div style={{
        background: 'var(--navy-900)',
        padding: '24px 32px 20px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TrendingUp size={20} color="rgba(255,255,255,0.7)" />
            <h1 style={{
              fontSize: 'var(--t-xl)',
              fontWeight: 700,
              color: 'white',
              margin: 0,
            }}>
              Gestión inversiones
            </h1>
          </div>
          <button
            onClick={handleNewPosition}
            style={{
              background: 'white',
              color: 'var(--navy-900)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: 'var(--t-base)',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Plus size={14} />
            Nueva posición
          </button>
        </div>
      </div>

      {/* Listado de posiciones con acciones */}
      <div style={{ padding: '24px 32px' }}>
        {posiciones.length === 0 ? (
          <div style={{
            background: 'white',
            border: `1px solid ${C.n300}`,
            borderRadius: 12,
            padding: '32px',
            textAlign: 'center',
            color: C.n500,
            fontSize: 14,
          }}>
            No hay posiciones activas. Crea tu primera posición con el botón "+ Nueva posición".
          </div>
        ) : (
          <div style={{ background: 'white', border: `1px solid ${C.n300}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.n100}`, fontSize: 13, fontWeight: 600, color: C.n700 }}>
              {posiciones.length} posición{posiciones.length !== 1 ? 'es' : ''} activa{posiciones.length !== 1 ? 's' : ''}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Posición / Entidad', 'Tipo', 'Aportado', 'Valor actual', 'Rent. total', 'Acciones'].map((col, i) => (
                    <th
                      key={col}
                      style={{
                        padding: '9px 16px',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '.08em',
                        textTransform: 'uppercase',
                        color: C.n500,
                        background: C.n50,
                        borderBottom: `1px solid ${C.n200}`,
                        textAlign: i >= 2 && i <= 4 ? 'right' : i === 5 ? 'center' : 'left',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {posiciones.map((p, i) => (
                  <tr
                    key={p.id}
                    style={{ borderBottom: i < posiciones.length - 1 ? `1px solid ${C.n100}` : 'none' }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: C.n700, fontSize: 13 }}>{p.nombre}</div>
                      <div style={{ fontSize: 11, color: C.n500, marginTop: 1 }}>{p.entidad}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: C.n500 }}>{p.tipo}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                      {fmt(p.total_aportado)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                      {fmt(p.valor_actual)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: p.rentabilidad_porcentaje >= 0 ? C.blue : C.n700, fontWeight: 600 }}>
                      {fmtPct(p.rentabilidad_porcentaje)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <button
                          onClick={() => handleViewDetail(p.id)}
                          title="Ver detalle y aportaciones"
                          aria-label={`Ver detalle de ${p.nombre}`}
                          style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleEditPosition(p.id)}
                          title="Editar posición"
                          aria-label={`Editar ${p.nombre}`}
                          style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }}
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <PosicionForm
          posicion={editingPosicion}
          onSave={handleSavePosition}
          onClose={() => {
            setShowForm(false);
            setEditingPosicion(undefined);
          }}
        />
      )}

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

export default GestionInversionesPage;
