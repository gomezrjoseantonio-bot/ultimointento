// ============================================================================
// ATLAS · T31 · PendientesDelDia (mockup atlas-tesoreria-v8 · pend-card)
// ============================================================================
//
// Lista de movimientos previstos del DÍA en curso pendientes de conciliar.
// Cada fila tiene:
//   · Checkbox (dashed gold) · clic puntea (confirma evento)
//   · Concepto + sub (cuenta/iban)
//   · Importe (verde / rojo según signo)
//   · Clic en la fila (no en checkbox) abre el drawer de detalle
//
// Cuando no quedan pendientes muestra el estado "Todo conciliado hoy".
// ============================================================================

import React, { useMemo } from 'react';
import { Check, CheckCircle2 } from 'lucide-react';

const formatEur = (v: number): string =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const formatDateTodayLabel = (): string => {
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm} · ${dias[d.getDay()]}`;
};

export interface PendienteEvent {
  id: number | string;
  predictedDate: string;
  type: 'income' | 'expense' | 'financing';
  amount: number;
  description?: string;
  status?: string;
  accountId?: number;
}

export interface PendienteAccount {
  id?: number;
  alias?: string;
  name?: string;
  iban?: string;
  banco?: { name?: string };
}

export interface PendientesDelDiaProps {
  events: PendienteEvent[];
  accounts: PendienteAccount[];
  /** Total de eventos previstos para hoy (incluyendo ya confirmados). */
  totalDelDia?: number;
  /** Click en checkbox · puntea (confirma) el evento */
  onPuntear: (id: number | string) => void | Promise<void>;
  /** Click en la fila · abre detalle drawer */
  onClick: (id: number | string) => void;
  /** Click en "Ir a conciliación" · navegar */
  onIrAConciliacion?: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ibanLast4(account?: PendienteAccount): string {
  if (!account?.iban) return '';
  const trimmed = account.iban.replace(/\s+/g, '');
  return trimmed.length >= 4 ? `···· ${trimmed.slice(-4)}` : trimmed;
}

function shortAlias(account?: PendienteAccount): string {
  if (!account) return '';
  return account.alias || account.banco?.name || account.name || '';
}

// ─── Componente ─────────────────────────────────────────────────────────────

const PendientesDelDia: React.FC<PendientesDelDiaProps> = ({
  events,
  accounts,
  totalDelDia,
  onPuntear,
  onClick,
  onIrAConciliacion,
}) => {
  const accountById = useMemo(() => {
    const map = new Map<number, PendienteAccount>();
    for (const a of accounts) {
      if (a.id != null) map.set(a.id, a);
    }
    return map;
  }, [accounts]);

  // Filtra eventos previstos para hoy con status === 'predicted'
  const hoy = useMemo(() => new Date(), []);
  const hoyIso = useMemo(() => {
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [hoy]);

  const pendientes = useMemo(
    () =>
      events
        .filter(
          (e) =>
            e.predictedDate?.startsWith(hoyIso) && e.status === 'predicted',
        )
        .sort((a, b) => a.predictedDate.localeCompare(b.predictedDate)),
    [events, hoyIso],
  );
  const total = totalDelDia ?? pendientes.length;

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--atlas-v5-ink)',
              letterSpacing: '-0.01em',
            }}
          >
            Pendientes del día
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--atlas-v5-ink-4)',
              marginTop: 2,
            }}
          >
            marca ✓ los que veas confirmados en el banco
          </div>
        </div>
        {onIrAConciliacion && (
          <button
            type="button"
            onClick={onIrAConciliacion}
            style={{
              fontSize: 12,
              color: 'var(--atlas-v5-gold)',
              background: 'transparent',
              border: 'none',
              padding: '4px 8px',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Ir a conciliación →
          </button>
        )}
      </div>

      {/* Lista */}
      {pendientes.length === 0 ? (
        <EmptyEstado />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pendientes.map((ev) => (
            <PendCard
              key={ev.id}
              evento={ev}
              account={ev.accountId != null ? accountById.get(ev.accountId) : undefined}
              onPuntear={onPuntear}
              onClick={onClick}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid var(--atlas-v5-line-2)',
          fontSize: 11,
          color: 'var(--atlas-v5-ink-4)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>
          Quedan{' '}
          <strong style={{ color: 'var(--atlas-v5-ink-3)' }}>{pendientes.length}</strong>
          {total > pendientes.length ? ` · de ${total} hoy` : ''}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace" }}>
          {formatDateTodayLabel()}
        </span>
      </div>
    </div>
  );
};

export default PendientesDelDia;

// ─── PendCard ───────────────────────────────────────────────────────────────

const PendCard: React.FC<{
  evento: PendienteEvent;
  account?: PendienteAccount;
  onPuntear: (id: number | string) => void | Promise<void>;
  onClick: (id: number | string) => void;
}> = ({ evento, account, onPuntear, onClick }) => {
  const isPos = evento.type === 'income';
  const cuentaLabel = [shortAlias(account), ibanLast4(account)]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(evento.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(evento.id);
        }
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr auto',
        gap: 12,
        alignItems: 'center',
        padding: '10px 12px',
        background: 'var(--atlas-v5-card-alt)',
        border: '1px solid var(--atlas-v5-line)',
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'border-color .12s',
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void onPuntear(evento.id);
        }}
        aria-label="Puntear · marcar conciliado"
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          border: '1.5px dashed var(--atlas-v5-gold)',
          background: 'var(--atlas-v5-gold-wash)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--atlas-v5-gold-ink)',
        }}
      >
        <Check size={12} strokeWidth={3} style={{ opacity: 0 }} />
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--atlas-v5-ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {evento.description || (isPos ? 'Ingreso' : 'Gasto')}
        </span>
        {cuentaLabel && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--atlas-v5-ink-4)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {cuentaLabel}
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
          fontSize: 13,
          fontWeight: 700,
          color: isPos ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)',
          whiteSpace: 'nowrap',
        }}
      >
        {isPos ? '+ ' : '− '}{formatEur(evento.amount)} €
      </div>
    </div>
  );
};

// ─── Estado vacío ───────────────────────────────────────────────────────────

const EmptyEstado: React.FC = () => (
  <div
    style={{
      textAlign: 'center',
      padding: '32px 12px',
      color: 'var(--atlas-v5-ink-4)',
      fontSize: 12,
    }}
  >
    <CheckCircle2
      size={32}
      strokeWidth={1.6}
      color="var(--atlas-v5-pos)"
      style={{ marginBottom: 10 }}
    />
    <div
      style={{
        fontWeight: 600,
        color: 'var(--atlas-v5-ink-3)',
        fontSize: 13,
      }}
    >
      Todo conciliado hoy
    </div>
    <div style={{ marginTop: 4 }}>
      no hay pendientes · vuelve a comprobar mañana
    </div>
  </div>
);
