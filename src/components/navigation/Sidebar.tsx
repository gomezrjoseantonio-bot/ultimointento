import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { getNavigationForModule, NavigationItem } from '../../config/navigation';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();
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

  const initials = user?.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((namePart) => namePart[0]?.toUpperCase() ?? '')
        .join('')
    : 'US';

  return (
    <>
      <button
        type="button"
        className={`fixed inset-0 z-40 bg-[color:var(--n-300)]/60 transition-opacity md:hidden ${
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Cerrar menú lateral"
      />

      <div
        className={`fixed inset-y-0 left-0 z-[100] transition duration-300 transform md:translate-x-0 md:relative md:flex md:flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-16' : 'w-64'}`}
        style={{ backgroundColor: 'var(--n-900)' }}
      >
        <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: '1px solid color-mix(in srgb, var(--white) 8%, transparent)' }}>
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
            className="hidden md:block text-white/40 transition-colors duration-150 ease-in-out hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--blue)] focus-visible:outline-offset-2"
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
            className="md:hidden text-white/60 transition-colors duration-150 ease-in-out hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--blue)] focus-visible:outline-offset-2"
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

        {user && (
          <div className="p-3" style={{ borderTop: '1px solid color-mix(in srgb, var(--white) 8%, transparent)' }}>
            <div
              className={`rounded-xl px-3 py-2.5 flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}
              style={{ backgroundColor: 'color-mix(in srgb, var(--white) 6%, transparent)' }}
              title={collapsed ? `${user.name} • ${user.subscriptionPlan}` : undefined}
            >
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: 'var(--blue)' }}
              >
                {initials}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white leading-tight truncate">{user.name}</p>
                  <p className="text-xs text-white/70 capitalize leading-tight">{user.subscriptionPlan}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
