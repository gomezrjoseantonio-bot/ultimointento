import React from 'react';
import { Outlet } from 'react-router-dom';
import { FiscalProvider } from '../../../contexts/FiscalContext';

const FiscalLayout: React.FC = () => {
  return (
    <FiscalProvider>
      <Outlet />
    </FiscalProvider>
  );
};

export default FiscalLayout;
