/**
 * Account Logo Component
 * Displays real bank logos or Atlas-styled monogram fallback
 */

import React from 'react';
import { Account } from '../../services/db';
import { getAccountInitials, hasValidLogo } from '../../utils/accountUtils';

interface AccountLogoProps {
  account: Account;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const AccountLogo: React.FC<AccountLogoProps> = ({ account, size = 'md', className = '' }) => {
  const hasLogo = hasValidLogo(account);
  const initials = getAccountInitials(account);
  
  // Size classes
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-base'
  };
  
  if (hasLogo) {
    return (
      <img
        src={account.logo_url}
        alt={`${account.bank} logo`}
        className={`${sizeClasses[size]} rounded object-cover ${className}`}
        onError={(e) => {
          // Fallback to monogram if image fails to load
          const target = e.target as HTMLElement;
          target.style.display = 'none';
          if (target.nextSibling) {
            (target.nextSibling as HTMLElement).style.display = 'flex';
          }
        }}
      />
    );
  }
  
  // Monogram fallback with Atlas color scheme
  return (
    <div 
      className={`${sizeClasses[size]} rounded flex items-center justify-center font-medium text-white ${className}`}
      style={{ backgroundColor: 'var(--atlas-navy-2, #142C50)' }}
      title={`${account.name} (${account.bank})`}
    >
      {initials}
    </div>
  );
};

export default AccountLogo;