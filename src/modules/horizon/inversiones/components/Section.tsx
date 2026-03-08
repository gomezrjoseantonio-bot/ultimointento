// Section.tsx
// ATLAS HORIZON: Form section with title and optional icon

import React from 'react';
import { LucideIcon } from 'lucide-react';

type SectionColor = 'green' | 'blue' | 'gray' | 'orange' | 'purple';

interface SectionProps {
  title: string;
  icon?: LucideIcon;
  color?: SectionColor;
  children: React.ReactNode;
}

const colorMap = {
  green: { bg: 'var(--n-50)', border: 'var(--n-300)', text: 'var(--n-700)', iconBg: 'var(--s-pos-bg)', iconColor: 'var(--s-pos)' },
  blue: { bg: 'var(--n-50)', border: 'var(--n-300)', text: 'var(--n-700)', iconBg: 'color-mix(in srgb, var(--blue) 10%, var(--white))', iconColor: 'var(--blue)' },
  gray: { bg: 'var(--white)', border: 'var(--n-300)', text: 'var(--n-700)', iconBg: 'var(--n-100)', iconColor: 'var(--n-700)' },
  orange: { bg: 'var(--n-50)', border: 'var(--n-300)', text: 'var(--n-700)', iconBg: 'var(--s-warn-bg)', iconColor: 'var(--s-warn)' },
  purple: { bg: 'var(--n-50)', border: 'var(--n-300)', text: 'var(--n-700)', iconBg: 'color-mix(in srgb, var(--c2) 12%, var(--white))', iconColor: 'var(--c6)' },
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
            <Icon size={18} style={{ color: colors.iconColor }} />
          </div>
        )}
        <h3 style={{
          fontFamily: 'var(--font-base)',
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
