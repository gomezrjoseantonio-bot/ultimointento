import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import InmuebleDetalle from './InmuebleDetalle';
import type { InmuebleDetalleData } from './InmuebleDetalle';

export interface DetailRowData {
  label: string;
  value: number;
  accent?: 'positive' | 'negative';
}

export interface SeccionRendimientoProps {
  id: string;
  title: string;
  total: number | null;
  rows?: DetailRowData[];
  inmuebles?: InmuebleDetalleData[];
  sinDatos?: boolean;
  onCompletar?: () => void;
  defaultOpen?: boolean;
}

const fmt = (v: number) =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSigned = (v: number) => `${v >= 0 ? '' : '-'}${fmt(Math.abs(v))} €`;

const monoStyle: React.CSSProperties = {
  fontFamily: 'IBM Plex Mono, monospace',
  fontVariantNumeric: 'tabular-nums',
};

const SeccionRendimiento: React.FC<SeccionRendimientoProps> = ({
  title,
  total,
  rows,
  inmuebles,
  sinDatos = false,
  onCompletar,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const hasDetail = Boolean((rows && rows.length) || (inmuebles && inmuebles.length));
  const canExpand = hasDetail && !sinDatos;

  return (
    <div>
      <button
        type="button"
        onClick={() => canExpand && setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 18px',
          border: 'none',
          borderBottom: '1px solid var(--n-100)',
          background: sinDatos ? 'var(--n-50)' : 'transparent',
          cursor: canExpand ? 'pointer' : 'default',
          minHeight: 44,
          opacity: sinDatos ? 0.7 : 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {canExpand && (
            open
              ? <ChevronDown size={16} style={{ color: 'var(--n-500)' }} />
              : <ChevronRight size={16} style={{ color: 'var(--n-500)' }} />
          )}
          {!canExpand && <div style={{ width: 16 }} />}
          <span style={{
            fontFamily: 'IBM Plex Sans, sans-serif',
            fontSize: 'var(--t-sm, 13px)',
            fontWeight: 500,
            color: sinDatos ? 'var(--n-500)' : 'var(--n-900)',
          }}>
            {title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {sinDatos && onCompletar && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCompletar(); }}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--blue)',
                fontSize: 'var(--t-xs, 11px)',
                fontWeight: 500,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Completar manualmente
            </button>
          )}
          <span style={{
            ...monoStyle,
            fontSize: 'var(--t-sm, 13px)',
            color: sinDatos ? 'var(--n-500)' : 'var(--n-900)',
          }}>
            {total !== null ? fmtSigned(total) : '—'}
          </span>
        </div>
      </button>

      {/* Expanded detail */}
      {canExpand && open && (
        <div style={{
          background: 'var(--n-50)',
          borderBottom: '1px solid var(--n-100)',
          padding: '8px 18px 12px',
        }}>
          {/* Inmuebles sub-sections */}
          {inmuebles?.map((inm, idx) => (
            <InmuebleDetalle key={idx} data={inm} defaultOpen={idx === 0} />
          ))}

          {/* Regular detail rows */}
          {rows?.map((row) => (
            <div key={row.label} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px 0',
              fontSize: 'var(--t-xs, 12px)',
              color: 'var(--n-700)',
            }}>
              <span>{row.label}</span>
              <span style={{
                ...monoStyle,
                color: row.accent === 'positive' ? 'var(--s-pos)'
                  : row.accent === 'negative' ? 'var(--s-neg)'
                  : 'var(--n-700)',
              }}>
                {fmtSigned(row.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SeccionRendimiento;
