import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, UserCircle, ChevronDown, Inbox } from 'lucide-react';
import ModuleSelector from '../common/ModuleSelector';

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ setSidebarOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const handleAccountClick = () => {
    navigate('/cuenta/perfil');
    setAccountMenuOpen(false);
  };

  const isInboxActive = location.pathname === '/inbox';

  return (
    <header className="sticky top-0 z-30 bg-white shadow-sm border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            className="md:hidden text-gray-600 hover:text-gray-900 focus:outline-none"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-full bg-brand-teal flex items-center justify-center text-white font-bold text-sm">
              A
            </div>
            <div className="hidden md:block">
              <h1 className="text-xl font-semibold text-gray-900">
                ATLAS
              </h1>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <ModuleSelector />
          
          {/* Global Inbox Icon */}
          <button
            onClick={() => navigate('/inbox')}
            className={`p-2 rounded-atlas transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 ${
              isInboxActive 
                ? 'bg-gray-100 text-gray-700' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
            title="Bandeja de Documentos"
            aria-label="Bandeja de Documentos"
          >
            <Inbox className="h-5 w-5" />
          </button>
          
          <div className="relative">
            <button 
              onClick={handleAccountClick}
              onMouseEnter={() => setAccountMenuOpen(true)}
              onMouseLeave={() => setAccountMenuOpen(false)}
              className="flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:ring-offset-2 rounded-atlas p-1"
            >
              <UserCircle className="h-8 w-8 text-gray-500" />
              <span className="hidden md:inline-block text-sm font-medium text-gray-700">
                Cuenta
              </span>
              <ChevronDown className="hidden md:inline-block h-4 w-4 text-gray-500" />
            </button>
            
            {/* Account Dropdown Menu */}
            {accountMenuOpen && (
              <div 
                className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50"
                onMouseEnter={() => setAccountMenuOpen(true)}
                onMouseLeave={() => setAccountMenuOpen(false)}
              >
                <div className="py-1">
                  <button
                    onClick={() => { navigate('/cuenta/perfil'); setAccountMenuOpen(false); }}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                  >
                    Perfil
                  </button>
                  <button
                    onClick={() => { navigate('/cuenta/seguridad'); setAccountMenuOpen(false); }}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                  >
                    Seguridad
                  </button>
                  <button
                    onClick={() => { navigate('/cuenta/plan'); setAccountMenuOpen(false); }}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                  >
                    Plan & Facturación
                  </button>
                  <button
                    onClick={() => { navigate('/cuenta/privacidad'); setAccountMenuOpen(false); }}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                  >
                    Privacidad & Datos
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