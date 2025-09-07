import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { MoreHorizontal, Building2, Settings, Eye, ExternalLink } from 'lucide-react';
import { PanelFilters } from './HorizonVisualPanel';

interface AccountData {
  id: string;
  name: string;
  bank: string;
  iban: string;
  logo?: string;
  usage: 'inmuebles' | 'mixto' | 'personal';
  currentBalance: number;
  projectedBalance: number;
  threshold?: number;
  sparklineData: Array<{
    date: string;
    balance: number;
    belowThreshold: boolean;
  }>;
}

interface AccountsSectionProps {
  filters: PanelFilters;
}

const AccountsSection: React.FC<AccountsSectionProps> = ({ filters }) => {
  const navigate = useNavigate();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuId(null);
    };
    
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);
  
  // Mock data - in real implementation would come from treasury services
  const accounts: AccountData[] = [
    {
      id: '1',
      name: 'Cuenta Principal',
      bank: 'Santander',
      iban: 'ES1234567890123456789012',
      usage: 'inmuebles',
      currentBalance: 8500,
      projectedBalance: 7200,
      threshold: 1000,
      sparklineData: generateSparklineData(8500, 7200, 1000, filters.dateRange)
    },
    {
      id: '2',
      name: 'Cuenta Gastos',
      bank: 'ING Direct',
      iban: 'ES9876543210987654321098',
      usage: 'mixto',
      currentBalance: 3200,
      projectedBalance: 2800,
      threshold: 500,
      sparklineData: generateSparklineData(3200, 2800, 500, filters.dateRange)
    },
    {
      id: '3',
      name: 'Cuenta Reserva',
      bank: 'BBVA',
      iban: 'ES5555444433332222111100',
      usage: 'inmuebles',
      currentBalance: 15000,
      projectedBalance: 14500,
      threshold: 5000,
      sparklineData: generateSparklineData(15000, 14500, 5000, filters.dateRange)
    }
  ];

  // Filter accounts based on personal exclusion
  const filteredAccounts = accounts.filter(account => {
    if (filters.excludePersonal && account.usage === 'personal') return false;
    return true;
  });

  const getDaysLabel = () => {
    switch (filters.dateRange) {
      case 'today': return '1 día';
      case '7days': return '7 días';
      case '30days': return '30 días';
    }
  };

  const formatBalance = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const maskIBAN = (iban: string) => {
    if (iban.length < 8) return iban;
    return `${iban.slice(0, 4)}...${iban.slice(-4)}`;
  };

  const getUsageLabel = (usage: AccountData['usage']) => {
    switch (usage) {
      case 'inmuebles': return 'Inmuebles';
      case 'mixto': return 'Mixto';
      case 'personal': return 'Personal';
    }
  };

  const getUsageColor = (usage: AccountData['usage']) => {
    switch (usage) {
      case 'inmuebles': return 'bg-hz-primary text-white';
      case 'mixto': return 'bg-hz-warning text-white';
      case 'personal': return 'bg-hz-neutral-500 text-white';
    }
  };

  const handleAccountMenu = (accountId: string, action: string) => {
    setOpenMenuId(null);
    
    switch (action) {
      case 'details':
        toast.success('Abriendo detalles de cuenta...');
        navigate('/tesoreria', { state: { accountId, action: 'details' } });
        break;
      case 'movements':
        toast.success('Abriendo movimientos de cuenta...');
        navigate('/tesoreria', { state: { accountId, action: 'movements' } });
        break;
      case 'settings':
        toast.success('Abriendo configuración de cuenta...');
        navigate('/tesoreria', { state: { accountId, action: 'settings' } });
        break;
    }
  };

  const toggleMenu = (accountId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    setOpenMenuId(openMenuId === accountId ? null : accountId);
  };

  if (filteredAccounts.length === 0) {
    return (
      <div className="bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-6">
        <h2 className="text-lg font-semibold text-hz-neutral-900 mb-4">Cuentas y saldos</h2>
        <div className="text-center py-8 text-hz-neutral-500">
          <Building2 className="w-12 h-12 mx-auto mb-4 text-hz-neutral-300" />
          <p>No hay cuentas que mostrar con los filtros actuales</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-6">
      <h2 className="text-lg font-semibold text-hz-neutral-900 mb-4">Cuentas y saldos</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAccounts.map((account) => (
          <div 
            key={account.id}
            className="border border-hz-neutral-200 rounded-lg p-4 bg-hz-card-bg hover:shadow-md transition-shadow"
          >
            {/* Account Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                {/* Bank Logo Placeholder */}
                <div className="w-8 h-8 bg-hz-neutral-100 rounded flex items-center justify-center text-xs font-medium text-hz-neutral-600">
                  {account.bank.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-hz-neutral-900 truncate">{account.name}</h3>
                  <p className="text-xs text-hz-neutral-500">{maskIBAN(account.iban)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs rounded-full ${getUsageColor(account.usage)}`}>
                  {getUsageLabel(account.usage)}
                </span>
                <div className="relative">
                  <button 
                    onClick={(e) => toggleMenu(account.id, e)}
                    className="p-1 hover:bg-hz-neutral-100 rounded"
                  >
                    <MoreHorizontal className="w-4 h-4 text-hz-neutral-500" />
                  </button>
                  
                  {/* Dropdown menu */}
                  {openMenuId === account.id && (
                    <div className="absolute right-0 top-8 z-10 w-48 bg-white border border-hz-neutral-200 rounded-lg shadow-lg py-1">
                      <button
                        onClick={() => handleAccountMenu(account.id, 'details')}
                        className="w-full px-3 py-2 text-left text-sm text-hz-neutral-700 hover:bg-hz-neutral-50 flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Ver detalles
                      </button>
                      <button
                        onClick={() => handleAccountMenu(account.id, 'movements')}
                        className="w-full px-3 py-2 text-left text-sm text-hz-neutral-700 hover:bg-hz-neutral-50 flex items-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Ver movimientos
                      </button>
                      <button
                        onClick={() => handleAccountMenu(account.id, 'settings')}
                        className="w-full px-3 py-2 text-left text-sm text-hz-neutral-700 hover:bg-hz-neutral-50 flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Configurar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sparkline Chart */}
            <div className="h-16 mb-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={account.sparklineData}>
                  <Line 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="#0A84FF" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-hz-neutral-900 text-white px-2 py-1 rounded text-xs">
                            <p>{label ? new Date(label).toLocaleDateString('es-ES', { 
                              day: '2-digit', 
                              month: 'short' 
                            }) : ''}</p>
                            <p>{formatBalance(payload[0].value as number)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Balance KPIs */}
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-hz-neutral-500 mb-1">Saldo hoy</p>
                <p className="text-lg font-semibold text-hz-neutral-900">
                  {formatBalance(account.currentBalance)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-hz-neutral-500 mb-1">A {getDaysLabel()}</p>
                <p className={`text-sm font-medium ${
                  account.projectedBalance < (account.threshold || 0) 
                    ? 'text-hz-error' 
                    : 'text-hz-success'
                }`}>
                  {formatBalance(account.projectedBalance)}
                </p>
              </div>
            </div>

            {/* Threshold indicator */}
            {account.threshold && (
              <div className="mt-2 pt-2 border-t border-hz-neutral-100">
                <p className="text-xs text-hz-neutral-500">
                  Umbral: {formatBalance(account.threshold)}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper function to generate sparkline data
function generateSparklineData(
  currentBalance: number, 
  finalBalance: number, 
  threshold: number, 
  dateRange: string
): AccountData['sparklineData'] {
  const days = dateRange === 'today' ? 1 : dateRange === '7days' ? 7 : 30;
  const data = [];
  
  for (let i = 0; i <= days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    
    // Linear interpolation with some random variation
    const progress = i / days;
    const balance = currentBalance + (finalBalance - currentBalance) * progress + 
                   (Math.random() - 0.5) * currentBalance * 0.1;
    
    data.push({
      date: date.toISOString(),
      balance: Math.round(balance),
      belowThreshold: balance < threshold
    });
  }
  
  return data;
}

export default AccountsSection;