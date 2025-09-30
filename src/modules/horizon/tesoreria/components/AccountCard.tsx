import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatEuro } from '../../../../utils/formatUtils';
import AccountCalendar from './AccountCalendar';
import { Movement as DBMovement } from '../../../../services/db';

interface Account {
  id: number;
  name: string; // alias
  bank: string;
  iban: string;
  balance: number;
  logo_url?: string;
  currency: string;
  status?: 'verde' | 'ambar' | 'rojo'; // Health indicator
}

// Use the database Movement interface
type Movement = DBMovement;

interface AccountCardProps {
  account: Account;
  movements: Movement[];
  isExpanded: boolean;
  onToggleExpanded: () => void;
  excludePersonal: boolean;
  searchText: string;
  monthYear: string;
  onMonthYearChange: (monthYear: string) => void;
}

const AccountCard: React.FC<AccountCardProps> = ({
  account,
  movements,
  isExpanded,
  onToggleExpanded,
  excludePersonal,
  searchText,
  monthYear,
  onMonthYearChange,
}) => {
  // Get account initials for fallback logo
  const getAccountInitials = (alias: string) => {
    return alias
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get health indicator color
  const getHealthColor = (status?: 'verde' | 'ambar' | 'rojo') => {
    switch (status) {
      case 'verde':
        return 'bg-hz-success';
      case 'ambar':
        return 'bg-hz-warning';
      case 'rojo':
        return 'bg-hz-error';
      default:
        return 'bg-hz-neutral-300';
    }
  };

  // Get balance color
  const getBalanceColor = (balance: number) => {
    return balance >= 0 ? 'text-hz-neutral-900' : 'text-hz-error font-semibold';
  };

  // Format IBAN partial (show last 4 digits)
  const formatIbanPartial = (iban: string) => {
    return `****${iban.slice(-4)}`;
  };

  return (
    <div className="bg-hz-card-bg rounded-lg border border-hz-neutral-300 overflow-hidden">
      {/* Account Header - Clickable for expand/collapse */}
      <button
        onClick={onToggleExpanded}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-hz-neutral-100 transition-colors focus:outline-none focus:ring-2 focus:ring-hz-primary focus:ring-inset"
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Contraer' : 'Expandir'} cuenta ${account.name}`}
      >
        <div className="flex items-center gap-3 flex-1">
          {/* Bank Logo or Initials */}
          <div className="w-7 h-7 rounded overflow-hidden flex-shrink-0">
            {account.logo_url ? (
              <img
                src={account.logo_url}
                alt={`Logo ${account.bank}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div
              className={`w-full h-full bg-hz-neutral-300 flex items-center justify-center text-xs font-medium text-hz-neutral-700 ${
                account.logo_url ? 'hidden' : ''
              }`}
            >
              {getAccountInitials(account.name)}
            </div>
          </div>

          {/* Account Text Info - Single line */}
          <div className="flex items-center gap-2 text-left flex-1 min-w-0">
            <span className="font-medium text-hz-neutral-900 truncate">
              {account.name}
            </span>
            <span className="text-hz-neutral-700 text-sm flex-shrink-0">
              {formatIbanPartial(account.iban)}
            </span>
            <span className="text-hz-neutral-500 text-sm flex-shrink-0">
              • {account.bank}
            </span>
          </div>
        </div>

        {/* Right side: Balance, Health, Caret */}
        <div className="flex items-center gap-3">
          {/* Current Balance */}
          <div className="text-right">
            <div className={`text-lg font-semibold ${getBalanceColor(account.balance)}`}>
              {formatEuro(account.balance)}
            </div>
          </div>

          {/* Health Indicator */}
          <div
            className={`w-3 h-3 rounded-full ${getHealthColor(account.status)}`}
            title={`Estado: ${account.status || 'normal'}`}
          />

          {/* Expand/Collapse Caret */}
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-hz-neutral-700" />
          ) : (
            <ChevronRight className="h-5 w-5 text-hz-neutral-700" />
          )}
        </div>
      </button>

      {/* Expanded Calendar - NO duplicate header text */}
      {isExpanded && (
        <div className="border-t border-hz-neutral-300">
          <AccountCalendar
            account={account}
            movements={movements}
            excludePersonal={excludePersonal}
            searchText={searchText}
            monthYear={monthYear}
            onMonthYearChange={onMonthYearChange}
          />
        </div>
      )}
    </div>
  );
};

export default AccountCard;