import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Outlet, Navigate } from 'react-router-dom';
import { PageHead, MoneyValue, Icons, showToastV5 } from '../../design-system/v5';
import { initDB, Account, Movement } from '../../services/db';
import { cuentasService } from '../../services/cuentasService';
import styles from './TesoreriaPage.module.css';

interface TabItem {
  key: 'general' | 'movimientos';
  label: string;
  count?: number;
  path: string;
}

const TesoreriaPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const db = await initDB();
        const [accs, movs] = await Promise.all([
          db.getAll('accounts') as Promise<Account[]>,
          db.getAll('movements') as Promise<Movement[]>,
        ]);
        if (cancelled) return;
        const activeAccs = accs.filter(
          (a) => (a.status ?? 'ACTIVE') === 'ACTIVE',
        );
        setAccounts(activeAccs);
        setMovements(movs);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[tesoreria] error cargando datos', err);
      }
    };
    load();
    const unsubscribe = cuentasService.on((event) => {
      if (event === 'accounts:updated') load();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const totalSaldo = accounts.reduce(
    (sum, a) => sum + (a.balance ?? a.openingBalance ?? 0),
    0,
  );
  const pendientesCount = movements.filter(
    (m) => m.unifiedStatus === 'no_planificado' || m.estado_conciliacion === 'sin_conciliar',
  ).length;

  const tabs: TabItem[] = [
    { key: 'general', label: 'Vista general', path: '/tesoreria' },
    {
      key: 'movimientos',
      label: 'Conciliación bancaria',
      count: pendientesCount,
      path: '/tesoreria/movimientos',
    },
  ];

  // Default redirect a general
  if (location.pathname === '/tesoreria/') {
    return <Navigate to="/tesoreria" replace />;
  }

  const activeKey: TabItem['key'] = location.pathname.startsWith('/tesoreria/movimientos')
    ? 'movimientos'
    : 'general';

  return (
    <div className={styles.page}>
      <PageHead
        title="Tesorería"
        sub={
          <>
            <strong>{accounts.length}</strong> cuentas <span> · </span>
            saldo consolidado{' '}
            <strong>
              <MoneyValue value={totalSaldo} decimals={0} tone="ink" />
            </strong>{' '}
            <span> · </span>
            última sync hace 12 min
          </>
        }
        actions={[
          {
            label: 'Exportar',
            variant: 'ghost',
            icon: <Icons.Download size={14} strokeWidth={1.8} />,
            onClick: () => showToastV5('Exportar movimientos · CSV / XLSX'),
          },
          {
            label: 'Subir extracto',
            variant: 'gold',
            icon: <Icons.Upload size={14} strokeWidth={1.8} />,
            onClick: () => navigate('/tesoreria/importar'),
          },
        ]}
        tabsSlot={
          <div className={styles.tabsBar} role="group" aria-label="Tabs Tesorería">
            {tabs.map((tab) => {
              const isActive = tab.key === activeKey;
              const cls = isActive ? styles.active : '';
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={cls}
                  aria-pressed={isActive}
                  onClick={() => navigate(tab.path)}
                >
                  {tab.label}
                  {tab.count != null && tab.count > 0 && (
                    <span className={styles.tabCount}>{tab.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        }
      />

      <Outlet context={{ accounts, movements }} />
    </div>
  );
};

export interface TesoreriaContext {
  accounts: Account[];
  movements: Movement[];
}

export default TesoreriaPage;
export { TesoreriaPage };
