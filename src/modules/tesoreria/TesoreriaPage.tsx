import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, Outlet, Navigate } from 'react-router-dom';
import { initDB, Account, Movement, type Property } from '../../services/db';
import { cuentasService } from '../../services/cuentasService';
import {
  necesitaRegenerar,
  regenerateForecastsForward,
} from '../../services/treasuryBootstrapService';
import { intlOpts } from '../../utils/intlNumber';
import styles from './TesoreriaPage.module.css';

const MONTH_NAMES_LONG = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const formatEur = (v: number): string =>
  v.toLocaleString(
    'es-ES',
    // es-ES por defecto usa minimumGroupingDigits=2 · 4 cifras (p.ej. 4473)
    // se quedaban sin separador. El mockup v8 espera "4.473" (el sufijo " €"
    // se concatena en el JSX, esta función solo formatea el número).
    intlOpts({
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: 'always',
    }),
  );

const TesoreriaPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [treasuryEvents, setTreasuryEvents] = useState<any[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const db = await initDB();
        const [accs, movs, evts, props] = await Promise.all([
          db.getAll('accounts') as Promise<Account[]>,
          db.getAll('movements') as Promise<Movement[]>,
          db.getAll('treasuryEvents') as Promise<any[]>,
          db.getAll('properties') as Promise<Property[]>,
        ]);
        if (cancelled) return;
        const activeAccs = accs.filter(
          (a) => (a.status ?? 'ACTIVE') === 'ACTIVE',
        );
        setAccounts(activeAccs);
        setMovements(movs);
        setTreasuryEvents(evts);
        setProperties(props);
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

  // ── KPIs Banner Navy (mockup v8) ──
  // Saldo · suma saldos de cuentas activas
  // Pendiente entrar mes · treasuryEvents tipo 'income' status 'predicted' del mes en curso
  // Pendiente salir mes · treasuryEvents tipo 'expense'/'financing' status 'predicted' del mes en curso
  // Saldo final mes · saldo + pendiente entrar − pendiente salir (proyección)
  const kpis = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();

    const saldo = accounts.reduce(
      (sum, a) => sum + (a.balance ?? a.openingBalance ?? 0),
      0,
    );

    const eventosMesPredicted = treasuryEvents.filter((e: any) => {
      if (!e?.predictedDate) return false;
      if (e.status !== 'predicted') return false;
      if (e.executedMovementId) return false;
      const d = new Date(
        String(e.predictedDate).length > 10
          ? e.predictedDate
          : `${e.predictedDate}T00:00:00`,
      );
      return (
        !Number.isNaN(d.getTime()) &&
        d.getFullYear() === y &&
        d.getMonth() === m
      );
    });

    const ingresos = eventosMesPredicted.filter((e: any) => e.type === 'income');
    const gastos = eventosMesPredicted.filter(
      (e: any) => e.type === 'expense' || e.type === 'financing',
    );
    const pendienteEntrar = ingresos.reduce(
      (s: number, e: any) => s + (e.amount ?? 0),
      0,
    );
    const pendienteSalir = gastos.reduce(
      (s: number, e: any) => s + (e.amount ?? 0),
      0,
    );
    const saldoFinal = saldo + pendienteEntrar - pendienteSalir;

    return {
      saldo,
      pendienteEntrar,
      pendienteSalir,
      saldoFinal,
      ingresosCount: ingresos.length,
      gastosCount: gastos.length,
      mesNombre: MONTH_NAMES_LONG[m],
    };
  }, [accounts, treasuryEvents]);

  const pendientesConciliarCount = useMemo(() => {
    const fromMovs = movements.filter(
      (m) =>
        m.unifiedStatus === 'no_planificado' ||
        m.estado_conciliacion === 'sin_conciliar',
    ).length;
    return fromMovs;
  }, [movements]);

  // Default redirect a general
  if (location.pathname === '/tesoreria/') {
    return <Navigate to="/tesoreria" replace />;
  }

  return (
    <div className={styles.page}>
      {/* Banner navy · "Mi Tesorería" + 4 KPIs (mockup v8) */}
      <div className={styles.bannerNavy}>
        <div className={styles.bannerRow}>
          <div className={styles.bannerSectionTitle}>
            <span className={styles.goldDot} aria-hidden />
            <h2>Mi Tesorería</h2>
          </div>
          <div className={styles.kpiBanner}>
            <div className={styles.kpiBannerLabel}>Saldo</div>
            <div className={styles.kpiBannerValue}>
              {formatEur(kpis.saldo)} €
            </div>
            <div className={styles.kpiBannerSub}>
              {accounts.length} cuenta{accounts.length === 1 ? '' : 's'} · hoy
            </div>
          </div>
          <div className={styles.kpiBanner}>
            <div className={styles.kpiBannerLabel}>Pendiente entrar mes</div>
            <div className={`${styles.kpiBannerValue} ${styles.pos}`}>
              +{formatEur(kpis.pendienteEntrar)} €
            </div>
            <div className={styles.kpiBannerSub}>
              {kpis.ingresosCount} movimiento{kpis.ingresosCount === 1 ? '' : 's'} · {kpis.mesNombre}
            </div>
          </div>
          <div className={styles.kpiBanner}>
            <div className={styles.kpiBannerLabel}>Pendiente salir mes</div>
            <div className={`${styles.kpiBannerValue} ${styles.neg}`}>
              −{formatEur(kpis.pendienteSalir)} €
            </div>
            <div className={styles.kpiBannerSub}>
              {kpis.gastosCount} movimiento{kpis.gastosCount === 1 ? '' : 's'} · {kpis.mesNombre}
            </div>
          </div>
          <div className={styles.kpiBanner}>
            <div className={styles.kpiBannerLabel}>Saldo final mes</div>
            <div className={styles.kpiBannerValue}>
              {formatEur(kpis.saldoFinal)} €
            </div>
            <div className={styles.kpiBannerSub}>
              cierre proyectado · {kpis.mesNombre}
            </div>
          </div>
        </div>
      </div>

      {/* Subcabecera blanca · h1 + subtítulo · sin botones (todo es contextual a vista cuenta) */}
      <div className={styles.subheader}>
        <div className={styles.subheaderInner}>
          <div>
            <h1 className={styles.subheaderTitle}>Tesorería</h1>
            <div className={styles.subheaderSub}>
              <strong>{accounts.length}</strong> cuenta{accounts.length === 1 ? '' : 's'} activas ·{' '}
              <button
                type="button"
                className={styles.subheaderLink}
                onClick={() => navigate('/tesoreria/movimientos?status=pendientes')}
              >
                <strong>{pendientesConciliarCount}</strong> movimiento
                {pendientesConciliarCount === 1 ? '' : 's'} pendientes
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <Outlet
          context={{
            accounts,
            movements,
            treasuryEvents,
            properties,
            reload: () => setReloadTick((t) => t + 1),
            totalSaldo: kpis.saldo,
          }}
        />
      </div>
    </div>
  );
};

export interface TesoreriaContext {
  accounts: Account[];
  movements: Movement[];
  treasuryEvents: any[];
  /** PR-C1 · necesario para que MovimientosTab abra `AddMovementModal` con
   * el listado de inmuebles disponible (ámbito='inmueble' o financiación). */
  properties: Property[];
  reload: () => void;
  /** S-TESORERIA-FASE-B · saldo consolidado (calculado en TesoreriaPage). */
  totalSaldo: number;
}

export default TesoreriaPage;
export { TesoreriaPage };
