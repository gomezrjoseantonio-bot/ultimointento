import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  PageHead,
  Icons,
} from '../../../design-system/v5';
import type { Contract } from '../../../services/db';
import type { InmueblesOutletContext } from '../InmueblesContext';
import { esFechaIndefinida } from '../utils/formatFechaFin';
import { calcularLibresAhora } from '../utils/calcularLibresAhora';
import {
  filtrarVencen30d,
  filtrarVencen30a90d,
} from '../utils/filtrosVencimiento';
import KpiContratoCard from '../components/contratos/KpiContratoCard';
import DrawerLibres from '../components/contratos/DrawerLibres';
import DrawerVencen from '../components/contratos/DrawerVencen';
import TabActivos from '../components/contratos/TabActivos';
import TabTablero from '../components/contratos/TabTablero';
import TabDisponibilidad from '../components/contratos/TabDisponibilidad';
import TabHistorico from '../components/contratos/historico/TabHistorico';
import styles from './ContratosListPage.module.css';
import { isContratoActivo } from '../utils/contratoEstado';

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
  const { properties, contracts } = useOutletContext<InmueblesOutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab: Tab = normalizeTab(searchParams.get('tab')) ?? 'activos';
  const [tab, setTab] = useState<Tab>(initialTab);
  const today = useMemo(() => new Date(), []);

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

  // KPIs cabecera
  const libresAhora = useMemo(
    () => calcularLibresAhora(contracts, properties, today),
    [contracts, properties, today],
  );
  const vencen30 = useMemo(() => filtrarVencen30d(contracts, today), [contracts, today]);
  const vencen3090 = useMemo(() => filtrarVencen30a90d(contracts, today), [contracts, today]);
  const libres = libresAhora.total;

  const [drawerOpen, setDrawerOpen] = useState<null | 'libres' | 'd30' | 'd3090'>(null);

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
          contratos={activos}
          inmuebleAliasById={propertyById}
          onNuevoContrato={() => navigate('/contratos/nuevo')}
        />
      )}

      {tab === 'historico' && (
        <TabHistorico
          contratos={historico}
          properties={properties}
          inmuebleAliasById={propertyById}
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
    </>
  );
};

export default ContratosListPage;
