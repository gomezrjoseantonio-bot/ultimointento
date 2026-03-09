import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  badge?: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon: Icon,
  children,
  defaultExpanded = false,
  badge,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-gray-200 bg-white rounded-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between text-left"
        style={{ backgroundColor: 'var(--bg)', padding: '1rem 1.5rem' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4" style={{ color: 'var(--atlas-navy-1)' }} />}
          <span className="font-medium" style={{ color: 'var(--atlas-navy-1)' }}>{title}</span>
          {badge && <span>{badge}</span>}
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-gray)' }} />
          : <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-gray)' }} />
        }
      </button>
      {expanded && (
        <div className="border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;
