// ============================================================================
// ATLAS · T31 · MesDetalleDrawer
// ============================================================================
//
// Drawer telescópico que se abre desde el clic en una mes-card del calendario
// rodante 24m. Replica el diseño del mockup atlas-tesoreria-v8.html:
//   · slide-in lateral derecho 44% width (max 640 · min 380)
//   · backdrop oscuro con click-to-close
//   · header con título "Mayo 2026" + sub "previsto · X eventos"
//   · KPIs grid (Entradas · Salidas · Saldo neto)
//   · secciones de eventos · Entradas (verde) + Salidas (rojo) · ordenados por fecha
//   · cada evento muestra concepto · fecha · cuenta · importe
// ============================================================================

import React, { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const formatEur = (v: number): string =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const formatDateShort = (iso: string): string => {
  const d = new Date(iso.length > 10 ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
};

export interface MesDrawerEvent {
  id?: number | string;
  predictedDate: string;
  type: 'income' | 'expense' | 'financing';
  amount: number;
  description?: string;
  status?: string;
  accountId?: number;
}

export interface MesDrawerAccount {
  id?: number;
  alias?: string;
  name?: string;
}

export interface MesDetalleDrawerProps {
  open: boolean;
  year: number | null;
  monthIndex0: number | null;
  events: MesDrawerEvent[];
  accounts: MesDrawerAccount[];
  onClose: () => void;
}

const MesDetalleDrawer: React.FC<MesDetalleDrawerProps> = ({
  open,
  year,
  monthIndex0,
  events,
  accounts,
  onClose,
}) => {
  // Cierre con Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const accountAlias = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of accounts) {
      if (a.id != null) map.set(a.id, a.alias ?? a.name ?? `Cuenta ${a.id}`);
    }
    return map;
  }, [accounts]);

  const eventosMes = useMemo(() => {
    if (year == null || monthIndex0 == null) return [];
    return events
      .filter((e) => {
        if (!e.predictedDate) return false;
        const d = new Date(e.predictedDate);
        return d.getFullYear() === year && d.getMonth() === monthIndex0;
      })
      .sort((a, b) => a.predictedDate.localeCompare(b.predictedDate));
  }, [events, year, monthIndex0]);

  const entradas = eventosMes.filter((e) => e.type === 'income');
  const salidas = eventosMes.filter((e) => e.type === 'expense' || e.type === 'financing');
  const totalEntradas = entradas.reduce((s, e) => s + e.amount, 0);
  const totalSalidas = salidas.reduce((s, e) => s + e.amount, 0);
  const neto = totalEntradas - totalSalidas;

  const titulo = year != null && monthIndex0 != null
    ? `${MESES[monthIndex0]} ${year}`
    : '';
  const sub = `${eventosMes.length} evento${eventosMes.length === 1 ? '' : 's'} · clic en uno para ver el detalle`;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden={!open}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(14,20,35,0.42)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .22s ease',
          zIndex: 100,
        }}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        aria-hidden={!open}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '44%',
          maxWidth: 640,
          minWidth: 380,
          background: 'var(--atlas-v5-card)',
          borderLeft: '1px solid var(--atlas-v5-line)',
          boxShadow: '-8px 0 24px rgba(14,20,35,0.08)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .26s cubic-bezier(.32,.72,0,1)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px 14px',
            borderBottom: '1px solid var(--atlas-v5-line)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--atlas-v5-card)',
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--atlas-v5-ink)',
                letterSpacing: '-0.02em',
              }}
            >
              {titulo}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--atlas-v5-ink-4)',
                marginTop: 2,
                fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
              }}
            >
              {sub}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar drawer"
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              border: '1px solid var(--atlas-v5-line)',
              background: 'var(--atlas-v5-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--atlas-v5-ink-3)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
          {/* KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3,1fr)',
              gap: 0,
              padding: '14px 0',
              marginBottom: 18,
              background: 'var(--atlas-v5-card-alt)',
              borderRadius: 10,
            }}
          >
            <KpiBlock label="Entradas" value={`+${formatEur(totalEntradas)} €`} tone="pos" />
            <KpiBlock label="Salidas" value={`−${formatEur(totalSalidas)} €`} tone="neg" />
            <KpiBlock
              label="Neto"
              value={`${neto >= 0 ? '+' : '−'}${formatEur(Math.abs(neto))} €`}
              tone={neto >= 0 ? 'pos' : 'neg'}
              last
            />
          </div>

          {/* Sección Entradas */}
          {entradas.length > 0 && (
            <Section title={`Entradas · ${entradas.length}`} tone="pos">
              {entradas.map((e, idx) => (
                <EventoRow
                  key={`in-${e.id ?? idx}`}
                  evento={e}
                  accountAlias={accountAlias}
                />
              ))}
            </Section>
          )}

          {/* Sección Salidas */}
          {salidas.length > 0 && (
            <Section title={`Salidas · ${salidas.length}`} tone="neg">
              {salidas.map((e, idx) => (
                <EventoRow
                  key={`out-${e.id ?? idx}`}
                  evento={e}
                  accountAlias={accountAlias}
                />
              ))}
            </Section>
          )}

          {eventosMes.length === 0 && (
            <div
              style={{
                padding: '40px 12px',
                textAlign: 'center',
                color: 'var(--atlas-v5-ink-4)',
                fontSize: 13,
              }}
            >
              Sin eventos para este mes.
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default MesDetalleDrawer;

// ─── Subcomponentes ─────────────────────────────────────────────────────────

const KpiBlock: React.FC<{
  label: string;
  value: string;
  tone: 'pos' | 'neg';
  last?: boolean;
}> = ({ label, value, tone, last }) => (
  <div
    style={{
      padding: '0 14px',
      borderRight: last ? 'none' : '1px solid var(--atlas-v5-line-2)',
    }}
  >
    <div
      style={{
        fontSize: 9.5,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--atlas-v5-ink-4)',
        fontWeight: 700,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
        fontSize: 16,
        fontWeight: 700,
        marginTop: 5,
        color: tone === 'pos' ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)',
      }}
    >
      {value}
    </div>
  </div>
);

