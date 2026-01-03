import React from 'react';
import TreasuryReconciliationView from '../../../components/treasury/TreasuryReconciliationView';

/**
 * ATLAS HORIZON - Treasury Router Component
 * 
 * New reconciliation-focused treasury view with:
 * - 0 scroll design
 * - 8 accounts in 4x2 grid
 * - Flip cards for summaries
 * - Modal-based reconciliation
 */
const Tesoreria: React.FC = () => {
  return <TreasuryReconciliationView />;
};

export default Tesoreria;