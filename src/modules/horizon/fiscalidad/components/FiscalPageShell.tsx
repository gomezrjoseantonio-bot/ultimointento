import React from 'react';
import SubTabs from '../../../../components/common/SubTabs';

interface FiscalPageShellProps {
  children: React.ReactNode;
}

const FiscalPageShell: React.FC<FiscalPageShellProps> = ({ children }) => {
  return (
    <div style={{ background: 'var(--white)', minHeight: '100%' }}>
      <SubTabs />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 56px' }}>
        {children}
      </div>
    </div>
  );
};

export default FiscalPageShell;
