import React, { useState, useEffect, useMemo } from 'react';
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
  Building,
  Banknote,
  Wallet,
  CheckCircle2,
  Circle
} from 'lucide-react';
import SummaryFlipCard from './SummaryFlipCard';
import toast from 'react-hot-toast';
import { formatCompact } from '../../utils/formatUtils';
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

/**
 * TreasuryEvent – evento previsto del mes para punteo manual.
 * status 'previsto'   → solo cuenta en el sumatorio "Previsto" del Nivel 1.
 * status 'confirmado' → cuenta también en el sumatorio "Real" del Nivel 1.
 */
export interface TreasuryEvent {
  id: string;
  accountId: string;
  concept: string;
  amount: number;
  date: string;
  type: 'income' | 'expense' | 'financing';
  status: 'previsto' | 'confirmado';
}

/** Mock de eventos previstos del mes para demostración */
const MOCK_EVENTS: TreasuryEvent[] = [
  // BBVA
  { id: 'e1',  accountId: '1', concept: 'Nómina',                   amount: 2500, date: '2025-01-28', type: 'income',     status: 'previsto'   },
  { id: 'e2',  accountId: '1', concept: 'Cuota hipoteca BBVA',       amount:  400, date: '2025-01-05', type: 'financing',  status: 'confirmado' },
  { id: 'e3',  accountId: '1', concept: 'Suministros',               amount:  200, date: '2025-01-15', type: 'expense',    status: 'previsto'   },
  { id: 'e4',  accountId: '1', concept: 'Suscripciones digitales',   amount:  800, date: '2025-01-20', type: 'expense',    status: 'confirmado' },
  // Santander
  { id: 'e5',  accountId: '2', concept: 'Gastos varios Santander',   amount:  600, date: '2025-01-10', type: 'expense',    status: 'confirmado' },
  // CaixaBank
  { id: 'e6',  accountId: '3', concept: 'Alquiler cobrado',          amount: 1200, date: '2025-01-01', type: 'income',     status: 'confirmado' },
  { id: 'e7',  accountId: '3', concept: 'Gastos operativos',         amount:  400, date: '2025-01-12', type: 'expense',    status: 'confirmado' },
  { id: 'e8',  accountId: '3', concept: 'Cuota préstamo CaixaBank',  amount:  200, date: '2025-01-05', type: 'financing',  status: 'confirmado' },
  // ING
  { id: 'e9',  accountId: '4', concept: 'Rentas ING',                amount:  800, date: '2025-01-15', type: 'income',     status: 'previsto'   },
  { id: 'e10', accountId: '4', concept: 'Gastos ING',                amount:  200, date: '2025-01-20', type: 'expense',    status: 'previsto'   },
  { id: 'e11', accountId: '4', concept: 'Cuota préstamo ING',        amount:  100, date: '2025-01-05', type: 'financing',  status: 'confirmado' },
  // Sabadell
  { id: 'e12', accountId: '5', concept: 'Ingresos Sabadell',         amount:  300, date: '2025-01-18', type: 'income',     status: 'confirmado' },
  { id: 'e13', accountId: '5', concept: 'Gastos Sabadell',           amount:  150, date: '2025-01-22', type: 'expense',    status: 'confirmado' },
  // Bankinter
  { id: 'e14', accountId: '6', concept: 'Freelance Bankinter',       amount: 1500, date: '2025-01-25', type: 'income',     status: 'previsto'   },
  { id: 'e15', accountId: '6', concept: 'Gastos Bankinter',          amount:  800, date: '2025-01-15', type: 'expense',    status: 'previsto'   },
  { id: 'e16', accountId: '6', concept: 'Cuota préstamo Bankinter',  amount:  300, date: '2025-01-05', type: 'financing',  status: 'confirmado' },
  // Metálico
  { id: 'e17', accountId: '7', concept: 'Cobro efectivo',            amount:  100, date: '2025-01-10', type: 'income',     status: 'confirmado' },
  { id: 'e18', accountId: '7', concept: 'Gastos efectivo',           amount:   50, date: '2025-01-14', type: 'expense',    status: 'previsto'   },
  // Revolut
  { id: 'e19', accountId: '8', concept: 'Ingreso Revolut',           amount:   50, date: '2025-01-08', type: 'income',     status: 'confirmado' },
  { id: 'e20', accountId: '8', concept: 'Gasto Revolut',             amount:   20, date: '2025-01-15', type: 'expense',    status: 'confirmado' },
];

/**
 * ATLAS HORIZON - Treasury Reconciliation View
 * 
 * Dashboard de Control de Tesorería a 3 niveles:
 *   Nivel 1 – Resumen Ejecutivo (4 SummaryFlipCards)
 *   Nivel 2 – Selector Rápido de Bancos (filtro horizontal)
 *   Nivel 3 – Pizarra de Trabajo / Punteo Manual
 * 
 * - 0 scroll exterior (todo en 1 pantalla)
 * - Sin CSV obligatorio – punteo 100 % manual
 * - Solo iconos Lucide en AZUL ATLAS
 * - NO verde/rojo en valores (ATLAS Design Bible)
 */
