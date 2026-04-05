import React from 'react';
import { Outlet } from 'react-router-dom';

interface FiscalPageShellProps {
  children?: React.ReactNode;
}

/**
 * FiscalPageShell - Wrapper for fiscal pages
 * 
 * Note: The new supervision page (ImpuestosSupervisionPage) handles its own
 * header and layout. This shell is now primarily used to wrap the Outlet
 * in FiscalLayout. Individual pages should manage their own styling.
 */
const FiscalPageShell: React.FC<FiscalPageShellProps> = ({ children }) => {
  // If children are provided (legacy usage), render them
  // Otherwise this component acts as a simple pass-through
  if (children) {
    return (
      <div style={{ background: 'var(--grey-50)', minHeight: '100%' }}>
        {children}
      </div>
    );
  }
  
  return <Outlet />;
};

export default FiscalPageShell;
