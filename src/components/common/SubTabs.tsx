import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

interface Tab {
  label: string;
  path: string;
}

interface SubTabsConfig {
  [key: string]: Tab[];
}

const HORIZON_SUBTABS: SubTabsConfig = {
  inmuebles: [
    { label: 'Cartera', path: '/inmuebles/cartera' },
    { label: 'Contratos', path: '/inmuebles/contratos' },
    { label: 'Préstamos', path: '/inmuebles/prestamos' },
    { label: 'Gastos & CAPEX', path: '/inmuebles/gastos-capex' },
    { label: 'Análisis', path: '/inmuebles/analisis' },
  ],
  tesoreria: [
    { label: 'Radar', path: '/tesoreria#radar' },
    { label: 'Cuentas', path: '/tesoreria#cuentas' },
    { label: 'Movimientos', path: '/tesoreria#movimientos' },
    { label: 'Automatizaciones', path: '/tesoreria#automatizaciones' },
  ],
  fiscalidad: [
    { label: 'Resumen', path: '/fiscalidad/resumen' },
    { label: 'Detalle', path: '/fiscalidad/detalle' },
    { label: 'Declaraciones', path: '/fiscalidad/declaraciones' },
  ],
  proyeccion: [
    { label: 'Base', path: '/proyeccion/base' },
    { label: 'Simulaciones', path: '/proyeccion/simulaciones' },
    { label: 'Comparativas', path: '/proyeccion/comparativas' },
  ],
  configuracion: [
    { label: 'Bancos & Cuentas', path: '/configuracion/bancos-cuentas' },
    { label: 'Usuarios & Roles', path: '/configuracion/usuarios-roles' },
    { label: 'Preferencias & Datos', path: '/configuracion/preferencias-datos' },
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

// Define which sections belong to which module
const HORIZON_SECTIONS = ['inmuebles', 'tesoreria', 'fiscalidad', 'proyeccion'];
const PULSE_SECTIONS = ['ingresos', 'gastos', 'tesoreria-personal', 'proyeccion-personal'];

const SubTabs: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentModule, setCurrentModule } = useTheme();
  
  // Extract the section from the current path
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const section = pathSegments[0];
  
  // Auto-update module based on current section
  useEffect(() => {
    if (HORIZON_SECTIONS.includes(section) && currentModule !== 'horizon') {
      setCurrentModule('horizon');
    } else if (PULSE_SECTIONS.includes(section) && currentModule !== 'pulse') {
      setCurrentModule('pulse');
    }
  }, [section, currentModule, setCurrentModule]);
  
  // Get the appropriate subtabs config based on current module and section
  const getSubTabs = (): Tab[] => {
    if (section === 'panel' || section === 'inbox') {
      return []; // No subtabs for panel or inbox
    }
    
    if (currentModule === 'horizon') {
      return HORIZON_SUBTABS[section] || [];
    } else {
      return PULSE_SUBTABS[section] || [];
    }
  };
  
  const tabs = getSubTabs();
  
  // If no tabs, don't render anything
  if (tabs.length === 0) {
    return null;
  }
  
  const accentColorClass = 'text-brand-navy'; // Both modules use navy as primary
  const borderColorClass = 'border-brand-navy'; // Both modules use navy as primary
  
  return (
    <div className="border-b border-gray-200">
      <div className="flex flex-wrap gap-6">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`
                px-1 py-3 text-sm font-medium transition-colors duration-200 relative border-b-2
                ${isActive 
                  ? `${accentColorClass} ${borderColorClass}` 
                  : 'text-neutral-600 hover:text-neutral-900 border-transparent hover:border-gray-300'
                }
              `}
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