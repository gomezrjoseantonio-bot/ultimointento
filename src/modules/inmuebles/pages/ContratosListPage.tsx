import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  PageHead,
  MoneyValue,
  DateLabel,
  EmptyState,
  Pill,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import type { Contract } from '../../../services/db';
import type { InmueblesOutletContext } from '../InmueblesContext';
import {
  deleteContractWithCascade,
  previewDeleteContractCascade,
  type DeleteContractCascadeReport,
} from '../../../services/contractService';
import ConfirmationModal from '../../../components/common/ConfirmationModal';
import { esFechaIndefinida } from '../utils/formatFechaFin';
import styles from './ContratosListPage.module.css';

type Tab = 'disponibilidad' | 'tablero' | 'activos' | 'historico';

const VALID_TABS: Tab[] = ['disponibilidad', 'tablero', 'activos', 'historico'];
const LEGACY_TAB_ALIAS: Record<string, Tab> = { acciones: 'tablero' };
const isValidTab = (value: string | null): value is Tab =>
  value !== null && (VALID_TABS as string[]).includes(value);
const normalizeTab = (raw: string | null): Tab | null => {
  if (raw === null) return null;
  if (isValidTab(raw)) return raw;
  return LEGACY_TAB_ALIAS[raw] ?? null;
};

