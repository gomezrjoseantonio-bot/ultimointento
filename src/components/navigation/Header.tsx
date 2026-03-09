import React from 'react';
import { MenuIcon, BellIcon, UserCircleIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ setSidebarOpen }) => {
  return (
    <header className="sticky top-0 z-30 bg-white shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <button
          type="button"
          className="md:hidden text-gray-600 hover:text-gray-900 focus:outline-none"
          onClick={() => setSidebarOpen(true)}
        >
          <MenuIcon className="h-6 w-6" aria-hidden="true" />
        </button>
        
        <div className="flex-1 flex justify-center md:justify-start">
          <div className="md:hidden text-xl font-semibold text-navy-600">Atlas Horizon</div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            type="button"
            className="p-1 rounded-full text-gray-500 hover:bg-gray-100"
          >
            <BellIcon className="h-6 w-6" aria-hidden="true" />
          </button>
          
          <div className="relative">
            <button className="flex items-center space-x-2 focus:outline-none">
              <UserCircleIcon className="h-8 w-8 text-gray-500" />
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