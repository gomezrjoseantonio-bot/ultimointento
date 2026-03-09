import React from 'react';
import { Landmark, Banknote, Wallet, TrendingUp, TrendingDown, CreditCard } from 'lucide-react';
import { formatCompact } from '../../utils/formatUtils';
import './treasury-reconciliation.css';

interface AccountCardProps {
  account: {
    id: string;
    name: string;
    type: 'bank' | 'cash' | 'wallet';
  };
  stats: {
    total: number;        // Total movimientos
    reconciled: number;   // Movimientos conciliados
    ingresos: { previsto: number; real: number };
    gastos: { previsto: number; real: number };
    financiacion: { previsto: number; real: number };
    saldo: { previsto: number; real: number };
  };
  onClick: () => void;
  disabled?: boolean; // true si 100% conciliado
}

/**
 * ATLAS HORIZON - Account Card
 * 
 * Tarjeta por cuenta bancaria, compacta para caber 8 en grid 4x2.
 * 
 * Estructura visual (altura ~130px):
 * - Header: icono AZUL + nombre
 * - Status: ratio conciliados/total
 * - Divider
 * - INGRESOS: ↑ AZUL + label negro + prev/real negro
 * - GASTOS: ↓ AZUL + label negro + prev/real negro
 * - FINANCIACIÓN: [CreditCard] AZUL + label negro + prev/real negro
 * - Divider
 * - Saldo label
 * - Saldo: prev/real (destacado, negro)
 * 
 * Estados:
 * - Normal: borde var(--hz-neutral-200)
 * - Hover: borde var(--atlas-blue)
 * - Completo (100%): borde var(--ok), fondo sutil verde
 * 
 * IMPORTANTE: Iconos SOLO azul ATLAS, texto SOLO negro/navy (NO verde/rojo)
 */
const AccountCard: React.FC<AccountCardProps> = ({
  account,
  stats,
  onClick,
  disabled = false
}) => {
  const isComplete = stats.reconciled === stats.total && stats.total > 0;
  
  // Select icon based on account type
  const AccountIcon = account.type === 'cash' 
    ? Banknote 
    : account.type === 'wallet' 
    ? Wallet 
    : Landmark;

  const handleClick = () => {
    if (!disabled) {
      onClick();
    }
  };

  return (
    <div 
      className={`account-card ${isComplete ? 'account-card--complete' : ''} ${disabled ? 'account-card--disabled' : ''}`}
      onClick={handleClick}
    >
      {/* Header */}
      <div className="account-card__header">
        <AccountIcon className="account-card__icon" size={16} />
        <span className="account-card__name">{account.name}</span>
      </div>

      {/* Status */}
      <div className={`account-card__status ${isComplete ? 'account-card__status--complete' : ''}`}>
        {stats.reconciled}/{stats.total}
      </div>

      <div className="account-card__divider" />

      {/* Ingresos */}
      <div className="account-card__row">
        <TrendingUp className="account-card__row-icon" size={12} />
        <span className="account-card__row-label">INGRESOS:</span>
        <span className="account-card__row-values">
          {formatCompact(stats.ingresos.previsto)} / {formatCompact(stats.ingresos.real)}
        </span>
      </div>

      {/* Gastos */}
      <div className="account-card__row">
        <TrendingDown className="account-card__row-icon" size={12} />
        <span className="account-card__row-label">GASTOS:</span>
        <span className="account-card__row-values">
          {formatCompact(stats.gastos.previsto)} / {formatCompact(stats.gastos.real)}
        </span>
      </div>

      {/* Financiación */}
      <div className="account-card__row">
        <CreditCard className="account-card__row-icon" size={12} />
        <span className="account-card__row-label">FINANCIACIÓN:</span>
        <span className="account-card__row-values">
          {formatCompact(stats.financiacion.previsto)} / {formatCompact(stats.financiacion.real)}
        </span>
      </div>

      <div className="account-card__divider" />

      {/* Saldo */}
      <div className="account-card__saldo-label">SALDO</div>
      <div className="account-card__saldo-values">
        {formatCompact(stats.saldo.previsto)} / {formatCompact(stats.saldo.real)}
      </div>
    </div>
  );
};

export default AccountCard;
