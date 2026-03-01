import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { Calculator, Landmark, ReceiptText, Rows3 } from 'lucide-react';

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
    { label: 'Análisis', path: '/inmuebles/analisis' },
  ],
  // Tesorería has NO subtabs - single Radar view per ATLAS guide
  fiscalidad: [
    { label: 'Resumen', path: '/fiscalidad/resumen', icon: Rows3 },
    { label: 'Declaración', path: '/fiscalidad/declaracion', icon: ReceiptText },
    { label: 'Pagos', path: '/fiscalidad/pagos', icon: Landmark },
    { label: 'Simulador', path: '/fiscalidad/simulador', icon: Calculator },
  ],
  proyeccion: [
    { label: 'Presupuesto', path: '/proyeccion/presupuesto' },
    { label: 'Real vs Previsto', path: '/proyeccion/comparativa' },
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
  
  return (
    <div className="border-b border-[color:var(--hz-neutral-300)] bg-[var(--hz-card-bg)]">
      <div className="px-6">
        <div className="flex flex-wrap gap-6">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            const TabIcon = tab.icon;
            
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`
                  px-1 py-3 text-sm font-medium transition-colors duration-200 relative border-b-2 flex items-center gap-1.5
                  ${isActive 
                    ? 'border-hz-primary' 
                    : 'text-[var(--hz-neutral-700)] hover:text-[var(--hz-neutral-900)] border-transparent hover:border-[color:var(--hz-neutral-300)]'
                  }
                `}
                style={isActive ? { color: 'var(--hz-primary)' } : {}}
              >
                {TabIcon && <TabIcon className="h-4 w-4" />}
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
