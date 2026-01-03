import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  Activity,
  Briefcase,
  Zap,
  Home,
  LineChart,
  Building2,
  Settings,
  User,
  Package,
  FileText,
  Receipt,
  Building
} from 'lucide-react';
import SummaryFlipCard from './SummaryFlipCard';
import AccountCard from './AccountCard';
import ReconciliationModal from './ReconciliationModal';
import toast from 'react-hot-toast';
import './treasury-reconciliation.css';

interface AccountStats {
  total: number;
  reconciled: number;
  ingresos: { previsto: number; real: number };
  gastos: { previsto: number; real: number };
  financiacion: { previsto: number; real: number };
  saldo: { previsto: number; real: number };
}

interface AccountData {
  id: string;
  name: string;
  type: 'bank' | 'cash' | 'wallet';
  stats: AccountStats;
}

interface Movement {
  id: string;
  concept: string;
  amount: number;
  date: string;
  type: 'income' | 'expense' | 'financing';
  status: 'previsto' | 'confirmado' | 'vencido';
  category?: string;
}

/**
 * ATLAS HORIZON - Treasury Reconciliation View
 * 
 * Vista principal de conciliación de tesorería con:
 * - 0 scroll (todo en 1 pantalla)
 * - 8 cuentas bancarias en grid 4x2
 * - Tarjetas resumen con flip detallado
 * - Solo iconos Lucide en AZUL ATLAS
 * - Colores ATLAS Design Bible (NO verde/rojo en valores)
 * - Números completos sin abreviaciones "k"
 */
