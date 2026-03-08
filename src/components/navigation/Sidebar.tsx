import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { getNavigationForModule, NavigationItem } from '../../config/navigation';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigation = getNavigationForModule();

  const renderNavItem = (item: NavigationItem) => (
    <NavLink
      key={item.name}
      to={item.href}
      className={({ isActive }) =>
        `${isActive ? 'text-white' : 'text-white/75 hover:text-white'} sidebar-nav-item group flex items-center ${collapsed ? 'justify-center' : ''} px-3 py-2 text-sm font-medium rounded-md transition-all duration-150`
      }
      style={({ isActive }) => ({
        backgroundColor: isActive ? 'var(--blue)' : 'transparent',
      })}
      title={collapsed ? item.name : undefined}
    >
      <item.icon className={`${collapsed ? '' : 'mr-3'} h-5 w-5 flex-shrink-0`} aria-hidden="true" />
      {!collapsed && item.name}
    </NavLink>
  );

  const mainItems = navigation.filter(item => item.section === 'horizon');
  const managementItems = navigation.filter(item => item.section === 'pulse');
  const docsItems = navigation.filter(item => item.section === 'documentation');

  const SectionLabel = ({ label }: { label: string }) => collapsed ? null : (
    <p className="px-2 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-white/40">
      {label}
    </p>
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <div
        className={`fixed inset-y-0 left-0 z-[100] transition duration-300 transform md:translate-x-0 md:relative md:flex md:flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-16' : 'w-64'}`}
        style={{ backgroundColor: 'var(--n-900)' }}
      >
        <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {!collapsed && (
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-md flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: 'var(--blue)' }}>
                A
              </div>
              <h1 className="text-white text-xl font-bold tracking-tight">ATLAS</h1>
            </div>
          )}
          {collapsed && (
            <div className="h-8 w-8 rounded-md flex items-center justify-center text-white font-bold text-sm mx-auto" style={{ backgroundColor: 'var(--blue)' }} title="ATLAS">
              A
            </div>
          )}

          <button
            className="hidden md:block text-white/40 hover:text-white/80 transition-colors focus:outline-none"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {collapsed
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              }
            </svg>
          </button>

          <button
            className="md:hidden text-white/60 hover:text-white"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="px-2 mt-3 flex-1 overflow-y-auto space-y-0.5">
          <SectionLabel label="Supervisión" />
          {mainItems.map(renderNavItem)}

          <SectionLabel label="Gestión" />
          {managementItems.map(renderNavItem)}

          <SectionLabel label="Docs" />
          {docsItems.map(renderNavItem)}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
