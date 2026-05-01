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
import styles from './ContratosListPage.module.css';

type Tab = 'disponibilidad' | 'acciones' | 'activos' | 'historico';

const VALID_TABS: Tab[] = ['disponibilidad', 'acciones', 'activos', 'historico'];
const isValidTab = (value: string | null): value is Tab =>
  value !== null && (VALID_TABS as string[]).includes(value);

const isContractActiveAt = (c: Contract, today: Date): boolean => {
  if (!c.fechaInicio || !c.fechaFin) return false;
  const ini = new Date(c.fechaInicio);
  const fin = new Date(c.fechaFin);
  return !Number.isNaN(ini.getTime()) && !Number.isNaN(fin.getTime()) && ini <= today && today <= fin;
};

const isExpiringSoon = (c: Contract, today: Date, daysWindow = 90): boolean => {
  if (!c.fechaFin) return false;
  const fin = new Date(c.fechaFin);
  if (Number.isNaN(fin.getTime())) return false;
  const diff = fin.getTime() - today.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= daysWindow;
};

const ContratosListPage: React.FC = () => {
  const navigate = useNavigate();
  const { properties, contracts } = useOutletContext<InmueblesOutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab: Tab = isValidTab(searchParams.get('tab')) ? (searchParams.get('tab') as Tab) : 'activos';
  const [tab, setTab] = useState<Tab>(initialTab);
  const today = useMemo(() => new Date(), []);

  // Sincronizar tab cuando cambia el query param (navegación externa · back/forward · enlace)
  useEffect(() => {
    const queryTab = searchParams.get('tab');
    if (isValidTab(queryTab) && queryTab !== tab) {
      setTab(queryTab);
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

  const activos = useMemo(
    () => contracts.filter((c) => isContractActiveAt(c, today)),
    [contracts, today],
  );
  const acciones = useMemo(
    () =>
      contracts.filter(
        (c) => isContractActiveAt(c, today) && isExpiringSoon(c, today, 90),
      ),
    [contracts, today],
  );
  const historico = contracts;

  // Disponibilidad · unidades libres por inmueble
  const totalUnidades = properties.reduce((sum, p) => sum + (p.bedrooms || 1), 0);
  const ocupadas = activos.length;
  const libres = totalUnidades - ocupadas;

  const tabs: Array<{ key: Tab; label: string; count?: number; countTone?: 'neg' }> = [
    { key: 'disponibilidad', label: 'Disponibilidad', count: libres, countTone: libres > 0 ? 'neg' : undefined },
    { key: 'acciones', label: 'Acciones', count: acciones.length },
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
        />
      )}

      {tab === 'historico' && (
        <ContractsTable
          contracts={historico}
          propertyById={propertyById}
          today={today}
          emptyTitle="Sin contratos registrados"
          emptySub="Aún no hay contratos en la base de datos."
          onNew={() => navigate('/contratos/nuevo')}
        />
      )}

      {tab === 'acciones' && (
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
            />
          )}
        </>
      )}

      {tab === 'disponibilidad' && (
        <div className={styles.placeholder}>
          <strong>Timeline 6 meses · disponibilidad por habitación</strong>
          Vista timeline 6 meses prevista · pendiente de implementación
          completa en sub-tarea follow-up. Por ahora · {libres} unidades
          libres del total de {totalUnidades}.
        </div>
      )}
    </>
  );
};

interface ContractsTableProps {
  contracts: Contract[];
  propertyById: Map<number, string>;
  today: Date;
  emptyTitle: string;
  emptySub: string;
  onNew: () => void;
}

const ContractsTable: React.FC<ContractsTableProps> = ({
  contracts,
  propertyById,
  today,
  emptyTitle,
  emptySub,
  onNew,
}) => {
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
          </tr>
        </thead>
        <tbody>
          {contracts
            .filter((c): c is Contract & { id: number } => c.id != null)
            .map((c) => {
              const activo = isContractActiveAt(c, today);
              const expiring = isExpiringSoon(c, today, 90);
              const propertyAlias = propertyById.get(c.inmuebleId) ?? `#${c.inmuebleId}`;
              return (
                <tr
                  key={c.id}
                  onClick={() => showToastV5(`Detalle contrato · ${c.inquilino.nombre}`)}
                >
                  <td>
                    <div className={styles.tStrong}>
                      {c.inquilino.nombre} {c.inquilino.apellidos}
                    </div>
                    {c.inquilino.email && (
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
                    <DateLabel value={c.fechaFin} format="short" size="sm" />
                  </td>
                  <td className="r">
                    <MoneyValue value={c.rentaMensual} decimals={0} />
                  </td>
                  <td className="c">
                    <Pill
                      variant={
                        activo && expiring ? 'warn' : activo ? 'pos' : 'gris'
                      }
                      asTag
                    >
                      {activo && expiring
                        ? 'Vence pronto'
                        : activo
                          ? 'Activo'
                          : 'Inactivo'}
                    </Pill>
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
