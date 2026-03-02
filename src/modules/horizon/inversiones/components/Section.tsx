// Section.tsx
// ATLAS HORIZON: Form section with title and optional icon

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SectionProps {
  title: string;
  icon?: LucideIcon;
  color?: 'green' | 'blue' | 'gray' | 'orange' | 'purple';
  children: React.ReactNode;
}

const colorMap = {
  green: { bg: '#f0fdfa', border: '#99f6e4', text: '#0d9488', iconBg: '#ccfbf1' },
  blue: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', iconBg: '#dbeafe' },
  gray: { bg: 'var(--hz-card-bg)', border: 'var(--hz-neutral-300)', text: 'var(--atlas-navy-1)', iconBg: 'var(--hz-neutral-100)' },
  orange: { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c', iconBg: '#ffedd5' },
  purple: { bg: '#faf5ff', border: '#e9d5ff', text: '#7e22ce', iconBg: '#f3e8ff' },
};

const Section: React.FC<SectionProps> = ({ title, icon: Icon, color = 'gray', children }) => {
  const colors = colorMap[color];
  return (
    <div style={{
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '10px',
      padding: '1.25rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        {Icon && (
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: colors.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon size={18} style={{ color: colors.text }} />
          </div>
        )}
        <h3 style={{
          fontFamily: 'var(--font-inter)',
          fontSize: '0.9375rem',
          fontWeight: 600,
          color: colors.text,
          margin: 0,
        }}>
          {title}
        </h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {children}
      </div>
    </div>
  );
};

export default Section;
