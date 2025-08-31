import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Inbox } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { currentModule } = useTheme();

  const getModuleInfo = () => {
    switch (currentModule) {
      case 'horizon':
        return {
          title: 'Horizon — Invest',
          subtitle: 'Real Estate Investment Platform',
          accentColor: 'brand-navy',
          description: 'Manage your real estate portfolio, track performance, and monitor investments.',
        };
      case 'pulse':
        return {
          title: 'Pulse — Personal',
          subtitle: 'Personal Finance Management',
          accentColor: 'brand-teal',
          description: 'Control your personal finances, track expenses, and plan your financial future.',
        };
      default:
        return {
          title: 'ATLAS',
          subtitle: 'Financial Management Platform',
          accentColor: 'brand-navy',
          description: 'Welcome to ATLAS',
        };
    }
  };

  const moduleInfo = getModuleInfo();

  return (
    <div className="space-y-8">
      {/* Module Header */}
      <div className="text-center py-12">
        <h1 className={`text-4xl font-semibold mb-2 ${
          currentModule === 'horizon' ? 'text-brand-navy' : 'text-brand-teal'
        }`}>
          {moduleInfo.title}
        </h1>
        <p className="text-xl text-gray-600 mb-4">{moduleInfo.subtitle}</p>
        <p className="text-gray-500 max-w-2xl mx-auto">{moduleInfo.description}</p>
      </div>

      {/* Empty State */}
      <div className="bg-white shadow rounded-atlas border border-gray-200">
        <div className="text-center py-16 px-6">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
            currentModule === 'horizon' 
              ? 'bg-brand-navy bg-opacity-10' 
              : 'bg-brand-teal bg-opacity-10'
          }`}>
            <Inbox className={`w-8 h-8 ${
              currentModule === 'horizon' ? 'text-brand-navy' : 'text-brand-teal'
            }`} />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Get Started</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Your {currentModule === 'horizon' ? 'investment portfolio' : 'personal finance dashboard'} is empty. 
            {' '}Start by importing your data or adding new entries.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button 
              className={`px-6 py-2 rounded-atlas hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                currentModule === 'horizon' 
                  ? 'bg-brand-navy text-white focus:ring-brand-navy' 
                  : 'bg-brand-teal text-white focus:ring-brand-teal'
              }`}
            >
              Import Data
            </button>
            <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-atlas hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-navy focus:ring-offset-2">
              Learn More
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentModule === 'horizon' ? (
          <>
            <div className="bg-white p-6 rounded-atlas shadow border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Add Property</h3>
              <p className="text-gray-500 mb-4">Start building your real estate portfolio</p>
              <button className="text-brand-navy hover:text-opacity-80 font-medium">
                Add Property →
              </button>
            </div>
            <div className="bg-white p-6 rounded-atlas shadow border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Documents</h3>
              <p className="text-gray-500 mb-4">Import contracts, invoices, and more</p>
              <button className="text-brand-navy hover:text-opacity-80 font-medium">
                Go to Inbox →
              </button>
            </div>
            <div className="bg-white p-6 rounded-atlas shadow border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Bank</h3>
              <p className="text-gray-500 mb-4">Link your accounts for automatic tracking</p>
              <button className="text-brand-navy hover:text-opacity-80 font-medium">
                Connect →
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white p-6 rounded-atlas shadow border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Track Income</h3>
              <p className="text-gray-500 mb-4">Monitor your earnings and income sources</p>
              <button className="text-brand-teal hover:text-opacity-80 font-medium">
                Add Income →
              </button>
            </div>
            <div className="bg-white p-6 rounded-atlas shadow border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Manage Expenses</h3>
              <p className="text-gray-500 mb-4">Categorize and control your spending</p>
              <button className="text-brand-teal hover:text-opacity-80 font-medium">
                Add Expense →
              </button>
            </div>
            <div className="bg-white p-6 rounded-atlas shadow border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Set Budget</h3>
              <p className="text-gray-500 mb-4">Create budgets and financial goals</p>
              <button className="text-brand-teal hover:text-opacity-80 font-medium">
                Create Budget →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;