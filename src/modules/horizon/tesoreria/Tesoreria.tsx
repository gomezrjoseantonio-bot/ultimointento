import React from 'react';
import TreasuryPage from './TreasuryPage';

/**
 * Tesorería - Single unified view (per problem statement)
 * 
 * Single screen with:
 * - Account selector with logos
 * - Date range and search filters
 * - Movement table
 * - Import functionality
 * 
 * No sub-tabs, no multiple screens
 */
const Tesoreria: React.FC = () => {
  return <TreasuryPage />;
};

export default Tesoreria;