import React, { useEffect, useState } from 'react';
import type { CompromisoRecurrente } from '../../../../../types/compromisosRecurrentes';
import type { Movement, TreasuryEvent } from '../../../../../services/db';
import { initDB } from '../../../../../services/db';
import { expandirPatron } from '../../../../../services/personal/patronCalendario';
import { computeMonthly } from '../../../utils/compromisoUtils';
import { formatEur } from '../utils/amountFormatter';

const MESES_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

interface RowExpandedDetailProps {
  compromiso: CompromisoRecurrente & { id: number };
}

interface NextCharge {
  date: Date;
  amount: number;
  status: 'predicted' | 'confirmed' | 'executed';
  source: 'event' | 'computed';
}

function formatShortDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')} ${MESES_SHORT[d.getMonth()] ?? ''} ${d.getFullYear()}`;
}

const RowExpandedDetail: React.FC<RowExpandedDetailProps> = ({ compromiso: c }) => {
  const [nextCharges, setNextCharges] = useState<NextCharge[]>([]);
  const [history, setHistory] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const db = await initDB();

        // Próximos cargos: leer treasuryEvents (status=predicted/confirmed) por sourceId
        const eventTx = db.transaction('treasuryEvents', 'readonly');
        const eventStore = eventTx.objectStore('treasuryEvents');
        const eventIdx = eventStore.index('sourceId');
        const events = (await eventIdx.getAll(c.id)) as TreasuryEvent[];

        const todayMs = Date.now();
        const futureEvents = events
          .filter(
            (e) =>
              e.sourceType === 'gasto_recurrente' &&
              (e.status === 'predicted' || e.status === 'confirmed') &&
              new Date(e.predictedDate).getTime() >= todayMs - 86_400_000,
          )
          .sort(
            (a, b) =>
              new Date(a.predictedDate).getTime() - new Date(b.predictedDate).getTime(),
          )
          .slice(0, 6)
          .map<NextCharge>((e) => ({
            date: new Date(e.predictedDate),
            amount: e.amount,
            status: e.status,
            source: 'event',
          }));

        // Si no hay events (compromiso recién creado), expandir patrón en cliente
        let charges = futureEvents;
        if (charges.length === 0) {
          const horizon = new Date();
          horizon.setMonth(horizon.getMonth() + 12);
          try {
            const dates = expandirPatron(
              c.patron,
              new Date().toISOString().slice(0, 10),
              horizon.toISOString().slice(0, 10),
            );
            const monthly = computeMonthly(c);
            charges = dates.slice(0, 6).map<NextCharge>((d) => ({
              date: d,
              amount: -Math.abs(monthly),
              status: 'predicted',
              source: 'computed',
            }));
          } catch {
            charges = [];
          }
        }

        // Histórico: movements ejecutados ligados al compromiso vía executedMovementId
        const executedEventIds = events
          .filter((e) => e.status === 'executed' && e.executedMovementId)
          .map((e) => e.executedMovementId!) as number[];

        let movs: Movement[] = [];
        if (executedEventIds.length > 0) {
          const movTx = db.transaction('movements', 'readonly');
          const movStore = movTx.objectStore('movements');
          const list: Movement[] = [];
          for (const mId of executedEventIds) {
            const m = await movStore.get(mId);
            if (m) list.push(m as Movement);
          }
          movs = list
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 6);
        }

        if (!cancelled) {
          setNextCharges(charges);
          setHistory(movs);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setNextCharges([]);
          setHistory([]);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [c.id, c.patron, c]);

  const showHistory = history.length > 0;

  return (
    <div
      role="region"
      aria-label={`Detalle de ${c.alias}`}
      style={{
        background: 'var(--atlas-v5-card-alt)',
        borderBottom: '1px solid var(--atlas-v5-line-2)',
        padding: '18px 28px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showHistory ? '1fr 1fr' : '1fr',
          gap: 24,
        }}
      >
        {/* Próximos cargos */}
        <div>
          <div style={sectionTitle}>Próximos cargos</div>
          {loading ? (
            <div style={emptyStyle}>Cargando…</div>
          ) : nextCharges.length === 0 ? (
            <div style={emptyStyle}>Sin próximas previsiones</div>
          ) : (
            <ul style={listStyle}>
              {nextCharges.map((ch, i) => (
                <li key={i} style={chargeItem}>
                  <span style={dateLabel}>{formatShortDate(ch.date)}</span>
                  <span style={amountValue}>{formatEur(ch.amount)}</span>
                  <span
                    style={{
                      ...statusPill,
                      background:
                        ch.status === 'confirmed'
                          ? 'var(--atlas-v5-pos-wash)'
                          : 'var(--atlas-v5-line-2)',
                      color:
                        ch.status === 'confirmed'
                          ? 'var(--atlas-v5-pos)'
                          : 'var(--atlas-v5-ink-4)',
                    }}
                  >
                    {ch.status === 'confirmed' ? 'confirmado' : 'previsto'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Histórico */}
        {showHistory && (
          <div>
            <div style={sectionTitle}>Histórico</div>
            <ul style={listStyle}>
              {history.map((m) => (
                <li key={m.id ?? m.date} style={chargeItem}>
                  <span style={dateLabel}>{formatShortDate(new Date(m.date))}</span>
                  <span style={{ ...conceptLabel }}>
                    {m.description?.slice(0, 32) ?? ''}
                  </span>
                  <span style={amountValue}>{formatEur(m.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

const sectionTitle: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--atlas-v5-ink-4)',
  marginBottom: 10,
};
const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};
const chargeItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 0',
  borderBottom: '1px solid var(--atlas-v5-line-3)',
  fontSize: 12,
};
const dateLabel: React.CSSProperties = {
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  color: 'var(--atlas-v5-ink-3)',
  fontSize: 11.5,
  minWidth: 80,
};
const conceptLabel: React.CSSProperties = {
  flex: 1,
  color: 'var(--atlas-v5-ink-3)',
  fontSize: 11.5,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const amountValue: React.CSSProperties = {
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  fontWeight: 700,
  color: 'var(--atlas-v5-neg)',
  fontSize: 12,
  marginLeft: 'auto',
};
const statusPill: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '2px 7px',
  borderRadius: 99,
};
const emptyStyle: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--atlas-v5-ink-4)',
  fontStyle: 'italic',
  padding: '6px 0',
};

export default RowExpandedDetail;
