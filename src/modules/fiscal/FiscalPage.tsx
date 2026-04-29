// Container del módulo Fiscal (v5). Sustituye a
// `src/modules/horizon/fiscalidad/FiscalLayout.tsx` con un patrón Outlet +
// sub-páginas (Dashboard · Ejercicios · Detalle · Calendario · Configuración)
// alineado con Mi Plan / Personal / Tesorería / Inversiones / Financiación.
//
// Mockup oficial · `docs/audit-inputs/atlas-fiscal.html`. La ruta canónica
// pasa de `/fiscalidad` a `/fiscal` (alineado con Icons.Fiscal v5).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { PageHead, Icons, showToastV5 } from '../../design-system/v5';
import { getAllEjercicios } from '../../services/ejercicioFiscalService';
import type { EjercicioFiscal } from '../../types/fiscal';
import { ejercicioRowFrom, ESTADOS_VIVOS } from './helpers';
import type { EjercicioRow } from './types';
import type { FiscalOutletContext } from './FiscalContext';
import styles from './FiscalPage.module.css';

interface TabItem {
  key: 'dashboard' | 'ejercicios' | 'deudas' | 'configuracion';
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  countFn?: (rows: EjercicioRow[]) => { count: number; tone?: 'neg' | 'pos' | 'neutral' };
}

const tabs: TabItem[] = [
  { key: 'dashboard', label: 'Calendario', path: '/fiscal', icon: Icons.Calendar },
  {
    key: 'ejercicios',
    label: 'Ejercicios',
    path: '/fiscal/ejercicios',
    icon: Icons.Fiscal,
    countFn: (r) => ({ count: r.length, tone: 'neutral' }),
  },
  {
    key: 'deudas',
    label: 'Deudas',
    path: '/fiscal/deudas',
    icon: Icons.Warning,
    countFn: (r) => {
      const n = r.filter((x) => x.cuotaResultadoEur < 0 && x.estado === 'declarado').length;
      return { count: n, tone: 'neg' };
    },
  },
  {
    key: 'configuracion',
    label: 'Configuración',
    path: '/fiscal/configuracion',
    icon: Icons.Ajustes,
  },
];

const FiscalPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [ejercicios, setEjercicios] = useState<EjercicioFiscal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getAllEjercicios();
      setEjercicios(
        list.sort((a, b) => b.ejercicio - a.ejercicio),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[fiscal] error cargando ejercicios', err);
      showToastV5('Error al cargar la fiscalidad.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows: EjercicioRow[] = useMemo(
    () => ejercicios.map(ejercicioRowFrom),
    [ejercicios],
  );

  const ctx: FiscalOutletContext = { ejercicios, rows, reload: load };

  if (location.pathname === '/fiscal/') {
    return <Navigate to="/fiscal" replace />;
  }

  // Detalle de ejercicio · `/fiscal/ejercicio/:anio` · ocultamos las tabs
  // principales y dejamos que la página renderice su propio breadcrumb.
  const isDetail = /^\/fiscal\/ejercicio\/[^/]+$/.test(location.pathname);

  const activeKey: TabItem['key'] = (() => {
    if (location.pathname === '/fiscal' || location.pathname === '/fiscal/') return 'dashboard';
    if (location.pathname.startsWith('/fiscal/ejercicios')) return 'ejercicios';
    if (location.pathname.startsWith('/fiscal/deudas')) return 'deudas';
    if (location.pathname.startsWith('/fiscal/configuracion')) return 'configuracion';
    return 'dashboard';
  })();

  const ejerciciosVivos = ejercicios.filter((e) => ESTADOS_VIVOS.includes(e.estado));
  const ejercicioCampaña = ejerciciosVivos.find((e) => e.ejercicio === new Date().getFullYear() - 1);
  const subText = (() => {
    const total = ejercicios.length;
    const enCurso = ejerciciosVivos.length;
    const declarados = ejercicios.filter((e) => e.estado === 'declarado').length;
    const prescritos = ejercicios.filter((e) => e.estado === 'prescrito').length;
    return `${total} ejercicios · ${enCurso} en curso · ${declarados} declarados · ${prescritos} prescritos`;
  })();

  return (
    <div className={styles.page}>
      {!isDetail && (
        <PageHead
          title="Fiscal"
          sub={
            <>
              {subText}
              {ejercicioCampaña && (
                <>
                  {' · '}campaña IRPF{' '}
                  <strong style={{ color: 'var(--atlas-v5-ink)' }}>
                    {ejercicioCampaña.ejercicio} · 2 abr – 30 jun
                  </strong>
                </>
              )}
            </>
          }
          actions={[
            {
              label: 'Calendario fiscal',
              variant: 'ghost',
              icon: <Icons.Calendar size={14} strokeWidth={1.8} />,
              onClick: () => navigate('/fiscal'),
            },
            {
              label: 'Configuración',
              variant: 'ghost',
              icon: <Icons.Ajustes size={14} strokeWidth={1.8} />,
              onClick: () => navigate('/fiscal/configuracion'),
            },
          ]}
          tabsSlot={
            <div className={styles.tabsBar} role="group" aria-label="Tabs Fiscal">
              {tabs.map((tab) => {
                const isActive = tab.key === activeKey;
                const Icon = tab.icon;
                const meta = tab.countFn ? tab.countFn(rows) : null;
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
                    {meta && meta.count > 0 && (
                      <span
                        className={`${styles.tabCount} ${meta.tone === 'neg' ? styles.neg : ''}`}
                      >
                        {meta.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          }
        />
      )}
      {loading ? (
        <div className={styles.loading}>Cargando ejercicios…</div>
      ) : (
        <Outlet context={ctx} />
      )}
    </div>
  );
};

export default FiscalPage;
