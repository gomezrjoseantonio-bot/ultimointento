import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { X, ChevronUp, LogOut } from 'lucide-react';
import { getNavigationForModule, NavigationItem } from '../../config/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { preloadRouteResources } from '../../services/navigationPerformanceService';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const preloadTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const navigation = getNavigationForModule();

  const cancelScheduledPreload = () => {
    if (preloadTimeoutRef.current !== null) {
      window.clearTimeout(preloadTimeoutRef.current);
      preloadTimeoutRef.current = null;
    }
  };

  const scheduleChunkPreload = (href: string) => {
    cancelScheduledPreload();
    preloadTimeoutRef.current = window.setTimeout(() => {
      void preloadRouteResources(href);
      preloadTimeoutRef.current = null;
    }, 120);
  };

  useEffect(() => cancelScheduledPreload, []);

  const renderNavItem = (item: NavigationItem) => (
    <NavLink
      key={item.name}
      to={item.href}
      onMouseEnter={() => { scheduleChunkPreload(item.href); }}
      onFocus={() => { scheduleChunkPreload(item.href); }}
      onMouseLeave={cancelScheduledPreload}
      onBlur={cancelScheduledPreload}
      className={({ isActive }) =>
        `sidebar-nav-item group flex items-center ${collapsed ? 'justify-center' : ''} px-3 py-2 text-sm rounded-lg transition-all duration-150`
      }
      style={({ isActive }) => ({
        backgroundColor: isActive ? 'var(--navy-900)' : 'transparent',
        color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.65)',
        fontWeight: isActive ? 500 : 400,
        margin: '1px 8px',
      })}
      title={collapsed ? item.name : undefined}
    >
      <item.icon className={`${collapsed ? '' : 'mr-3'} flex-shrink-0`} size={20} aria-hidden="true" style={{ opacity: 'inherit' }} />
      {!collapsed && item.name}
    </NavLink>
  );

  const mainItems = navigation.filter(item => item.section === 'horizon');
  const managementItems = navigation.filter(item => item.section === 'pulse');
  const docsItems = navigation.filter(item => item.section === 'documentation');

  const SectionLabel = ({ label }: { label: string }) => collapsed ? null : (
    <p style={{
      padding: '20px 16px 8px',
      fontSize: 'var(--t-xs)',
      fontWeight: 600,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.35)',
    }}>
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

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    setAccountMenuOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className={`fixed inset-0 z-40 transition-opacity md:hidden ${
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(2px)' }}
        onClick={() => setSidebarOpen(false)}
        aria-label="Cerrar menú lateral"
      />

      <div
        className={`fixed inset-y-0 left-0 z-[100] transition duration-300 transform md:translate-x-0 md:relative md:flex md:flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-16' : 'w-60'}`}
        style={{ backgroundColor: 'var(--navy-700)', width: collapsed ? 64 : 240 }}
      >
        <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {!collapsed && (
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-md flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: 'var(--navy-900)' }}>
                A
              </div>
              <h1 className="text-white text-xl font-bold tracking-tight">ATLAS</h1>
            </div>
          )}
          {collapsed && (
            <div className="h-8 w-8 rounded-md flex items-center justify-center text-white font-bold text-sm mx-auto" style={{ backgroundColor: 'var(--navy-900)' }} title="ATLAS">
              A
            </div>
          )}

          <button
            className="hidden md:block transition-colors duration-150 ease-in-out"
            style={{ color: 'rgba(255,255,255,0.4)' }}
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
            className="md:hidden"
            style={{ color: 'rgba(255,255,255,0.6)' }}
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="px-0 mt-3 flex-1 overflow-y-auto">
          <SectionLabel label="Supervisión" />
          {mainItems.map(renderNavItem)}

          <SectionLabel label="Gestión" />
          {managementItems.map(renderNavItem)}

          <SectionLabel label="Docs" />
          {docsItems.map(renderNavItem)}
        </nav>

        {user && (
          <div className="p-3 relative" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {accountMenuOpen && !collapsed && (
              <div
                className="absolute bottom-[84px] left-3 right-3 bg-white rounded-lg shadow-lg border z-50 overflow-hidden"
                style={{ borderColor: 'var(--grey-300)' }}
              >
                <div className="px-4 py-2 text-xs border-b" style={{ color: 'var(--grey-500)', borderColor: 'var(--grey-200)' }}>
                  {user.email}
                </div>
                <button
                  onClick={() => { navigate('/cuenta/perfil'); setAccountMenuOpen(false); }}
                  className="block px-4 py-2 text-sm w-full text-left"
                  style={{ color: 'var(--grey-700)' }}
                >
                  Perfil
                </button>
                <button
                  onClick={() => { navigate('/cuenta/plan'); setAccountMenuOpen(false); }}
                  className="block px-4 py-2 text-sm w-full text-left"
                  style={{ color: 'var(--grey-700)' }}
                >
                  Plan & Facturación
                </button>
                <button
                  onClick={() => { navigate('/cuenta/cuentas'); setAccountMenuOpen(false); }}
                  className="block px-4 py-2 text-sm w-full text-left"
                  style={{ color: 'var(--grey-700)' }}
                >
                  Métodos de pago
                </button>
                <div style={{ borderTop: '1px solid var(--grey-200)', margin: '4px 0' }} />
                <button
                  onClick={handleLogout}
                  className="flex items-center px-4 py-2 text-sm w-full text-left"
                  style={{ color: 'var(--grey-700)' }}
                >
                  <LogOut size={16} className="mr-2" />
                  Cerrar sesión
                </button>
              </div>
            )}

            <button
              onClick={() => {
                if (collapsed) {
                  navigate('/cuenta/perfil');
                  return;
                }
                setAccountMenuOpen((prev) => !prev);
              }}
              className={`w-full rounded-xl px-3 py-2.5 flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}
              style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
              title={collapsed ? `${user.name} • ${user.subscriptionPlan}` : undefined}
              aria-label="Menú de cuenta"
            >
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: 'var(--navy-900)' }}
              >
                {initials}
              </div>
              {!collapsed && (
                <>
                  <div className="min-w-0 text-left flex-1">
                    <p className="text-sm font-semibold text-white leading-tight truncate">{user.name}</p>
                    <p className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.7)' }}>{user.subscriptionPlan}</p>
                  </div>
                  <ChevronUp className={`h-4 w-4 transition-transform ${accountMenuOpen ? '' : 'rotate-180'}`} style={{ color: 'rgba(255,255,255,0.7)' }} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
