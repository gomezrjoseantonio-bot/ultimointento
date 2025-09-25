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

  // ATLAS brand consistent colors - exact specification
  const getThemeClasses = () => {
    return {
      sidebarBg: 'atlas-navy-2', // Use ATLAS navy-2 for sidebar background
      logoIcon: 'atlas-teal', // Use ATLAS teal for logo accent
      activeItem: 'atlas-blue', // Use ATLAS blue for active items
      hoverItem: 'hover:opacity-80', // Simple opacity hover for better UX
      separatorText: 'text-gray-300 text-xs font-semibold uppercase tracking-wider',
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
            ? 'text-white'
            : `text-gray-300 ${themeClasses.hoverItem} hover:text-white`
        } group flex items-center px-2 py-2 text-base font-medium rounded-lg transition-colors duration-200`
      }
      style={({ isActive }) => ({
        backgroundColor: isActive ? 'var(--atlas-blue)' : 'transparent',
      })}
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
      {/* Mobile sidebar - Light overlay only per ATLAS */}
      <div
        className={`fixed inset-0 z-40 bg-white transition-opacity md:hidden ${
          sidebarOpen ? 'ease-out duration-300 opacity-100' : 'ease-in duration-200 opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 transition duration-300 transform md:translate-x-0 md:relative md:flex md:flex-col ${
          sidebarOpen ? 'translate-x-0 ease-out' : '-translate-x-full ease-in'
        }`}
        style={{ backgroundColor: 'var(--atlas-navy-2)' }}
      >
        <div className="flex items-center justify-between px-4 py-5">
          <div className="flex items-center space-x-2">
            <div 
              className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
              >
              style={{ backgroundColor: 'var(--atlas-teal)' }}
            >
              A
            </div>
            <h1 className="text-white text-xl font-bold">
              ATLAS
            </h1>
          </div>
          <button
            className="md:hidden text-white hover:text-gray-200 focus:outline-none"
          >
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