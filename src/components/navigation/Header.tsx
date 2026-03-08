import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, UserCircle, ChevronDown, LogOut, HelpCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import TourManager from '../tours/TourManager';

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ setSidebarOpen }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [showTourManager, setShowTourManager] = useState(false);

  const handleAccountClick = () => {
    navigate('/cuenta/perfil');
    setAccountMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Sprint 4: Tour Manager Modal */}
      {showTourManager && (
        <TourManager onClose={() => setShowTourManager(false)} />
      )}
      
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          borderColor: 'var(--gray-200)',
          backdropFilter: 'blur(8px)',
        }}
      >
      <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between min-h-[72px]">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            className="md:hidden atlas-btn-ghost"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú lateral"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ backgroundColor: 'var(--blue-800)' }}>
              A
            </div>
            <div className="hidden sm:block">
              <h1 className="atlas-h3">
                ATLAS
              </h1>
              <p className="atlas-caption -mt-0.5">Panel financiero</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Sprint 4: Help/Tours button */}
          <button
            onClick={() => setShowTourManager(true)}
            className="atlas-btn-ghost"
            aria-label="Ver tours guiados"
            title="Tours guiados"
          >
            <HelpCircle className="h-5 w-5 text-hz-neutral-700" />
          </button>
          
          {/* User Plan Badge */}
          {user && (
            <div className="hidden lg:flex items-center px-3 py-1 rounded-full text-xs font-medium border" style={{ color: 'var(--blue-800)', backgroundColor: 'var(--blue-050)', borderColor: 'var(--blue-200)' }}>
              Plan {user.subscriptionPlan.toUpperCase()}
            </div>
          )}
          
          <div className="relative">
            <button 
              onClick={handleAccountClick}
              onMouseEnter={() => setAccountMenuOpen(true)}
              onMouseLeave={() => setAccountMenuOpen(false)}
              className="flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-atlas-blue focus:ring-offset-2 rounded-lg p-1.5"
              aria-label="Menú de cuenta"
            >
              <UserCircle className="h-8 w-8 text-hz-neutral-700" />
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium text-atlas-navy-1">
                  {user?.name || 'Usuario'}
                </div>
                <div className="text-xs text-hz-neutral-700">
                  {user?.email}
                </div>
              </div>
              <ChevronDown className="hidden md:inline-block h-4 w-4 text-hz-neutral-700" />
            </button>
            
            {/* Account Dropdown Menu */}
            {accountMenuOpen && (
              <div 
                className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg border border-hz-neutral-300 z-50"
                onMouseEnter={() => setAccountMenuOpen(true)}
                onMouseLeave={() => setAccountMenuOpen(false)}
              >
                <div className="py-1">
                  <div className="px-4 py-2 text-xs text-hz-neutral-700 border-b border-hz-neutral-300">
                    {user?.email}
                  </div>
                  <button
                    onClick={() => { navigate('/cuenta/perfil'); setAccountMenuOpen(false); }}
                    className="block px-4 py-2 text-sm text-atlas-navy-1 hover:bg-hz-neutral-100 w-full text-left"
                  >
                    Perfil
                  </button>
                  <button
                    onClick={() => { navigate('/cuenta/plan'); setAccountMenuOpen(false); }}
                    className="block px-4 py-2 text-sm text-atlas-navy-1 hover:bg-hz-neutral-100 w-full text-left"
                  >
                    Plan & Facturación
                  </button>
                  <button
                    onClick={() => { navigate('/cuenta/cuentas'); setAccountMenuOpen(false); }}
                    className="block px-4 py-2 text-sm text-atlas-navy-1 hover:bg-hz-neutral-100 w-full text-left"
                  >
                    Métodos de pago
                  </button>
                  <div className="border-t border-hz-neutral-300 my-1"></div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center px-4 py-2 text-sm text-error hover:bg-hz-neutral-100 w-full text-left"
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
    </>
  );
};

export default Header;
