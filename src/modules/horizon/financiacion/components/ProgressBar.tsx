import React from 'react';

interface ProgressBarProps {
  value: number; // 0-100
  label?: string;
  color?: string;
  height?: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  color = 'var(--atlas-blue)',
  height = 8,
}) => {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div>
      {label && (
        <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-gray)' }}>
          <span>{label}</span>
          <span>{Math.round(clamped)}%</span>
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height, backgroundColor: 'var(--border-light, #e5e7eb)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
