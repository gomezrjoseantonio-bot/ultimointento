/**
 * BalancesBancariosView.tsx
 *
 * Read-only view of bank accounts for SUPERVISIÓN > Tesorería > Balances bancarios.
 * Shows each active account as a card with name, IBAN mask, and current balance.
 * No edit or delete actions — those live in /conciliacion (Gestión).
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { initDB } from '../../services/db';
import type { Account } from '../../services/db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtEur = (v: number): string =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const getAccountDisplayName = (acc: Account): string =>
  acc.alias ?? acc.name ?? acc.banco?.name ?? 'Cuenta';

const getAccountIbanMask = (acc: Account): string =>
  acc.ibanMasked ?? (acc.iban ? acc.iban.slice(0, 4) + ' **** **** **** ' + acc.iban.slice(-4) : '—');

const getAccountBalance = (acc: Account): number =>
  acc.balance ?? acc.openingBalance ?? 0;

const isActiveAccount = (acc: Account): boolean => {
  if (acc.deleted_at) return false;
  if (acc.status === 'DELETED') return false;
  if (acc.activa === false) return false;
  if (acc.isActive === false) return false;
  return true;
};

// ─── Component ────────────────────────────────────────────────────────────────

const BalancesBancariosView: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await initDB();
        const all: Account[] = await db.getAll('accounts');
        if (cancelled) return;
        const active = all.filter(isActiveAccount);
        active.sort((a, b) => getAccountDisplayName(a).localeCompare(getAccountDisplayName(b), 'es'));
        const sum = active.reduce((s, a) => s + getAccountBalance(a), 0);
        setAccounts(active);
        setTotal(sum);
      } catch (err) {
        console.error('BalancesBancariosView load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--grey-400)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
        Cargando cuentas…
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 0', color: 'var(--grey-400)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
        <Landmark size={32} strokeWidth={1.5} />
        <p style={{ margin: 0, fontSize: 14 }}>No hay cuentas registradas.</p>
        <button
          type="button"
          onClick={() => navigate('/conciliacion')}
          style={{ fontSize: 13, color: 'var(--navy-900)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}
        >
          Añadir cuentas en Conciliación →
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>

      {/* Summary header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid var(--grey-200)', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderRight: '1px solid var(--grey-200)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--grey-400)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
            Cuentas activas
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--grey-900)', fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1.3 }}>
            {accounts.length}
          </div>
        </div>
        <div style={{ padding: '14px 18px', borderRight: '1px solid var(--grey-200)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--grey-400)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
            Saldo total
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy-900)', fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1.3 }}>
            {fmtEur(total)}
          </div>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--grey-500)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
              Para punteo y gestión
            </div>
            <button
              type="button"
              onClick={() => navigate('/conciliacion')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 12, fontWeight: 600, color: 'var(--navy-900)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
            >
              Ir a Conciliación →
            </button>
          </div>
        </div>
      </div>

      {/* Account cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {accounts.map((acc) => {
          const name    = getAccountDisplayName(acc);
          const mask    = getAccountIbanMask(acc);
          const balance = getAccountBalance(acc);
          return (
            <div
              key={acc.id}
              style={{
                background: '#fff',
                border: '1px solid var(--grey-200)',
                borderRadius: 10,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Avatar + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: 'var(--navy-50, #EEF3FA)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: 'var(--navy-900)',
                  flexShrink: 0,
                }}>
                  {name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--grey-900)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--grey-400)', fontFamily: 'IBM Plex Mono, monospace', marginTop: 1 }}>
                    {mask}
                  </div>
                </div>
              </div>

              {/* Saldo row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--grey-100)' }}>
                <span style={{ fontSize: 12, color: 'var(--grey-500)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>Saldo registrado</span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 700, color: 'var(--navy-900)' }}>
                  {fmtEur(balance)}
                </span>
              </div>

              {/* Account type badge */}
              {acc.tipo && (
                <div style={{ marginTop: -6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: 'var(--grey-100)', color: 'var(--grey-500)', letterSpacing: '.04em', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
                    {acc.tipo}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div style={{ fontSize: 11, color: 'var(--grey-400)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontStyle: 'italic' }}>
        Los saldos mostrados corresponden al balance registrado en cada cuenta. Para ver movimientos detallados y puntear, ve a{' '}
        <button
          type="button"
          onClick={() => navigate('/conciliacion')}
          style={{ fontSize: 11, color: 'var(--grey-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline', fontStyle: 'italic' }}
        >
          Conciliación
        </button>.
      </div>

    </div>
  );
};

export default BalancesBancariosView;
