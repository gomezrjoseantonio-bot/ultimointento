import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
interface Tab {
  label: string;
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SubTabsConfig {
  [key: string]: Tab[];
}

const HORIZON_SUBTABS: SubTabsConfig = {
  inmuebles: [
    { label: 'Cartera', path: '/inmuebles/cartera' },
    { label: 'Evolución', path: '/inmuebles/evolucion' },
    { label: 'Análisis', path: '/inmuebles/analisis' },
  ],
  inversiones: [
    { label: 'Cartera', path: '/inversiones/cartera' },
    { label: 'Rendimientos', path: '/inversiones/rendimientos' },
    { label: 'Análisis', path: '/inversiones/analisis' },
  ],
  fiscalidad: [
    { label: 'Estado', path: '/fiscalidad/estado' },
    { label: 'Declaración', path: '/fiscalidad/declaracion' },
    { label: 'Historial', path: '/fiscalidad/historial' },
  ],
  proyeccion: [
    { label: 'Proyección Automática', path: '/proyeccion/presupuesto' },
    { label: 'Real vs Previsión', path: '/proyeccion/comparativa' },
    { label: 'Escenarios', path: '/proyeccion/escenarios' },
  ],
  configuracion: [
    { label: 'Usuarios y roles', path: '/configuracion/usuarios-roles' },
    { label: 'Preferencias y datos', path: '/configuracion/preferencias-datos' },
    { label: 'Cuentas', path: '/configuracion/cuentas' },
    { label: 'Email entrante', path: '/configuracion/email-entrante' },
  ],
};

const PULSE_SUBTABS: SubTabsConfig = {
  ingresos: [
    { label: 'Lista', path: '/ingresos/lista' },
    { label: 'Nuevo', path: '/ingresos/nuevo' },
    { label: 'Importar', path: '/ingresos/importar' },
  ],
  gastos: [
    { label: 'Lista', path: '/gastos/lista' },
    { label: 'Nuevo', path: '/gastos/nuevo' },
    { label: 'Reglas', path: '/gastos/reglas' },
  ],
  'tesoreria-personal': [
    { label: 'Radar', path: '/tesoreria-personal/radar' },
    { label: 'Movimientos', path: '/tesoreria-personal/movimientos' },
    { label: 'Alertas', path: '/tesoreria-personal/alertas' },
  ],
  'proyeccion-personal': [
    { label: 'Presupuesto', path: '/proyeccion-personal/presupuesto' },
    { label: 'Escenarios', path: '/proyeccion-personal/escenarios' },
  ],
  configuracion: [
    { label: 'Preferencias & Datos', path: '/configuracion/preferencias-datos' },
    { label: 'Email entrante', path: '/configuracion/email-entrante' },
  ],
};

const HORIZON_SECTIONS = ['inmuebles', 'inversiones', 'tesoreria', 'fiscalidad', 'proyeccion'];
const PULSE_SECTIONS = ['ingresos', 'gastos', 'tesoreria-personal', 'proyeccion-personal'];

const SubTabs: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentModule, setCurrentModule } = useTheme();

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const section = pathSegments[0];

  useEffect(() => {
    if (HORIZON_SECTIONS.includes(section) && currentModule !== 'horizon') {
      setCurrentModule('horizon');
    } else if (PULSE_SECTIONS.includes(section) && currentModule !== 'pulse') {
      setCurrentModule('pulse');
    }
  }, [section, currentModule, setCurrentModule]);

  const getSubTabs = (): Tab[] => {
    if (section === 'panel' || section === 'inbox') {
      return [];
    }

    if (currentModule === 'horizon') {
      return HORIZON_SUBTABS[section] || [];
    }

    return PULSE_SUBTABS[section] || [];
  };

  const tabs = getSubTabs();

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="border-b" style={{ borderColor: 'var(--n-200)', background: 'var(--white)' }}>
      <div className="px-6">
        <div className="flex flex-wrap">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;

            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                style={{
                  padding: '10px 16px',
                  fontSize: 'var(--t-sm, 14px)',
                  fontFamily: 'var(--font-base, IBM Plex Sans, sans-serif)',
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? 'var(--n-900)' : 'var(--n-500)',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--blue)' : '2px solid transparent',
                  marginBottom: -1,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: 44,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SubTabs;
