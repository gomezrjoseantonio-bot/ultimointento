import React from 'react';

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'hero';

interface AtlasHeadingProps {
  level?: HeadingLevel;
  className?: string;
  children: React.ReactNode;
}

const levelClasses: Record<HeadingLevel, string> = {
  'hero': 'text-[2rem] font-bold text-atlas-navy-1 leading-10',
  'h1': 'text-[1.25rem] font-semibold text-atlas-navy-1 leading-7',
  'h2': 'text-[1.125rem] font-semibold text-atlas-navy-1 leading-7',
  'h3': 'text-[1rem] font-medium text-atlas-navy-1 leading-6',
};

const levelTags: Record<HeadingLevel, 'h1' | 'h2' | 'h3'> = {
  'hero': 'h1',
  'h1': 'h1',
  'h2': 'h2',
  'h3': 'h3'
};

export const AtlasHeading: React.FC<AtlasHeadingProps> = ({
  level = 'h1',
  className = '',
  children
}) => {
  const Tag = levelTags[level];

  return (
    <Tag className={`${levelClasses[level]} ${className}`}>
      {children}
    </Tag>
  );
};
