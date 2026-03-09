import React from 'react';
import { Menu } from 'lucide-react';

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ setSidebarOpen }) => {
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

          <div
            className="h-8 w-8 rounded-md flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: 'var(--blue)' }}
          >
            A
          </div>
          <div className="hidden sm:block">
            <h1 className="atlas-h3">ATLAS</h1>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
