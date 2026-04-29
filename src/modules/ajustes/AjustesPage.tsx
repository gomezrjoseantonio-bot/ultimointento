import React from 'react';
import { useLocation, useNavigate, Outlet, Navigate } from 'react-router-dom';
import { Icons } from '../../design-system/v5';
import type { IconComponent } from '../../design-system/v5';
import styles from './AjustesPage.module.css';

interface AjustesNavItem {
  key: string;
  label: string;
  icon: IconComponent;
  path: string;
}

const items: AjustesNavItem[] = [
  { key: 'perfil', label: 'Perfil', icon: Icons.Personal, path: '/ajustes/perfil' },
  { key: 'plan', label: 'Plan & facturación', icon: Icons.Tesoreria, path: '/ajustes/plan' },
  { key: 'integraciones', label: 'Integraciones', icon: Icons.Refresh, path: '/ajustes/integraciones' },
  { key: 'notificaciones', label: 'Notificaciones', icon: Icons.Bell, path: '/ajustes/notificaciones' },
  { key: 'plantillas', label: 'Plantillas', icon: Icons.Contratos, path: '/ajustes/plantillas' },
  { key: 'fiscal', label: 'Perfil fiscal y convivencia', icon: Icons.Fiscal, path: '/ajustes/fiscal' },
  { key: 'seguridad', label: 'Seguridad y datos', icon: Icons.Lock, path: '/ajustes/seguridad' },
];

const AjustesPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Sin sub-ruta · redirigir a /perfil
  if (location.pathname === '/ajustes' || location.pathname === '/ajustes/') {
    return <Navigate to="/ajustes/perfil" replace />;
  }

  const activeKey =
    items.find((i) => location.pathname.startsWith(i.path))?.key ?? 'perfil';

  return (
    <div className={styles.layout}>
      <aside className={styles.aside} aria-label="Sub-navegación de Ajustes">
        <div className={styles.head}>
          <div className={styles.title}>Ajustes</div>
          <div className={styles.sub}>tu cuenta · plan · integraciones</div>
        </div>
        <nav className={styles.nav}>
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activeKey;
            const cls = [styles.navItem, isActive ? styles.active : '']
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={item.key}
                type="button"
                className={cls}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => navigate(item.path)}
              >
                <Icon size={16} strokeWidth={1.7} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <section className={styles.content}>
        <Outlet />
      </section>
    </div>
  );
};

export default AjustesPage;
export { AjustesPage };
