// Container del módulo Financiación (v5). Sustituye a
// `src/modules/horizon/financiacion/Financiacion.tsx` con un patrón
// Outlet + 4 sub-páginas (Dashboard · Listado · Snowball · Calendario)
// alineado con Mi Plan / Personal / Tesorería / Inversiones.
//
// Carga préstamos + planes una sola vez y los expone vía `useOutletContext`.
// La página Detalle (no es un tab) se renderiza también en este Outlet
// dentro de `/financiacion/:id`.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { PageHead, Icons, showToastV5 } from '../../design-system/v5';
import {
  prestamosService,
  interesesTotalDeducible,
} from '../../services/prestamosService';
import type { Prestamo, PlanPagos } from '../../types/prestamos';
import { effectiveTIN, loanRowFromPrestamo } from './helpers';
import type { LoanRow } from './types';
import type { FinanciacionOutletContext } from './FinanciacionContext';
import styles from './FinanciacionPage.module.css';

interface TabItem {
  key: 'dashboard' | 'listado' | 'snowball' | 'calendario';
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  countFn?: (rows: LoanRow[]) => number;
}

const tabs: TabItem[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/financiacion', icon: Icons.Panel },
  {
    key: 'listado',
    label: 'Listado',
    path: '/financiacion/listado',
    icon: Icons.Cartera,
    countFn: (r) => r.length,
  },
  { key: 'snowball', label: 'Snowball', path: '/financiacion/snowball', icon: Icons.Reducir },
  { key: 'calendario', label: 'Calendario', path: '/financiacion/calendario', icon: Icons.Calendar },
];

const FinanciacionPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [planes, setPlanes] = useState<Map<string, PlanPagos | null>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await prestamosService.getAllPrestamos();
      // Sync cached fields (cuotasPagadas / principalVivo) for data created
      // before the autoMarcarCuotasPagadas cache-recalc fix.
      const synced = await Promise.all(
        list.map((p) => prestamosService.autoMarcarCuotasPagadas(p.id).catch(() => null)),
      );
      const updatedList = synced.map((s, i) => s ?? list[i]);
      setPrestamos(updatedList);
      const planEntries = await Promise.all(
        updatedList.map(async (p) => {
          try {
            const plan = await prestamosService.getPaymentPlan(p.id);
            return [p.id, plan] as const;
          } catch {
            return [p.id, null] as const;
          }
        }),
      );
      setPlanes(new Map(planEntries));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[financiacion] error cargando datos', err);
      showToastV5('Error al cargar la financiación.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const rows: LoanRow[] = useMemo(() => {
    return prestamos
      .filter((p) => p.activo !== false && p.estado !== 'cancelado')
      .map((p) => {
        // Aproximación · intereses anuales = capitalVivo · TIN efectivo.
        const interesesAnualEstim = (p.principalVivo * effectiveTIN(p)) / 100;
        let intDed = 0;
        try {
          intDed = interesesTotalDeducible(p, interesesAnualEstim);
        } catch {
          intDed = 0;
        }
        return loanRowFromPrestamo(p, intDed);
      });
  }, [prestamos]);

  const ctx: FinanciacionOutletContext = {
    prestamos,
    rows,
    planes,
    reload: load,
  };

  if (location.pathname === '/financiacion/') {
    return <Navigate to="/financiacion" replace />;
  }

  // El Detalle (`/financiacion/:id`) es una sub-ruta · ahí no mostramos las
  // tabs principales · son sustituidas por un breadcrumb propio en la página.
  const isDetail =
    /^\/financiacion\/[^/]+$/.test(location.pathname) &&
    !['/financiacion/listado', '/financiacion/snowball', '/financiacion/calendario', '/financiacion/nuevo', '/financiacion/nuevo-fein'].includes(
      location.pathname,
    );
  const isWizard =
    location.pathname === '/financiacion/nuevo' ||
    location.pathname === '/financiacion/nuevo-fein' ||
    /^\/financiacion\/[^/]+\/editar$/.test(location.pathname);

  const activeKey: TabItem['key'] = (() => {
    if (location.pathname === '/financiacion' || location.pathname === '/financiacion/') return 'dashboard';
    if (location.pathname.startsWith('/financiacion/listado')) return 'listado';
    if (location.pathname.startsWith('/financiacion/snowball')) return 'snowball';
    if (location.pathname.startsWith('/financiacion/calendario')) return 'calendario';
    return 'dashboard';
  })();

  const showTabs = !isDetail && !isWizard;

  return (
    <div className={styles.page}>
      {!isDetail && !isWizard && (
        <PageHead
          title="Financiación"
          sub="tus hipotecas y préstamos · destino determina deducibilidad fiscal"
          actions={[
            {
              label: 'Importar CSV',
              variant: 'ghost',
              icon: <Icons.Upload size={14} strokeWidth={1.8} />,
              onClick: () => navigate('/financiacion/importar'),
            },
            {
              label: 'Crear desde FEIN',
              variant: 'ghost',
              icon: <Icons.Upload size={14} strokeWidth={1.8} />,
              onClick: () => navigate('/financiacion/nuevo-fein'),
            },
            {
              label: 'Nuevo préstamo',
              variant: 'gold',
              icon: <Icons.Plus size={14} strokeWidth={1.8} />,
              onClick: () => navigate('/financiacion/nuevo'),
            },
          ]}
          tabsSlot={
            showTabs ? (
              <div className={styles.tabsBar} role="group" aria-label="Tabs Financiación">
                {tabs.map((tab) => {
                  const isActive = tab.key === activeKey;
                  const Icon = tab.icon;
                  const count = tab.countFn ? tab.countFn(rows) : null;
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
                      {count != null && count > 0 && (
                        <span className={styles.tabCount}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : undefined
          }
        />
      )}
      {loading ? (
        <div className={styles.loading}>Cargando financiación…</div>
      ) : (
        <Outlet context={ctx} />
      )}
    </div>
  );
};

export default FinanciacionPage;
