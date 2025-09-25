import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, UserCircle, ChevronDown, HelpCircle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ setSidebarOpen }) => {
  const navigate = useNavigate();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const { currentModule, setCurrentModule } = useTheme();
  const helpMenuRef = useRef<HTMLDivElement>(null);

  // Close help menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (helpMenuRef.current && !helpMenuRef.current.contains(event.target as Node)) {
        setHelpMenuOpen(false);
      }
    };

    if (helpMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [helpMenuOpen]);

  const handleAccountClick = () => {
    navigate('/cuenta/perfil');
    setAccountMenuOpen(false);
  };

  const handleHelpClick = () => {
    setHelpMenuOpen(!helpMenuOpen);
  };

  const handleDesignBibleClick = () => {
    // Navigate to Design Bible page within the app
    navigate('/design-bible');
    setHelpMenuOpen(false);
  };

  const handleModuleChange = (module: 'horizon' | 'pulse') => {
    setCurrentModule(module);
    navigate('/panel');
  };

  const isHorizonActive = currentModule === 'horizon';
  const isPulseActive = currentModule === 'pulse';

  return (
    <header className="sticky top-0 z-30 bg-white shadow-sm border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            className="md:hidden text-gray-600 hover:text-gray-900 focus:outline-none"
          >
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú lateral"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-full bg-brand-teal flex items-center justify-center text-white font-bold text-sm">
              A
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                ATLAS
              </h1>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Direct Module Navigation */}
          <nav className="flex items-center bg-gray-100 rounded-atlas p-1">
            <button
              className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-atlas transition-all duration-200 ${
                isHorizonActive
                  ? 'bg-brand-navy text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => handleModuleChange('horizon')}
            >
              Horizon
            </button>
            <div className="w-px h-4 bg-gray-300 mx-1" />
            <button
              className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-atlas transition-all duration-200 ${
                isPulseActive
                  ? 'bg-brand-teal text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => handleModuleChange('pulse')}
            >
              Pulse
            </button>
          </nav>
          
          {/* Help Menu */}
          <div className="relative" ref={helpMenuRef}>
            <button 
              onClick={handleHelpClick}
              className="flex items-center space-x-1 focus:outline-none focus:ring-2 focus:ring-atlas-blue focus:ring-offset-2 rounded-atlas p-2 hover:bg-gray-50"
              >
              aria-label="Menú de ayuda"
            >
              <HelpCircle className="h-5 w-5 text-gray-500" />
              <span className="hidden md:inline-block text-sm font-medium text-gray-700">
                Ayuda
              </span>
            </button>
            
            {/* Help Dropdown Menu */}
            {helpMenuOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                <div className="py-1">
                  <button
                    onClick={handleDesignBibleClick}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                  >
                    📘 Guía ATLAS
                    <div className="text-xs text-gray-500 mt-0.5">
                      Design Bible completo
                    </div>
                  </button>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button
                    onClick={() => { 
                      navigate('/documentacion'); 
                      setHelpMenuOpen(false); 
                    }}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                  >
                    📚 Documentación
                  </button>
                  <button
                    onClick={() => { 
                      window.open('mailto:soporte@atlas.com', '_blank'); 
                      setHelpMenuOpen(false); 
                    }}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                  >
                    💬 Contactar Soporte
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="relative">
            <button 
              onClick={handleAccountClick}
              onMouseEnter={() => setAccountMenuOpen(true)}
              onMouseLeave={() => setAccountMenuOpen(false)}
              className="flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:ring-offset-2 rounded-atlas p-1"
              >
              aria-label="Menú de cuenta"
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
          >
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
                  <button
                    onClick={() => { navigate('/cuenta/cuentas'); setAccountMenuOpen(false); }}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                  >
                    Cuentas Bancarias
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