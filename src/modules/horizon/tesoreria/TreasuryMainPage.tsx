import React from 'react';
import { useParams } from 'react-router-dom';
import TreasuryMainView from './TreasuryMainView';
import AccountDetailPage from './AccountDetailPage';

/**
 * ATLAS HORIZON - Treasury v1 Router Component
 * 
 * Routes between main treasury view and account detail based on URL params
 */
const TreasuryMainPage: React.FC = () => {
  const { id: accountId } = useParams<{ id: string }>();

  // If we have an accountId, render the account detail page
  if (accountId) {
    return <AccountDetailPage accountId={parseInt(accountId)} />;
  }

  // Otherwise render the main treasury view
  return <TreasuryMainView />;
};

export default TreasuryMainPage;