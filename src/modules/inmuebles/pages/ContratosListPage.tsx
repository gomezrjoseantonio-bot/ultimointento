import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import {
  PageHead,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import { EmptyState } from '../../../components/common/EmptyState';
import type { Contract, Property } from '../../../services/db';
import type { InmueblesOutletContext } from '../InmueblesContext';
import {
  deleteContractWithCascade,
  previewDeleteContractCascade,
  type DeleteContractCascadeReport,
} from '../../../services/contractService';
import ConfirmationModal from '../../../components/common/ConfirmationModal';
import ContratosTopHero from '../components/contratos/ContratosTopHero';
import { useContratosKPIs } from '../hooks/useContratosByTab';
import { getEstadoEfectivo } from '../utils/estadoEfectivoService';
import { esInquilinoIdentificado } from '../utils/inquilinoUtils';
import TabActivos from '../components/contratos/TabActivos';
import TabProximos from '../components/contratos/TabProximos';
import TabAnalisis from '../components/contratos/TabAnalisis';
import TabDisponibilidad from '../components/contratos/TabDisponibilidad';
import TabHistorico from '../components/contratos/historico/TabHistorico';
import TabPorConciliar from '../components/contratos/TabPorConciliar';
import styles from './ContratosListPage.module.css';
import { isContratoActivo } from '../utils/contratoEstado';
// Re-export · `contratoFiltros.test.ts` consume estos helpers desde la página.
export { isContratoActivo };

// Tabs nuevas (mockup v5) · sin Tablero · estado calculado por fechas.
type Tab = 'disponibilidad' | 'vigentes' | 'proximos' | 'historico' | 'analisis' | 'conciliar';

const VALID_TABS: Tab[] = [
  'disponibilidad',
  'vigentes',
  'proximos',
  'historico',
  'analisis',
  'conciliar',
];
// Compatibilidad con URLs antiguas · activos/tablero/acciones → vigentes.
const LEGACY_TAB_ALIAS: Record<string, Tab> = {
  activos: 'vigentes',
  tablero: 'vigentes',
  acciones: 'vigentes',
  'por-conciliar': 'conciliar',
};
const isValidTab = (value: string | null): value is Tab =>
  value !== null && (VALID_TABS as string[]).includes(value);
const normalizeTab = (raw: string | null): Tab | null => {
  if (raw === null) return null;
  if (isValidTab(raw)) return raw;
  return LEGACY_TAB_ALIAS[raw] ?? null;
};

// Helpers documentales (estadoContrato persistido) · consumidos por
// `contratoFiltros.test.ts`. El estado de pestaña ya NO depende de ellos:
// las tabs filtran por estado efectivo (fechas) vía `getEstadoEfectivo`.
export const isContratoFinalizado = (c: Contract): boolean =>
  c.estadoContrato === 'finalizado' || c.estadoContrato === 'rescindido';

const ContratosListPage: React.FC = () => {
  const navigate = useNavigate();
  const { properties, contracts, reload } = useOutletContext<InmueblesOutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab: Tab = normalizeTab(searchParams.get('tab')) ?? 'vigentes';
  const [tab, setTab] = useState<Tab>(initialTab);
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
        // Reescribir URL legacy (?tab=activos → ?tab=vigentes) sin push extra
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

  // FIX § 1.3 · modoExplotacion por inmueble · la celda Inmueble decide
  // "Piso completo" vs "Hab N" / "Hab pendiente" sin denormalizar en el Contract.
  const modoById = useMemo(() => {
    const map = new Map<number, Property['modoExplotacion']>();
    properties.forEach((p) => {
      if (p.id != null) map.set(p.id, p.modoExplotacion);
    });
    return map;
  }, [properties]);

  // Filtrado por estado EFECTIVO (fechas) · un Rentila finalizado nunca cae en
  // Vigentes; un firmado sin empezar vive en Próximos hasta su fechaInicio.
  // FIX § 1.2/§ 1.4 · además se excluyen los contratos SIN inquilino real (rentas
  // declaradas AEAT sin identificar): su sitio es exclusivamente Por conciliar.
  const vigentes = useMemo(
    () =>
      contracts.filter(
        (c) => getEstadoEfectivo(c) === 'vigente' && esInquilinoIdentificado(c),
      ),
    [contracts],
  );
  const proximos = useMemo(
    () =>
      contracts.filter(
        (c) => getEstadoEfectivo(c) === 'proximo' && esInquilinoIdentificado(c),
      ),
    [contracts],
  );
  const historico = useMemo(
    () =>
      contracts.filter(
        (c) => getEstadoEfectivo(c) === 'finalizado' && esInquilinoIdentificado(c),
      ),
    [contracts],
  );

  // KPIs banda navy GESTIÓN · única fuente de los stats (estado efectivo por fechas).
  const kpis = useContratosKPIs(contracts, properties);

  // Tabs · texto puro, sin contadores (mockup v5).
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'disponibilidad', label: 'Disponibilidad' },
    { key: 'vigentes', label: 'Vigentes' },
    { key: 'proximos', label: 'Próximos' },
    { key: 'historico', label: 'Histórico' },
    { key: 'analisis', label: 'Análisis' },
    { key: 'conciliar', label: 'Por conciliar' },
  ];

  const headActions = [
    {
      label: 'Importar contratos',
      variant: 'ghost' as const,
      icon: <Icons.Upload size={14} strokeWidth={1.8} />,
      onClick: () => navigate('/inmuebles/importar-contratos'),
    },
    {
      label: 'Nuevo contrato',
      variant: 'gold' as const,
      icon: <Icons.Plus size={14} strokeWidth={2} />,
      onClick: () => navigate('/contratos/nuevo'),
    },
  ];

  if (contracts.length === 0) {
    return (
      <div className={styles.mainContainer}>
        <main className={styles.main}>
          <PageHead title="Contratos" actions={headActions} />
          <EmptyState
            icon={FileText}
            title="Sin contratos activos"
            subtitle="No hay contratos en vigor hoy. Crea el primero cuando un inquilino entre."
            cta={{
              label: 'Nuevo contrato',
              onClick: () => navigate('/contratos/nuevo'),
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className={styles.mainContainer}>
      {/* 1 · PERSISTENT BAR · navy · ARRIBA del todo · sticky · full-bleed */}
      <ContratosTopHero kpis={kpis} />

      {/* 2 · MAIN · zona blanca con título · tabs · contenido */}
      <main className={styles.main}>
      <PageHead
        title="Contratos"
        sub="Gestiona tus alquileres · revisa histórico · concilia rentas declaradas"
        actions={headActions}
      />

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
            </button>
          );
        })}
      </div>

      {tab === 'vigentes' && (
        <TabActivos
          contratos={vigentes}
          inmuebleAliasById={propertyById}
          inmuebleModoById={modoById}
          onNuevoContrato={() => navigate('/contratos/nuevo')}
        />
      )}

      {tab === 'proximos' && (
        <TabProximos contratos={proximos} inmuebleAliasById={propertyById} />
      )}

      {tab === 'historico' && (
        <TabHistorico
          contratos={historico}
          properties={properties}
          inmuebleAliasById={propertyById}
          inmuebleModoById={modoById}
          onEliminar={requestDelete}
        />
      )}

      {tab === 'analisis' && (
        <TabAnalisis contratos={contracts} properties={properties} />
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
      </main>

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
    </div>
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
  const cascadaTexto = cascadaParts.length > 0
    ? ` Se eliminarán también: ${cascadaParts.join(' · ')}.`
    : '';
  return `Vas a eliminar el contrato de ${tenant}.${cascadaTexto} Esta acción no se puede deshacer.`;
};

export default ContratosListPage;
