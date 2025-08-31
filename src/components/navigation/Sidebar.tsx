import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  HomeIcon, InboxIcon, BuildingOfficeIcon, ReceiptPercentIcon, 
  DocumentTextIcon, BanknotesIcon, CalculatorIcon, ChartBarIcon,
  UserCircleIcon, Cog6ToothIcon, XMarkIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const navigation = [
    { name: 'Dashboard', href: '/', icon: HomeIcon },
    { name: 'Inbox', href: '/inbox', icon: InboxIcon },
    { name: 'Real Estate', href: '/real-estate', icon: BuildingOfficeIcon },
    { name: 'Expenses & CAPEX', href: '/expenses', icon: ReceiptPercentIcon },
    { name: 'Contracts', href: '/contracts', icon: DocumentTextIcon },
    { name: 'Treasury', href: '/treasury', icon: BanknotesIcon },
    { name: 'Tax Management', href: '/tax', icon: CalculatorIcon },
    { name: 'Projections', href: '/projections', icon: ChartBarIcon },
    { name: 'Pulse Centers', href: '/pulse', icon: UserCircleIcon },
    { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
  ];

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
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-navy-700 transition duration-300 transform md:translate-x-0 md:relative md:flex md:flex-col ${
          sidebarOpen ? 'translate-x-0 ease-out' : '-translate-x-full ease-in'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-5">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold">
              AH
            </div>
            <h1 className="text-white text-xl font-bold">Atlas Horizon</h1>
          </div>
          <button
            className="md:hidden text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <nav className="px-2 mt-5 flex-1 overflow-y-auto">
          <div className="space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `${
                    isActive
                      ? 'bg-navy-800 text-white'
                      : 'text-gray-300 hover:bg-navy-800 hover:text-white'
                  } group flex items-center px-2 py-2 text-base font-medium rounded-md`
                }
              >
                <item.icon
                  className="mr-3 h-6 w-6 flex-shrink-0"
                  aria-hidden="true"
                />
                {item.name}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </>
  );
};

export default Sidebar;