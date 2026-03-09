import React from 'react';

interface ProjectionChartProps {
  type: 'horizon' | 'pulse';
}

const DATA_POINTS: Record<ProjectionChartProps['type'], number[]> = {
  horizon: [42, 46, 49, 52, 58, 62, 66, 71, 75, 79, 84, 88],
  pulse: [64, 61, 68, 65, 71, 69, 74, 72, 78, 76, 82, 85],
};

const ProjectionChart: React.FC<ProjectionChartProps> = ({ type }) => {
  const points = DATA_POINTS[type];

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">
          {type === 'horizon' ? 'Projected portfolio performance' : 'Projected budget performance'}
        </p>
        <span className="text-xs text-gray-500">12 months</span>
      </div>

      <div className="grid h-32 grid-cols-12 items-end gap-1">
        {points.map((value, index) => (
          <div key={`${type}-${index}`} className="flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-sm ${type === 'horizon' ? 'bg-primary-900/70' : 'bg-teal-500/70'}`}
              style={{ height: `${value}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectionChart;