const TreasuryReconciliationView: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);

  // Load mock data for demo
  useEffect(() => {
    loadMockData();
  }, [currentMonth]);

  const loadMockData = () => {
    // Mock data for 8 accounts
    const mockAccounts: AccountData[] = [
      {
        id: '1',
        name: 'BBVA',
        type: 'bank',
        stats: {
          total: 12,
          reconciled: 8,
          ingresos: { previsto: 2500, real: 2100 },
          gastos: { previsto: 1200, real: 1000 },
          financiacion: { previsto: 400, real: 400 },
          saldo: { previsto: 15200, real: 15800 }
        }
      },
      {
        id: '2',
        name: 'Santander',
        type: 'bank',
        stats: {
          total: 5,
          reconciled: 5,
          ingresos: { previsto: 0, real: 0 },
          gastos: { previsto: 600, real: 600 },
          financiacion: { previsto: 0, real: 0 },
          saldo: { previsto: 8400, real: 8400 }
        }
      },
      {
        id: '3',
        name: 'CaixaBank',
        type: 'bank',
        stats: {
          total: 10,
          reconciled: 10,
          ingresos: { previsto: 1200, real: 1200 },
          gastos: { previsto: 400, real: 400 },
          financiacion: { previsto: 200, real: 200 },
          saldo: { previsto: 22100, real: 22100 }
        }
      },
      {
        id: '4',
        name: 'ING',
        type: 'bank',
        stats: {
          total: 7,
          reconciled: 3,
          ingresos: { previsto: 800, real: 500 },
          gastos: { previsto: 200, real: 150 },
          financiacion: { previsto: 100, real: 100 },
          saldo: { previsto: 5300, real: 4900 }
        }
      },
      {
        id: '5',
        name: 'Sabadell',
        type: 'bank',
        stats: {
          total: 6,
          reconciled: 6,
          ingresos: { previsto: 300, real: 300 },
          gastos: { previsto: 150, real: 150 },
          financiacion: { previsto: 0, real: 0 },
          saldo: { previsto: 3100, real: 3100 }
        }
      },
      {
        id: '6',
        name: 'Bankinter',
        type: 'bank',
        stats: {
          total: 8,
          reconciled: 4,
          ingresos: { previsto: 1500, real: 1000 },
          gastos: { previsto: 800, real: 600 },
          financiacion: { previsto: 300, real: 300 },
          saldo: { previsto: 12400, real: 11800 }
        }
      },
      {
        id: '7',
        name: 'Metálico',
        type: 'cash',
        stats: {
          total: 3,
          reconciled: 2,
          ingresos: { previsto: 100, real: 100 },
          gastos: { previsto: 50, real: 0 },
          financiacion: { previsto: 0, real: 0 },
          saldo: { previsto: 500, real: 550 }
        }
      },
      {
        id: '8',
        name: 'Revolut',
        type: 'wallet',
        stats: {
          total: 1,
          reconciled: 1,
          ingresos: { previsto: 50, real: 50 },
          gastos: { previsto: 20, real: 20 },
          financiacion: { previsto: 0, real: 0 },
          saldo: { previsto: 180, real: 180 }
        }
      }
    ];

    setAccounts(mockAccounts);
  };

  const handlePrevMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month - 2, 1);
    setCurrentMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month, 1);
    setCurrentMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const formatMonthYear = (monthStr: string): string => {
    const [year, month] = monthStr.split('-');
    const monthNames = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  // Calculate global totals
  const globalTotals = accounts.reduce(
    (acc, account) => ({
      ingresos: {
        previsto: acc.ingresos.previsto + account.stats.ingresos.previsto,
        real: acc.ingresos.real + account.stats.ingresos.real
      },
      gastos: {
        previsto: acc.gastos.previsto + account.stats.gastos.previsto,
        real: acc.gastos.real + account.stats.gastos.real
      },
      financiacion: {
        previsto: acc.financiacion.previsto + account.stats.financiacion.previsto,
        real: acc.financiacion.real + account.stats.financiacion.real
      },
      cashflow: {
        previsto: acc.cashflow.previsto + account.stats.ingresos.previsto - account.stats.gastos.previsto,
        real: acc.cashflow.real + account.stats.ingresos.real - account.stats.gastos.real
      }
    }),
    {
      ingresos: { previsto: 0, real: 0 },
      gastos: { previsto: 0, real: 0 },
      financiacion: { previsto: 0, real: 0 },
      cashflow: { previsto: 0, real: 0 }
    }
  );

  const handleAccountClick = (accountId: string) => {
    setSelectedAccount(accountId);
    // Load movements for this account
    loadMovements(accountId);
  };

  const loadMovements = (accountId: string) => {
    // Mock movements
    const mockMovements: Movement[] = [
      {
        id: '1',
        concept: 'Alquiler - Propiedad 1',
        amount: 850,
        date: `${currentMonth}-05`,
        type: 'income',
        status: 'previsto',
        category: 'Alquiler'
      },
      {
        id: '2',
        concept: 'Cuota préstamo hipotecario',
        amount: -450,
        date: `${currentMonth}-10`,
        type: 'financing',
        status: 'previsto',
        category: 'Financiación'
      },
      {
        id: '3',
        concept: 'Comunidad Propiedad 2',
        amount: -120,
        date: `${currentMonth}-15`,
        type: 'expense',
        status: 'confirmado',
        category: 'Gastos'
      }
    ];
    setMovements(mockMovements);
  };

  const handleConfirmMovement = (movementId: string, realAmount?: number) => {
    setMovements(prev =>
      prev.map(m => m.id === movementId ? { ...m, status: 'confirmado' as const } : m)
    );
    toast.success('Movimiento confirmado');
  };

  const handleCancelMovement = (movementId: string) => {
    setMovements(prev => prev.filter(m => m.id !== movementId));
    toast.success('Movimiento anulado');
  };

  const handleConfirmAll = () => {
    setMovements(prev => prev.map(m => ({ ...m, status: 'confirmado' as const })));
    toast.success('Todos los movimientos confirmados');
  };

  const handleCloseModal = () => {
    setSelectedAccount(null);
    setMovements([]);
  };

  const selectedAccountData = accounts.find(a => a.id === selectedAccount);

  return (
    <div className="treasury-view-decision">
      {/* Header con título y navegación de mes */}
      <div className="treasury-decision-header">
        <h1 className="treasury-decision-title">Conciliación mensual</h1>
        <div className="treasury-decision-controls">
          <button 
            className="treasury-decision-nav-button"
            onClick={handlePrevMonth}
            aria-label="Mes anterior"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="treasury-decision-month-text">
            {formatMonthYear(currentMonth)}
          </span>
          <button 
            className="treasury-decision-nav-button"
            onClick={handleNextMonth}
            aria-label="Mes siguiente"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Solo las 4 tarjetas de resumen - SIN grid de cuentas bancarias */}
      <div className="summary-cards-decision">
        <SummaryFlipCard
          title="Ingresos"
          icon={TrendingUp}
          previsto={globalTotals.ingresos.previsto}
          real={globalTotals.ingresos.real}
          detalles={[
            {
              icon: Briefcase,
              label: 'Nómina',
              previsto: globalTotals.ingresos.previsto * 0.388,
              real: globalTotals.ingresos.real * 0.4
            },
            {
              icon: Zap,
              label: 'Servicios Freelance',
              previsto: globalTotals.ingresos.previsto * 0.124,
              real: globalTotals.ingresos.real * 0.114
            },
            {
              icon: Home,
              label: 'Rentas de alquiler',
              previsto: globalTotals.ingresos.previsto * 0.287,
              real: globalTotals.ingresos.real * 0.352
            },
            {
              icon: LineChart,
              label: 'Intereses posiciones',
              previsto: globalTotals.ingresos.previsto * 0.019,
              real: globalTotals.ingresos.real * 0.023
            },
            {
              icon: Building2,
              label: 'Venta de activos',
              previsto: globalTotals.ingresos.previsto * 0.182,
              real: globalTotals.ingresos.real * 0.111
            }
          ]}
        />
        <SummaryFlipCard
          title="Gastos"
          icon={TrendingDown}
          previsto={globalTotals.gastos.previsto}
          real={globalTotals.gastos.real}
          detalles={[
            {
              icon: Settings,
              label: 'Gastos operativos',
              previsto: globalTotals.gastos.previsto * (400 / 1800),
              real: globalTotals.gastos.real * (350 / 1600)
            },
            {
              icon: User,
              label: 'Gastos personales',
              previsto: globalTotals.gastos.previsto * (1200 / 1800),
              real: globalTotals.gastos.real * (1100 / 1600)
            },
            {
              icon: Package,
              label: 'Gastos Freelance',
              previsto: globalTotals.gastos.previsto * (200 / 1800),
              real: globalTotals.gastos.real * (150 / 1600)
            },
            {
              icon: FileText,
              label: 'Gastos venta activos',
              previsto: globalTotals.gastos.previsto * (0 / 1800),
              real: globalTotals.gastos.real * (0 / 1600)
            },
            {
              icon: Receipt,
              label: 'IRPF a pagar',
              previsto: globalTotals.gastos.previsto * (0 / 1800),
              real: globalTotals.gastos.real * (0 / 1600)
            }
          ]}
        />
        <SummaryFlipCard
          title="Financiación"
          icon={CreditCard}
          previsto={globalTotals.financiacion.previsto}
          real={globalTotals.financiacion.real}
          detalles={[
            {
              icon: Building,
              label: 'Cuotas hipotecas',
              previsto: globalTotals.financiacion.previsto * 0.8,
              real: globalTotals.financiacion.real * 0.8
            },
            {
              icon: CreditCard,
              label: 'Cuotas préstamos',
              previsto: globalTotals.financiacion.previsto * 0.2,
              real: globalTotals.financiacion.real * 0.2
            }
          ]}
        />
        <SummaryFlipCard
          title="Cashflow"
          icon={Activity}
          previsto={globalTotals.cashflow.previsto}
          real={globalTotals.cashflow.real}
        />
      </div>

      {/* NO bank account grid - Decision-Maker no muestra cuentas bancarias en esta vista */}

      {/* Reconciliation Modal */}
      {selectedAccount && selectedAccountData && (
        <ReconciliationModal
          isOpen={true}
          onClose={handleCloseModal}
          accountId={selectedAccount}
          accountName={selectedAccountData.name}
          month={currentMonth}
          movements={movements}
          onConfirm={handleConfirmMovement}
          onCancel={handleCancelMovement}
          onConfirmAll={handleConfirmAll}
        />
      )}
    </div>
  );
};

export default TreasuryReconciliationView;
