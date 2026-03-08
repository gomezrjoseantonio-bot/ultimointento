import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, UserCircle, ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ setSidebarOpen }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const handleAccountClick = () => {
    navigate('/cuenta/perfil');
    setAccountMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header
        className="sticky top-0 z-30 border-b"
        style={{
          backgroundColor: 'var(--white)',
          borderColor: 'var(--n-300)',
          minHeight: 'var(--topbar-height)',
        }}
      >
        <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              className="md:hidden atlas-btn-ghost atlas-btn-sm"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú lateral"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="h-8 w-8 rounded-md flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: 'var(--blue)' }}>
              A
            </div>
            <div className="hidden sm:block">
              <h1 className="atlas-h3">ATLAS</h1>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {user && (
              <div
                className="hidden lg:flex items-center px-3 py-1 rounded-md text-xs font-semibold"
                style={{ color: 'var(--n-700)', backgroundColor: 'var(--n-100)' }}
              >
                Plan {user.subscriptionPlan.toUpperCase()}
              </div>
            )}

            <div className="relative">
              <button
                onClick={handleAccountClick}
                onMouseEnter={() => setAccountMenuOpen(true)}
                onMouseLeave={() => setAccountMenuOpen(false)}
                className="flex items-center space-x-2 rounded-md p-1.5"
                aria-label="Menú de cuenta"
              >
                <UserCircle className="h-8 w-8" style={{ color: 'var(--n-700)' }} />
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium" style={{ color: 'var(--n-700)' }}>
                    {user?.name || 'Usuario'}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--n-500)' }}>
                    {user?.email}
                  </div>
                </div>
                <ChevronDown className="hidden md:inline-block h-4 w-4" style={{ color: 'var(--n-500)' }} />
              </button>

              {accountMenuOpen && (
                <div
                  className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border z-50"
                  style={{ borderColor: 'var(--n-300)' }}
                  onMouseEnter={() => setAccountMenuOpen(true)}
                  onMouseLeave={() => setAccountMenuOpen(false)}
                >
                  <div className="py-1">
                    <div className="px-4 py-2 text-xs border-b" style={{ color: 'var(--n-500)', borderColor: 'var(--n-300)' }}>
                      {user?.email}
                    </div>
                    <button
                      onClick={() => { navigate('/cuenta/perfil'); setAccountMenuOpen(false); }}
                      className="block px-4 py-2 text-sm w-full text-left"
                      style={{ color: 'var(--n-700)' }}
                    >
                      Perfil
                    </button>
                    <button
                      onClick={() => { navigate('/cuenta/plan'); setAccountMenuOpen(false); }}
                      className="block px-4 py-2 text-sm w-full text-left"
                      style={{ color: 'var(--n-700)' }}
                    >
                      Plan & Facturación
                    </button>
                    <button
                      onClick={() => { navigate('/cuenta/cuentas'); setAccountMenuOpen(false); }}
                      className="block px-4 py-2 text-sm w-full text-left"
                      style={{ color: 'var(--n-700)' }}
                    >
                      Métodos de pago
                    </button>
                    <div className="border-t my-1" style={{ borderColor: 'var(--n-300)' }}></div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center px-4 py-2 text-sm w-full text-left"
                      style={{ color: 'var(--s-negative)' }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
  );
};

export default Header;
