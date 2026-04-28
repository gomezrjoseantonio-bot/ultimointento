// Container del módulo Inversiones (v5). Sustituye a
// `src/modules/horizon/inversiones/InversionesPage.tsx` con un patrón
// Outlet + 4 sub-páginas (Resumen · Cartera · Rendimientos · Individual)
// alineado con Mi Plan / Personal / Tesorería.
//
// Carga posiciones + planes de pensión una sola vez, los expone vía
// `useOutletContext`, y orquesta los modales (formulario · detalle ·
// aportación · actualizar valor) que actuan sobre cualquiera de las tabs.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { PageHead, Icons, showToastV5 } from '../../design-system/v5';
import { inversionesService } from '../../services/inversionesService';
import { rendimientosService } from '../../services/rendimientosService';
import { planesInversionService } from '../../services/planesInversionService';
import { migrateInversionesToNewModel } from '../../services/migrations/migrateInversiones';
import type { Aportacion, PosicionInversion } from '../../types/inversiones';
import type { PlanPensionInversion } from '../../types/personal';
import { mapPosicionesToRows, POSITION_COLORS } from './helpers';
import type { PositionRow, Plan } from './types';
import type { InversionesOutletContext } from './InversionesContext';
import PosicionFormDialog from './components/PosicionFormDialog';
import PosicionDetailDialog from './components/PosicionDetailDialog';
import AportacionFormDialog from './components/AportacionFormDialog';
import ActualizarValorDialog from './components/ActualizarValorDialog';
import styles from './InversionesPage.module.css';

interface TabItem {
  key: 'resumen' | 'cartera' | 'rendimientos' | 'individual';
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
}

const tabs: TabItem[] = [
  { key: 'resumen', label: 'Resumen', path: '/inversiones', icon: Icons.Panel },
  { key: 'cartera', label: 'Cartera', path: '/inversiones/cartera', icon: Icons.Cartera },
  { key: 'rendimientos', label: 'Rendimientos', path: '/inversiones/rendimientos', icon: Icons.Rendimientos },
  { key: 'individual', label: 'Individual', path: '/inversiones/individual', icon: Icons.Objetivos },
];

const InversionesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activas, setActivas] = useState<PosicionInversion[]>([]);
  const [closedPositions, setClosedPositions] = useState<PosicionInversion[]>([]);
  const [planesPension, setPlanesPension] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPositionId, setSelectedPositionId] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingPosicion, setEditingPosicion] = useState<PosicionInversion | undefined>();

  const [showDetail, setShowDetail] = useState(false);
  const [detailPosicion, setDetailPosicion] = useState<PosicionInversion | undefined>();

  const [showAportacionForm, setShowAportacionForm] = useState(false);
  const [editingAportacion, setEditingAportacion] = useState<Aportacion | undefined>();

  const [showActualizarValor, setShowActualizarValor] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [{ activas: act, cerradas }, planes] = await Promise.all([
        inversionesService.getAllPosiciones(),
        planesInversionService.getPlanes(1).catch(() => [] as PlanPensionInversion[]),
      ]);
      setActivas(act);
      setClosedPositions(cerradas);
      setPlanesPension(planes as PlanPensionInversion[]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] error cargando datos', err);
      showToastV5('Error al cargar las inversiones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        await migrateInversionesToNewModel();
        await rendimientosService.generarRendimientosPendientes();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[inversiones] init', err);
      }
      if (!cancelled) await load();
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const positions: PositionRow[] = useMemo(() => {
    const planRows: PositionRow[] = planesPension.map((plan, index) => {
      const valorActual = plan.unidades
        ? plan.unidades * (plan.valorActual ?? 0)
        : plan.valorActual ?? 0;
      const aportado = plan.aportacionesRealizadas ?? 0;
      const valor = valorActual > 0 ? valorActual : aportado;
      const rentPct = aportado > 0 ? ((valor - aportado) / aportado) * 100 : 0;
      const planLegacy = plan as typeof plan & {
        gestoraActual?: string;
        fechaContratacion?: string;
      };
      return {
        id: `plan-${plan.id ?? index}`,
        alias: plan.nombre,
        broker: plan.entidad ?? planLegacy.gestoraActual ?? '—',
        tipo: 'plan_pensiones',
        aportado,
        valor,
        rentPct,
        rentAnual: 0,
        peso: 0,
        color: POSITION_COLORS[(activas.length + index) % POSITION_COLORS.length],
        tag: null,
        fechaCompra: plan.fechaApertura ?? planLegacy.fechaContratacion ?? null,
        duracionMeses: null,
      };
    });
    const mapped = mapPosicionesToRows(activas);
    const all = [...mapped, ...planRows];
    const totalValor = all.reduce((s, r) => s + r.valor, 0);
    return all.map((r) => ({
      ...r,
      peso: totalValor > 0 ? Number(((r.valor / totalValor) * 100).toFixed(1)) : 0,
    }));
  }, [activas, planesPension]);

  // Mantener `selectedPositionId` válido cuando cambian las posiciones.
  useEffect(() => {
    if (positions.length === 0) {
      if (selectedPositionId !== '') setSelectedPositionId('');
      return;
    }
    if (!positions.some((p) => p.id === selectedPositionId)) {
      setSelectedPositionId(positions[0].id);
    }
  }, [positions, selectedPositionId]);

  if (location.pathname === '/inversiones/') {
    return <Navigate to="/inversiones" replace />;
  }

  const activeKey: TabItem['key'] = (() => {
    if (location.pathname === '/inversiones' || location.pathname === '/inversiones/') return 'resumen';
    if (location.pathname.startsWith('/inversiones/cartera')) return 'cartera';
    if (location.pathname.startsWith('/inversiones/rendimientos')) return 'rendimientos';
    if (location.pathname.startsWith('/inversiones/individual')) return 'individual';
    return 'resumen';
  })();

  const handleOpenPosicionForm = (posicion?: PosicionInversion) => {
    setEditingPosicion(posicion);
    setShowForm(true);
  };

  const handleOpenPosicionDetail = async (id: string) => {
    if (id.startsWith('plan-')) {
      showToastV5('Los planes de pensión no tienen historial de aportaciones aquí.');
      return;
    }
    try {
      const pos = await inversionesService.getPosicion(Number(id));
      if (!pos) {
        showToastV5('No se ha encontrado la posición.');
        return;
      }
      setDetailPosicion(pos);
      setShowDetail(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] detalle', err);
      showToastV5('Error al abrir el detalle de aportaciones.');
    }
  };

  const refreshDetailPosicion = async () => {
    if (!detailPosicion) return;
    const updated = await inversionesService.getPosicion(detailPosicion.id);
    setDetailPosicion(updated);
  };

  const handleSavePosicion = async (
    data: Partial<PosicionInversion> & { importe_inicial?: number },
  ) => {
    try {
      if (editingPosicion) {
        await inversionesService.updatePosicion(editingPosicion.id, data);
        showToastV5('Posición actualizada.');
      } else {
        await inversionesService.createPosicion(
          data as Omit<PosicionInversion, 'id' | 'created_at' | 'updated_at'> & {
            importe_inicial?: number;
          },
        );
        showToastV5('Posición creada.');
      }
      setShowForm(false);
      setEditingPosicion(undefined);
      await rendimientosService.generarRendimientosPendientes();
      await load();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] save', err);
      showToastV5('Error al guardar la posición.');
    }
  };

  const handleSaveAportacion = async (aportacion: Omit<Aportacion, 'id'>) => {
    if (!detailPosicion) return;
    try {
      if (editingAportacion) {
        await inversionesService.updateAportacion(detailPosicion.id, editingAportacion.id, aportacion);
        showToastV5('Movimiento actualizado.');
      } else {
        await inversionesService.addAportacion(detailPosicion.id, aportacion);
        showToastV5('Aportación añadida.');
      }
      setShowAportacionForm(false);
      setEditingAportacion(undefined);
      await load();
      await refreshDetailPosicion();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] aportacion', err);
      showToastV5('Error al guardar el movimiento.');
    }
  };

  const handleDeleteAportacion = async (aportacionId: number) => {
    if (!detailPosicion) return;
    await inversionesService.deleteAportacion(detailPosicion.id, aportacionId);
    await load();
    await refreshDetailPosicion();
  };

  const handleSaveValor = async (nuevoValor: number, fechaValoracionISO: string) => {
    if (!detailPosicion) return;
    try {
      await inversionesService.updatePosicion(detailPosicion.id, {
        valor_actual: nuevoValor,
        fecha_valoracion: fechaValoracionISO,
      });
      showToastV5('Valor actualizado.');
      setShowActualizarValor(false);
      await load();
      await refreshDetailPosicion();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] actualizar valor', err);
      showToastV5('Error al actualizar el valor.');
    }
  };

  const ctx: InversionesOutletContext = {
    positions,
    closedPositions,
    planesPension,
    selectedPositionId,
    setSelectedPositionId,
    reload: load,
    onOpenPosicionForm: handleOpenPosicionForm,
    onOpenPosicionDetail: handleOpenPosicionDetail,
  };

  return (
    <div className={styles.page}>
      <PageHead
        title="Inversiones"
        sub="Análisis del rendimiento y evolución de tus posiciones."
        actions={[
          {
            label: 'Nueva posición',
            variant: 'gold',
            icon: <Icons.Plus size={14} strokeWidth={1.8} />,
            onClick: () => handleOpenPosicionForm(),
          },
        ]}
        tabsSlot={
          <div className={styles.tabsBar} role="group" aria-label="Tabs Inversiones">
            {tabs.map((tab) => {
              const isActive = tab.key === activeKey;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={isActive ? styles.active : ''}
                  aria-pressed={isActive}
                  onClick={() => navigate(tab.path)}
                >
                  <Icon size={14} strokeWidth={1.8} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        }
      />
      {loading ? (
        <div className={styles.loading}>Cargando inversiones…</div>
      ) : (
        <Outlet context={ctx} />
      )}

      {showForm && (
        <PosicionFormDialog
          posicion={editingPosicion}
          onSave={handleSavePosicion}
          onClose={() => {
            setShowForm(false);
            setEditingPosicion(undefined);
          }}
        />
      )}

      {showDetail && detailPosicion && (
        <PosicionDetailDialog
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
            const ap = detailPosicion.aportaciones.find((a) => a.id === aportacionId);
            if (!ap) return;
            setEditingAportacion(ap);
            setShowAportacionForm(true);
          }}
          onDeleteAportacion={handleDeleteAportacion}
          onActualizarValor={() => setShowActualizarValor(true)}
          onEditarPosicion={() => {
            setShowDetail(false);
            handleOpenPosicionForm(detailPosicion);
          }}
        />
      )}

      {showAportacionForm && detailPosicion && (
        <AportacionFormDialog
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

      {showActualizarValor && detailPosicion && (
        <ActualizarValorDialog
          posicionNombre={detailPosicion.nombre}
          valorActual={detailPosicion.valor_actual}
          onSave={handleSaveValor}
          onClose={() => setShowActualizarValor(false)}
        />
      )}
    </div>
  );
};

export default InversionesPage;
