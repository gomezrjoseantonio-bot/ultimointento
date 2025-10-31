import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ProgressiveDisclosureProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  badge?: string;
  description?: string;
  isSimpleMode?: boolean;
}

/**
 * Sprint 4: Progressive Disclosure Component
 * Reduces cognitive load by allowing users to expand/collapse sections
 * In simple mode, optional sections are collapsed by default
 */
const ProgressiveDisclosure: React.FC<ProgressiveDisclosureProps> = ({
  title,
  children,
  defaultExpanded = true,
  badge,
  description,
  isSimpleMode = false
}) => {
  // In simple mode, start collapsed unless defaultExpanded is explicitly true
  const initialExpanded = isSimpleMode ? defaultExpanded : true;
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
        aria-expanded={isExpanded}
        aria-controls={`disclosure-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <div className="flex items-center gap-3">
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-white font-semibold">{title}</h3>
              {badge && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/30 text-blue-300 border border-blue-700/30">
                  {badge}
                </span>
              )}
            </div>
            {description && (
              <p className="text-sm text-gray-400 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div
          id={`disclosure-${title.replace(/\s+/g, '-').toLowerCase()}`}
          className="px-4 py-4 border-t border-gray-200"
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default ProgressiveDisclosure;
