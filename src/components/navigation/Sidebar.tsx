import React from 'react';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { getNavigationForModule, NavigationItem } from '../../config/navigation';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const navigation = getNavigationForModule();

  // ATLAS brand consistent colors - both modules use navy primary
  const getThemeClasses = () => {
    return {
      sidebarBg: 'bg-brand-navy', // Both modules use navy background
      logoIcon: 'bg-brand-teal', // Both modules use teal accent for logo
      activeItem: 'bg-blue-600', // Use --atlas-blue for active items
      hoverItem: 'hover:bg-navy-800', // Both modules use darker navy for hover
      separatorText: 'text-gray-400 text-xs font-semibold uppercase tracking-wider',
    };
  };

  const themeClasses = getThemeClasses();

  // Group navigation items by section
  const horizonItems = navigation.filter(item => item.section === 'horizon');
  const pulseItems = navigation.filter(item => item.section === 'pulse');
  const documentationItems = navigation.filter(item => item.section === 'documentation');

  const renderNavItem = (item: NavigationItem) => (
    <NavLink
      key={item.name}
      to={item.href}
      className={({ isActive }) =>
        `${
          isActive
            ? `${themeClasses.activeItem} text-white`
            : `text-gray-300 ${themeClasses.hoverItem} hover:text-white`
        } group flex items-center px-2 py-2 text-base font-medium rounded-atlas transition-colors duration-200`
      }
    >
      <item.icon
        className="mr-3 h-6 w-6 flex-shrink-0"
        aria-hidden="true"
      />
      {item.name}
    </NavLink>
  );

  return (
    <>
      {/* Mobile sidebar */}
      <div
        className={`fixed inset-0 z-40 bg-gray-600 bg-opacity-75 transition-opacity md:hidden ${
          sidebarOpen ? 'ease-out duration-300 opacity-100' : 'ease-in duration-200 opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 ${themeClasses.sidebarBg} transition duration-300 transform md:translate-x-0 md:relative md:flex md:flex-col ${
          sidebarOpen ? 'translate-x-0 ease-out' : '-translate-x-full ease-in'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-5">
          <div className="flex items-center space-x-2">
            <div className={`h-8 w-8 rounded-full ${themeClasses.logoIcon} flex items-center justify-center text-white font-bold text-sm`}>
              A
            </div>
            <h1 className="text-white text-xl font-bold">
              ATLAS
            </h1>
          </div>
          <button
            className="md:hidden text-white hover:text-gray-200 focus:outline-none"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú lateral"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <nav className="px-2 mt-5 flex-1 overflow-y-auto">
          <div className="space-y-1">
            {/* HORIZON — Supervisión */}
            <div className={`px-2 py-2 ${themeClasses.separatorText}`}>
              HORIZON — Supervisión
            </div>
            {horizonItems.map(renderNavItem)}
            
            {/* PULSE — Gestión */}
            <div className={`px-2 py-2 mt-4 ${themeClasses.separatorText}`}>
              PULSE — Gestión
            </div>
            {pulseItems.map(renderNavItem)}
            
            {/* DOCUMENTACIÓN */}
            <div className={`px-2 py-2 mt-4 ${themeClasses.separatorText}`}>
              DOCUMENTACIÓN
            </div>
            {documentationItems.map(renderNavItem)}
          </div>
        </nav>
      </div>
    </>
  );
};

export default Sidebar;