// Chip.tsx
// ATLAS HORIZON: Reusable chip/badge component

import React from 'react';

interface ChipProps {
  children: React.ReactNode;
  color: string;
  bg: string;
}

const Chip: React.FC<ChipProps> = ({ children, color, bg }) => {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        background: bg,
        color,
      }}
    >
      {children}
    </span>
  );
};

export default Chip;
