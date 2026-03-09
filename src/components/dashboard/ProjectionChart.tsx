import React from 'react';

interface ProjectionChartProps {
  type: 'horizon' | 'pulse';
}

const chartConfig = {
  horizon: {
    label: 'Projected cashflow',
    stroke: '#1D4ED8',
    fill: '#93C5FD',
    values: [38, 44, 47, 53, 56, 61, 65, 70, 72, 77, 81, 86],
  },
  pulse: {
    label: 'Budget utilization',
    stroke: '#0F766E',
    fill: '#99F6E4',
    values: [62, 60, 63, 58, 56, 59, 61, 57, 55, 58, 60, 62],
  },
} as const;

const ProjectionChart: React.FC<ProjectionChartProps> = ({ type }) => {
  const config = chartConfig[type];
  const maxValue = Math.max(...config.values);

  const points = config.values
    .map((value, index) => {
      const x = (index / (config.values.length - 1)) * 100;
      const y = 100 - (value / maxValue) * 90;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex items-center justify-between text-sm text-gray-600">
        <span>{config.label}</span>
        <span className="font-medium text-gray-800">Last 12 months</span>
      </div>

      <div className="h-36 w-full rounded-md bg-white p-2">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <linearGradient id={`gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={config.fill} stopOpacity="0.5" />
              <stop offset="100%" stopColor={config.fill} stopOpacity="0" />
            </linearGradient>
          </defs>

          <polygon points={`${points} 100,100 0,100`} fill={`url(#gradient-${type})`} />
          <polyline
            fill="none"
            stroke={config.stroke}
            strokeWidth="2.5"
            points={points}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
};

export default ProjectionChart;
