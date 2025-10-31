import React, { ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { X, Sunrise, Activity, BookOpen, Info } from 'lucide-react';
import { getNavigationForModule, NavigationItem } from '../../config/navigation';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

interface SeparatorOverlineProps {
  icon: ReactNode;
  label: string;
  colorToken: string;
  collapsed?: boolean;
  tooltip?: string;
  className?: string;
  description?: string;
}

interface SectionDocsProps {
  children: ReactNode;
}

// SeparatorOverline component - decorative section separator with icon + pill
const SeparatorOverline: React.FC<SeparatorOverlineProps> = ({ 
  icon, 
  label, 
  colorToken, 
  collapsed = false, 
  tooltip, 
  className = '',
  description
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div
      role="separator"
      aria-label={`${label} section`}
      className={`select-none px-3 ${className}`}
    >
      {collapsed ? (
        <div 
          className="flex items-center justify-center py-2" 
          title={tooltip ?? label}
        >
          {icon}
        </div>
      ) : (
        <div className="mt-2 mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
          {icon}
          <span
            className="inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide transition-all duration-200"
            style={{
              color: `var(${colorToken})`,
              backgroundColor:
                colorToken === "--atlas-teal"
                  ? "color-mix(in srgb, var(--atlas-teal) 10%, transparent)"
                  : colorToken === "--text-gray"
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(255,255,255,0.05)",
              border: "1px solid",
              borderColor:
                colorToken === "--atlas-teal"
                  ? "color-mix(in srgb, var(--atlas-teal) 25%, transparent)"
                  : "rgba(255,255,255,0.10)"
            }}
          >
            {label}
          </span>
          {description && (
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={() => setShowTooltip(!showTooltip)}
                className="text-gray-400 hover:text-gray-300 transition-colors"
                aria-label={`Ver información sobre ${label}`}
                type="button"
              >
                <Info size={14} />
              </button>
              {showTooltip && (
                <div 
                  className="absolute left-0 top-6 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 z-50 whitespace-normal max-w-xs shadow-lg border border-gray-700"
                  role="tooltip"
                >
                  <div className="font-semibold mb-1">{label}</div>
                  <div className="text-gray-300">{description}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// SectionDocs wrapper - encapsulates documentation block for easy removal
const SectionDocs: React.FC<SectionDocsProps> = ({ children }) => {
  return <>{children}</>;
};

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  // State for collapsed sidebar (desktop only)
  const [collapsed, setCollapsed] = useState(false);
  
  const navigation = getNavigationForModule();

  // ATLAS brand consistent colors - exact specification
  const getThemeClasses = () => {
    return {
      sidebarBg: 'atlas-navy-2', // Use ATLAS navy-2 for sidebar background
      logoIcon: 'atlas-teal', // Use ATLAS teal for logo accent
      activeItem: 'atlas-blue', // Use ATLAS blue for active items
      hoverItem: 'hover:opacity-80', // Simple opacity hover for better UX
      separatorText: 'text-gray-300 text-xs font-semibold uppercase tracking-wider',
    };
  };

  const themeClasses = getThemeClasses();

  // Group navigation items by section
  const horizonItems = navigation.filter(item => item.section === 'horizon');
  const pulseItems = navigation.filter(item => item.section === 'pulse');
  const documentationItems = navigation.filter(item => item.section === 'documentation');

  const renderNavItem = (item: NavigationItem) => (
    <NavLink
      key={item.name}
      to={item.href}
      className={({ isActive }) =>
        `${
          isActive
            ? 'text-white'
            : `text-gray-300 ${themeClasses.hoverItem} hover:text-white`
        } group flex items-center ${collapsed ? 'justify-center' : ''} px-2 py-2 text-base font-medium rounded-lg transition-colors duration-200`
      }
      style={({ isActive }) => ({
        backgroundColor: isActive ? 'var(--atlas-blue)' : 'transparent',
      })}
      title={collapsed ? item.name : undefined}
    >
      <item.icon
        className={`${collapsed ? '' : 'mr-3'} h-6 w-6 flex-shrink-0`}
        aria-hidden="true"
      />
      {!collapsed && item.name}
    </NavLink>
  );

  return (
    <>
      {/* Mobile sidebar - Light overlay only per ATLAS */}
      <div
        className={`fixed inset-0 z-40 bg-white transition-opacity md:hidden ${
          sidebarOpen ? 'ease-out duration-300 opacity-100' : 'ease-in duration-200 opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <div
        className={`fixed inset-y-0 left-0 z-40 transition duration-300 transform md:translate-x-0 md:relative md:flex md:flex-col ${
          sidebarOpen ? 'translate-x-0 ease-out' : '-translate-x-full ease-in'
        } ${collapsed ? 'w-16' : 'w-64'}`}
        style={{ backgroundColor: 'var(--atlas-navy-2)' }}
      >
        <div className="flex items-center justify-between px-4 py-5">
          {!collapsed && (
            <div className="flex items-center space-x-2">
              <div 
                className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: 'var(--atlas-teal)' }}
              >
                A
              </div>
              <h1 className="text-white text-xl font-bold">
                ATLAS
              </h1>
            </div>
          )}
          {collapsed && (
            <div 
              className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm mx-auto"
              style={{ backgroundColor: 'var(--atlas-teal)' }}
              title="ATLAS"
            >
              A
            </div>
          )}
          {/* Toggle button for collapsed mode (desktop only) */}
          <button
            className="hidden md:block text-white hover:text-gray-200 focus:outline-none"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
            title={collapsed ? "Expandir" : "Colapsar"}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              )}
            </svg>
          </button>
          <button
            className="md:hidden text-white hover:text-gray-200 focus:outline-none"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú lateral"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <nav className="px-2 mt-5 flex-1 overflow-y-auto">
          <div className="space-y-1">
            {/* HORIZON — Supervisión */}
            <SeparatorOverline
              icon={<Sunrise className="w-4 h-4 text-[--atlas-blue]" strokeWidth={1.5} aria-hidden />}
              label="Horizon"
              colorToken="--atlas-blue"
              collapsed={collapsed}
              tooltip="Horizon — Supervisión"
              description="Módulo de supervisión financiera. Vista ejecutiva para inversores y gestores de alto nivel con KPIs y métricas clave."
            />
            {horizonItems.map(renderNavItem)}
            
            {/* PULSE — Gestión */}
            <SeparatorOverline
              icon={<Activity className="w-4 h-4 text-[--atlas-teal]" strokeWidth={1.5} aria-hidden />}
              label="Pulse"
              colorToken="--atlas-teal"
              collapsed={collapsed}
              tooltip="Pulse — Gestión"
              description="Módulo de gestión operativa diaria. Herramientas para tareas administrativas, documentación y flujos de trabajo."
              className="mt-3"
            />
            {pulseItems.map(renderNavItem)}
            
            {/* DOCUMENTACIÓN */}
            <SectionDocs>
              <SeparatorOverline
                icon={<BookOpen className="w-4 h-4 text-[--text-gray]" strokeWidth={1.5} aria-hidden />}
                label="Docs"
                colorToken="--text-gray"
                collapsed={collapsed}
                tooltip="Documentación"
                className="mt-3"
              />
              {documentationItems.map(renderNavItem)}
            </SectionDocs>
          </div>
        </nav>
      </div>
    </>
  );
};

export default Sidebar;