import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { PageHead, Icons, showToastV5 } from '../../design-system/v5';
import { initDB } from '../../services/db';
import { getEscenarioActivo } from '../../services/escenariosService';
import { listObjetivosVitales } from '../../services/objetivosVitalesService';
import type {
  Escenario,
  Objetivo,
  FondoAhorro,
  Reto,
} from '../../types/miPlan';
import type { ObjetivoVital } from '../../types/objetivosVitales';
import type { MiPlanOutletContext } from './MiPlanContext';
import { SHOW_RETOS } from './featureFlags';
import styles from './MiPlanPage.module.css';

interface TabItem {
  key: 'landing' | 'proyeccion' | 'libertad' | 'objetivos' | 'hitos-vitales' | 'fondos' | 'retos';
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
}

// T27.2-skip · El flag `SHOW_RETOS` (ver `./featureFlags`) controla TODOS
// los puntos de entrada al submódulo Retos · pestaña · ruta · card landing
// · sub-tab navigation · sub-text "reto activo" del page-head.
const allTabs: TabItem[] = [
  { key: 'landing', label: 'Mi Plan', path: '/mi-plan', icon: Icons.MiPlan },
  { key: 'proyeccion', label: 'Proyección', path: '/mi-plan/proyeccion', icon: Icons.Proyeccion },
  { key: 'libertad', label: 'Libertad financiera', path: '/mi-plan/libertad', icon: Icons.Libertad },
  { key: 'objetivos', label: 'Objetivos', path: '/mi-plan/objetivos', icon: Icons.Objetivos },
  { key: 'hitos-vitales', label: 'Hitos vitales', path: '/mi-plan/hitos-vitales', icon: Icons.Compra },
  { key: 'fondos', label: 'Fondos de ahorro', path: '/mi-plan/fondos', icon: Icons.Fondos },
  { key: 'retos', label: 'Retos', path: '/mi-plan/retos', icon: Icons.Retos },
];

const tabs: TabItem[] = SHOW_RETOS
  ? allTabs
  : allTabs.filter((t) => t.key !== 'retos');

const isCurrentMonth = (mes: string): boolean => {
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return mes === ym;
};

const MiPlanPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [escenario, setEscenario] = useState<Escenario | null>(null);
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [fondos, setFondos] = useState<FondoAhorro[]>([]);
  const [retos, setRetos] = useState<Reto[]>([]);
  const [hitosVitales, setHitosVitales] = useState<ObjetivoVital[]>([]);

  const load = useCallback(async () => {
    try {
      const db = await initDB();
      const [esc, obj, fon, ret, hit] = await Promise.all([
        getEscenarioActivo(),
        db.getAll('objetivos') as Promise<Objetivo[]>,
        db.getAll('fondos_ahorro') as Promise<FondoAhorro[]>,
        db.getAll('retos') as Promise<Reto[]>,
        listObjetivosVitales(),
      ]);
      setEscenario(esc);
      setObjetivos(obj.filter((o) => o.estado !== 'archivado'));
      setFondos(fon.filter((f) => f.activo));
      setRetos(ret);
      setHitosVitales(hit);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[mi-plan] error cargando datos', err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (location.pathname === '/mi-plan/') {
    return <Navigate to="/mi-plan" replace />;
  }

  const activeKey: TabItem['key'] = (() => {
    if (location.pathname === '/mi-plan' || location.pathname === '/mi-plan/') return 'landing';
    if (location.pathname.startsWith('/mi-plan/proyeccion')) return 'proyeccion';
    if (location.pathname.startsWith('/mi-plan/libertad')) return 'libertad';
    if (location.pathname.startsWith('/mi-plan/objetivos')) return 'objetivos';
    if (location.pathname.startsWith('/mi-plan/hitos-vitales')) return 'hitos-vitales';
    if (location.pathname.startsWith('/mi-plan/fondos')) return 'fondos';
    if (location.pathname.startsWith('/mi-plan/retos')) return 'retos';
    return 'landing';
  })();

  const retoActivo = retos.find((r) => r.estado === 'activo' && isCurrentMonth(r.mes)) ?? null;
  const retosUltimos12 = retos
    .slice()
    .sort((a, b) => b.mes.localeCompare(a.mes))
    .slice(0, 12)
    .reverse();

  const ctx: MiPlanOutletContext = {
    escenario,
    objetivos,
    fondos,
    retos,
    retoActivo,
    retosUltimos12,
    hitosVitales,
    reload: () => load(),
  };

  const today = new Date();
  const monthLabel = today.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <div className={styles.page}>
      <PageHead
        title="Mi Plan"
        sub={
          <>
            tu brújula hacia la libertad financiera · datos al cierre de{' '}
            <strong>{monthLabel}</strong>
            {/* T27.2-skip · sub "reto activo" oculto · ver featureFlags.SHOW_RETOS. */}
            {SHOW_RETOS && retoActivo ? (
              <>
                {' · '}reto activo <strong>{retoActivo.titulo}</strong>
              </>
            ) : null}
          </>
        }
        actions={[
          {
            label: 'Configurar escenario',
            variant: 'ghost',
            icon: <Icons.Ajustes size={14} strokeWidth={1.8} />,
            onClick: () => showToastV5('Editar escenario · sub-tarea follow-up'),
          },
        ]}
        tabsSlot={
          <div className={styles.tabsBar} role="group" aria-label="Tabs Mi Plan">
            {tabs.map((tab) => {
              const isActive = tab.key === activeKey;
              const Icon = tab.icon;
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
                </button>
              );
            })}
          </div>
        }
      />
      <Outlet context={ctx} />
    </div>
  );
};

export default MiPlanPage;
export { MiPlanPage };
