import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface Tab {
  label: string;
  path: string;
}

interface SubTabsConfig {
  [key: string]: Tab[];
}

const SUBTABS: SubTabsConfig = {
  personal: [
    { label: 'Resumen', path: '/personal/resumen' },
    { label: 'Gastos', path: '/personal/gastos' },
    { label: 'Ingresos', path: '/personal/ingresos' },
  ],
  inmuebles: [
    { label: 'Resumen', path: '/inmuebles/resumen' },
    { label: 'Cartera', path: '/inmuebles/cartera' },
    { label: 'Evolución', path: '/inmuebles/evolucion' },
    { label: 'Individual', path: '/inmuebles/individual' },
  ],
  inversiones: [
    { label: 'Resumen', path: '/inversiones/resumen' },
    { label: 'Cartera', path: '/inversiones/cartera' },
    { label: 'Rendimientos', path: '/inversiones/rendimientos' },
    { label: 'Individual', path: '/inversiones/individual' },
  ],
  fiscalidad: [
    { label: 'Mi IRPF', path: '/fiscalidad/mi-irpf' },
    { label: 'Historial', path: '/fiscalidad/historial' },
  ],
  proyeccion: [
    { label: 'Proyección', path: '/proyeccion/presupuesto' },
    { label: 'Presupuesto', path: '/proyeccion/comparativa' },
    { label: 'Real vs Previsión', path: '/proyeccion/mensual' },
  ],
};

interface SubTabsProps {
  tabs?: Tab[];
}

const SubTabs: React.FC<SubTabsProps> = ({ tabs: propTabs }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const section = pathSegments[0];

  const tabs = propTabs || SUBTABS[section] || [];

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div style={{
      borderBottom: '1px solid var(--grey-200)',
      background: 'var(--white)',
      padding: '0 24px',
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path ||
            (location.pathname.startsWith(tab.path) && tab.path !== `/${section}`);

          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              style={{
                padding: '10px 0',
                marginRight: 32,
                fontSize: 'var(--t-base)',
                fontFamily: 'var(--font-base)',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--grey-900)' : 'var(--grey-500)',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--navy-900)' : '2px solid transparent',
                marginBottom: -1,
                cursor: 'pointer',
                transition: 'all 150ms ease',
                minHeight: 44,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SubTabs;
