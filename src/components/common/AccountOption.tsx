import React from 'react';
import { Account } from '../../services/db';
import { maskIban, generateHashColor, getAvatarInitial } from '../../utils/accountHelpers';

interface AccountOptionProps {
  account: Account;
  showFullIban?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * AccountOption - Reusable component for uniform account display
 * 
 * Used across the app for account selection and display:
 * - Préstamos (loan account selection)
 * - Inmuebles (property default account)
 * - Tesorería (treasury filters and listings)
 * - Any account selector
 */
const AccountOption: React.FC<AccountOptionProps> = ({ 
  account, 
  showFullIban = false, 
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: {
      container: 'flex items-center space-x-2',
      logo: 'w-6 h-6',
      text: 'text-xs',
      subtext: 'text-xs'
    },
    md: {
      container: 'flex items-center space-x-3',
      logo: 'w-8 h-8',
      text: 'text-sm',
      subtext: 'text-xs'
    },
    lg: {
      container: 'flex items-center space-x-4',
      logo: 'w-10 h-10',
      text: 'text-base',
      subtext: 'text-sm'
    }
  };

  const classes = sizeClasses[size];

  const renderLogo = () => {
    if (account.banco?.brand?.logoUrl) {
      return (
        <img 
          src={account.banco.brand.logoUrl} 
          alt={`Logo ${account.banco.name}`}
          className="w-full h-full object-cover"
          >
          onError={(e) => {
            // Fallback to avatar
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              const fallback = parent.querySelector('.fallback-avatar');
              if (fallback) {
                fallback.setAttribute('style', 'display: flex');
              }
            }
          }}
        />
      );
    }
    
    const color = account.banco?.brand?.color || generateHashColor(account.iban);
    const initial = getAvatarInitial(account.alias || 'Sin alias');
    
    return (
      <div 
        className="fallback-avatar w-full h-full flex items-center justify-center text-white font-bold"
        >
        style={{ 
          backgroundColor: color,
          fontSize: size === 'sm' ? '0.6rem' : size === 'md' ? '0.75rem' : '0.875rem'
        }}
      >
        {initial}
      </div>
    );
  };

  const displayIban = showFullIban ? account.iban : maskIban(account.iban);

  return (
    <div className={`${classes.container} ${className}`}>
      {/* Bank Logo */}
      <div className={`${classes.logo} bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0`}>
        {renderLogo()}
      </div>
      
      {/* Account Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-medium text-atlas-navy-1 truncate ${classes.text}`}>
            {account.alias}
          </p>
          {account.isDefault && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-atlas-blue text-white flex-shrink-0">
              Por defecto
            </span>
          )}
          {!account.activa && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 flex-shrink-0">
              Inactiva
            </span>
          )}
        </div>
        <p className={`text-text-gray truncate ${classes.subtext}`}>
          {displayIban}
        </p>
        {account.banco?.name && (
          <p className={`text-text-gray truncate ${classes.subtext}`}>
            {account.banco.name}
          </p>
        )}
      </div>
    </div>
  );
};

export default AccountOption;