const TreasuryReconciliationView: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [accounts, setAccounts] = useState<AccountData[]>([]);
  /** Banco activo como filtro; null = todos los bancos */
  const [selectedBankFilter, setSelectedBankFilter] = useState<string | null>(null);
  /** Eventos previstos del mes – fuente única de verdad para los sumatorios */
  const [events, setEvents] = useState<TreasuryEvent[]>(MOCK_EVENTS);

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

  /**
   * Punteo manual: alterna el estado de un evento entre 'previsto' y 'confirmado'.
   * Cuando pasa a 'confirmado', su importe se suma al "Real" del Nivel 1.
   */
  const handleToggleStatus = (eventId: string) => {
    setEvents(prev =>
      prev.map(e =>
        e.id === eventId
          ? { ...e, status: e.status === 'previsto' ? 'confirmado' : 'previsto' }
          : e
      )
    );
    const ev = events.find(e => e.id === eventId);
    if (ev) {
      toast.success(ev.status === 'previsto' ? 'Evento punteado ✓' : 'Punteo retirado');
    }
  };

  /** Alterna el filtro de banco; si ya está activo, deselecciona (todos los bancos). */
  const handleBankFilterClick = (accountId: string) => {
    setSelectedBankFilter(prev => (prev === accountId ? null : accountId));
  };

  /**
   * Nivel 1 – Totales globales (TODOS los bancos, no filtrado).
   * previsto = suma de todos los eventos (independientemente del estado).
   * real     = suma solo de eventos 'confirmado'.
   */
  const globalTotals = useMemo(() => {
    const base = { ingresos: { previsto: 0, real: 0 }, gastos: { previsto: 0, real: 0 }, financiacion: { previsto: 0, real: 0 } };
    events.forEach(ev => {
      const key = ev.type === 'income' ? 'ingresos' : ev.type === 'expense' ? 'gastos' : 'financiacion';
      base[key].previsto += ev.amount;
      if (ev.status === 'confirmado') base[key].real += ev.amount;
    });
    return {
      ...base,
      cashflow: {
        previsto: base.ingresos.previsto - base.gastos.previsto,
        real:     base.ingresos.real     - base.gastos.real
      }
    };
  }, [events]);

  /** Nivel 3 – Eventos filtrados por banco seleccionado */
  const filteredEvents = useMemo(
    () => selectedBankFilter ? events.filter(e => e.accountId === selectedBankFilter) : events,
    [events, selectedBankFilter]
  );

  /** Devuelve el icono Lucide apropiado según el tipo de cuenta */
  const getAccountIcon = (type: AccountData['type']) => {
    if (type === 'cash')   return Banknote;
    if (type === 'wallet') return Wallet;
    return Building2;
  };

  const selectedBankName = accounts.find(a => a.id === selectedBankFilter)?.name;

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

      {/* ── NIVEL 1: Resumen Ejecutivo ─────────────────────────────────── */}
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

      {/* ── NIVEL 2: Selector Rápido de Bancos ────────────────────────── */}
      <div className="bank-filter-strip" role="group" aria-label="Filtro por banco">
        {accounts.map(account => {
          const Icon = getAccountIcon(account.type);
          const isActive = selectedBankFilter === account.id;
          const acctEvents = events.filter(e => e.accountId === account.id);
          const confirmedCount = acctEvents.filter(e => e.status === 'confirmado').length;
          return (
            <button
              key={account.id}
              className={`bank-filter-card${isActive ? ' bank-filter-card--active' : ''}`}
              onClick={() => handleBankFilterClick(account.id)}
              aria-pressed={isActive}
              title={`Filtrar por ${account.name}`}
            >
              <Icon size={18} className="bank-filter-card__icon" />
              <span className="bank-filter-card__name">{account.name}</span>
              <span className="bank-filter-card__saldo">{formatCompact(account.stats.saldo.real)} €</span>
              <span className="bank-filter-card__progress">{confirmedCount}/{acctEvents.length}</span>
            </button>
          );
        })}
      </div>

      {/* ── NIVEL 3: Pizarra de Trabajo – Punteo Manual ───────────────── */}
      <div className="events-panel">
        <div className="events-panel__header">
          <h2 className="events-panel__title">
            {selectedBankFilter ? `Eventos — ${selectedBankName}` : 'Todos los eventos previstos'}
          </h2>
          <span className="events-panel__count">
            {filteredEvents.filter(e => e.status === 'confirmado').length} / {filteredEvents.length} punteados
          </span>
        </div>

        <div className="events-list">
          {filteredEvents.length === 0 ? (
            <div className="events-list__empty">Sin eventos para este periodo</div>
          ) : (
            filteredEvents.map(event => {
              const isConfirmed = event.status === 'confirmado';
              const EventTypeIcon =
                event.type === 'income' ? TrendingUp :
                event.type === 'expense' ? TrendingDown : CreditCard;
              return (
                <div
                  key={event.id}
                  className={`event-item${isConfirmed ? ' event-item--confirmed' : ''}`}
                >
                  <button
                    className={`event-toggle-btn${isConfirmed ? ' event-toggle-btn--confirmed' : ''}`}
                    onClick={() => handleToggleStatus(event.id)}
                    aria-label={isConfirmed ? 'Quitar punteo' : 'Puntear como visto en banco'}
                    title={isConfirmed ? 'Quitar punteo' : 'Puntear como visto en banco'}
                  >
                    {isConfirmed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </button>
                  <EventTypeIcon size={16} className="event-item__type-icon" />
                  <span className="event-item__concept">{event.concept}</span>
                  <span className="event-item__date">{event.date}</span>
                  <span className="event-item__amount">
                    {event.type !== 'income' && '−\u202F'}{formatCompact(event.amount)} €
                  </span>
                  <span className={`event-item__status${isConfirmed ? ' event-item__status--confirmed' : ''}`}>
                    {isConfirmed ? 'Confirmado' : 'Previsto'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default TreasuryReconciliationView;
