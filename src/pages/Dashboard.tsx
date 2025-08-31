import React from 'react';
import KpiCard from '../components/dashboard/KpiCard';
import ProjectionChart from '../components/dashboard/ProjectionChart';
import RecentActivity from '../components/dashboard/RecentActivity';

const Dashboard: React.FC = () => {
  const horizontKpis = [
    { title: 'Total Properties', value: '8', change: '+1', isPositive: true },
    { title: 'Rental Yield', value: '5.8%', change: '+0.3%', isPositive: true },
    { title: 'Occupancy Rate', value: '92%', change: '-3%', isPositive: false },
    { title: 'Monthly Cashflow', value: '€3,240', change: '+€180', isPositive: true },
  ];
  
  const pulseKpis = [
    { title: 'Monthly Income', value: '€4,750', change: '+€250', isPositive: true },
    { title: 'Expenses', value: '€2,830', change: '-€120', isPositive: true },
    { title: 'Savings Rate', value: '28%', change: '+2%', isPositive: true },
    { title: 'Net Worth', value: '€312,450', change: '+€8,300', isPositive: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
        <div className="flex space-x-2">
          <select className="bg-white border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>This year</option>
            <option>All time</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Horizon Module */}
        <div className="bg-white shadow rounded-lg p-6 border-l-4 border-navy-600">
          <h2 className="text-xl font-semibold text-navy-600 mb-4">Horizon - Real Estate</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {horizontKpis.map((kpi, index) => (
              <KpiCard key={index} {...kpi} color="navy" />
            ))}
          </div>
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-700 mb-2">12-Month Projection</h3>
            <ProjectionChart type="horizon" />
          </div>
        </div>

        {/* Pulse Module */}
        <div className="bg-white shadow rounded-lg p-6 border-l-4 border-teal-500">
          <h2 className="text-xl font-semibold text-teal-600 mb-4">Pulse - Personal Finance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pulseKpis.map((kpi, index) => (
              <KpiCard key={index} {...kpi} color="teal" />
            ))}
          </div>
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-700 mb-2">Budget vs. Actual</h3>
            <ProjectionChart type="pulse" />
          </div>
        </div>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Activity</h2>
        <RecentActivity />
      </div>
    </div>
  );
};

export default Dashboard;