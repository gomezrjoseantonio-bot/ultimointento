import React from 'react';

interface ProjectionChartProps {
  type: 'horizon' | 'pulse';
}

const ProjectionChart: React.FC<ProjectionChartProps> = ({ type }) => {
  return (
    <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
      <p className="text-gray-500">Chart for {type} - coming soon</p>
    </div>
  );
};

export default ProjectionChart;