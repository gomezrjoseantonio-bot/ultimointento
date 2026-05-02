import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { PageHead, Icons, showToastV5 } from '../../design-system/v5';
import { initDB, type TreasuryEvent } from '../../services/db';
import { nominaService } from '../../services/nominaService';
import { autonomoService } from '../../services/autonomoService';
import { otrosIngresosService } from '../../services/otrosIngresosService';
import { personalDataService } from '../../services/personalDataService';
import type { Nomina, Autonomo, OtrosIngresos } from '../../types/personal';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';
import type { PersonalOutletContext } from './PersonalContext';
import styles from './PersonalPage.module.css';

interface TabItem {
  key: 'panel' | 'ingresos' | 'gastos' | 'vivienda' | 'presupuesto';
  label: string;
  path: string;
  countFn?: (ctx: PersonalOutletContext, eventos: TreasuryEvent[]) => number | undefined;
}

const tabs: TabItem[] = [
  { key: 'panel', label: 'Panel', path: '/personal' },
  {
    key: 'ingresos',
    label: 'Ingresos',
    path: '/personal/ingresos',
    countFn: (ctx) =>
      ctx.nominas.filter((n) => n.activa).length +
      ctx.autonomos.filter((a) => a.activo).length,
  },
  {
    key: 'gastos',
    label: 'Gastos',
    path: '/personal/gastos',
    countFn: (ctx) =>
      ctx.compromisos.filter((c) => c.ambito === 'personal' && c.estado === 'activo').length,
  },
  { key: 'vivienda', label: 'Mi vivienda', path: '/personal/vivienda' },
  { key: 'presupuesto', label: 'Presupuesto', path: '/personal/presupuesto' },
];

const PersonalPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [autonomos, setAutonomos] = useState<Autonomo[]>([]);
  const [otrosIngresos, setOtrosIngresos] = useState<OtrosIngresos[]>([]);
  const [compromisos, setCompromisos] = useState<CompromisoRecurrente[]>([]);

  // T30.1 · stores legacy `nominas`/`autonomos`/`otrosIngresos` se eliminaron
  // en V63 · los datos viven en `ingresos` (unión discriminada por `tipo`).
  // Leemos vía servicios canónicos que filtran por `tipo`.
  const load = useCallback(async () => {
    try {
      const db = await initDB();
      const personalData = await personalDataService.getPersonalData();
      const personalDataId = personalData?.id ?? 1;
      const [n, a, o, c] = await Promise.all([
        nominaService.getNominas(personalDataId),
        autonomoService.getAutonomos(personalDataId),
        otrosIngresosService.getOtrosIngresos(personalDataId),
        db.getAll('compromisosRecurrentes') as Promise<CompromisoRecurrente[]>,
      ]);
      setNominas(n);
      setAutonomos(a);
      setOtrosIngresos(o);
      setCompromisos(c);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[personal] error cargando datos', err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ctx: PersonalOutletContext = {
    nominas,
    autonomos,
    otrosIngresos,
    compromisos,
    reload: () => load(),
  };

  // Redirect /personal/ → /personal
  if (location.pathname === '/personal/') {
    return <Navigate to="/personal" replace />;
  }

  // Determina tab activa
  const activeKey: TabItem['key'] = (() => {
    if (location.pathname === '/personal' || location.pathname === '/personal/') return 'panel';
    if (location.pathname.startsWith('/personal/ingresos')) return 'ingresos';
    if (location.pathname.startsWith('/personal/gastos')) return 'gastos';
    if (location.pathname.startsWith('/personal/vivienda')) return 'vivienda';
    if (location.pathname.startsWith('/personal/presupuesto')) return 'presupuesto';
    return 'panel';
  })();

  return (
    <div className={styles.page}>
      <PageHead
        title="Personal"
        sub="ingresos · gastos · mi vivienda · presupuesto del hogar"
        actions={[
          {
            label: 'Importar nóminas',
            variant: 'ghost',
            icon: <Icons.Upload size={13} strokeWidth={1.8} />,
            onClick: () => navigate('/personal/importar-nominas'),
          },
          {
            label: 'Hogar · soltero · asalariado',
            variant: 'ghost',
            icon: <Icons.Ajustes size={13} strokeWidth={1.8} />,
            onClick: () => showToastV5('Editar perfil del hogar en Ajustes'),
          },
        ]}
        tabsSlot={
          <div className={styles.tabsBar} role="group" aria-label="Tabs Personal">
            {tabs.map((tab) => {
              const isActive = tab.key === activeKey;
              const count = tab.countFn ? tab.countFn(ctx, []) : undefined;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={isActive ? styles.active : ''}
                  aria-pressed={isActive}
                  onClick={() => navigate(tab.path)}
                >
                  {tab.label}
                  {count != null && count > 0 && (
                    <span className={styles.tabCount}>{count}</span>
                  )}
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

export default PersonalPage;
export { PersonalPage };
