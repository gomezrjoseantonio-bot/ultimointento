import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { X, ChevronUp, LogOut } from 'lucide-react';
import { Icons } from '../../design-system/v5/icons';
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
        `group flex items-center ${collapsed ? 'justify-center' : ''} transition-all duration-150`
      }
      style={({ isActive }) => ({
        padding: isActive ? '9px 12px 9px 10px' : '9px 12px',
        borderRadius: '7px',
        gap: '11px',
        color: isActive ? 'var(--atlas-v5-white)' : 'var(--atlas-v5-ink-5)',
        fontSize: '13.5px',
        fontWeight: 500,
        backgroundColor: isActive ? 'rgba(255,255,255,.07)' : 'transparent',
        boxShadow: isActive ? 'inset 2px 0 0 var(--atlas-v5-gold)' : 'none',
        display: 'flex',
        alignItems: 'center',
      })}
      title={collapsed ? item.name : undefined}
    >
      {({ isActive }) => (
        <>
          <item.icon
            size={16}
            strokeWidth={1.7}
            aria-hidden="true"
            style={{
              flexShrink: 0,
              opacity: isActive ? 1 : 0.85,
              color: isActive ? 'var(--atlas-v5-gold)' : 'inherit',
            }}
          />
          {!collapsed && item.name}
        </>
      )}
    </NavLink>
  );

  const panelItems = navigation.filter(item => item.section === 'panel');
  const misActivosItems = navigation.filter(item => item.section === 'mis-activos');
  const operativaItems = navigation.filter(item => item.section === 'operativa');
  const ajustesItems = navigation.filter(item => item.section === 'ajustes');

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

  /* ── Estilos constantes de la barra § Z.4 ── */
  const sideStyle: React.CSSProperties = {
    backgroundColor: 'var(--atlas-v5-brand-ink)',
    width: collapsed ? 64 : 240,
    height: '100vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    padding: '22px 0',
    position: 'sticky',
    top: 0,
    flexShrink: 0,
  };

  const navStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    padding: '0 12px',
  };

  const navSectionStyle: React.CSSProperties = collapsed
    ? { display: 'none' }
    : {
        padding: '20px 22px 6px',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '.2em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,.38)',
      };

  const navSepStyle: React.CSSProperties = {
    margin: '14px 22px 4px',
    borderTop: '1px solid rgba(255,255,255,.06)',
  };

  return (
    <>
      {/* Mobile overlay */}
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
        className={`fixed inset-y-0 left-0 z-[100] transition duration-300 transform md:translate-x-0 md:relative ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={sideStyle}
      >
        {/* Brand header */}
        <div
          style={{
            padding: '4px 22px 20px',
            borderBottom: '1px solid rgba(255,255,255,.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, var(--atlas-v5-gold-light), var(--atlas-v5-gold))',
                  color: 'var(--atlas-v5-brand-ink)',
                  fontWeight: 700,
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                A
              </div>
              <div>
                <div
                  style={{
                    color: 'var(--atlas-v5-white)',
                    fontWeight: 700,
                    fontSize: 17,
                    lineHeight: 1,
                    letterSpacing: '-0.015em',
                  }}
                >
                  ATLAS
                </div>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: '.18em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,.42)',
                    marginTop: 3,
                  }}
                >
                  patrimonio
                </div>
              </div>
            </div>
          )}
          {collapsed && (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, var(--atlas-v5-gold-light), var(--atlas-v5-gold))',
                color: 'var(--atlas-v5-brand-ink)',
                fontWeight: 700,
                fontSize: 15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
              title="ATLAS"
            >
              A
            </div>
          )}

          {/* Desktop collapse button */}
          <button
            className="hidden md:flex"
            style={{
              color: 'rgba(255,255,255,.4)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              alignItems: 'center',
            }}
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed
              ? <Icons.ChevronsRight size={16} />
              : <Icons.ChevronsLeft size={16} />
            }
          </button>

          {/* Mobile close button */}
          <button
            className="md:hidden"
            style={{ color: 'rgba(255,255,255,.6)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', marginTop: 12 }}>
          {/* Panel · sin grupo */}
          <div style={navStyle}>
            {panelItems.map(renderNavItem)}
          </div>

          {/* MIS ACTIVOS */}
          <p className="nav-section" style={navSectionStyle}>Mis activos</p>
          <div style={navStyle}>
            {misActivosItems.map(renderNavItem)}
          </div>

          {/* OPERATIVA */}
          <p className="nav-section" style={navSectionStyle}>Operativa</p>
          <div style={navStyle}>
            {operativaItems.map(renderNavItem)}
          </div>

          {/* Separador · .nav-sep */}
          <div className="nav-sep" style={navSepStyle} role="separator" aria-hidden="true" />
          <div style={navStyle}>
            {ajustesItems.map(renderNavItem)}
          </div>
        </nav>

        {/* Footer usuario */}
        {user && (
          <div
            className="side-foot"
            style={{
              marginTop: 'auto',
              padding: '14px 22px 4px',
              borderTop: '1px solid rgba(255,255,255,.06)',
              position: 'relative',
            }}
          >
            {accountMenuOpen && !collapsed && (
              <div
                className="absolute bottom-[84px] left-3 right-3 bg-white rounded-lg shadow-lg border z-50 overflow-hidden"
                style={{ borderColor: 'var(--atlas-v5-line)' }}
              >
                <div
                  className="px-4 py-2 text-xs border-b"
                  style={{ color: 'var(--atlas-v5-ink-4)', borderColor: 'var(--atlas-v5-line-2)' }}
                >
                  {user.email}
                </div>
                <button
                  onClick={() => { navigate('/ajustes/perfil'); setAccountMenuOpen(false); }}
                  className="block px-4 py-2 text-sm w-full text-left"
                  style={{ color: 'var(--atlas-v5-ink-2)' }}
                >
                  Perfil
                </button>
                <button
                  onClick={() => { navigate('/ajustes/plan'); setAccountMenuOpen(false); }}
                  className="block px-4 py-2 text-sm w-full text-left"
                  style={{ color: 'var(--atlas-v5-ink-2)' }}
                >
                  Plan & Facturación
                </button>
                <div style={{ borderTop: '1px solid var(--atlas-v5-line-2)', margin: '4px 0' }} />
                <button
                  onClick={handleLogout}
                  className="flex items-center px-4 py-2 text-sm w-full text-left"
                  style={{ color: 'var(--atlas-v5-ink-2)' }}
                >
                  <LogOut size={16} className="mr-2" />
                  Cerrar sesión
                </button>
              </div>
            )}

            <button
              onClick={() => {
                if (collapsed) {
                  navigate('/ajustes/perfil');
                  return;
                }
                setAccountMenuOpen((prev) => !prev);
              }}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: collapsed ? 0 : 10,
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
              title={collapsed ? `${user.name} · ${user.subscriptionPlan}` : undefined}
              aria-label="Menú de cuenta"
            >
              <div
                className="avatar"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--atlas-v5-gold-light), var(--atlas-v5-gold))',
                  color: 'var(--atlas-v5-brand-ink)',
                  fontWeight: 700,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              {!collapsed && (
                <>
                  <div style={{ minWidth: 0, textAlign: 'left', flex: 1 }}>
                    <p
                      className="side-foot-name"
                      style={{ fontSize: 13, color: 'var(--atlas-v5-white)', fontWeight: 600, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {user.name}
                    </p>
                    <p
                      className="side-foot-sub"
                      style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 1 }}
                    >
                      {user.subscriptionPlan}
                    </p>
                  </div>
                  <ChevronUp
                    size={14}
                    className={`transition-transform ${accountMenuOpen ? '' : 'rotate-180'}`}
                    style={{ color: 'rgba(255,255,255,.5)', flexShrink: 0 }}
                  />
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
