import React from 'react';
import { MoneyValue, Icons } from '../../../design-system/v5';
import type { Account } from '../../../services/db';
import styles from './BankAccountCard.module.css';

const BANK_COLOR_MAP: Record<string, string> = {
  santander: 'var(--atlas-v5-brand-santander)',
  sabadell: 'var(--atlas-v5-brand-sabadell)',
  unicaja: 'var(--atlas-v5-brand-unicaja)',
  bbva: 'var(--atlas-v5-brand-bbva)',
  ing: 'var(--atlas-v5-brand-ing)',
  caixabank: 'var(--atlas-v5-brand-caixabank)',
  caixa: 'var(--atlas-v5-brand-caixabank)',
};

const inferLogoColor = (account: Account): string => {
  const brandColor = account.banco?.brand?.color;
  if (brandColor && brandColor.startsWith('#')) return brandColor;
  const bankName = (
    account.banco?.name ??
    account.bank ??
    ''
  ).toLowerCase();
  for (const key of Object.keys(BANK_COLOR_MAP)) {
    if (bankName.includes(key)) return BANK_COLOR_MAP[key];
  }
  return 'var(--atlas-v5-brand)';
};

const inferInitials = (account: Account): string => {
  const name =
    account.alias ??
    account.banco?.name ??
    account.bank ??
    account.name ??
    '??';
  return name
    .replace(/[^A-Za-zÁÉÍÓÚÑ\s]/g, '')
    .trim()
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase() || '??';
};

const last4 = (iban?: string): string => {
  if (!iban) return '';
  const digits = iban.replace(/\s+/g, '').slice(-4);
  return `···· ${digits}`;
};

export interface BankAccountCardProps {
  account: Account;
  /** Pendientes por conciliar de esta cuenta. */
  pendingCount?: number;
  /** Delta a 30 días (importe). Si null · oculta el delta. */
  delta30d?: number | null;
  onClick?: (id: number) => void;
  onEdit?: (id: number) => void;
}

const BankAccountCard: React.FC<BankAccountCardProps> = ({
  account,
  pendingCount = 0,
  delta30d = null,
  onClick,
  onEdit,
}) => {
  const balance = account.balance ?? account.openingBalance ?? 0;
  const logoColor = inferLogoColor(account);
  const initials = inferInitials(account);
  const id = account.id ?? 0;

  const allClear = pendingCount === 0;

  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => onClick?.(id)}
      aria-label={`${account.alias ?? account.banco?.name ?? 'Cuenta'} · saldo ${balance} euros`}
    >
      <div className={styles.head}>
        <span className={styles.logo} style={{ background: logoColor }} aria-hidden>
          {initials}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className={styles.name}>
            {account.alias ?? account.banco?.name ?? account.bank ?? 'Cuenta'}
          </div>
          <div className={styles.type}>{last4(account.iban)}</div>
        </div>
        {onEdit && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Editar cuenta"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onEdit(id);
              }
            }}
            style={{
              color: 'var(--atlas-v5-ink-4)',
              padding: 4,
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            <Icons.Edit size={11} strokeWidth={2} />
          </span>
        )}
      </div>
      <div className={styles.bal}>
        <MoneyValue
          value={balance}
          decimals={0}
          tone="ink"
          size="kpi"
        />
      </div>
      {delta30d !== null && (
        <div
          className={`${styles.delta} ${delta30d > 0 ? styles.pos : delta30d < 0 ? styles.neg : ''}`}
        >
          <MoneyValue
            value={delta30d}
            decimals={0}
            showSign
            tone="auto"
          />{' '}
          · 30d
        </div>
      )}
      <div className={styles.pending}>
        <span className={styles.pendingLabel}>
          {allClear ? 'Todo al día' : 'Pendiente conciliar'}
        </span>
        <span
          className={`${styles.pendingCount} ${allClear ? styles.ok : ''}`}
        >
          {allClear ? '✓' : pendingCount}
        </span>
      </div>
    </button>
  );
};

interface BankAccountAddCardProps {
  onClick?: () => void;
}

const BankAccountAddCard: React.FC<BankAccountAddCardProps> = ({ onClick }) => (
  <button
    type="button"
    className={`${styles.card} ${styles.cardNew}`}
    onClick={onClick}
    aria-label="Añadir nueva cuenta"
  >
    <span className={styles.cardNewIcon}>
      <Icons.Plus size={22} strokeWidth={1.8} />
    </span>
    <span className={styles.cardNewText}>Nueva cuenta</span>
    <span className={styles.cardNewSub}>añade banco · cripto · plataforma</span>
  </button>
);

export default BankAccountCard;
export { BankAccountCard, BankAccountAddCard };
