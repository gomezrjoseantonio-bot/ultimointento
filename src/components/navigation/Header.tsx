import React from 'react';
import { Menu, Bell, UserCircle, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import ModuleSelector from '../common/ModuleSelector';
import { useTheme } from '../../contexts/ThemeContext';

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ setSidebarOpen }) => {
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
          
          <Link
            to="/inbox"
            className="p-2 rounded-atlas text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:ring-offset-2"
            title="Inbox"
          >
            <Inbox className="h-5 w-5" aria-hidden="true" />
          </Link>
          
          <button
            type="button"
            className="p-2 rounded-atlas text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:ring-offset-2"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
          </button>
          
          <div className="relative">
            <button className="flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:ring-offset-2 rounded-atlas p-1">
              <UserCircle className="h-8 w-8 text-gray-500" />
              <span className="hidden md:inline-block text-sm font-medium text-gray-700">
                Account
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;