const Section: React.FC<{
  title: string;
  tone: 'pos' | 'neg';
  children: React.ReactNode;
}> = ({ title, tone, children }) => (
  <div style={{ marginBottom: 22 }}>
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: tone === 'pos' ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)',
        marginBottom: 10,
        paddingBottom: 6,
        borderBottom: '1px solid var(--atlas-v5-line-2)',
      }}
    >
      {title}
    </div>
    {children}
  </div>
);

const EventoRow: React.FC<{
  evento: MesDrawerEvent;
  accountAlias: Map<number, string>;
}> = ({ evento, accountAlias }) => {
  const isPos = evento.type === 'income';
  const cuenta = evento.accountId != null ? accountAlias.get(evento.accountId) : undefined;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 10,
        padding: '10px 12px',
        border: '1px solid var(--atlas-v5-line-2)',
        borderRadius: 8,
        marginBottom: 6,
        alignItems: 'center',
        background: 'var(--atlas-v5-card)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
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
        </div>
        <div
          style={{
            fontSize: 10.5,
            color: 'var(--atlas-v5-ink-4)',
            marginTop: 2,
            fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
          }}
        >
          {formatDateShort(evento.predictedDate)}
          {cuenta ? ` · ${cuenta}` : ''}
          {evento.status === 'confirmed' || evento.status === 'executed' ? ' · ✓' : ''}
        </div>
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
          fontSize: 13,
          fontWeight: 700,
          color: isPos ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)',
        }}
      >
        {isPos ? '+' : '−'}{formatEur(evento.amount)} €
      </div>
    </div>
  );
};