export const isContratoActivo = (c: Contract): boolean => c.estadoContrato === 'activo';
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

  // Disponibilidad · unidades libres por inmueble
  const totalUnidades = properties.reduce((sum, p) => sum + (p.bedrooms || 1), 0);
  const ocupadas = activos.length;
  const libres = totalUnidades - ocupadas;

  const tabs: Array<{ key: Tab; label: string; count?: number; countTone?: 'neg' }> = [
    { key: 'disponibilidad', label: 'Disponibilidad', count: libres, countTone: libres > 0 ? 'neg' : undefined },
    { key: 'tablero', label: 'Tablero', count: acciones.length },
    { key: 'activos', label: 'Activos', count: activos.length },
    { key: 'historico', label: 'Histórico', count: historico.length },
  ];

  return (
    <>
      <PageHead
        title="Contratos"
        sub={
          <>
            <strong>{totalUnidades}</strong> unidades arrendables <span> · </span>
            <strong>{ocupadas}</strong> activos · <strong>{libres}</strong> libres
            <span> · </span>
            renta mensual{' '}
            <strong>
              <MoneyValue
                value={activos.reduce((s, c) => s + (c.rentaMensual ?? 0), 0)}
                decimals={0}
                tone="ink"
              />
            </strong>
          </>
        }
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
        <ContractsTable
          contracts={activos}
          propertyById={propertyById}
          today={today}
          emptyTitle="Sin contratos activos"
          emptySub="No hay contratos en vigor a fecha de hoy."
          onNew={() => navigate('/contratos/nuevo')}
          onDelete={requestDelete}
        />
      )}

      {tab === 'historico' && (
        historico.length === 0 ? (
          <EmptyState
            icon={<Icons.Success size={20} />}
            title="Sin contratos finalizados"
            sub="Cuando termines o archives un contrato aparecerá aquí su histórico."
          />
        ) : (
          <ContractsTable
            contracts={historico}
            propertyById={propertyById}
            today={today}
            emptyTitle="Sin contratos finalizados"
            emptySub="Cuando termines o archives un contrato aparecerá aquí su histórico."
            onNew={() => navigate('/contratos/nuevo')}
            onDelete={requestDelete}
          />
        )
      )}

      {tab === 'tablero' && (
        <>
          {acciones.length === 0 ? (
            <EmptyState
              icon={<Icons.Check size={20} />}
              title="Sin acciones pendientes"
              sub="Todos los contratos activos están en plazo · sin renovaciones próximas."
            />
          ) : (
            <ContractsTable
              contracts={acciones}
              propertyById={propertyById}
              today={today}
              emptyTitle=""
              emptySub=""
              onNew={() => navigate('/contratos/nuevo')}
              onDelete={requestDelete}
            />
          )}
        </>
      )}

      {tab === 'disponibilidad' && (
        <EmptyState
          icon={<Icons.Calendar size={20} />}
          title="Vista de disponibilidad en construcción"
          sub={
            <>
              Estamos preparando un calendario de 6 meses por habitación para
              ver de un vistazo qué está libre, qué se acerca a vencer y dónde
              colocar nuevos inquilinos.{' '}
              <br />
              Mientras tanto, gestiona tus contratos desde{' '}
              <button
                type="button"
                className={styles.linkInline}
                onClick={() => handleTabChange('activos')}
              >
                Activos
              </button>{' '}
              o{' '}
              <button
                type="button"
                className={styles.linkInline}
                onClick={() => handleTabChange('tablero')}
              >
                Tablero
              </button>
              .
            </>
          }
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

interface ContractsTableProps {
  contracts: Contract[];
  propertyById: Map<number, string>;
  today: Date;
  emptyTitle: string;
  emptySub: string;
  onNew: () => void;
  onDelete: (contract: Contract & { id: number }) => void;
}

const ContractsTable: React.FC<ContractsTableProps> = ({
  contracts,
  propertyById,
  today,
  emptyTitle,
  emptySub,
  onNew,
  onDelete,
}) => {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  useEffect(() => {
    if (openMenuId === null) return;
    const close = (): void => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  if (contracts.length === 0) {
    return (
      <EmptyState
        icon={<Icons.Contratos size={20} />}
        title={emptyTitle}
        sub={emptySub}
        ctaLabel={emptyTitle ? '+ nuevo contrato' : undefined}
        onCtaClick={onNew}
      />
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Inquilino</th>
            <th>Inmueble</th>
            <th>Modalidad</th>
            <th>Inicio</th>
            <th>Fin</th>
            <th className="r">Renta</th>
            <th className="c">Estado</th>
            <th className={styles.actionsCell} aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {contracts
            .filter((c): c is Contract & { id: number } => c.id != null)
            .map((c) => {
              const activo = isContratoActivo(c);
              const expiring = activo && isExpiringSoon(c, today, 90);
              const propertyAlias = propertyById.get(c.inmuebleId) ?? `#${c.inmuebleId}`;
              const menuOpen = openMenuId === c.id;
              const nombreCompleto = `${c.inquilino?.nombre ?? ''} ${
                c.inquilino?.apellidos ?? ''
              }`.trim();
              const finIndefinida = esFechaIndefinida(c.fechaFin);
              return (
                <tr
                  key={c.id}
                  onClick={() => showToastV5(`Detalle contrato · ${nombreCompleto || '—'}`)}
                >
                  <td>
                    <div className={styles.tStrong}>
                      {nombreCompleto || '—'}
                    </div>
                    {c.inquilino?.email && (
                      <div className={styles.tMuted}>{c.inquilino.email}</div>
                    )}
                  </td>
                  <td>{propertyAlias}</td>
                  <td>
                    <Pill variant="brand">{c.modalidad}</Pill>
                  </td>
                  <td>
                    <DateLabel value={c.fechaInicio} format="short" size="sm" />
                  </td>
                  <td>
                    {finIndefinida ? (
                      <span className={styles.fechaIndefinida}>Indefinido</span>
                    ) : (
                      <DateLabel value={c.fechaFin} format="short" size="sm" />
                    )}
                  </td>
                  <td className="r">
                    <MoneyValue value={c.rentaMensual} decimals={0} />
                  </td>
                  <td className="c">
                    <Pill
                      variant={expiring ? 'warn' : activo ? 'pos' : 'gris'}
                      asTag
                    >
                      {expiring ? 'Vence pronto' : activo ? 'Activo' : 'Inactivo'}
                    </Pill>
                  </td>
                  <td
                    className={styles.actionsCell}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={styles.kebabBtn}
                      aria-label="Acciones del contrato"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(menuOpen ? null : c.id);
                      }}
                    >
                      <Icons.More size={16} strokeWidth={1.8} />
                    </button>
                    {menuOpen && (
                      <div className={styles.menuPopover} role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          className={`${styles.menuItem} ${styles.menuItemDanger}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            onDelete(c);
                          }}
                        >
                          <Icons.Delete size={14} strokeWidth={1.8} />
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
};

export default ContratosListPage;
