import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Outlet, Navigate } from 'react-router-dom';
import { PageHead, MoneyValue, Icons, showToastV5 } from '../../design-system/v5';
import { initDB, Account, Movement } from '../../services/db';
import { cuentasService } from '../../services/cuentasService';
import {
  necesitaRegenerar,
  regenerateForecastsForward,
} from '../../services/treasuryBootstrapService';
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
  const [treasuryEvents, setTreasuryEvents] = useState<any[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const db = await initDB();
        const [accs, movs, evts] = await Promise.all([
          db.getAll('accounts') as Promise<Account[]>,
          db.getAll('movements') as Promise<Movement[]>,
          db.getAll('treasuryEvents') as Promise<any[]>,
        ]);
        if (cancelled) return;
        const activeAccs = accs.filter(
          (a) => (a.status ?? 'ACTIVE') === 'ACTIVE',
        );
        setAccounts(activeAccs);
        setMovements(movs);
        setTreasuryEvents(evts);
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
  }, [reloadTick]);

  // ── T31 · auto-ejecución silenciosa del bootstrap forward-looking ──
  // Al montar Tesorería · si detectamos gap entre el último predicted y el
  // horizonte esperado (24m), regeneramos en background sin diálogos ni
  // spinners ruidosos. Errores quedan en consola.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const necesita = await necesitaRegenerar(24);
        if (!necesita || cancelled) return;
        const resultado = await regenerateForecastsForward();
        if (cancelled) return;
        if (resultado.eventosCreados > 0) {
          setReloadTick((t) => t + 1);
        }
        if (resultado.errores.length > 0) {
          // eslint-disable-next-line no-console
          console.warn('[TreasuryBootstrap] errores parciales', resultado.errores);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[TreasuryBootstrap] auto-regeneración falló', err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── T31 · Regenerar 24 meses forward-only (botón header) ──
  const handleRegenerarPrevisiones = async (): Promise<void> => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const result = await regenerateForecastsForward({ force: true });
      const partes: string[] = [];
      if (result.eventosCreados > 0) {
        partes.push(`${result.eventosCreados} creado${result.eventosCreados === 1 ? '' : 's'}`);
      }
      if (result.eventosOmitidos > 0) {
        partes.push(`${result.eventosOmitidos} omitido${result.eventosOmitidos === 1 ? '' : 's'}`);
      }
      const resumen = partes.length > 0
        ? `Previsiones regeneradas · ${partes.join(' · ')}`
        : 'Previsiones ya estaban al día';
      if (result.errores.length > 0) {
        showToastV5(`${resumen} (con avisos · ver consola)`, 'warn');
        // eslint-disable-next-line no-console
        console.warn('[TreasuryBootstrap] errores parciales', result.errores);
      } else {
        showToastV5(resumen, 'success');
      }
      setReloadTick((t) => t + 1);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[TreasuryBootstrap] regeneración manual falló', err);
      showToastV5('Error regenerando previsiones · ver consola', 'error');
    } finally {
      setRegenerating(false);
    }
  };

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
            </strong>
          </>
        }
        actions={[
          {
            label: regenerating ? 'Regenerando…' : 'Regenerar previsiones',
            variant: 'ghost',
            icon: <Icons.Refresh size={14} strokeWidth={1.8} />,
            onClick: handleRegenerarPrevisiones,
            disabled: regenerating,
          },
          {
            label: 'Importar cuentas',
            variant: 'ghost',
            icon: <Icons.Upload size={14} strokeWidth={1.8} />,
            onClick: () => navigate('/tesoreria/importar-cuentas'),
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

      <Outlet context={{ accounts, movements, treasuryEvents }} />
    </div>
  );
};

export interface TesoreriaContext {
  accounts: Account[];
  movements: Movement[];
  treasuryEvents: any[];
}

export default TesoreriaPage;
export { TesoreriaPage };
