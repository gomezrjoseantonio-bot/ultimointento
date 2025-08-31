import React from 'react';

interface KpiCardProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  color: 'navy' | 'teal';
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, change, isPositive, color }) => {
  const colorClasses = {
    navy: 'border-blue-900',
    teal: 'border-teal-500'
  };

  return (
    <div className={`bg-white p-4 rounded-lg shadow border-l-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</p>
        </div>
        <div className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {change}
        </div>
      </div>
    </div>
  );
};

export default KpiCard;