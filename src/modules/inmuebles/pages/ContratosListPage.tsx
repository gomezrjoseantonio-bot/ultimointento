import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import {
  PageHead,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import { EmptyState } from '../../../components/common/EmptyState';
import type { Contract } from '../../../services/db';
import type { InmueblesOutletContext } from '../InmueblesContext';
import {
  deleteContractWithCascade,
  previewDeleteContractCascade,
  type DeleteContractCascadeReport,
} from '../../../services/contractService';
import ConfirmationModal from '../../../components/common/ConfirmationModal';
import { esFechaIndefinida } from '../utils/formatFechaFin';
import { calcularLibresAhora } from '../utils/calcularLibresAhora';
import {
  filtrarVencen30d,
  filtrarVencen30a90d,
} from '../utils/filtrosVencimiento';
import KpiContratoCard from '../components/contratos/KpiContratoCard';
import DrawerLibres from '../components/contratos/DrawerLibres';
import DrawerVencen from '../components/contratos/DrawerVencen';
import DrawerAnalisisAnual from '../components/contratos/DrawerAnalisisAnual';
import TabActivos from '../components/contratos/TabActivos';
import TabTablero from '../components/contratos/TabTablero';
import TabDisponibilidad from '../components/contratos/TabDisponibilidad';
import TabHistorico from '../components/contratos/historico/TabHistorico';
import TabPorConciliar from '../components/contratos/TabPorConciliar';
import { boteAnualService } from '../../../services/boteAnualService';
import styles from './ContratosListPage.module.css';
import { isContratoActivo } from '../utils/contratoEstado';

type Tab = 'disponibilidad' | 'tablero' | 'activos' | 'historico' | 'conciliar';

const VALID_TABS: Tab[] = ['disponibilidad', 'tablero', 'activos', 'historico', 'conciliar'];
const LEGACY_TAB_ALIAS: Record<string, Tab> = { acciones: 'tablero', 'por-conciliar': 'conciliar' };
const isValidTab = (value: string | null): value is Tab =>
  value !== null && (VALID_TABS as string[]).includes(value);
const normalizeTab = (raw: string | null): Tab | null => {
  if (raw === null) return null;
  if (isValidTab(raw)) return raw;
  return LEGACY_TAB_ALIAS[raw] ?? null;
};

export const isContratoFinalizado = (c: Contract): boolean =>
  c.estadoContrato === 'finalizado' || c.estadoContrato === 'rescindido';

const isExpiringSoon = (c: Contract, today: Date, daysWindow = 90): boolean => {
  if (!c.fechaFin || esFechaIndefinida(c.fechaFin)) return false;
  const fin = new Date(c.fechaFin);
  if (Number.isNaN(fin.getTime())) return false;
  const diff = fin.getTime() - today.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= daysWindow;
};

const ContratosListPage: React.FC = () => {
  const navigate = useNavigate();
  const { properties, contracts, reload } = useOutletContext<InmueblesOutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab: Tab = normalizeTab(searchParams.get('tab')) ?? 'activos';
  const [tab, setTab] = useState<Tab>(initialTab);
  const today = useMemo(() => new Date(), []);
  const [pendingDelete, setPendingDelete] = useState<{
    contract: Contract & { id: number };
    cascade: DeleteContractCascadeReport;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const requestDelete = async (contract: Contract & { id: number }): Promise<void> => {
    try {
      const cascade = await previewDeleteContractCascade(contract.id);
      setPendingDelete({ contract, cascade });
    } catch (err) {
      console.error('Error preparing contract deletion', err);
      showToastV5('No se pudo preparar el borrado del contrato');
    }
  };

  const cancelDelete = (): void => {
    if (isDeleting) return;
    setPendingDelete(null);
  };

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const report = await deleteContractWithCascade(pendingDelete.contract.id);
      const detalle: string[] = [];
      if (report.treasuryEventsPredictedDeleted > 0) {
        detalle.push(`${report.treasuryEventsPredictedDeleted} eventos previstos`);
      }
      if (report.treasuryEventsHistoricUnlinked > 0) {
        detalle.push(`${report.treasuryEventsHistoricUnlinked} eventos históricos desvinculados`);
      }
      if (report.presupuestoLineasDeleted > 0) {
        detalle.push(`${report.presupuestoLineasDeleted} líneas de presupuesto`);
      }
      const sufijo = detalle.length > 0 ? ` · ${detalle.join(' · ')}` : '';
      showToastV5(`Contrato eliminado${sufijo}`);
      setPendingDelete(null);
      reload();
    } catch (err) {
      console.error('Error deleting contract', err);
      showToastV5('Error al eliminar el contrato');
    } finally {
      setIsDeleting(false);
    }
  };

  // Sincronizar tab cuando cambia el query param (navegación externa · back/forward · enlace)
  useEffect(() => {
    const rawTab = searchParams.get('tab');
    const queryTab = normalizeTab(rawTab);
    if (queryTab !== null && queryTab !== tab) {
      setTab(queryTab);
      if (rawTab !== queryTab) {
        // Reescribir URL legacy (?tab=acciones → ?tab=tablero) sin push extra
        setSearchParams({ tab: queryTab }, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTabChange = (next: Tab): void => {
    setTab(next);
    setSearchParams({ tab: next }, { replace: true });
  };

  const propertyById = useMemo(() => {
    const map = new Map<number, string>();
    properties.forEach((p) => {
      if (p.id != null) map.set(p.id, p.alias);
    });
    return map;
  }, [properties]);

  const activos = useMemo(() => contracts.filter(isContratoActivo), [contracts]);
  const acciones = useMemo(
    () =>
      contracts.filter(
        (c) => isContratoActivo(c) && isExpiringSoon(c, today, 90),
      ),
    [contracts, today],
  );
  const historico = useMemo(
    () => contracts.filter(isContratoFinalizado),
    [contracts],
  );
  // V79 · contratos importados SIN FIRMAR. Se muestran en la pestaña Activos
  // (con chip "sin-firmar") hasta que el usuario los active. NO cuentan como
  // ocupación (tablero/libres) ni como vencimientos: por eso van aparte de
  // `activos` y solo se inyectan en la lista de la pestaña.
  const sinFirmar = useMemo(
    () => contracts.filter((c) => c.estadoContrato === 'sin_firmar'),
    [contracts],
  );
  const activosTab = useMemo(() => [...activos, ...sinFirmar], [activos, sinFirmar]);

  // Botes "por conciliar" visibles (rentas declaradas AEAT sin cuadrar) · solo para el badge.
  // Cuenta los visibles en la pestaña = todos menos los 'cerrado' (transitorios, ya conciliados).
  // Incluye 'sobre_asignado' (saldo negativo) para que el contador no los esconda.
  const [porConciliarPendientes, setPorConciliarPendientes] = useState(0);
  useEffect(() => {
    let activo = true;
    boteAnualService
      .listarBotes()
      .then((botes) => {
        if (activo) {
          setPorConciliarPendientes(botes.filter((b) => b.estado !== 'cerrado').length);
        }
      })
      .catch(() => undefined);
    return () => {
      activo = false;
    };
  }, [contracts]);

  // KPIs cabecera
  const libresAhora = useMemo(
    () => calcularLibresAhora(contracts, properties, today),
    [contracts, properties, today],
  );
  const vencen30 = useMemo(() => filtrarVencen30d(contracts, today), [contracts, today]);
  const vencen3090 = useMemo(() => filtrarVencen30a90d(contracts, today), [contracts, today]);
  const libres = libresAhora.total;

  const [drawerOpen, setDrawerOpen] = useState<null | 'libres' | 'd30' | 'd3090'>(null);
  const [analisisAnualOpen, setAnalisisAnualOpen] = useState(false);

  const tabs: Array<{ key: Tab; label: string; count?: number; countTone?: 'neg' }> = [
    { key: 'disponibilidad', label: 'Disponibilidad', count: libres, countTone: libres > 0 ? 'neg' : undefined },
    { key: 'tablero', label: 'Tablero', count: acciones.length },
    { key: 'activos', label: 'Activos', count: activosTab.length },
    { key: 'historico', label: 'Histórico', count: historico.length },
    { key: 'conciliar', label: 'Por conciliar', count: porConciliarPendientes },
  ];

  if (contracts.length === 0) {
    return (
      <>
        <PageHead
          title="Contratos"
          actions={[
            {
              label: 'Importar contratos',
              variant: 'ghost',
              icon: <Icons.Upload size={14} strokeWidth={1.8} />,
              onClick: () => navigate('/inmuebles/importar-contratos'),
            },
            {
              label: 'Nuevo contrato',
              variant: 'gold',
              icon: <Icons.Plus size={14} strokeWidth={2} />,
              onClick: () => navigate('/contratos/nuevo'),
            },
          ]}
        />
        <EmptyState
          icon={FileText}
          title="Sin contratos activos"
          subtitle="No hay contratos en vigor hoy. Crea el primero cuando un inquilino entre."
          cta={{
            label: 'Nuevo contrato',
            onClick: () => navigate('/contratos/nuevo'),
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Contratos"
        actions={[
          {
            label: 'Análisis anual',
            variant: 'ghost',
            icon: <Icons.Panel size={14} strokeWidth={1.8} />,
            onClick: () => setAnalisisAnualOpen(true),
          },
          {
            label: 'Importar contratos',
            variant: 'ghost',
            icon: <Icons.Upload size={14} strokeWidth={1.8} />,
            onClick: () => navigate('/inmuebles/importar-contratos'),
          },
          {
            label: 'Nuevo contrato',
            variant: 'gold',
            icon: <Icons.Plus size={14} strokeWidth={2} />,
            onClick: () => navigate('/contratos/nuevo'),
          },
        ]}
      />

      <div className={styles.kpiStrip} role="group" aria-label="KPIs contratos">
        <KpiContratoCard
          label="Libres ahora"
          value={libres}
          accent="neg"
          valueTone={libres > 0 ? 'neg' : 'ink'}
          hint={
            libres === 0
              ? 'Todas las unidades ocupadas'
              : libresAhora.unidades
                  .slice(0, 2)
                  .map((u) => u.inmuebleAlias)
                  .join(' · ')
          }
          onClick={libres > 0 ? () => setDrawerOpen('libres') : undefined}
        />
        <KpiContratoCard
          label="Vencen en 30 d"
          value={vencen30.length}
          accent="warn"
          hint={vencen30.length === 0 ? 'Sin vencimientos próximos' : 'decisión urgente'}
          onClick={vencen30.length > 0 ? () => setDrawerOpen('d30') : undefined}
        />
        <KpiContratoCard
          label="Vencen en 30-90 d"
          value={vencen3090.length}
          accent="muted"
          hint={vencen3090.length === 0 ? 'Sin vencimientos en este rango' : 'a planificar'}
          onClick={vencen3090.length > 0 ? () => setDrawerOpen('d3090') : undefined}
        />
        <KpiContratoCard
          label="Días vacíos YTD"
          value={null}
          accent="muted"
          hint="cálculo en preparación"
        />
        <KpiContratoCard
          label="Ingresos perdidos YTD"
          value={null}
          accent="plain"
          hint="cálculo en preparación"
        />
      </div>

      <div className={styles.tabsBar} role="group" aria-label="Tabs contratos">
        {tabs.map((t) => {
          const isActive = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              className={isActive ? styles.active : ''}
              onClick={() => handleTabChange(t.key)}
              aria-pressed={isActive}
            >
              {t.label}
              {t.count != null && (
                <span
                  className={`${styles.tabCount} ${t.countTone === 'neg' ? styles.neg : ''}`}
                >
                  {t.countTone === 'neg' && t.count > 0 ? `${t.count} libres` : t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'activos' && (
        <TabActivos
          contratos={activosTab}
          inmuebleAliasById={propertyById}
          onNuevoContrato={() => navigate('/contratos/nuevo')}
        />
      )}

      {tab === 'historico' && (
        <TabHistorico
          contratos={historico}
          properties={properties}
          inmuebleAliasById={propertyById}
          onEliminar={requestDelete}
        />
      )}

      {tab === 'tablero' && (
        <TabTablero
          contratos={activos}
          properties={properties}
          inmuebleAliasById={propertyById}
          onSwitchTabActivos={() => handleTabChange('activos')}
          onNuevoContrato={(inmuebleId) =>
            navigate(
              inmuebleId != null
                ? `/contratos/nuevo?inmueble=${inmuebleId}`
                : '/contratos/nuevo',
            )
          }
        />
      )}

      {tab === 'conciliar' && (
        <TabPorConciliar inmuebleAliasById={propertyById} />
      )}

      {tab === 'disponibilidad' && (
        <TabDisponibilidad
          contratos={contracts}
          properties={properties}
          onNuevoContrato={(inmuebleId) =>
            navigate(
              inmuebleId != null
                ? `/contratos/nuevo?inmueble=${inmuebleId}`
                : '/contratos/nuevo',
            )
          }
          onIrAInmuebles={() => navigate('/inmuebles')}
        />
      )}

      <ConfirmationModal
        isOpen={pendingDelete !== null}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Eliminar contrato"
        message={
          pendingDelete
            ? buildDeleteMessage(pendingDelete.contract, pendingDelete.cascade)
            : ''
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />

      <DrawerLibres
        open={drawerOpen === 'libres'}
        onClose={() => setDrawerOpen(null)}
        data={libresAhora}
      />
      <DrawerVencen
        variant="d30"
        open={drawerOpen === 'd30'}
        onClose={() => setDrawerOpen(null)}
        contratos={vencen30}
        inmuebleAliasById={propertyById}
      />
      <DrawerVencen
        variant="d3090"
        open={drawerOpen === 'd3090'}
        onClose={() => setDrawerOpen(null)}
        contratos={vencen3090}
        inmuebleAliasById={propertyById}
      />
      <DrawerAnalisisAnual
        open={analisisAnualOpen}
        onClose={() => setAnalisisAnualOpen(false)}
        contratos={contracts}
        properties={properties}
      />
    </>
  );
};

const buildDeleteMessage = (
  contract: Contract,
  cascade: DeleteContractCascadeReport,
): string => {
  const tenant =
    `${contract.inquilino?.nombre ?? ''} ${contract.inquilino?.apellidos ?? ''}`.trim() ||
    'este contrato';
  const cascadaParts: string[] = [];
  if (cascade.treasuryEventsPredictedDeleted > 0) {
    cascadaParts.push(
      `${cascade.treasuryEventsPredictedDeleted} eventos previstos de tesorería`,
    );
  }
  if (cascade.treasuryEventsHistoricUnlinked > 0) {
    cascadaParts.push(
      `${cascade.treasuryEventsHistoricUnlinked} eventos históricos quedarán desvinculados (sin borrar)`,
    );
  }
  if (cascade.presupuestoLineasDeleted > 0) {
    cascadaParts.push(`${cascade.presupuestoLineasDeleted} líneas de presupuesto`);
  }
  const cascadaTexto = cascadaParts.length > 0
    ? ` Se eliminarán también: ${cascadaParts.join(' · ')}.`
    : '';
  return `Vas a eliminar el contrato de ${tenant}.${cascadaTexto} Esta acción no se puede deshacer.`;
};

export default ContratosListPage;
